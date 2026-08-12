import * as THREE from 'three';
import { VoxelWorld, BLOCK } from './VoxelWorld.js';
import { Player } from './Player.js';
import { Zombie, Pig, ItemDrop } from './Mob.js';

// ===================================================================
//  SCENA, KAMERA, RENDERER
// ===================================================================

const scene = new THREE.Scene();

// Jaskrawy, "wesoly" blekit nieba w stylu vanilla Minecraft.
const SKY_COLOR = 0x6ec6ff;
scene.background = new THREE.Color(SKY_COLOR);

// Mgla "ucina" widok daleko przed granica wczytanych chunkow, dzieki
// czemu nigdy nie widac "krawedzi swiata" - kolejna optymalizacja,
// poniewaz Three.js moze pomijac fragmenty zbyt daleko od kamery.
scene.fog = new THREE.Fog(SKY_COLOR, 64, 150);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

// ===================================================================
//  OSWIETLENIE
// ===================================================================

// Wysokie swiatlo otoczenia, aby cienie nigdy nie byly calkiem czarne
// (jasny, "kreskowkowy" klimat zamiast realistycznego kontrastu).
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.55);
sunLight.position.set(120, 200, 80);
scene.add(sunLight);

// ===================================================================
//  CHMURY - PLASKIE, BIALE PLASZCZYZNY PRZESUWAJACE SIE PO NIEBIE
// ===================================================================

/**
 * Tworzy prosty system chmur: grupe plaskich, prostopadlosciennych
 * "platform" umieszczonych wysoko nad swiatem. Grupa jest co klatke
 * centrowana na pozycji XZ gracza (chmury zawsze widoczne nad glowa,
 * niezalezne od dystansu podroyz), a poszczegolne chmury powoli
 * przesuwaja sie w jednym kierunku, zawijajac sie w petli.
 */
function createClouds(scene) {
    const group = new THREE.Group();
    scene.add(group);

    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const AREA = 300;       // obszar (jednostki) na ktorym rozmieszczone sa chmury
    const CLOUD_HEIGHT = 90; // wysokosc chmur nad swiatem
    const SPEED = 1.2;       // jednostki/sekunda - predkosc dryfu chmur

    const clouds = [];
    for (let i = 0; i < 22; i++) {
        const width = 8 + Math.random() * 14;
        const depth = 6 + Math.random() * 12;
        const geometry = new THREE.BoxGeometry(width, 1.5, depth);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            (Math.random() - 0.5) * AREA,
            CLOUD_HEIGHT + Math.random() * 10,
            (Math.random() - 0.5) * AREA
        );
        group.add(mesh);
        clouds.push(mesh);
    }

    return {
        update(dt, playerPos) {
            group.position.x = playerPos.x;
            group.position.z = playerPos.z;
            for (const mesh of clouds) {
                mesh.position.x += SPEED * dt;
                if (mesh.position.x > AREA / 2) mesh.position.x -= AREA;
            }
        },
    };
}

const clouds = createClouds(scene);

// ===================================================================
//  SWIAT, GRACZ I MOBY
// ===================================================================

const world = new VoxelWorld(scene);
const player = new Player(camera, renderer.domElement, world, scene);

// Punkt spawnu gracza.
const SPAWN_X = 8;
const SPAWN_Z = 8;

// Wygeneruj synchronicznie obszar 3x3 chunkow wokol spawnu PRZED startem
// petli gry, aby gracz i moby mialy od razu pod stopami solidny teren
// (bez tego gracz na pierwszej klatce spadalby w "pustke" niezaladowanego
// swiata).
for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
        world.generateChunkData(cx, cz);
    }
}
world.processDirtyChunks(Infinity);

player.setPosition(SPAWN_X, world.getSpawnHeight(SPAWN_X, SPAWN_Z) + 0.1, SPAWN_Z);

// --- Rozmieszczenie kilku mobow w okolicy spawnu ---
const mobs = [];
player.mobs = mobs; // wspoldzielona referencja - Player uzywa jej do raycastingu atakow

// Przedmioty lezace na ziemi (np. "Surowa Schabowa" po zabiciu swini).
const items = [];

function spawnMob(MobClass, x, z) {
    const y = world.getSpawnHeight(x, z) + 0.1;
    mobs.push(new MobClass(world, scene, x, y, z));
}

spawnMob(Pig, SPAWN_X + 5, SPAWN_Z - 3);
spawnMob(Pig, SPAWN_X - 6, SPAWN_Z + 4);
spawnMob(Pig, SPAWN_X + 2, SPAWN_Z + 9);
spawnMob(Zombie, SPAWN_X - 10, SPAWN_Z - 8);
spawnMob(Zombie, SPAWN_X + 12, SPAWN_Z + 6);

// ===================================================================
//  EKRAN STARTOWY / POINTER LOCK
// ===================================================================

const startScreen = document.getElementById('start-screen');
const playButton = document.getElementById('play-button');

playButton.addEventListener('click', () => {
    player.controls.lock();
});

player.controls.addEventListener('lock', () => {
    startScreen.classList.add('hidden');
});

player.controls.addEventListener('unlock', () => {
    startScreen.classList.remove('hidden');
});

// ===================================================================
//  HOTBAR - WYBOR BLOKU / PRZEDMIOTU (1-6 / KOLKO MYSZY)
// ===================================================================

// Sloty 1-5 to bloki do stawiania, slot 6 to przedmiot spozywczy
// (Surowa Schabowa) zbierany ze swiata po zabiciu swini.
const HOTBAR_ITEMS = [
    { type: 'block', block: BLOCK.GRASS },
    { type: 'block', block: BLOCK.DIRT },
    { type: 'block', block: BLOCK.STONE },
    { type: 'block', block: BLOCK.WOOD },
    { type: 'block', block: BLOCK.LEAVES },
    { type: 'food', food: 'porkchop' },
];

const hotbarSlots = document.querySelectorAll('.hotbar-slot');
const porkchopCountEl = document.getElementById('porkchop-count');
let selectedSlot = 0;

function selectSlot(index) {
    selectedSlot = ((index % HOTBAR_ITEMS.length) + HOTBAR_ITEMS.length) % HOTBAR_ITEMS.length;
    const item = HOTBAR_ITEMS[selectedSlot];

    if (item.type === 'block') {
        player.selectedBlock = item.block;
        player.selectedFood = null;
    } else {
        player.selectedBlock = null;
        player.selectedFood = item.food;
    }

    hotbarSlots.forEach((slot, i) => slot.classList.toggle('active', i === selectedSlot));
}

document.addEventListener('keydown', (e) => {
    if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.slice(5), 10);
        if (num >= 1 && num <= HOTBAR_ITEMS.length) selectSlot(num - 1);
    }
});

document.addEventListener('wheel', (e) => {
    if (!player.controls.isLocked) return;
    selectSlot(selectedSlot + (e.deltaY > 0 ? 1 : -1));
});

selectSlot(0);

// ===================================================================
//  UI: ZDROWIE, GLOD, JEDZENIE I PANEL DEBUG
// ===================================================================

const healthFill = document.getElementById('health-fill');
const healthText = document.getElementById('health-text');
const hungerFill = document.getElementById('hunger-fill');
const hungerText = document.getElementById('hunger-text');
const eatingIndicator = document.getElementById('eating-indicator');
const fpsCounter = document.getElementById('fps-counter');
const posCounter = document.getElementById('pos-counter');
const chunkCounter = document.getElementById('chunk-counter');

let fpsFrames = 0;
let fpsTimer = 0;

function updateUI(dt) {
    const healthPct = Math.max(0, (player.health / player.maxHealth) * 100);
    healthFill.style.width = `${healthPct}%`;
    healthText.textContent = `Zdrowie: ${Math.ceil(player.health)} / ${player.maxHealth}`;

    const hungerPct = Math.max(0, (player.hunger / player.maxHunger) * 100);
    hungerFill.style.width = `${hungerPct}%`;
    hungerText.textContent = `Glod: ${Math.ceil(player.hunger)} / ${player.maxHunger}`;

    eatingIndicator.classList.toggle('hidden', player.eatingTimer <= 0);

    porkchopCountEl.textContent = String(player.inventory.porkchop || 0);

    fpsFrames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
        fpsCounter.textContent = `FPS: ${Math.round(fpsFrames / fpsTimer)}`;
        fpsFrames = 0;
        fpsTimer = 0;
    }

    const p = player.position;
    posCounter.textContent = `Pozycja: X:${p.x.toFixed(1)} Y:${p.y.toFixed(1)} Z:${p.z.toFixed(1)}`;
    chunkCounter.textContent = `Chunki: ${world.loadedChunkCount}`;
}

// ===================================================================
//  OBSLUGA ZMIANY ROZMIARU OKNA
// ===================================================================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===================================================================
//  GLOWNA PETLA GRY
// ===================================================================

const clock = new THREE.Clock();

function respawnPlayer() {
    player.health = player.maxHealth;
    player.hunger = player.maxHunger;
    player.setPosition(SPAWN_X, world.getSpawnHeight(SPAWN_X, SPAWN_Z) + 0.1, SPAWN_Z);
}

function animate() {
    requestAnimationFrame(animate);

    // Ograniczamy delta time, aby uniknac "skokow" fizyki po np. zmianie karty.
    const dt = Math.min(clock.getDelta(), 0.1);

    // Strumieniowanie chunkow swiata wokol gracza (generowanie + face culling).
    world.update(player.position);

    // Animacja chmur (zawsze wycentrowanych nad graczem).
    clouds.update(dt, player.position);

    // Fizyka i interakcje gracza (w tym glod/zdrowie/jedzenie).
    player.update(dt);

    // AI, fizyka i animacje mobow. Mob, ktory zginie (alive === false)
    // jest usuwany ze sceny - jezeli ma przypisany "dropItem", w jego
    // miejscu pojawia sie przedmiot do zebrania.
    for (let i = mobs.length - 1; i >= 0; i--) {
        const mob = mobs[i];
        mob.update(dt, player);

        if (!mob.alive) {
            if (mob.dropItem) {
                items.push(new ItemDrop(scene, mob.position.x, mob.position.y + 0.2, mob.position.z, mob.dropItem));
            }
            mob.dispose();
            mobs.splice(i, 1);
        }
    }

    // Przedmioty na ziemi - rotacja/bujanie + zbieranie przez gracza.
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update(dt, player);

        if (item.collected) {
            player.inventory[item.itemType] = (player.inventory[item.itemType] || 0) + 1;
            item.dispose();
            items.splice(i, 1);
        }
    }

    if (player.health <= 0) {
        respawnPlayer();
    }

    updateUI(dt);

    renderer.render(scene, camera);
}

animate();
