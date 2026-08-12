import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// ===================================================================
//  STALE SWIATA
// ===================================================================

// Rozmiar chunka w blokach (X i Z). Wysokosc swiata jest stala dla
// kazdego chunka, co znacznie upraszcza generowanie i renderowanie
// (nie musimy laczyc chunkow w stosy w osi Y).
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 48;

// Promien (w chunkach) wokol gracza, ktory jest wczytany i renderowany.
export const RENDER_DISTANCE = 4;

// Identyfikatory typow blokow.
export const BLOCK = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    BEDROCK: 6,
};

// Kolory poszczegolnych scian dla kazdego typu bloku (wartosci 0-1 dla Three.Color).
// "all" = kolor uzywany dla wszystkich scian, "py"/"ny"/"side" = gora/dol/boki.
const BLOCK_COLORS = {
    [BLOCK.GRASS]: { py: [0.45, 0.82, 0.27], ny: [0.5, 0.36, 0.2], side: [0.5, 0.62, 0.27] },
    [BLOCK.DIRT]: { all: [0.55, 0.38, 0.22] },
    [BLOCK.STONE]: { all: [0.64, 0.64, 0.66] },
    [BLOCK.WOOD]: { py: [0.66, 0.5, 0.3], ny: [0.66, 0.5, 0.3], side: [0.48, 0.33, 0.17] },
    [BLOCK.LEAVES]: { all: [0.3, 0.7, 0.22] },
    [BLOCK.BEDROCK]: { all: [0.15, 0.15, 0.17] },
};

// Definicje 6 scian szescianu. Kazda sciana ma:
//  - dir: wektor normalny (kierunek, w ktorym znajduje sie sasiad do sprawdzenia)
//  - corners: 4 wierzcholki sciany (wzgledem naroznika bloku 0,0,0) w kolejnosci,
//             ktora daje prawidlowo skierowana (CCW) normalna "na zewnatrz"
//  - face: nazwa uzywana do wyboru koloru ("py" = +Y / gora, "ny" = -Y / dol, "side" = bok)
const FACES = [
    { dir: [1, 0, 0], face: 'side', corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, // +X
    { dir: [-1, 0, 0], face: 'side', corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] }, // -X
    { dir: [0, 1, 0], face: 'py', corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, // +Y (gora)
    { dir: [0, -1, 0], face: 'ny', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] }, // -Y (dol)
    { dir: [0, 0, 1], face: 'side', corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, // +Z
    { dir: [0, 0, -1], face: 'side', corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }, // -Z
];

// Indeksy trojkatow dla kazdej sciany (2 trojkaty = 1 quad).
const FACE_INDICES = [0, 1, 2, 0, 2, 3];

/**
 * Prosty, deterministyczny generator pseudo-losowy oparty na funkcji sin.
 * Uzywany do rozmieszczania drzew - zawsze daje ten sam wynik dla tych
 * samych wspolrzednych, dzieki czemu swiat jest stabilny.
 */
function hashRandom(x, z, seed) {
    const v = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
    return v - Math.floor(v);
}

/**
 * Pojedynczy chunk swiata. Przechowuje surowe dane wokseli w plaskiej tablicy
 * Uint8Array oraz wygenerowany mesh (geometria po face-cullingu).
 */
class Chunk {
    constructor(cx, cz) {
        this.cx = cx;
        this.cz = cz;
        this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.mesh = null;
    }

    index(x, y, z) {
        return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    }

    get(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) {
            return BLOCK.AIR;
        }
        return this.data[this.index(x, y, z)];
    }

    set(x, y, z, value) {
        this.data[this.index(x, y, z)] = value;
    }
}

/**
 * Glowna klasa swiata wokselowego. Zarzadza chunkami: proceduralnym
 * generowaniem terenu, budowaniem zoptymalizowanych mesh-y (face culling +
 * scalona geometria - jeden draw call na chunk) oraz odpytywaniem o bloki
 * na potrzeby fizyki i raycastingu.
 */
export class VoxelWorld {
    constructor(scene) {
        this.scene = scene;
        this.noise = new ImprovedNoise();

        // Mapa wczytanych chunkow: klucz "cx,cz" -> Chunk
        this.chunks = new Map();

        // Zbior chunkow, ktore wymagaja (ponownego) zbudowania mesh-a.
        this.dirty = new Set();

        // Wspolny material dla wszystkich chunkow - kolory pochodza
        // z atrybutu "color" geometrii (vertex colors), wiec nie
        // potrzebujemy zewnetrznych tekstur.
        this.material = new THREE.MeshLambertMaterial({ vertexColors: true });

        // Grupa, do ktorej dodawane sa wszystkie mesh-e chunkow.
        this.group = new THREE.Group();
        this.scene.add(this.group);
    }

    // ---------------------------------------------------------------
    //  POMOCNICZE
    // ---------------------------------------------------------------

    chunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    markDirty(cx, cz) {
        const key = this.chunkKey(cx, cz);
        if (this.chunks.has(key)) {
            this.dirty.add(key);
        }
    }

    /**
     * Zwraca typ bloku w globalnych wspolrzednych swiata.
     * Jezeli chunk nie jest wczytany lub wspolrzedna Y jest poza swiatem,
     * traktujemy blok jako AIR (powietrze) - dziala to dobrze przy
     * face cullingu na granicach wczytanego obszaru (brak "dziur").
     */
    getBlock(x, y, z) {
        if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.chunkKey(cx, cz));
        if (!chunk) return BLOCK.AIR;
        const lx = x - cx * CHUNK_SIZE;
        const lz = z - cz * CHUNK_SIZE;
        return chunk.get(lx, y, lz);
    }

    /** Czy dany punkt swiata jest "pelny" (kolizyjny)? */
    isSolid(x, y, z) {
        return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) !== BLOCK.AIR;
    }

    /**
     * Sprawdza kolizje prostopadloscianu (AABB) z wokselami swiata.
     * `pos` to punkt na srodku dolnej podstawy prostopadloscianu (stopy
     * gracza/moba), `halfWidth` to polowa szerokosci w X/Z, `height` to
     * wysokosc. Zwraca true, jezeli prostopadlosocian przecina sie z
     * jakimkolwiek nie-powietrznym blokiem - uzywane przez Player i Mob
     * do wykrywania kolizji (AABB) podczas ruchu.
     */
    checkCollision(pos, halfWidth, height) {
        const epsilon = 1e-9;
        const minX = Math.floor(pos.x - halfWidth);
        const maxX = Math.floor(pos.x + halfWidth - epsilon);
        const minY = Math.floor(pos.y);
        const maxY = Math.floor(pos.y + height - epsilon);
        const minZ = Math.floor(pos.z - halfWidth);
        const maxZ = Math.floor(pos.z + halfWidth - epsilon);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.isSolid(x, y, z)) return true;
                }
            }
        }
        return false;
    }

    /**
     * Ustawia typ bloku w globalnych wspolrzednych i natychmiast
     * przebudowuje wplywane chunki (wlasny + sasiednie, jezeli blok
     * znajduje sie na granicy chunka).
     */
    setBlock(x, y, z, type) {
        if (y < 0 || y >= CHUNK_HEIGHT) return;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks.get(this.chunkKey(cx, cz));
        if (!chunk) return;

        const lx = x - cx * CHUNK_SIZE;
        const lz = z - cz * CHUNK_SIZE;
        chunk.set(lx, y, lz, type);

        this.markDirty(cx, cz);
        // Jezeli zmodyfikowany blok lezy na granicy chunka, sasiad rowniez
        // musi przebudowac swoja geometrie (zmienia sie jego face culling).
        if (lx === 0) this.markDirty(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
        if (lz === 0) this.markDirty(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);

        // Modyfikacje blokow przez gracza wymagaja natychmiastowej reakcji
        // wizualnej, wiec przebudowujemy oznaczone chunki od razu.
        this.processDirtyChunks(Infinity);
    }

    // ---------------------------------------------------------------
    //  GENEROWANIE TERENU
    // ---------------------------------------------------------------

    /** Wysokosc terenu (warstwa trawy) dla danej kolumny swiata. */
    getSurfaceHeight(x, z) {
        const large = this.noise.noise(x * 0.01, z * 0.01, 0); // duze wzgorza/doliny
        const detail = this.noise.noise(x * 0.05, z * 0.05, 100) * 0.35; // mniejsze detale
        const h = (large + detail) * 12;
        return Math.max(2, Math.min(CHUNK_HEIGHT - 10, Math.floor(18 + h)));
    }

    /**
     * Generuje surowe dane wokselow dla chunka (cx, cz): wypelnia kolumny
     * blokow na podstawie mapy wysokosci szumu Perlina/Simplex oraz
     * rozmieszcza drzewa.
     */
    generateChunkData(cx, cz) {
        const key = this.chunkKey(cx, cz);
        if (this.chunks.has(key)) return;

        const chunk = new Chunk(cx, cz);
        const originX = cx * CHUNK_SIZE;
        const originZ = cz * CHUNK_SIZE;

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = originX + lx;
                const wz = originZ + lz;
                const height = this.getSurfaceHeight(wx, wz);

                for (let y = 0; y <= height && y < CHUNK_HEIGHT; y++) {
                    let type;
                    if (y === 0) {
                        type = BLOCK.BEDROCK;
                    } else if (y === height) {
                        type = BLOCK.GRASS;
                    } else if (y >= height - 3) {
                        type = BLOCK.DIRT;
                    } else {
                        type = BLOCK.STONE;
                    }
                    chunk.set(lx, y, lz, type);
                }
            }
        }

        // Drugi przebieg: rozmieszczenie drzew. Ograniczamy obszar do
        // wnetrza chunka (z marginesem 2 blokow), aby cale drzewo
        // (pien + korona) zawsze pomieszczalo sie w danych tego chunka
        // bez konieczności modyfikowania sasiadow.
        for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
            for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
                const wx = originX + lx;
                const wz = originZ + lz;
                const height = this.getSurfaceHeight(wx, wz);
                if (height < 3 || height >= CHUNK_HEIGHT - 8) continue;

                if (chunk.get(lx, height, lz) === BLOCK.GRASS && hashRandom(wx, wz, 7) < 0.01) {
                    this.placeTree(chunk, lx, height, lz);
                }
            }
        }

        this.chunks.set(key, chunk);

        // Nowy chunk wymaga zbudowania mesh-a. Sasiedzi (jezeli istnieja)
        // rowniez musza zostac przebudowani, bo wczesniej traktowali
        // ten obszar jako powietrze (brak chunka => face culling rysowal
        // ich graniczne sciany).
        this.dirty.add(key);
        this.markDirty(cx + 1, cz);
        this.markDirty(cx - 1, cz);
        this.markDirty(cx, cz + 1);
        this.markDirty(cx, cz - 1);
    }

    /** Tworzy prosty model drzewa: pien z drewna + korona z listowia. */
    placeTree(chunk, lx, baseY, lz) {
        const trunkHeight = 3 + Math.floor(hashRandom(lx, lz, 99) * 2); // 3-4 bloki
        for (let i = 1; i <= trunkHeight; i++) {
            if (baseY + i < CHUNK_HEIGHT) {
                chunk.set(lx, baseY + i, lz, BLOCK.WOOD);
            }
        }

        // Korona drzewa - kilka warstw listowia wokol wierzcholka pnia.
        const topY = baseY + trunkHeight;
        for (let dy = -1; dy <= 1; dy++) {
            const radius = dy === 1 ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius === 2) continue; // zaokraglenie naroznikow
                    const x = lx + dx;
                    const z = lz + dz;
                    const y = topY + dy;
                    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y >= CHUNK_HEIGHT) continue;
                    if (chunk.get(x, y, z) === BLOCK.AIR) {
                        chunk.set(x, y, z, BLOCK.LEAVES);
                    }
                }
            }
        }
        // Wierzcholek korony.
        if (topY + 2 < CHUNK_HEIGHT) chunk.set(lx, topY + 2, lz, BLOCK.LEAVES);
    }

    // ---------------------------------------------------------------
    //  BUDOWANIE MESH-A (FACE CULLING + SCALONA GEOMETRIA)
    // ---------------------------------------------------------------

    /**
     * Buduje (lub przebudowuje) geometrie chunka.
     *
     * KLUCZOWA OPTYMALIZACJA: zamiast tworzyc osobny obiekt Mesh dla kazdego
     * blocku (co dla swiata 16x48x16 dawaloby tysiace obiektow i drastycznie
     * obnizyloby FPS), iterujemy po wszystkich blokach chunka i dla kazdej
     * z 6 scian sprawdzamy, czy sasiadujacy blok jest powietrzem (face
     * culling). Jezeli tak - dodajemy 4 wierzcholki i 2 trojkaty tej sciany
     * do wspolnych tablic. Na koniec cala geometria chunka trafia do JEDNEJ
     * scalonej BufferGeometry i jest renderowana jednym wywolaniem rysowania
     * (jeden Mesh na chunk). Ukryte, wewnetrzne sciany nigdy nie powstaja.
     */
    buildChunkMesh(cx, cz) {
        const chunk = this.chunks.get(this.chunkKey(cx, cz));
        if (!chunk) return;

        const positions = [];
        const normals = [];
        const colors = [];
        const indices = [];

        const originX = cx * CHUNK_SIZE;
        const originZ = cz * CHUNK_SIZE;

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    const block = chunk.get(lx, y, lz);
                    if (block === BLOCK.AIR) continue;

                    const wx = originX + lx;
                    const wz = originZ + lz;
                    const palette = BLOCK_COLORS[block];

                    for (const f of FACES) {
                        const nx = wx + f.dir[0];
                        const ny = y + f.dir[1];
                        const nz = wz + f.dir[2];

                        // Face culling: rysujemy sciane TYLKO gdy sasiad jest powietrzem.
                        if (this.getBlock(nx, ny, nz) !== BLOCK.AIR) continue;

                        const color = palette[f.face] || palette.all;
                        const vertexStart = positions.length / 3;

                        for (const corner of f.corners) {
                            positions.push(lx + corner[0], y + corner[1], lz + corner[2]);
                            normals.push(f.dir[0], f.dir[1], f.dir[2]);
                            colors.push(color[0], color[1], color[2]);
                        }

                        for (const idx of FACE_INDICES) {
                            indices.push(vertexStart + idx);
                        }
                    }
                }
            }
        }

        let geometry = chunk.mesh ? chunk.mesh.geometry : new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();

        if (!chunk.mesh) {
            chunk.mesh = new THREE.Mesh(geometry, this.material);
            chunk.mesh.position.set(originX, 0, originZ);
            this.group.add(chunk.mesh);
        }
    }

    /** Przetwarza maksymalnie `limit` chunkow oznaczonych jako "dirty". */
    processDirtyChunks(limit) {
        let processed = 0;
        for (const key of this.dirty) {
            const [cx, cz] = key.split(',').map(Number);
            this.buildChunkMesh(cx, cz);
            this.dirty.delete(key);
            processed++;
            if (processed >= limit) break;
        }
    }

    // ---------------------------------------------------------------
    //  STRUMIENIOWANIE CHUNKOW WOKOL GRACZA
    // ---------------------------------------------------------------

    /**
     * Wywolywane co klatke. Generuje nowe chunki w okolicy gracza,
     * usuwa te zbyt odlegle i przetwarza kolejke przebudowy mesh-y.
     */
    update(playerPosition) {
        const pcx = Math.floor(playerPosition.x / CHUNK_SIZE);
        const pcz = Math.floor(playerPosition.z / CHUNK_SIZE);

        // Wczytaj brakujace chunki w zasiegu RENDER_DISTANCE (w kolejnosci
        // od najblizszych do najdalszych, zeby otoczenie gracza ladowalo
        // sie jako pierwsze).
        const candidates = [];
        for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
            for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
                if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE) continue;
                candidates.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
            }
        }
        candidates.sort((a, b) => a[2] - b[2]);

        let generatedThisFrame = 0;
        for (const [cx, cz] of candidates) {
            const key = this.chunkKey(cx, cz);
            if (!this.chunks.has(key)) {
                this.generateChunkData(cx, cz);
                generatedThisFrame++;
                // Generowanie terenu jest kosztowne - ograniczamy liczbe
                // nowych chunkow na klatke, aby uniknac spadkow FPS.
                if (generatedThisFrame >= 2) break;
            }
        }

        // Przetworz kolejke przebudowy geometrii (kilka chunkow na klatke).
        this.processDirtyChunks(3);

        // Usun chunki, ktore wypadly poza zasieg renderowania.
        const unloadDistance = RENDER_DISTANCE + 2;
        for (const [key, chunk] of this.chunks) {
            const dx = chunk.cx - pcx;
            const dz = chunk.cz - pcz;
            if (dx * dx + dz * dz > unloadDistance * unloadDistance) {
                if (chunk.mesh) {
                    this.group.remove(chunk.mesh);
                    chunk.mesh.geometry.dispose();
                }
                this.chunks.delete(key);
                this.dirty.delete(key);
            }
        }
    }

    get loadedChunkCount() {
        return this.chunks.size;
    }

    // ---------------------------------------------------------------
    //  RAYCASTING WOKSELOWY (DDA / Amanatides-Woo)
    // ---------------------------------------------------------------

    /**
     * Wystrzeluje promien z punktu `origin` w kierunku `direction` i znajduje
     * pierwszy nie-powietrzny blok na drodze (do `maxDistance`).
     *
     * Algorytm "DDA" (Amanatides & Woo): zamiast malych krokow proboje
     * (co byloby niedokladne i kosztowne), przeskakujemy precyzyjnie od
     * jednej granicy woksela do nastepnej w kazdej osi, wybierajac za
     * kazdym razem os z najmniejsza odlegloscia do najblizszej granicy.
     *
     * Zwraca obiekt { x, y, z, normal, distance, block } dla trafionego
     * bloku (normal wskazuje sciane, w ktora trafil promien) albo null.
     */
    raycast(origin, direction, maxDistance = 8) {
        const dir = direction.clone().normalize();

        let x = Math.floor(origin.x);
        let y = Math.floor(origin.y);
        let z = Math.floor(origin.z);

        const stepX = dir.x > 0 ? 1 : -1;
        const stepY = dir.y > 0 ? 1 : -1;
        const stepZ = dir.z > 0 ? 1 : -1;

        const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
        const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
        const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

        const nextBoundary = (o, d, step) => (d === 0 ? Infinity : (step > 0 ? Math.floor(o) + 1 - o : o - Math.ceil(o) + 1) / Math.abs(d));

        let tMaxX = nextBoundary(origin.x, dir.x, stepX);
        let tMaxY = nextBoundary(origin.y, dir.y, stepY);
        let tMaxZ = nextBoundary(origin.z, dir.z, stepZ);

        let normal = [0, 0, 0];
        let dist = 0;

        while (dist < maxDistance) {
            const block = this.getBlock(x, y, z);
            if (block !== BLOCK.AIR) {
                return { x, y, z, normal, distance: dist, block };
            }

            if (tMaxX < tMaxY && tMaxX < tMaxZ) {
                dist = tMaxX;
                x += stepX;
                tMaxX += tDeltaX;
                normal = [-stepX, 0, 0];
            } else if (tMaxY < tMaxZ) {
                dist = tMaxY;
                y += stepY;
                tMaxY += tDeltaY;
                normal = [0, -stepY, 0];
            } else {
                dist = tMaxZ;
                z += stepZ;
                tMaxZ += tDeltaZ;
                normal = [0, 0, -stepZ];
            }
        }
        return null;
    }

    /**
     * Znajduje bezpieczna wysokosc (Y) do "spawnu" gracza/moba w danej
     * kolumnie (x, z) - najwyzszy nie-powietrzny blok + 1.
     */
    getSpawnHeight(x, z) {
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            if (this.getBlock(Math.floor(x), y, Math.floor(z)) !== BLOCK.AIR) {
                return y + 1;
            }
        }
        return 1;
    }
}
