import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { BLOCK } from './VoxelWorld.js';

// ===================================================================
//  STALE FIZYKI I WYMIARY GRACZA
// ===================================================================
const PLAYER_HALF_WIDTH = 0.3;   // polowa szerokosci hitboxa gracza (w X i Z)
const PLAYER_HEIGHT = 1.8;       // wysokosc hitboxa gracza
const EYE_HEIGHT = 1.62;         // wysokosc oczu (kamery) wzgledem stop gracza

const WALK_SPEED = 4.3;          // jednostki/sekunda
const SPRINT_SPEED = 6.8;
const GRAVITY = 28;               // jednostki/sekunda^2
const JUMP_SPEED = 8.6;
const TERMINAL_VELOCITY = 42;

const REACH = 6;                 // maksymalny zasieg interakcji (raycast)
const ATTACK_DAMAGE = 4;         // obrazenia zadawane mobom przez LPM

// --- STALE SYSTEMU GLODU / REGENERACJI (SURVIVAL) ---
const MAX_HUNGER = 20;
const HUNGER_DRAIN_PER_SEC = 20 / 720;   // pelne wyczerpanie glodu po ~12 minutach ruchu
const SPRINT_HUNGER_MULTIPLIER = 2.5;    // sprint zuzywa glod szybciej
const HEALTH_REGEN_PER_SEC = 0.5;        // regeneracja HP, gdy glod > 90%
const STARVE_DAMAGE_PER_SEC = 0.5;       // utrata HP, gdy glod == 0
const EATING_DURATION = 0.6;             // czas trwania animacji jedzenia (s)

// Wartosc odzywcza poszczegolnych przedmiotow spozywczych.
const FOOD_VALUES = {
    porkchop: 8,
};

/**
 * Klasa gracza: kamera FPS (PointerLockControls), grawitacja i kolizje
 * AABB z wokselami, interakcja z blokami (niszczenie/stawianie) i mobami
 * (atak) poprzez raycasting, oraz system przetrwania (zdrowie + glod).
 */
export class Player {
    constructor(camera, domElement, world, scene) {
        this.camera = camera;
        this.world = world;
        this.domElement = domElement;
        this.scene = scene;

        this.controls = new PointerLockControls(camera, domElement);

        // Pozycja gracza = punkt na srodku jego stop (dol hitboxa AABB).
        this.position = new THREE.Vector3(8, 40, 8);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;

        // Zdrowie gracza.
        this.maxHealth = 20;
        this.health = this.maxHealth;
        this.invulnerableTimer = 0; // krotka nietykalnosc po otrzymaniu obrazen

        // Glod gracza (Survival Update).
        this.maxHunger = MAX_HUNGER;
        this.hunger = MAX_HUNGER;

        // Ekwipunek przedmiotow zbieranych ze swiata (np. { porkchop: 2 }).
        this.inventory = { porkchop: 0 };

        // Animacja "jedzenia": > 0, gdy gracz aktualnie spozywa posilek.
        this.eatingTimer = 0;
        this.eatingFood = null;

        // Lista mobow w swiecie - wypelniana przez main.js (wspoldzielona
        // referencja), uzywana do raycastingu przy atakach LPM.
        this.mobs = [];

        // Aktualnie wybrany blok do stawiania (PPM) / przedmiot spozywczy.
        this.selectedBlock = BLOCK.GRASS;
        this.selectedFood = null;

        // Stan klawiszy ruchu.
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
        };

        // Blok, na ktory aktualnie patrzy gracz (wynik raycastu wokselowego).
        this.targetBlock = null;

        // Raycaster do wykrywania mobow na linii strzalu (atak LPM).
        this._raycaster = new THREE.Raycaster();

        // Wireframe (czarna obwodka) podswietlajacy blok, na ktory patrzy gracz.
        const highlightGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
        const edges = new THREE.EdgesGeometry(highlightGeo);
        this.highlightMesh = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
        );
        this.highlightMesh.visible = false;
        scene.add(this.highlightMesh);

        this._setupInput();
    }

    // ---------------------------------------------------------------
    //  OBSLUGA WEJSCIA (KLAWIATURA / MYSZ)
    // ---------------------------------------------------------------

    _setupInput() {
        document.addEventListener('keydown', (e) => this._onKey(e.code, true));
        document.addEventListener('keyup', (e) => this._onKey(e.code, false));

        // Blokujemy menu kontekstowe, zeby PPM dzialalo jako "postaw blok"/"jedz".
        this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

        this.domElement.addEventListener('mousedown', (e) => {
            if (!this.controls.isLocked) return;
            if (e.button === 0) this._handleLeftClick();
            else if (e.button === 2) this._handleRightClick();
        });
    }

    _onKey(code, isDown) {
        switch (code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = isDown; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = isDown; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = isDown; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = isDown; break;
            case 'Space': this.keys.jump = isDown; break;
            case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = isDown; break;
        }
    }

    // ---------------------------------------------------------------
    //  FIZYKA: GRAWITACJA, RUCH I KOLIZJE AABB
    // ---------------------------------------------------------------

    /** Zwraca prostopadlosocian (AABB) gracza w danej pozycji "stop". */
    getAABB(pos = this.position) {
        return {
            minX: pos.x - PLAYER_HALF_WIDTH,
            maxX: pos.x + PLAYER_HALF_WIDTH,
            minY: pos.y,
            maxY: pos.y + PLAYER_HEIGHT,
            minZ: pos.z - PLAYER_HALF_WIDTH,
            maxZ: pos.z + PLAYER_HALF_WIDTH,
        };
    }

    /**
     * Przesuwa gracza zgodnie z aktualna predkoscia (velocity), rozwiazujac
     * kolizje niezaleznie dla kazdej osi (X, potem Z, potem Y). Takie
     * podejscie ("axis separation") zapobiega przenikaniu przez sciany
     * i pozwala plynnie sliscic sie wzdluz powierzchni blokow.
     */
    _move(dt) {
        const world = this.world;

        // Os X
        let next = this.position.clone();
        next.x += this.velocity.x * dt;
        if (!world.checkCollision(next, PLAYER_HALF_WIDTH, PLAYER_HEIGHT)) {
            this.position.x = next.x;
        } else {
            this.velocity.x = 0;
        }

        // Os Z
        next = this.position.clone();
        next.z += this.velocity.z * dt;
        if (!world.checkCollision(next, PLAYER_HALF_WIDTH, PLAYER_HEIGHT)) {
            this.position.z = next.z;
        } else {
            this.velocity.z = 0;
        }

        // Os Y (grawitacja / skok)
        next = this.position.clone();
        next.y += this.velocity.y * dt;
        if (!world.checkCollision(next, PLAYER_HALF_WIDTH, PLAYER_HEIGHT)) {
            this.position.y = next.y;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) this.onGround = true;
            this.velocity.y = 0;
        }
    }

    /** Glowna aktualizacja gracza - wywolywana raz na klatke. */
    update(dt) {
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

        this._updateEating(dt);

        if (this.controls.isLocked) {
            this._applyMovementInput(dt);
        }

        // Grawitacja - zawsze dziala, niezaleznie od stanu pointer locka.
        this.velocity.y -= GRAVITY * dt;
        if (this.velocity.y < -TERMINAL_VELOCITY) this.velocity.y = -TERMINAL_VELOCITY;

        if (this.controls.isLocked && this.keys.jump && this.onGround) {
            this.velocity.y = JUMP_SPEED;
            this.onGround = false;
        }

        this._move(dt);

        // Kamera siedzi na "oczach" gracza, ponad punktem stop (position).
        this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);

        // Lekkie "schylenie" kamery podczas animacji jedzenia.
        if (this.eatingTimer > 0) {
            this.camera.position.y -= 0.08;
        }

        this._updateTargetBlock();
        this._updateSurvivalStats(dt);
    }

    /** Oblicza wektor ruchu w plaszczyznie XZ na podstawie klawiszy WSAD. */
    _applyMovementInput(dt) {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        // Wektor "w prawo" wzgledem kierunku patrzenia (obrocony o -90 stopni w XZ).
        const right = new THREE.Vector3(-forward.z, 0, forward.x);

        const move = new THREE.Vector3();
        if (this.keys.forward) move.add(forward);
        if (this.keys.backward) move.sub(forward);
        if (this.keys.right) move.add(right);
        if (this.keys.left) move.sub(right);

        if (move.lengthSq() > 0) {
            move.normalize();
            const speed = this.keys.sprint ? SPRINT_SPEED : WALK_SPEED;
            move.multiplyScalar(speed);
        }

        this.velocity.x = move.x;
        this.velocity.z = move.z;
    }

    // ---------------------------------------------------------------
    //  INTERAKCJA Z BLOKAMI (RAYCASTING Z CENTRUM EKRANU)
    // ---------------------------------------------------------------

    /**
     * Wystrzeluje promien wokselowy ze srodka kamery (czyli ze srodka
     * ekranu - typowe dla gier FPS) i aktualizuje informacje o bloku,
     * na ktory patrzy gracz, wraz z jego wizualnym podswietleniem.
     */
    _updateTargetBlock() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        this.targetBlock = this.world.raycast(this.camera.position, direction, REACH);

        if (this.targetBlock) {
            const { x, y, z } = this.targetBlock;
            this.highlightMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
            this.highlightMesh.visible = true;
        } else {
            this.highlightMesh.visible = false;
        }
    }

    /**
     * Wystrzeluje (klasyczny, trojkatowy) promien Three.js w mobow na
     * scenie, aby wykryc, czy gracz patrzy na zywego moba. Zwraca
     * najblizsze trafienie { mob, distance } albo null.
     */
    _raycastMobs() {
        if (!this.mobs || this.mobs.length === 0) return null;

        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this._raycaster.set(this.camera.position, direction);
        this._raycaster.far = REACH;

        const meshes = [];
        for (const mob of this.mobs) {
            if (mob.alive) meshes.push(...mob.bodyParts);
        }
        if (meshes.length === 0) return null;

        const hits = this._raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;

        return { mob: hits[0].object.userData.owner, distance: hits[0].distance };
    }

    /**
     * LPM: rozroznia cel ataku - jezeli na linii strzalu (blizej niz
     * trafiony blok) znajduje sie zywy mob, zadaje mu obrazenia.
     * W przeciwnym razie niszczy blok, na ktory patrzy gracz.
     */
    _handleLeftClick() {
        const mobHit = this._raycastMobs();
        const blockDist = this.targetBlock ? this.targetBlock.distance : Infinity;

        if (mobHit && mobHit.distance < blockDist) {
            this._attackMob(mobHit.mob);
        } else {
            this.breakBlock();
        }
    }

    /** Zadaje mobowi obrazenia i wylicza kierunek odskoku (knockback) od gracza. */
    _attackMob(mob) {
        const dir = new THREE.Vector3(mob.position.x - this.position.x, 0, mob.position.z - this.position.z);
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
        dir.normalize();
        mob.takeDamage(ATTACK_DAMAGE, dir);
    }

    /**
     * PPM: jezeli wybrany jest przedmiot spozywczy (i gracz go posiada) -
     * rozpoczyna jedzenie. W przeciwnym razie stawia wybrany blok.
     */
    _handleRightClick() {
        if (this.selectedFood && (this.inventory[this.selectedFood] || 0) > 0) {
            this.eat(this.selectedFood);
        } else if (this.selectedBlock !== null) {
            this.placeBlock();
        }
    }

    /** LPM (przez breakBlock): niszczy blok, na ktory aktualnie patrzy gracz. */
    breakBlock() {
        if (!this.targetBlock) return;
        const { x, y, z, block } = this.targetBlock;
        if (block === BLOCK.BEDROCK) return; // bedrock jest niezniszczalny
        this.world.setBlock(x, y, z, BLOCK.AIR);
    }

    /** PPM (przez placeBlock): stawia aktualnie wybrany blok na scianie, na ktora patrzy gracz. */
    placeBlock() {
        if (!this.targetBlock) return;
        const { x, y, z, normal } = this.targetBlock;
        const px = x + normal[0];
        const py = y + normal[1];
        const pz = z + normal[2];

        // Nie pozwol postawic bloku w miejscu, w ktorym aktualnie stoi gracz
        // (zapobiega "zamurowaniu" sie).
        const aabb = this.getAABB();
        const overlaps = !(
            aabb.maxX <= px || aabb.minX >= px + 1 ||
            aabb.maxY <= py || aabb.minY >= py + 1 ||
            aabb.maxZ <= pz || aabb.minZ >= pz + 1
        );
        if (overlaps) return;

        this.world.setBlock(px, py, pz, this.selectedBlock);
    }

    // ---------------------------------------------------------------
    //  SURVIVAL: ZDROWIE, GLOD I JEDZENIE
    // ---------------------------------------------------------------

    /** Rozpoczyna animacje/proces jedzenia wybranego przedmiotu (jezeli posiadany). */
    eat(foodId) {
        if (this.eatingTimer > 0) return; // gracz juz cos je
        if ((this.inventory[foodId] || 0) <= 0) return;
        this.eatingTimer = EATING_DURATION;
        this.eatingFood = foodId;
    }

    /** Po zakonczeniu animacji jedzenia: usuwa przedmiot z ekwipunku i przywraca glod. */
    _updateEating(dt) {
        if (this.eatingTimer <= 0) return;
        this.eatingTimer -= dt;
        if (this.eatingTimer <= 0) {
            this.eatingTimer = 0;
            const food = this.eatingFood;
            this.inventory[food] = Math.max(0, (this.inventory[food] || 0) - 1);
            this.hunger = Math.min(this.maxHunger, this.hunger + (FOOD_VALUES[food] || 0));
            this.eatingFood = null;
        }
    }

    /**
     * Aktualizuje pasek glodu (spada w czasie, szybciej przy sprincie)
     * oraz reguluje zdrowie: regeneracja przy wysokim glodzie, utrata
     * zdrowia przy glodzie na poziomie 0.
     */
    _updateSurvivalStats(dt) {
        const isMoving = this.velocity.x !== 0 || this.velocity.z !== 0;
        const sprinting = this.keys.sprint && isMoving;
        const drain = HUNGER_DRAIN_PER_SEC * (sprinting ? SPRINT_HUNGER_MULTIPLIER : 1);
        this.hunger = Math.max(0, this.hunger - drain * dt);

        if (this.hunger >= this.maxHunger * 0.9) {
            this.health = Math.min(this.maxHealth, this.health + HEALTH_REGEN_PER_SEC * dt);
        } else if (this.hunger <= 0) {
            this.health = Math.max(0, this.health - STARVE_DAMAGE_PER_SEC * dt);
        }
    }

    /** Zadaje obrazenia graczowi (np. od zombie), z krotka nietykalnoscia. */
    takeDamage(amount) {
        if (this.invulnerableTimer > 0) return;
        this.health = Math.max(0, this.health - amount);
        this.invulnerableTimer = 0.5;
    }

    /** Ustawia pozycje gracza (np. przy spawnie) i zeruje predkosc. */
    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.velocity.set(0, 0, 0);
        this.camera.position.set(x, y + EYE_HEIGHT, z);
    }
}

export { PLAYER_HALF_WIDTH, PLAYER_HEIGHT, EYE_HEIGHT };
