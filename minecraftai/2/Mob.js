import * as THREE from 'three';

// ===================================================================
//  STALE FIZYKI I WALKI MOBOW (te same zasady grawitacji co u gracza)
// ===================================================================
const GRAVITY = 28;
const TERMINAL_VELOCITY = 42;
const MOB_JUMP_SPEED = 7.5;

const KNOCKBACK_HORIZONTAL = 5.5; // sila odskoku w plaszczyznie XZ po trafieniu
const KNOCKBACK_VERTICAL = 5;     // sila odskoku w gore po trafieniu
const FLASH_DURATION = 0.1;       // 100ms czerwonego "flasha" po otrzymaniu obrazen

/**
 * Sprawdza, czy dwa prostopadloscianby (AABB) "stop" pozycji A i B
 * przecinaja sie. Uzywane np. do wykrycia kontaktu zombie z graczem.
 */
function aabbOverlap(posA, halfWidthA, heightA, posB, halfWidthB, heightB) {
    return (
        Math.abs(posA.x - posB.x) < halfWidthA + halfWidthB &&
        Math.abs(posA.z - posB.z) < halfWidthA + halfWidthB &&
        posA.y < posB.y + heightB &&
        posA.y + heightA > posB.y
    );
}

/**
 * Bazowa klasa dla wszystkich jednostek (mobow) w grze.
 *
 * Model wizualny kazdego moba to hierarchiczna struktura THREE.Group
 * zbudowana z wielu szescianow (glowa, tulow, konczyny...), w stylu
 * modeli Minecrafta. `this.mesh` to korzen tej hierarchii, umieszczony
 * w pozycji "stop" entity (this.position) - poszczegolne czesci ciala
 * sa pozycjonowane wzgledem niego.
 *
 * Klasa zapewnia rowniez: grawitacje, kolizje AABB z otoczeniem
 * (identycznie jak u gracza), system punktow zycia (HP) z efektami
 * trafienia (knockback + czerwony "flash") oraz mechanizm usuwania
 * (dispose) po smierci.
 */
export class Entity {
    constructor(world, scene, { x, y, z, halfWidth = 0.3, height = 1.8, maxHp = 10 }) {
        this.world = world;
        this.scene = scene;

        // Pozycja = punkt na srodku stop (dol AABB).
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);

        this.halfWidth = halfWidth;
        this.height = height;
        this.onGround = false;
        this.alive = true;

        this.maxHp = maxHp;
        this.hp = maxHp;
        this.flashTimer = 0;

        // Przedmiot upuszczany po smierci (np. 'porkchop'), null = brak.
        this.dropItem = null;

        // Korzen modelu - jego pozycja odpowiada pozycji "stop" entity.
        this.mesh = new THREE.Group();
        // Wszystkie pojedyncze czesci ciala (Mesh) - uzywane do raycastingu
        // (atak gracza) oraz efektu "flash" po trafieniu.
        this.bodyParts = [];

        scene.add(this.mesh);
    }

    // ---------------------------------------------------------------
    //  BUDOWA MODELU (HIERARCHICZNE CZESCI CIALA)
    // ---------------------------------------------------------------

    /** Tworzy pojedynczy szescian (czesc ciala) z zapamietanym kolorem bazowym. */
    _createBox(width, height, depth, color, position) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.userData.baseColor = color;
        mesh.userData.owner = this;
        this.bodyParts.push(mesh);
        return mesh;
    }

    /** Dodaje "statyczna" czesc ciala (np. tulow, glowa) wprost do korzenia modelu. */
    _addPart(width, height, depth, color, center) {
        const mesh = this._createBox(width, height, depth, color, center);
        this.mesh.add(mesh);
        return mesh;
    }

    /**
     * Dodaje "konczyne" (noga/reka) z punktem obrotu (pivot) umieszczonym
     * w stawie (np. biodro/ramie). Sama geometria jest przesunieta tak,
     * aby "zwisala" pod pivotem - dzieki temu obrot pivot.rotation.x
     * daje naturalna animacje wahadlowa (chodzenie, wyciagniete rece).
     */
    _addLimb(width, height, depth, color, pivotPosition) {
        const pivot = new THREE.Group();
        pivot.position.copy(pivotPosition);
        const mesh = this._createBox(width, height, depth, color, new THREE.Vector3(0, -height / 2, 0));
        pivot.add(mesh);
        this.mesh.add(pivot);
        return pivot;
    }

    // ---------------------------------------------------------------
    //  FIZYKA: GRAWITACJA, RUCH I KOLIZJE AABB
    // ---------------------------------------------------------------

    /** Przesuwa entity wedlug velocity, rozwiazujac kolizje AABB osiowo (X, Z, Y). */
    move(dt) {
        const world = this.world;

        let next = this.position.clone();
        next.x += this.velocity.x * dt;
        if (!world.checkCollision(next, this.halfWidth, this.height)) {
            this.position.x = next.x;
        } else {
            this.velocity.x = 0;
        }

        next = this.position.clone();
        next.z += this.velocity.z * dt;
        if (!world.checkCollision(next, this.halfWidth, this.height)) {
            this.position.z = next.z;
        } else {
            this.velocity.z = 0;
        }

        next = this.position.clone();
        next.y += this.velocity.y * dt;
        if (!world.checkCollision(next, this.halfWidth, this.height)) {
            this.position.y = next.y;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) this.onGround = true;
            this.velocity.y = 0;
        }
    }

    /** Stosuje grawitacje do predkosci wertykalnej. */
    applyGravity(dt) {
        this.velocity.y -= GRAVITY * dt;
        if (this.velocity.y < -TERMINAL_VELOCITY) this.velocity.y = -TERMINAL_VELOCITY;
    }

    /**
     * Sprawdza, czy przed entity (w kierunku ruchu velocity.x/z) znajduje
     * sie blok na wysokosci stop - jezeli tak, mob moze "przeskoczyc"
     * o jeden blok (prosta wspinaczka po terenie).
     */
    isBlockedAhead() {
        const dirX = Math.sign(this.velocity.x);
        const dirZ = Math.sign(this.velocity.z);
        if (dirX === 0 && dirZ === 0) return false;

        const checkX = Math.floor(this.position.x + dirX * (this.halfWidth + 0.1));
        const checkZ = Math.floor(this.position.z + dirZ * (this.halfWidth + 0.1));
        const feetY = Math.floor(this.position.y);

        return this.world.isSolid(checkX, feetY, checkZ);
    }

    /** Synchronizuje pozycje korzenia modelu (Group) z pozycja fizyczna (stopy). */
    syncMesh() {
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    }

    // ---------------------------------------------------------------
    //  WALKA: PUNKTY ZYCIA, KNOCKBACK, EFEKT TRAFIENIA
    // ---------------------------------------------------------------

    /**
     * Zadaje obrazenia mobowi. Powoduje:
     *  - odjecie HP,
     *  - "odskok" (knockback) w strone wskazana przez `knockbackDir` (znormalizowany Vector3, plaszczyzna XZ),
     *  - chwilowy (100ms) czerwony "flash" wszystkich czesci ciala,
     *  - oznaczenie moba jako martwego (alive = false), gdy HP spadnie do 0.
     */
    takeDamage(amount, knockbackDir) {
        if (!this.alive) return;

        this.hp -= amount;

        this.velocity.x = knockbackDir.x * KNOCKBACK_HORIZONTAL;
        this.velocity.z = knockbackDir.z * KNOCKBACK_HORIZONTAL;
        this.velocity.y = KNOCKBACK_VERTICAL;
        this.onGround = false;

        for (const part of this.bodyParts) {
            part.material.color.setHex(0xff0000);
        }
        this.flashTimer = FLASH_DURATION;

        if (this.hp <= 0) {
            this.alive = false;
        }
    }

    /** Przywraca oryginalne kolory czesci ciala po uplywie czasu "flasha". */
    _updateFlash(dt) {
        if (this.flashTimer <= 0) return;
        this.flashTimer -= dt;
        if (this.flashTimer <= 0) {
            for (const part of this.bodyParts) {
                part.material.color.setHex(part.userData.baseColor);
            }
        }
    }

    /** Usuwa mob ze sceny i zwalnia zasoby GPU (geometrie i materialy). */
    dispose() {
        this.scene.remove(this.mesh);
        for (const part of this.bodyParts) {
            part.geometry.dispose();
            part.material.dispose();
        }
    }

    /** Domyslna aktualizacja - nadpisywana przez podklasy (AI + animacja). */
    update(dt, player) {
        if (!this.alive) return;
        this._updateFlash(dt);
        this.applyGravity(dt);
        this.move(dt);
        this.syncMesh();
    }
}

/**
 * Zombie - model humanoidalny zbudowany z 6 czesci (glowa, tulow,
 * 2 nogi, 2 rece). Rece sa na staly wyciagniete do przodu (klasyczna
 * "pozycja zombie"). AI: proste sledzenie gracza w linii prostej
 * (pathfinding XZ) + atak przy kontakcie.
 */
export class Zombie extends Entity {
    constructor(world, scene, x, y, z) {
        super(world, scene, { x, y, z, halfWidth: 0.35, height: 1.9, maxHp: 10 });

        this.speed = 2.3;
        this.damage = 2;
        this.attackCooldown = 0;
        this.jumpCooldown = 0;

        const LEG_H = 0.7;
        const BODY_H = 0.7;
        const HEAD_S = 0.5;

        const SKIN = 0x6fae55;   // zielona "skora" zombie - glowa i rece
        const SHIRT = 0x3f5e3a;  // ciemnozielona koszula
        const PANTS = 0x3b5a8c;  // niebieskie spodnie

        // Tulow i glowa - statyczne czesci ciala.
        this._addPart(0.5, BODY_H, 0.25, SHIRT, new THREE.Vector3(0, LEG_H + BODY_H / 2, 0));
        this._addPart(HEAD_S, HEAD_S, HEAD_S, SKIN, new THREE.Vector3(0, LEG_H + BODY_H + HEAD_S / 2, 0));

        // Nogi - pivot w biodrze (do animacji chodu).
        this.leftLeg = this._addLimb(0.25, LEG_H, 0.25, PANTS, new THREE.Vector3(-0.125, LEG_H, 0));
        this.rightLeg = this._addLimb(0.25, LEG_H, 0.25, PANTS, new THREE.Vector3(0.125, LEG_H, 0));

        // Rece - pivot w ramieniu, obrocony o -90 stopni = wyciagniete do przodu.
        this.leftArm = this._addLimb(0.25, BODY_H, 0.25, SKIN, new THREE.Vector3(-0.375, LEG_H + BODY_H, 0));
        this.rightArm = this._addLimb(0.25, BODY_H, 0.25, SKIN, new THREE.Vector3(0.375, LEG_H + BODY_H, 0));
        this.leftArm.rotation.x = -Math.PI / 2;
        this.rightArm.rotation.x = -Math.PI / 2;
    }

    update(dt, player) {
        if (!this.alive) return;
        this._updateFlash(dt);

        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

        // --- AI: pathfinding w linii prostej w stronę gracza ---
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        const distXZ = Math.hypot(dx, dz);

        if (distXZ > 0.2) {
            const dirX = dx / distXZ;
            const dirZ = dz / distXZ;
            this.velocity.x = dirX * this.speed;
            this.velocity.z = dirZ * this.speed;
            this.mesh.rotation.y = Math.atan2(dirX, dirZ);
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        this.applyGravity(dt);

        // Przeskakiwanie niskich (1-blokowych) przeszkod na drodze do gracza.
        if (this.onGround && this.jumpCooldown <= 0 && this.isBlockedAhead()) {
            this.velocity.y = MOB_JUMP_SPEED;
            this.jumpCooldown = 0.6;
        }

        this.move(dt);
        this.syncMesh();
        this._animate();

        // --- Obrazenia przy kontakcie z graczem ---
        if (this.attackCooldown <= 0) {
            const playerAABB = player.getAABB();
            const playerHalfWidth = (playerAABB.maxX - playerAABB.minX) / 2;
            const playerHeight = playerAABB.maxY - playerAABB.minY;

            if (aabbOverlap(this.position, this.halfWidth, this.height, player.position, playerHalfWidth, playerHeight)) {
                player.takeDamage(this.damage);
                this.attackCooldown = 1.0;
            }
        }
    }

    /** Animacja proceduralna: wahadlowy ruch nog i rąk podczas chodzenia. */
    _animate() {
        const moving = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z > 0.05;
        const t = Date.now() * 0.01;

        if (moving) {
            this.leftLeg.rotation.x = Math.sin(t * this.speed) * 0.6;
            this.rightLeg.rotation.x = -Math.sin(t * this.speed) * 0.6;
            this.leftArm.rotation.x = -Math.PI / 2 + Math.sin(t * this.speed) * 0.2;
            this.rightArm.rotation.x = -Math.PI / 2 - Math.sin(t * this.speed) * 0.2;
        } else {
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = -Math.PI / 2;
            this.rightArm.rotation.x = -Math.PI / 2;
        }
    }
}

/**
 * Swinia - model zbudowany z duzego tulowia, glowy z ryjkiem i 4 nog.
 * AI: swobodne wedrowanie - co kilka sekund wybiera nowy losowy
 * kierunek (lub decyduje sie zatrzymac), obraca sie w jego strone
 * i idzie do przodu. Po smierci upuszcza "Surowa Schabowa" (porkchop).
 */
export class Pig extends Entity {
    constructor(world, scene, x, y, z) {
        super(world, scene, { x, y, z, halfWidth: 0.4, height: 1.0, maxHp: 6 });

        this.speed = 1.6;
        this.wanderTimer = 0;
        this.isWalking = false;
        this.jumpCooldown = 0;
        this.moveDir = { x: 0, z: 1 };
        this.dropItem = 'porkchop';

        const LEG_H = 0.4;
        const BODY_H = 0.6;

        const BODY_COLOR = 0xf4a6c6;
        const HEAD_COLOR = 0xf7b8d1;
        const SNOUT_COLOR = 0xe892b5;

        // Tulow (duzy prostopadlosocian).
        this._addPart(0.8, BODY_H, 1.2, BODY_COLOR, new THREE.Vector3(0, LEG_H + BODY_H / 2, 0));
        // Glowa - umieszczona na przodzie tulowia (+Z = kierunek "naprzod").
        this._addPart(0.5, 0.5, 0.5, HEAD_COLOR, new THREE.Vector3(0, LEG_H + 0.3, 0.85));
        // Ryjek - mala plytka na przodzie glowy.
        this._addPart(0.25, 0.2, 0.15, SNOUT_COLOR, new THREE.Vector3(0, LEG_H + 0.25, 1.175));

        // 4 nogi - pivoty w "biodrach"/"barkach" do animacji chodu na przekatna.
        this.legFL = this._addLimb(0.2, LEG_H, 0.2, BODY_COLOR, new THREE.Vector3(-0.3, LEG_H, 0.5));
        this.legFR = this._addLimb(0.2, LEG_H, 0.2, BODY_COLOR, new THREE.Vector3(0.3, LEG_H, 0.5));
        this.legBL = this._addLimb(0.2, LEG_H, 0.2, BODY_COLOR, new THREE.Vector3(-0.3, LEG_H, -0.5));
        this.legBR = this._addLimb(0.2, LEG_H, 0.2, BODY_COLOR, new THREE.Vector3(0.3, LEG_H, -0.5));
    }

    update(dt, player) {
        if (!this.alive) return;
        this._updateFlash(dt);

        this.wanderTimer -= dt;
        this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

        // --- AI: swobodne wedrowanie ---
        if (this.wanderTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            this.mesh.rotation.y = angle;
            this.moveDir = { x: Math.sin(angle), z: Math.cos(angle) };
            // Swinia czasem stoi w miejscu, czasem wedruje.
            this.isWalking = Math.random() > 0.35;
            this.wanderTimer = 2 + Math.random() * 4;
        }

        if (this.isWalking) {
            this.velocity.x = this.moveDir.x * this.speed;
            this.velocity.z = this.moveDir.z * this.speed;
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        this.applyGravity(dt);

        if (this.isWalking && this.onGround && this.jumpCooldown <= 0 && this.isBlockedAhead()) {
            this.velocity.y = MOB_JUMP_SPEED;
            this.jumpCooldown = 0.6;
        }

        this.move(dt);
        this.syncMesh();
        this._animate();
    }

    /** Animacja proceduralna: nogi przekatne wahaja sie w przeciwnych fazach. */
    _animate() {
        if (this.isWalking) {
            const swing = Math.sin(Date.now() * 0.01 * this.speed * 2) * 0.5;
            this.legFL.rotation.x = swing;
            this.legBR.rotation.x = swing;
            this.legFR.rotation.x = -swing;
            this.legBL.rotation.x = -swing;
        } else {
            this.legFL.rotation.x = 0;
            this.legFR.rotation.x = 0;
            this.legBL.rotation.x = 0;
            this.legBR.rotation.x = 0;
        }
    }
}

// ===================================================================
//  PRZEDMIOTY UPUSZCZANE W SWIECIE (ITEM DROPS)
// ===================================================================

const ITEM_COLORS = {
    porkchop: 0xe8a999, // Surowa Schabowa
};

/**
 * Przedmiot lezacy na ziemi (np. po zabiciu swini). Renderowany jako
 * maly, rotujacy szescian z lekkim "bujaniem" w gore i w dol. Gracz
 * zbiera przedmiot, podchodzac w jego poblize (kolizja odleglosciowa).
 */
export class ItemDrop {
    constructor(scene, x, y, z, itemType) {
        this.scene = scene;
        this.itemType = itemType;
        this.position = new THREE.Vector3(x, y, z);
        this.collected = false;

        const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const material = new THREE.MeshLambertMaterial({ color: ITEM_COLORS[itemType] || 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
    }

    update(dt, player) {
        // Rotacja i delikatne "bujanie" - typowy efekt itemow lezacych na ziemi.
        this.mesh.rotation.y += dt * 1.5;
        const bob = Math.sin(Date.now() * 0.004) * 0.06;
        this.mesh.position.set(this.position.x, this.position.y + 0.35 + bob, this.position.z);

        // Gracz zbiera przedmiot, podchodzac blisko (prosta kolizja odleglosciowa).
        const dx = player.position.x - this.position.x;
        const dy = (player.position.y + 0.9) - this.position.y;
        const dz = player.position.z - this.position.z;
        if (dx * dx + dy * dy + dz * dz < 1.0) {
            this.collected = true;
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
