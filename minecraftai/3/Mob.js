// ============================================================
//  Mob.js — jednostki świata:
//   - Entity: wspólna fizyka (grawitacja + kolizje AABB świata)
//   - Mob: HP, knockback, czerwony błysk obrażeń, śmierć
//   - Zombie: humanoidalny model (głowa/tułów/ręce/nogi),
//     AI ścigania gracza, atak kontaktowy
//   - Pig: model czworonoga, AI swobodnego wędrowania, panika
//   - ItemDrop: rotujący przedmiot do zebrania (surowa schabowa)
// ============================================================

import * as THREE from 'three';
import { BLOCK } from './VoxelWorld.js';

const GRAVITY = 28;

// ------------------------------------------------------------
//  Klasa bazowa: ciało fizyczne w świecie wokseli
// ------------------------------------------------------------
export class Entity {
  constructor(world, x, y, z, width, height) {
    this.world = world;
    this.position = new THREE.Vector3(x, y, z); // środek stóp
    this.velocity = new THREE.Vector3();
    this.width = width;
    this.height = height;
    this.onGround = false;
    this.hitWall = false;
    this.inWater = false;
    this.shouldRemove = false;
  }

  // Grawitacja + kolizje; w wodzie jednostki wypływają na powierzchnię
  applyPhysics(dt) {
    const block = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.3),
      Math.floor(this.position.z)
    );
    this.inWater = block === BLOCK.WATER;

    if (this.inWater) {
      // Wyporność: dążenie do lekkiego ruchu w górę
      this.velocity.y += (1.5 - this.velocity.y) * Math.min(1, dt * 2.5);
    } else {
      this.velocity.y -= GRAVITY * dt;
      if (this.velocity.y < -50) this.velocity.y = -50;
    }
    this.world.moveBody(this, dt);

    // Awaryjne usunięcie, gdyby coś wypadło pod świat
    if (this.position.y < -20) this.shouldRemove = true;
  }

  get aabb() {
    const half = this.width / 2;
    return {
      min: { x: this.position.x - half, y: this.position.y, z: this.position.z - half },
      max: { x: this.position.x + half, y: this.position.y + this.height, z: this.position.z + half },
    };
  }
}

// ------------------------------------------------------------
//  Klasa bazowa moba: model z grupy sześcianów + system walki
// ------------------------------------------------------------
export class Mob extends Entity {
  constructor(world, scene, x, y, z, width, height, hp) {
    super(world, x, y, z, width, height);
    this.scene = scene;
    this.hp = hp;
    this.maxHp = hp;
    this.dead = false;
    this.yaw = 0;
    this.walking = false;
    this.panicTime = 0;
    this.stunTime = 0; // po ciosie AI nie nadpisuje prędkości — knockback jest widoczny
    this.materials = [];
    this.flashTimeout = null;
    this.onDeath = null;

    // userData.mob pozwala raycasterowi gracza odnaleźć moba
    // po trafieniu w dowolny sześcian jego modelu
    this.group = new THREE.Group();
    this.group.userData.mob = this;
    scene.add(this.group);
  }

  // Fabryka sześcianów modelu. pivotTop=true przesuwa geometrię tak,
  // by punkt obrotu był u góry (staw biodrowy/barkowy) — dzięki temu
  // rotation.x daje naturalny wymach kończyny.
  box(w, h, d, color, px, py, pz, pivotTop = false) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (pivotTop) geo.translate(0, -h / 2, 0);
    const mat = new THREE.MeshLambertMaterial({ color });
    mat.userData.baseColor = new THREE.Color(color);
    this.materials.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    this.group.add(mesh);
    return mesh;
  }

  // Otrzymanie obrażeń: HP w dół, knockback, czerwony błysk 100 ms
  hurt(damage, knockDir) {
    if (this.dead) return;
    this.hp -= damage;
    this.panicTime = 3;
    this.stunTime = 0.35;

    if (knockDir) {
      this.velocity.x += knockDir.x * 6;
      this.velocity.z += knockDir.z * 6;
      this.velocity.y = 4.5;
    }

    for (const m of this.materials) m.color.set(0xff3333);
    clearTimeout(this.flashTimeout);
    this.flashTimeout = setTimeout(() => {
      for (const m of this.materials) m.color.copy(m.userData.baseColor);
    }, 100);

    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.shouldRemove = true;
    if (this.onDeath) this.onDeath(this);
  }

  // Płynny obrót w stronę kierunku ruchu (najkrótszą drogą)
  faceTowards(dx, dz, dt) {
    const target = Math.atan2(dx, dz); // model patrzy w +Z
    let diff = target - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.yaw += diff * Math.min(1, dt * 8);
  }

  // Wspólna końcówka update'u: fizyka + synchronizacja modelu
  updateCommon(dt) {
    this.applyPhysics(dt);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    if (this.panicTime > 0) this.panicTime -= dt;
    if (this.stunTime > 0) this.stunTime -= dt;
  }

  dispose() {
    clearTimeout(this.flashTimeout);
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        obj.material.dispose();
      }
    });
  }
}

// ------------------------------------------------------------
//  Zombie — model humanoidalny, AI ścigania, atak kontaktowy
// ------------------------------------------------------------
export class Zombie extends Mob {
  constructor(world, scene, x, y, z) {
    super(world, scene, x, y, z, 0.6, 1.95, 10);
    this.speed = 2.3;
    this.attackDamage = 3;
    this.attackCooldown = 0;

    const SKIN = 0x4f9e45;
    const SHIRT = 0x1d8a8a;
    const PANTS = 0x3c3c72;

    // Hierarchiczny model: osobne sześciany na każdą część ciała
    this.head = this.box(0.5, 0.5, 0.5, SKIN, 0, 1.75, 0);
    this.body = this.box(0.5, 0.75, 0.25, SHIRT, 0, 1.125, 0);
    this.legL = this.box(0.24, 0.75, 0.24, PANTS, -0.13, 0.75, 0, true);
    this.legR = this.box(0.24, 0.75, 0.24, PANTS, 0.13, 0.75, 0, true);
    this.armL = this.box(0.22, 0.7, 0.22, SKIN, -0.36, 1.45, 0, true);
    this.armR = this.box(0.22, 0.7, 0.22, SKIN, 0.36, 1.45, 0, true);
    // Charakterystyczna poza zombie: ręce wyciągnięte do przodu
    this.armL.rotation.x = -Math.PI / 2;
    this.armR.rotation.x = -Math.PI / 2;
  }

  update(dt, player, time) {
    if (this.dead) return;
    this.attackCooldown -= dt;

    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const dy = player.position.y - this.position.y;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (this.stunTime > 0) {
      // Świeżo po ciosie: zachowujemy prędkość z knockbacku
      this.walking = false;
    } else if (dist < 28 && dist > 0.01 && !player.dead) {
      // AI ścigania: prosty pathfinding w linii prostej do gracza
      this.walking = true;
      this.velocity.x = (dx / dist) * this.speed;
      this.velocity.z = (dz / dist) * this.speed;
      this.faceTowards(dx, dz, dt);

      // Skok na przeszkodę blokującą drogę
      if (this.hitWall && this.onGround) this.velocity.y = 8.5;

      // Atak kontaktowy z cooldownem
      if (dist < 1.5 && Math.abs(dy) < 2 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.2;
        const knock = new THREE.Vector3(dx / dist * 6, 0, dz / dist * 6);
        player.damage(this.attackDamage, knock);
      }
    } else {
      this.walking = false;
      this.velocity.x *= 1 - Math.min(1, dt * 8);
      this.velocity.z *= 1 - Math.min(1, dt * 8);
    }

    // Animacja proceduralna: wahadłowy ruch nóg i lekki ruch rąk
    const swing = this.walking ? Math.sin(time * 9) * 0.7 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -Math.PI / 2 + Math.sin(time * 9) * 0.12;
    this.armR.rotation.x = -Math.PI / 2 - Math.sin(time * 9) * 0.12;

    this.updateCommon(dt);
  }
}

// ------------------------------------------------------------
//  Świnia — model czworonoga, AI wędrowania, panika po ciosie
// ------------------------------------------------------------
export class Pig extends Mob {
  constructor(world, scene, x, y, z) {
    super(world, scene, x, y, z, 0.8, 0.95, 6);
    this.speed = 1.3;
    this.wanderTimer = 0;
    this.wandering = false;

    const PINK = 0xf0a5a2;
    const SNOUT = 0xd77f7c;

    // Tułów + głowa z ryjkiem + 4 nogi
    this.body = this.box(0.65, 0.5, 1.0, PINK, 0, 0.7, 0);
    this.head = this.box(0.5, 0.45, 0.4, PINK, 0, 0.78, 0.66);
    this.snout = this.box(0.2, 0.14, 0.08, SNOUT, 0, 0.7, 0.9);
    this.legs = [
      this.box(0.18, 0.45, 0.18, PINK, -0.2, 0.45, 0.34, true),
      this.box(0.18, 0.45, 0.18, PINK, 0.2, 0.45, 0.34, true),
      this.box(0.18, 0.45, 0.18, PINK, -0.2, 0.45, -0.34, true),
      this.box(0.18, 0.45, 0.18, PINK, 0.2, 0.45, -0.34, true),
    ];
  }

  update(dt, player, time) {
    if (this.dead) return;
    this.wanderTimer -= dt;

    if (this.stunTime > 0) {
      // Świeżo po ciosie: zachowujemy prędkość z knockbacku
    } else if (this.panicTime > 0) {
      // Panika po otrzymaniu obrażeń: szybki bieg w losowym kierunku
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 0.5 + Math.random() * 0.5;
        this.yaw = Math.random() * Math.PI * 2;
      }
      this.wandering = true;
    } else if (this.wanderTimer <= 0) {
      // Zmiana zachowania: zatrzymanie albo marsz w nowym kierunku
      this.wanderTimer = 1.5 + Math.random() * 3;
      this.wandering = Math.random() > 0.45;
      if (this.wandering) this.yaw = Math.random() * Math.PI * 2;
    }

    if (this.stunTime > 0) {
      // knockback w toku — nie nadpisujemy prędkości
    } else if (this.wandering) {
      const speed = this.panicTime > 0 ? 3.4 : this.speed;
      this.velocity.x = Math.sin(this.yaw) * speed;
      this.velocity.z = Math.cos(this.yaw) * speed;
      if (this.hitWall && this.onGround) this.velocity.y = 8;
    } else {
      this.velocity.x *= 1 - Math.min(1, dt * 8);
      this.velocity.z *= 1 - Math.min(1, dt * 8);
    }

    // Animacja chodu: nogi po przekątnej poruszają się zgodnie
    const rate = this.panicTime > 0 ? 14 : 8;
    const swing = this.wandering ? Math.sin(time * rate) * 0.6 : 0;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.legs[2].rotation.x = -swing;
    this.legs[3].rotation.x = swing;

    this.updateCommon(dt);
  }
}

// ------------------------------------------------------------
//  ItemDrop — "Surowa Schabowa": mały rotujący sześcian,
//  podlega grawitacji, zbierany kolizją z graczem
// ------------------------------------------------------------
export class ItemDrop extends Entity {
  constructor(world, scene, x, y, z) {
    super(world, x, y, z, 0.25, 0.25);
    this.scene = scene;
    this.age = 0;

    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf08a98 });
    this.mesh = new THREE.Mesh(geo, mat);
    scene.add(this.mesh);

    // Mały losowy "wyrzut" przy dropie
    this.velocity.set((Math.random() - 0.5) * 2, 4, (Math.random() - 0.5) * 2);
  }

  update(dt, time) {
    this.age += dt;
    this.applyPhysics(dt);
    if (this.onGround) {
      this.velocity.x *= 1 - Math.min(1, dt * 6);
      this.velocity.z *= 1 - Math.min(1, dt * 6);
    }
    // Rotacja + delikatne unoszenie się (sygnał "zbierz mnie")
    this.mesh.position.set(
      this.position.x,
      this.position.y + 0.25 + Math.sin(time * 3) * 0.07,
      this.position.z
    );
    this.mesh.rotation.y = time * 2;
    // Znikanie po 5 minutach jak w MC
    if (this.age > 300) this.shouldRemove = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
