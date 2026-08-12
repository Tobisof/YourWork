// ============================================================
//  Player.js — gracz pierwszoosobowy:
//   - fizyka AABB (grawitacja, skok, sprint, pływanie)
//   - obrażenia od upadku, tlen pod wodą, głód i regeneracja
//   - interakcja: raycast DDA ze środka ekranu
//       LPM -> atak moba (Raycaster Three.js) lub niszczenie bloku
//       PPM -> stawianie bloku albo jedzenie
//   - highlight: czarny wireframe na celowanym bloku
//   - hotbar: 4 bloki + slot jedzenia, wybór 1-5 / kółko myszy
// ============================================================

import * as THREE from 'three';
import { BLOCK } from './VoxelWorld.js';

const GRAVITY = 30;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.2;
const JUMP_SPEED = 9.2;
const REACH = 6;        // zasięg interakcji z blokami
const ATTACK_RANGE = 4; // zasięg ataku wręcz
const EAT_TIME = 1.4;   // czas jedzenia w sekundach

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

export class Player {
  constructor(camera, controls, world, scene) {
    this.camera = camera;
    this.controls = controls;
    this.world = world;
    this.scene = scene;

    // --- ciało fizyczne (kompatybilne z world.moveBody) ---
    this.position = new THREE.Vector3(); // środek stóp
    this.velocity = new THREE.Vector3();
    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.onGround = false;
    this.hitWall = false;

    // --- statystyki survivalowe ---
    this.maxHp = 20;
    this.hp = 20;
    this.food = 20;
    this.air = 10;
    this.dead = false;
    this.invulnTime = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.drownTimer = 0;
    this.fallAccum = 0;
    this.inWater = false;
    this.underwater = false;
    this.sprinting = false;

    // --- jedzenie ---
    this.eating = false;
    this.eatProgress = 0;

    // --- callbacki dla UI (podpinane w main.js) ---
    this.onHurt = null;
    this.onDeath = null;

    // --- hotbar ---
    this.slots = [
      { kind: 'block', block: BLOCK.DIRT, name: 'Ziemia' },
      { kind: 'block', block: BLOCK.STONE, name: 'Kamień' },
      { kind: 'block', block: BLOCK.WOOD, name: 'Drewno' },
      { kind: 'block', block: BLOCK.LEAVES, name: 'Liście' },
      { kind: 'food', name: 'Surowa Schabowa', count: 0, restores: 8 },
    ];
    this.selected = 0;

    // --- wejście ---
    this.keys = new Set();
    this._mobs = [];

    // --- highlight celowanego bloku: czarny wireframe ---
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    this.highlight.visible = false;
    scene.add(this.highlight);

    // Raycaster Three.js — używany TYLKO do trafiania mobów
    // (bloki obsługuje szybki raycast DDA na siatce wokseli)
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = ATTACK_RANGE;

    this.#bindInput();
  }

  #bindInput() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      // Wybór slotu klawiszami 1-5
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= this.slots.length) this.selected = n - 1;
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousedown', (e) => {
      if (!this.controls.isLocked || this.dead) return;
      if (e.button === 0) this.#attackOrBreak();
      if (e.button === 2) this.#useItem();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Kółko myszy przewija sloty hotbara
    document.addEventListener('wheel', (e) => {
      if (!this.controls.isLocked) return;
      const step = e.deltaY > 0 ? 1 : -1;
      this.selected = (this.selected + step + this.slots.length) % this.slots.length;
    });
  }

  // ---------- LPM: atak moba albo niszczenie bloku ----------
  #attackOrBreak() {
    this.camera.getWorldDirection(_dir);
    const blockHit = this.world.raycast(this.camera.position, _dir, REACH);

    // Raycast po modelach mobów (rekurencyjnie po grupach)
    this.raycaster.set(this.camera.position, _dir);
    const groups = this._mobs.filter((m) => !m.dead).map((m) => m.group);
    const hits = this.raycaster.intersectObjects(groups, true);

    let mob = null;
    let mobDist = Infinity;
    if (hits.length > 0) {
      // Wspinamy się po hierarchii grupy do obiektu z userData.mob
      let obj = hits[0].object;
      while (obj && !obj.userData.mob) obj = obj.parent;
      if (obj) {
        mob = obj.userData.mob;
        mobDist = hits[0].distance;
      }
    }

    // Mob ma priorytet, jeśli jest bliżej niż trafiony blok
    if (mob && (!blockHit || mobDist < blockHit.dist)) {
      const knock = new THREE.Vector3(_dir.x, 0, _dir.z).normalize();
      mob.hurt(3, knock);
    } else if (blockHit && blockHit.block !== BLOCK.BEDROCK) {
      this.world.setBlock(blockHit.x, blockHit.y, blockHit.z, BLOCK.AIR);
    }
  }

  // ---------- PPM: jedzenie albo stawianie bloku ----------
  #useItem() {
    const slot = this.slots[this.selected];
    if (slot.kind === 'food') {
      this.#tryEat(slot);
      return;
    }

    this.camera.getWorldDirection(_dir);
    const hit = this.world.raycast(this.camera.position, _dir, REACH);
    if (!hit) return;

    // Nowy blok ląduje w komórce obok trafionej ściany (hit + normalna)
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;

    const target = this.world.getBlock(px, py, pz);
    if (target !== BLOCK.AIR && target !== BLOCK.WATER) return;

    // Nie można postawić bloku w sobie ani w mobie
    if (this.#aabbIntersectsBlock(this.position, this.width, this.height, px, py, pz)) return;
    for (const m of this._mobs) {
      if (m.dead) continue;
      if (this.#aabbIntersectsBlock(m.position, m.width, m.height, px, py, pz)) return;
    }

    this.world.setBlock(px, py, pz, slot.block);
  }

  #aabbIntersectsBlock(pos, width, height, bx, by, bz) {
    const half = width / 2;
    return (
      pos.x + half > bx && pos.x - half < bx + 1 &&
      pos.y + height > by && pos.y < by + 1 &&
      pos.z + half > bz && pos.z - half < bz + 1
    );
  }

  #tryEat(slot) {
    if (this.eating || slot.count <= 0 || this.food >= 20) return;
    this.eating = true;
    this.eatProgress = 0;
  }

  addFood(n = 1) {
    this.slots[4].count += n;
  }

  // ---------- Obrażenia / śmierć ----------
  damage(amount, knock = null) {
    if (this.dead || this.invulnTime > 0) return;
    this.hp -= amount;
    this.invulnTime = 0.7;
    if (knock) {
      this.velocity.x += knock.x;
      this.velocity.z += knock.z;
      this.velocity.y += 4;
    }
    if (this.onHurt) this.onHurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (this.onDeath) this.onDeath();
    }
  }

  reset(spawn) {
    this.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.hp = 20;
    this.food = 20;
    this.air = 10;
    this.dead = false;
    this.eating = false;
    this.fallAccum = 0;
    this.invulnTime = 0;
  }

  // ---------- Główna pętla gracza ----------
  update(dt, time, mobs) {
    this._mobs = mobs;
    if (this.dead) return;

    this.invulnTime -= dt;

    // --- stan wody ---
    const fx = Math.floor(this.position.x);
    const fz = Math.floor(this.position.z);
    const feetBlock = this.world.getBlock(fx, Math.floor(this.position.y + 0.2), fz);
    const eyeBlock = this.world.getBlock(fx, Math.floor(this.position.y + this.eyeHeight), fz);
    this.inWater = feetBlock === BLOCK.WATER || eyeBlock === BLOCK.WATER;
    this.underwater = eyeBlock === BLOCK.WATER;

    // --- kierunek ruchu względem kamery (tylko yaw) ---
    this.camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, UP); // wektor "w prawo" względem kamery

    let f = 0, s = 0;
    if (this.keys.has('KeyW')) f += 1;
    if (this.keys.has('KeyS')) f -= 1;
    if (this.keys.has('KeyD')) s += 1;
    if (this.keys.has('KeyA')) s -= 1;

    const wishX = _fwd.x * f + _right.x * s;
    const wishZ = _fwd.z * f + _right.z * s;
    const wishLen = Math.hypot(wishX, wishZ);

    // Sprint: Shift + ruch do przodu + niepusty żołądek
    this.sprinting =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
      f > 0 && this.food > 6;

    let speed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (this.inWater) speed *= 0.55;
    if (this.eating) speed *= 0.5;

    const targetVx = wishLen > 0 ? (wishX / wishLen) * speed : 0;
    const targetVz = wishLen > 0 ? (wishZ / wishLen) * speed : 0;
    const accel = this.onGround ? 12 : this.inWater ? 8 : 4;
    this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, dt * accel);
    this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, dt * accel);

    // --- ruch pionowy ---
    if (this.inWater) {
      // Pływanie: spacja wynurza, bez spacji powolne tonięcie
      const targetVy = this.keys.has('Space') ? 4.2 : -1.8;
      this.velocity.y += (targetVy - this.velocity.y) * Math.min(1, dt * 3);
      // Wyskok z wody na brzeg
      if (this.keys.has('Space') && this.hitWall) this.velocity.y = 6.5;
      this.fallAccum = 0;
    } else {
      this.velocity.y -= GRAVITY * dt;
      if (this.velocity.y < -50) this.velocity.y = -50;
      if (this.keys.has('Space') && this.onGround) this.velocity.y = JUMP_SPEED;
    }

    // --- akumulacja dystansu spadania (przed kolizją!) ---
    if (!this.inWater && this.velocity.y < 0) this.fallAccum += -this.velocity.y * dt;

    this.world.moveBody(this, dt);

    // --- obrażenia od upadku ---
    if (this.onGround) {
      if (this.fallAccum > 3.5) this.damage(Math.floor(this.fallAccum - 3));
      this.fallAccum = 0;
    }
    if (this.inWater) this.fallAccum = 0;

    // --- kamera podąża za ciałem ---
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );

    // --- efekt FOV przy sprincie ---
    const targetFov = this.sprinting ? 80 : 75;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    // --- highlight celowanego bloku ---
    this.camera.getWorldDirection(_dir);
    const hit = this.world.raycast(this.camera.position, _dir, REACH);
    if (hit) {
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.highlight.visible = true;
    } else {
      this.highlight.visible = false;
    }

    this.#updateSurvival(dt, wishLen > 0);
  }

  // ---------- Głód, regeneracja, tlen, jedzenie ----------
  #updateSurvival(dt, moving) {
    // Głód spada powoli; sprint wyraźnie przyspiesza spadek
    const drain = this.sprinting && moving ? 0.1 : 0.012;
    this.food = Math.max(0, this.food - drain * dt);

    // Pełny żołądek (>90%) -> powolna regeneracja zdrowia
    if (this.food > 18 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 2) {
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.regenTimer = 0;
      }
    } else {
      this.regenTimer = 0;
    }

    // Głodówka: powolna utrata zdrowia (do 1 HP, jak w MC na normal)
    if (this.food <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 3) {
        this.starveTimer = 0;
        if (this.hp > 1) {
          this.hp -= 1;
          if (this.onHurt) this.onHurt();
        }
      }
    } else {
      this.starveTimer = 0;
    }

    // Tlen: 10 s pod wodą, potem topienie
    if (this.underwater) {
      this.air -= dt;
      if (this.air <= 0) {
        this.air = 0;
        this.drownTimer += dt;
        if (this.drownTimer >= 1) {
          this.drownTimer = 0;
          this.invulnTime = 0; // topienie ignoruje invulnerability
          this.damage(2);
        }
      }
    } else {
      this.air = Math.min(10, this.air + dt * 3);
      this.drownTimer = 0;
    }

    // Animacja jedzenia: opóźnienie, potem efekt
    if (this.eating) {
      this.eatProgress += dt / EAT_TIME;
      if (this.eatProgress >= 1) {
        const slot = this.slots[4];
        if (slot.count > 0) {
          slot.count -= 1;
          this.food = Math.min(20, this.food + slot.restores);
        }
        this.eating = false;
        this.eatProgress = 0;
      }
    }
  }
}
