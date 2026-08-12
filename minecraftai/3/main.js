// ============================================================
//  main.js — rdzeń gry:
//   - scena, renderer, oświetlenie, jaskrawe niebo + mgła
//   - cykl dnia i nocy (słońce, kolory nieba, intensywność światła)
//   - chmury dryfujące nad światem
//   - spawnowanie i sprzątanie mobów oraz item dropów
//   - HUD: hotbar z ikonami z atlasu, paski HP/głodu/tlenu
//   - pętla gry z budżetowanym dogenerowywaniem chunków
// ============================================================

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { VoxelWorld, TILES } from './VoxelWorld.js';
import { Player } from './Player.js';
import { Zombie, Pig, ItemDrop } from './Mob.js';

// ---------- Renderer i scena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Jaskrawy, czysty błękit dnia + granat nocy
const DAY_SKY = new THREE.Color(0x63c8ff);
const NIGHT_SKY = new THREE.Color(0x0b1230);
const skyColor = DAY_SKY.clone();
scene.background = skyColor;
// Mgła kończy się przed krawędzią meshowanych chunków — ukrywa "koniec świata"
scene.fog = new THREE.Fog(skyColor, 45, 80);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 500
);

// Mocny ambient — cienie nie są czarne, świat jest "wesoły"
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff4d6, 1.1);
scene.add(sun);

// ---------- Świat ----------
const world = new VoxelWorld(scene);
world.renderDistance = 5; // 11x11 chunków = teren sięga dalej niż mgła

// Szukamy suchego miejsca na spawn (nie w oceanie)
let spawnX = 8;
while (world.getHeightAt(spawnX, 8) <= world.SEA && spawnX < 600) spawnX += 16;
const spawn = new THREE.Vector3(spawnX + 0.5, world.getHeightAt(spawnX, 8), 8.5);

world.update(spawn);
world.forceBuild(); // pierwszy obszar budujemy synchronicznie przed startem

// ---------- Gracz i sterowanie ----------
const controls = new PointerLockControls(camera, document.body);
const player = new Player(camera, controls, world, scene);
player.position.copy(spawn);
camera.position.set(spawn.x, spawn.y + player.eyeHeight, spawn.z);

// ---------- Chmury ----------
// Płaskie białe prostopadłościany wysoko nad terenem, wolny dryf +X,
// zawijane wokół gracza, żeby nigdy się nie kończyły.
const clouds = [];
{
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 26; i++) {
    const w = 14 + Math.random() * 26;
    const d = 10 + Math.random() * 22;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), cloudMat);
    mesh.position.set(
      spawn.x + (Math.random() - 0.5) * 520,
      88 + Math.random() * 9,
      spawn.z + (Math.random() - 0.5) * 520
    );
    scene.add(mesh);
    clouds.push(mesh);
  }
}

// ---------- Moby i item dropy ----------
let mobs = [];
let drops = [];
const tmpVec = new THREE.Vector3();

function dropPorkchop(mob) {
  drops.push(new ItemDrop(world, scene, mob.position.x, mob.position.y + 0.4, mob.position.z));
}

function spawnMob(Type) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 22 + Math.random() * 20;
  const x = player.position.x + Math.cos(angle) * dist;
  const z = player.position.z + Math.sin(angle) * dist;
  const y = world.getHeightAt(x, z);
  if (y <= world.SEA + 1) return; // nie spawnujemy w wodzie
  const mob = new Type(world, scene, Math.floor(x) + 0.5, y, Math.floor(z) + 0.5);
  if (mob instanceof Pig) mob.onDeath = dropPorkchop;
  mobs.push(mob);
}

let spawnTimer = 2;
function updateSpawning(dt, isNight) {
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  spawnTimer = 4;
  const zombieCount = mobs.filter((m) => m instanceof Zombie).length;
  const pigCount = mobs.filter((m) => m instanceof Pig).length;
  const zombieCap = isNight ? 6 : 2; // noc należy do zombie
  if (zombieCount < zombieCap) spawnMob(Zombie);
  if (pigCount < 4) spawnMob(Pig);
}

// ---------- UI: hotbar ----------
const hotbarEl = document.getElementById('hotbar');
const slotEls = [];
{
  // Ikony slotów rysowane wprost z proceduralnego atlasu tekstur
  const iconTiles = [TILES.DIRT, TILES.STONE, TILES.WOOD_SIDE, TILES.LEAVES, TILES.PORKCHOP];
  player.slots.forEach((slot, i) => {
    const el = document.createElement('div');
    el.className = 'slot' + (i === 0 ? ' selected' : '');
    el.title = slot.name;

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(i + 1);
    el.appendChild(num);

    const icon = document.createElement('canvas');
    icon.width = 36;
    icon.height = 36;
    const ctx = icon.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(world.atlasCanvas, iconTiles[i] * 16, 0, 16, 16, 0, 0, 36, 36);
    el.appendChild(icon);

    if (slot.kind === 'food') {
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = '0';
      el.appendChild(count);
      el._count = count;
    }

    hotbarEl.appendChild(el);
    slotEls.push(el);
  });
}

// ---------- UI: paski i nakładki ----------
const healthFill = document.getElementById('health-fill');
const foodFill = document.getElementById('food-fill');
const airFill = document.getElementById('air-fill');
const airRow = document.getElementById('air-row');
const eatRow = document.getElementById('eat-row');
const eatFill = document.getElementById('eat-fill');
const damageFlash = document.getElementById('damage-flash');
const waterOverlay = document.getElementById('water-overlay');
const debugEl = document.getElementById('debug');
const overlay = document.getElementById('overlay');
const deathScreen = document.getElementById('death-screen');

let flashTimeout = null;
player.onHurt = () => {
  damageFlash.classList.add('show');
  clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => damageFlash.classList.remove('show'), 160);
};

player.onDeath = () => {
  controls.unlock();
  deathScreen.classList.remove('hidden');
  overlay.classList.add('hidden');
};

function updateHud() {
  healthFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
  foodFill.style.width = `${(player.food / 20) * 100}%`;

  const showAir = player.air < 10;
  airRow.classList.toggle('hidden', !showAir);
  if (showAir) airFill.style.width = `${(player.air / 10) * 100}%`;

  eatRow.classList.toggle('hidden', !player.eating);
  if (player.eating) eatFill.style.width = `${player.eatProgress * 100}%`;

  waterOverlay.classList.toggle('show', player.underwater);

  slotEls.forEach((el, i) => {
    el.classList.toggle('selected', i === player.selected);
    if (el._count) el._count.textContent = String(player.slots[i].count);
  });
}

// ---------- Pauza / pointer lock ----------
let paused = true;

document.getElementById('play-btn').addEventListener('click', () => controls.lock());
document.getElementById('respawn-btn').addEventListener('click', () => {
  player.reset(spawn);
  deathScreen.classList.add('hidden');
  controls.lock();
});

controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  paused = false;
});
controls.addEventListener('unlock', () => {
  paused = true;
  if (!player.dead) overlay.classList.remove('hidden');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Cykl dnia i nocy ----------
const DAY_LENGTH = 240; // pełna doba w sekundach
let timeOfDay = 0.08;   // start tuż po wschodzie słońca

function updateDayNight() {
  const angle = timeOfDay * Math.PI * 2; // 0 = wschód słońca
  // 0..1 — ile światła dziennego aktualnie dociera
  const daylight = THREE.MathUtils.clamp(Math.sin(angle) * 1.4 + 0.25, 0.06, 1);

  sun.position.set(
    player.position.x + Math.cos(angle) * 120,
    Math.sin(angle) * 120,
    player.position.z + 40
  );
  sun.target.position.copy(player.position);
  sun.target.updateMatrixWorld();
  sun.intensity = daylight * 1.1;
  ambient.intensity = 0.25 + 0.6 * daylight;

  skyColor.lerpColors(NIGHT_SKY, DAY_SKY, daylight);
  scene.fog.color.copy(skyColor);
  return daylight;
}

// ---------- Pętla gry ----------
const clock = new THREE.Clock();
let worldUpdateTimer = 0;
let debugTimer = 0;
let fpsSmooth = 60;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = performance.now() / 1000;
  fpsSmooth += ((dt > 0 ? 1 / dt : 60) - fpsSmooth) * 0.05;

  const daylight = updateDayNight();

  if (!paused) {
    timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;

    // Dogenerowywanie świata wokół gracza (sprawdzane co 0.5 s)
    worldUpdateTimer -= dt;
    if (worldUpdateTimer <= 0) {
      worldUpdateTimer = 0.5;
      world.update(player.position);
    }
    world.processQueue(2); // budżet: max 2 nowe meshe na klatkę
    world.tickWater(dt);

    player.update(dt, time, mobs);

    // Moby: AI + fizyka + sprzątanie martwych/za dalekich
    mobs = mobs.filter((mob) => {
      mob.update(dt, player, time);
      const far = tmpVec.subVectors(mob.position, player.position).length() > 90;
      if (mob.shouldRemove || far) {
        mob.dispose();
        return false;
      }
      return true;
    });

    // Item dropy: fizyka + zbieranie kolizją z graczem
    drops = drops.filter((drop) => {
      drop.update(dt, time);
      const dist = tmpVec.subVectors(drop.position, player.position).length();
      if (!player.dead && dist < 1.4) {
        player.addFood(1);
        drop.dispose();
        return false;
      }
      if (drop.shouldRemove) {
        drop.dispose();
        return false;
      }
      return true;
    });

    updateSpawning(dt, daylight < 0.25);

    // Dryf chmur + zawijanie względem gracza
    for (const cloud of clouds) {
      cloud.position.x += dt * 1.6;
      if (cloud.position.x - player.position.x > 280) cloud.position.x -= 560;
      if (cloud.position.z - player.position.z > 280) cloud.position.z -= 560;
      if (cloud.position.z - player.position.z < -280) cloud.position.z += 560;
    }
  }

  updateHud();

  debugTimer -= dt;
  if (debugTimer <= 0) {
    debugTimer = 0.25;
    const p = player.position;
    const hour = ((timeOfDay * 24 + 6) % 24) | 0; // 0.0 doby = 6:00
    debugEl.textContent =
      `FPS: ${fpsSmooth.toFixed(0)}\n` +
      `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\n` +
      `Godzina: ${String(hour).padStart(2, '0')}:00  Moby: ${mobs.length}`;
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
