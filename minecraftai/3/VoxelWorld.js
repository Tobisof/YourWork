// ============================================================
//  VoxelWorld.js — silnik wokselowy:
//   - proceduralne generowanie terenu (szum Simplex 2D, fBm)
//   - system chunków 16 x 80 x 16 (kolumnowych)
//   - meshowanie z FACE CULLINGIEM (renderowane są wyłącznie
//     ściany graniczące z powietrzem/wodą — jeden zmergowany
//     BufferGeometry na chunk zamiast tysięcy meshy)
//   - raycast wokselowy DDA (Amanatides & Woo)
//   - fizyka AABB współdzielona przez gracza i moby (moveBody)
//   - prosta symulacja rozlewania wody z poziomami
// ============================================================

import * as THREE from 'three';

// ---------- Identyfikatory bloków ----------
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  BEDROCK: 6,
  WATER: 7,
  SAND: 8,
};

// ---------- Kafelki w atlasie tekstur ----------
export const TILES = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, WOOD_SIDE: 4,
  WOOD_TOP: 5, LEAVES: 6, BEDROCK: 7, SAND: 8, WATER: 9, PORKCHOP: 10,
};
const ATLAS_COLS = 16; // szerokość atlasu w kafelkach (16 x 16 px każdy)

const CHUNK = 16;   // rozmiar chunka w poziomie
const HEIGHT = 80;  // wysokość świata

// ============================================================
//  Szum Simplex 2D (implementacja wg Stefana Gustavsona),
//  z możliwością seedowania — brak zależności zewnętrznych.
// ============================================================
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

class SimplexNoise2D {
  constructor(random = Math.random) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Tasowanie Fishera-Yatesa tabeli permutacji
    for (let i = 255; i > 0; i--) {
      const j = (random() * (i + 1)) | 0;
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise(xin, yin) {
    const F2 = 0.3660254037844386;  // (sqrt(3)-1)/2
    const G2 = 0.21132486540518713; // (3-sqrt(3))/6
    const perm = this.perm;
    let n0 = 0, n1 = 0, n2 = 0;

    // Przekształcenie do siatki simpleksów
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);

    // Wybór trójkąta (górny/dolny simpleks)
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const g = GRAD2[perm[ii + perm[jj]] % 8];
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const g = GRAD2[perm[ii + i1 + perm[jj + j1]] % 8];
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const g = GRAD2[perm[ii + 1 + perm[jj + 1]] % 8];
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    // Skalowanie do zakresu ok. [-1, 1]
    return 70.14 * (n0 + n1 + n2);
  }
}

// Fraktalny szum (fBm) — suma oktaw o malejącej amplitudzie
function fbm(noise, x, y, octaves) {
  let value = 0, amplitude = 1, frequency = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    value += noise.noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

// Deterministyczny hash 2D -> [0,1) — do rozmieszczania drzew
function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 144269);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ============================================================
//  Atlas tekstur generowany w Canvas API (zero plików PNG).
//  Każdy kafelek to 16x16 px z pikselowym "szumem" jasności.
// ============================================================
function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Deterministyczny generator — atlas zawsze wygląda tak samo
  let rngState = 987654321;
  const rnd = () => {
    rngState = (Math.imul(rngState, 1103515245) + 12345) >>> 0;
    return rngState / 4294967296;
  };

  const shade = (hex, f) => {
    const r = Math.min(255, (((hex >> 16) & 255) * f) | 0);
    const g = Math.min(255, (((hex >> 8) & 255) * f) | 0);
    const b = Math.min(255, ((hex & 255) * f) | 0);
    return `rgb(${r},${g},${b})`;
  };

  const px = (tile, x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(tile * 16 + x, y, 1, 1);
  };

  // Wypełnienie kafelka kolorem bazowym z losową wariacją jasności
  const fillNoise = (tile, base, fMin, fMax) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        px(tile, x, y, shade(base, fMin + rnd() * (fMax - fMin)));
  };

  // Żywe, nasycone kolory w stylu "Vanilla Minecraft"
  fillNoise(TILES.GRASS_TOP, 0x5ec93e, 0.88, 1.08);
  fillNoise(TILES.DIRT, 0x9b6a44, 0.85, 1.05);
  fillNoise(TILES.STONE, 0x9a9a9a, 0.85, 1.05);
  fillNoise(TILES.BEDROCK, 0x565656, 0.45, 1.25);
  fillNoise(TILES.SAND, 0xeadfa0, 0.92, 1.05);
  fillNoise(TILES.WATER, 0x4a86e8, 0.92, 1.06);

  // Bok trawy: ziemia + nierówny zielony pas u góry
  fillNoise(TILES.GRASS_SIDE, 0x9b6a44, 0.85, 1.05);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + ((rnd() * 2) | 0);
    for (let y = 0; y < depth; y++)
      px(TILES.GRASS_SIDE, x, y, shade(0x5ec93e, 0.85 + rnd() * 0.2));
  }

  // Bok drewna: pionowe słoje
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const stripe = x % 4 === 0 ? 0.7 : 1.0;
      px(TILES.WOOD_SIDE, x, y, shade(0x7a5230, stripe * (0.9 + rnd() * 0.15)));
    }

  // Przekrój pnia: pierścienie
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const f = ring > 6.5 ? 0.75 : ring > 4.5 ? 1.1 : ring > 2.5 ? 0.85 : 1.05;
      px(TILES.WOOD_TOP, x, y, shade(0x8a6238, f * (0.92 + rnd() * 0.12)));
    }

  // Liście: soczysta zieleń z ciemniejszymi "dziurami"
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const f = rnd() < 0.18 ? 0.55 : 0.85 + rnd() * 0.3;
      px(TILES.LEAVES, x, y, shade(0x3fae3f, f));
    }

  // "Surowa schabowa" — ikona do hotbara i item dropu
  for (let y = 2; y < 12; y++)
    for (let x = 4; x < 13; x++)
      px(TILES.PORKCHOP, x, y, shade(0xf08a98, 0.85 + rnd() * 0.25));
  for (let y = 11; y < 15; y++)
    for (let x = 2; x < 6; x++)
      px(TILES.PORKCHOP, x, y, shade(0xf5f0dc, 0.9 + rnd() * 0.1));

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // pikselowy wygląd
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture };
}

// Mapowanie blok + kierunek ściany (dy) -> kafelek atlasu
function faceTile(block, dy) {
  switch (block) {
    case BLOCK.GRASS: return dy > 0 ? TILES.GRASS_TOP : dy < 0 ? TILES.DIRT : TILES.GRASS_SIDE;
    case BLOCK.DIRT: return TILES.DIRT;
    case BLOCK.STONE: return TILES.STONE;
    case BLOCK.WOOD: return dy !== 0 ? TILES.WOOD_TOP : TILES.WOOD_SIDE;
    case BLOCK.LEAVES: return TILES.LEAVES;
    case BLOCK.BEDROCK: return TILES.BEDROCK;
    case BLOCK.SAND: return TILES.SAND;
    case BLOCK.WATER: return TILES.WATER;
    default: return TILES.STONE;
  }
}

// ---------- Definicje 6 ścian sześcianu ----------
// "shade" to zapieczona w vertex colors prosta symulacja oświetlenia
// kierunkowego (góra jasna, dół ciemny) — tania alternatywa dla cieni.
const FACES = [
  { dir: [-1, 0, 0], shade: 0.75, corners: [{ pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] }] },
  { dir: [1, 0, 0],  shade: 0.75, corners: [{ pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] }] },
  { dir: [0, -1, 0], shade: 0.55, corners: [{ pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] }] },
  { dir: [0, 1, 0],  shade: 1.00, corners: [{ pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] }] },
  { dir: [0, 0, -1], shade: 0.85, corners: [{ pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] }] },
  { dir: [0, 0, 1],  shade: 0.85, corners: [{ pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] }] },
];

// ============================================================
//  Świat wokselowy
// ============================================================
export class VoxelWorld {
  constructor(scene, seed = 20260612) {
    this.scene = scene;
    this.seed = seed;
    this.SEA = 30;            // poziom morza (powierzchnia wody na y = SEA-1)
    this.renderDistance = 4;  // promień meshowanych chunków

    this.chunks = new Map();  // "cx,cz" -> Uint8Array (dane bloków, trzymane na zawsze — edycje gracza nie giną)
    this.meshes = new Map();  // "cx,cz" -> { solid, water }
    this.meshQueue = [];      // chunki czekające na zbudowanie geometrii
    this.queued = new Set();
    this.dirty = new Set();   // chunki do przebudowania po edycji

    const rand = mulberry32(seed);
    this.noiseA = new SimplexNoise2D(rand); // kontynenty / detale
    this.noiseB = new SimplexNoise2D(rand); // góry

    const atlas = makeAtlas();
    this.atlasCanvas = atlas.canvas; // udostępniane UI (ikony hotbara)
    this.solidMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
    });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,       // poprawne mieszanie przezroczystości
      side: THREE.DoubleSide,  // woda widoczna też od środka
    });

    // Symulacja wody: poziom 8 = źródło, rozlewa się do poziomu 1
    this.waterLevels = new Map(); // "x,y,z" -> poziom (brak wpisu = 8, woda z generatora)
    this.waterQueue = new Set();  // komórki do przeliczenia w następnym ticku
    this.waterTimer = 0;
  }

  // ---------- Pomocnicze ----------
  key(cx, cz) { return `${cx},${cz}`; }
  blockKey(x, y, z) { return `${x},${y},${z}`; }
  isSolid(block) { return block !== BLOCK.AIR && block !== BLOCK.WATER; }

  getBlock(x, y, z) {
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    // Niewygenerowany chunk traktujemy jak litą skałę — nikt nie
    // wypadnie poza świat i raycast nie poleci w nieskończoność.
    if (!data) return BLOCK.BEDROCK;
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    return data[(y * CHUNK + lz) * CHUNK + lx];
  }

  setBlock(x, y, z, block) {
    if (y < 0 || y >= HEIGHT) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return;
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    data[(y * CHUNK + lz) * CHUNK + lx] = block;

    this.waterLevels.delete(this.blockKey(x, y, z));

    // Przebudowa chunka + sąsiadów, jeśli edycja na granicy
    // (ich face culling zależy od tego bloku)
    this.dirty.add(this.key(cx, cz));
    if (lx === 0) this.dirty.add(this.key(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirty.add(this.key(cx + 1, cz));
    if (lz === 0) this.dirty.add(this.key(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirty.add(this.key(cx, cz + 1));

    // Każda zmiana może uruchomić przepływ wody w sąsiedztwie
    this.scheduleWaterAround(x, y, z);
  }

  // ---------- Generowanie terenu ----------
  columnHeight(x, z) {
    // Baza: łagodne wzgórza i doliny (4 oktawy fBm)
    const e = fbm(this.noiseA, x * 0.0045, z * 0.0045, 4);
    let h = this.SEA - 2 + e * 11;
    // Góry: niska częstotliwość, działa tylko powyżej progu
    const m = fbm(this.noiseB, x * 0.0016, z * 0.0016, 3);
    if (m > 0.2) h += (m - 0.2) * 60;
    // Drobny detal powierzchni
    h += fbm(this.noiseA, x * 0.05, z * 0.05, 2) * 2;
    return Math.max(3, Math.min(HEIGHT - 6, Math.floor(h)));
  }

  ensureChunkData(cx, cz) {
    const k = this.key(cx, cz);
    if (!this.chunks.has(k)) this.chunks.set(k, this.generateChunk(cx, cz));
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const set = (lx, y, lz, b) => { data[(y * CHUNK + lz) * CHUNK + lx] = b; };
    const get = (lx, y, lz) => data[(y * CHUNK + lz) * CHUNK + lx];

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = cx * CHUNK + lx;
        const z = cz * CHUNK + lz;
        const h = this.columnHeight(x, z);
        const beach = h <= this.SEA + 1; // piasek przy wodzie i pod nią

        set(lx, 0, lz, BLOCK.BEDROCK); // niezniszczalne dno świata
        for (let y = 1; y < h; y++) {
          if (y < h - 4) set(lx, y, lz, BLOCK.STONE);
          else if (y < h - 1) set(lx, y, lz, BLOCK.DIRT);
          else set(lx, y, lz, beach ? BLOCK.SAND : BLOCK.GRASS);
        }
        // Wypełnienie oceanów/jezior do poziomu morza
        for (let y = h; y < this.SEA; y++) set(lx, y, lz, BLOCK.WATER);
      }
    }

    // Drzewa — tylko w głębi chunka (margines 2), żeby korona
    // nigdy nie wystawała do sąsiedniego chunka
    for (let lz = 2; lz < CHUNK - 2; lz++) {
      for (let lx = 2; lx < CHUNK - 2; lx++) {
        const x = cx * CHUNK + lx;
        const z = cz * CHUNK + lz;
        const r = hash2(x, z, this.seed);
        if (r >= 0.012) continue;
        const h = this.columnHeight(x, z);
        if (get(lx, h - 1, lz) !== BLOCK.GRASS) continue;

        const trunkH = 4 + ((r * 1000) | 0) % 2; // 4-5 bloków pnia
        if (h + trunkH + 2 >= HEIGHT) continue;

        for (let y = h; y < h + trunkH; y++) set(lx, y, lz, BLOCK.WOOD);

        // Korona: dwie szerokie warstwy + dwie wąskie na szczycie
        for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
          const radius = dy <= trunkH - 1 ? 2 : 1;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              // Losowe ścinanie narożników korony
              if (Math.abs(dx) === radius && Math.abs(dz) === radius &&
                  hash2(x + dx * 31, z + dz * 17 + dy, this.seed) > 0.4) continue;
              const y = h + dy;
              if (get(lx + dx, y, lz + dz) === BLOCK.AIR) set(lx + dx, y, lz + dz, BLOCK.LEAVES);
            }
          }
        }
      }
    }
    return data;
  }

  // Najniższe wolne y, na którym może stanąć jednostka (generuje dane w razie potrzeby)
  getHeightAt(x, z) {
    this.ensureChunkData(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (this.isSolid(this.getBlock(Math.floor(x), y, Math.floor(z)))) return y + 1;
    }
    return 1;
  }

  // ---------- Zarządzanie chunkami wokół gracza ----------
  update(playerPos) {
    const pcx = Math.floor(playerPos.x / CHUNK);
    const pcz = Math.floor(playerPos.z / CHUNK);
    const R = this.renderDistance;

    // Dane terenu o 1 chunk dalej niż meshowanie — face culling na
    // granicach chunków potrzebuje danych sąsiada
    for (let dz = -R - 1; dz <= R + 1; dz++)
      for (let dx = -R - 1; dx <= R + 1; dx++)
        this.ensureChunkData(pcx + dx, pcz + dz);

    // Kolejkowanie brakujących meshy, najbliższe najpierw
    const wanted = [];
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        const k = this.key(pcx + dx, pcz + dz);
        if (!this.meshes.has(k) && !this.queued.has(k))
          wanted.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz });
      }
    wanted.sort((a, b) => a.d - b.d);
    for (const w of wanted) {
      this.queued.add(this.key(w.cx, w.cz));
      this.meshQueue.push(w);
    }

    // Usuwanie meshy poza zasięgiem (dane bloków zostają w pamięci)
    for (const k of [...this.meshes.keys()]) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > R + 1)
        this.disposeChunkMesh(k);
    }
  }

  // Budżetowane budowanie meshy — max kilka na klatkę, żeby uniknąć ścinek
  processQueue(maxBuilds = 2) {
    let n = 0;
    for (const k of this.dirty) {
      this.dirty.delete(k);
      const [cx, cz] = k.split(',').map(Number);
      if (this.chunks.has(k)) this.buildChunkMesh(cx, cz);
      if (++n >= 4) break;
    }
    let built = 0;
    while (built < maxBuilds && this.meshQueue.length > 0) {
      const { cx, cz } = this.meshQueue.shift();
      const k = this.key(cx, cz);
      this.queued.delete(k);
      if (!this.meshes.has(k)) {
        this.buildChunkMesh(cx, cz);
        built++;
      }
    }
  }

  // Synchroniczne zbudowanie wszystkiego z kolejki (start gry)
  forceBuild() {
    while (this.meshQueue.length > 0 || this.dirty.size > 0) this.processQueue(Infinity);
  }

  disposeChunkMesh(k) {
    const entry = this.meshes.get(k);
    if (!entry) return;
    for (const mesh of [entry.solid, entry.water]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.delete(k);
  }

  // ---------- Meshowanie chunka (FACE CULLING) ----------
  // Dla każdego bloku sprawdzamy 6 sąsiadów. Ściana jest emitowana
  // TYLKO wtedy, gdy sąsiad nie jest lity (powietrze/woda). Wnętrza
  // terenu nie generują żadnej geometrii — to redukuje liczbę
  // trójkątów o ~95% i pozwala trzymać stabilne 60 FPS.
  buildChunkMesh(cx, cz) {
    const k = this.key(cx, cz);
    const data = this.chunks.get(k);
    if (!data) return;
    this.disposeChunkMesh(k);

    const solid = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const water = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const uvw = 1 / ATLAS_COLS;

    for (let y = 0; y < HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const block = data[(y * CHUNK + lz) * CHUNK + lx];
          if (block === BLOCK.AIR) continue;
          const wx = cx * CHUNK + lx;
          const wz = cz * CHUNK + lz;
          const isWater = block === BLOCK.WATER;
          // Powierzchnia wody jest lekko obniżona (jak w MC),
          // chyba że nad nią jest kolejna woda
          const topY = isWater && this.getBlock(wx, y + 1, wz) !== BLOCK.WATER ? 0.875 : 1;

          for (const face of FACES) {
            const neighbor = this.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
            if (isWater) {
              // Woda rysuje ściany tylko na styku z powietrzem
              if (neighbor !== BLOCK.AIR) continue;
            } else {
              // FACE CULLING: ściana przy litym sąsiedzie jest niewidoczna
              if (this.isSolid(neighbor)) continue;
            }

            const target = isWater ? water : solid;
            const tile = faceTile(block, face.dir[1]);
            const base = target.pos.length / 3;

            for (const c of face.corners) {
              const cy = isWater ? (c.pos[1] === 1 ? topY : 0) : c.pos[1];
              target.pos.push(lx + c.pos[0], y + cy, lz + c.pos[2]);
              target.norm.push(face.dir[0], face.dir[1], face.dir[2]);
              target.uv.push((tile + c.uv[0]) * uvw, c.uv[1]);
              target.col.push(face.shade, face.shade, face.shade);
            }
            target.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }

    const entry = { solid: null, water: null };
    const build = (arrays, material) => {
      if (arrays.idx.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arrays.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(arrays.col, 3));
      geo.setIndex(arrays.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
      this.scene.add(mesh);
      return mesh;
    };
    entry.solid = build(solid, this.solidMaterial);
    entry.water = build(water, this.waterMaterial);
    this.meshes.set(k, entry);
  }

  // ---------- Raycast wokselowy (DDA / Amanatides & Woo) ----------
  // Zamiast testować trójkąty (wolne przy zmergowanej geometrii),
  // maszerujemy promieniem po siatce wokseli komórka po komórce.
  // Algorytm utrzymuje tMaxX/Y/Z — odległości do najbliższej granicy
  // komórki na każdej osi — i zawsze przekracza najbliższą z nich.
  // Normalna trafienia wynika z osi, którą właśnie przekroczyliśmy.
  raycast(origin, direction, maxDist = 8) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = direction.x > 0 ? 1 : -1;
    const stepY = direction.y > 0 ? 1 : -1;
    const stepZ = direction.z > 0 ? 1 : -1;

    const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX = direction.x !== 0 ? (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX : Infinity;
    let tMaxY = direction.y !== 0 ? (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY : Infinity;
    let tMaxZ = direction.z !== 0 ? (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ : Infinity;

    let nx = 0, ny = 0, nz = 0;
    let t = 0;

    while (t <= maxDist) {
      const block = this.getBlock(x, y, z);
      // Woda i powietrze są "przezroczyste" dla promienia
      if (this.isSolid(block)) return { x, y, z, nx, ny, nz, block, dist: t };

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX;
        nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
        nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  // ---------- Fizyka AABB (gracz, moby, item dropy) ----------
  // body: { position (środek stóp), velocity, width, height, onGround, hitWall }
  // Ruch rozbijamy na osie X -> Z -> Y i każdą oś rozwiązujemy osobno:
  // po przesunięciu sprawdzamy woksele przecinające AABB i odpychamy
  // ciało do ściany woksela. Substepy zapobiegają tunelowaniu przy
  // dużych prędkościach (np. długi upadek).
  moveBody(body, dt) {
    body.onGround = false;
    body.hitWall = false;
    const maxMove = Math.max(
      Math.abs(body.velocity.x), Math.abs(body.velocity.y), Math.abs(body.velocity.z)
    ) * dt;
    const steps = Math.max(1, Math.ceil(maxMove / 0.4));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.#moveAxis(body, 'x', body.velocity.x * sdt);
      this.#moveAxis(body, 'z', body.velocity.z * sdt);
      this.#moveAxis(body, 'y', body.velocity.y * sdt);
    }
  }

  #moveAxis(body, axis, dist) {
    if (dist === 0) return;
    const p = body.position;
    p[axis] += dist;

    const half = body.width / 2;
    const E = 0.001;
    const minX = Math.floor(p.x - half + E);
    const maxX = Math.floor(p.x + half - E);
    const minY = Math.floor(p.y + E);
    const maxY = Math.floor(p.y + body.height - E);
    const minZ = Math.floor(p.z - half + E);
    const maxZ = Math.floor(p.z + half - E);

    for (let vy = minY; vy <= maxY; vy++) {
      for (let vz = minZ; vz <= maxZ; vz++) {
        for (let vx = minX; vx <= maxX; vx++) {
          if (!this.isSolid(this.getBlock(vx, vy, vz))) continue;
          // Kolizja — odpychamy ciało do płaszczyzny woksela
          if (axis === 'y') {
            if (dist < 0) { p.y = vy + 1 + E; body.onGround = true; }
            else p.y = vy - body.height - E;
          } else if (axis === 'x') {
            p.x = dist > 0 ? vx - half - E : vx + 1 + half + E;
            body.hitWall = true;
          } else {
            p.z = dist > 0 ? vz - half - E : vz + 1 + half + E;
            body.hitWall = true;
          }
          body.velocity[axis] = 0;
          return;
        }
      }
    }
  }

  // ---------- Symulacja wody ----------
  // Każda komórka wody ma poziom 1-8 (8 = źródło / woda z generatora).
  // Woda zawsze spływa w dół (pełnym poziomem), a po podłożu rozlewa
  // się na boki z poziomem o 1 mniejszym, aż do wyczerpania (poziom 1).
  scheduleWaterAround(x, y, z) {
    const candidates = [
      [x, y, z], [x + 1, y, z], [x - 1, y, z],
      [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1],
    ];
    for (const [cx, cy, cz] of candidates) {
      if (this.getBlock(cx, cy, cz) === BLOCK.WATER)
        this.waterQueue.add(this.blockKey(cx, cy, cz));
    }
  }

  tickWater(dt) {
    this.waterTimer += dt;
    if (this.waterTimer < 0.25) return; // tick wody co 250 ms
    this.waterTimer = 0;
    if (this.waterQueue.size === 0) return;

    // Budżet na tick, żeby wielka powódź nie zabiła klatek
    const cells = [...this.waterQueue].slice(0, 300);
    for (const key of cells) {
      this.waterQueue.delete(key);
      const [x, y, z] = key.split(',').map(Number);
      if (this.getBlock(x, y, z) !== BLOCK.WATER) continue;
      const level = this.waterLevels.get(key) ?? 8;

      const below = this.getBlock(x, y - 1, z);
      if (below === BLOCK.AIR) {
        // Spadek w dół — woda spadająca odzyskuje pełny poziom
        this.setBlock(x, y - 1, z, BLOCK.WATER);
        this.waterLevels.set(this.blockKey(x, y - 1, z), 8);
      } else if (below !== BLOCK.WATER && level > 1) {
        // Rozlewanie po podłożu na 4 strony, poziom maleje o 1
        const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of sides) {
          if (this.getBlock(x + dx, y, z + dz) === BLOCK.AIR) {
            this.setBlock(x + dx, y, z + dz, BLOCK.WATER);
            this.waterLevels.set(this.blockKey(x + dx, y, z + dz), level - 1);
          }
        }
      }
    }
  }
}
