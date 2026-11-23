import * as THREE from 'three';
import { createContactShadowTexture } from '../src/textures.js';
import { brawlAudio } from './brawlAudio.js';

export const WEAPON_INFO = {
  orbit: { name: '🌀 迴旋星環刃', desc: '全時環繞主角旋轉切割與擊退' },
  dart: { name: '⚡ 追蹤雷羽鏢', desc: '自動鎖定最近敵人與建築發射雷鏢' },
  nova: { name: '🔥 烈焰震地波', desc: '週期性 360° 大範圍震地衝擊波' },
  laser: { name: '☄️ 貫穿星能砲', desc: '朝前方發射高傷貫穿光砲' }
};

export class WeaponAndDropManager {
  constructor(scene, planet) {
    this.scene = scene;
    this.planet = planet;
    this.contactShadowTex = createContactShadowTexture();

    this.resetUpgrades();
    this.orbitGroup = new THREE.Group();
    this.scene.add(this.orbitGroup);
    this.bladeMeshes = [];
    this.bladeHitCooldowns = new Map(); // zombie -> timestamp
    this.buildingHitCooldowns = new Map(); // building -> timestamp

    // Visible 3D Weapon Range Ring + Left/Right Physical 3D Side Weapon Pods
    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.48,
        depthWrite: false
      })
    );
    this.scene.add(this.rangeRing);

    this.sidePodsGroup = new THREE.Group();
    this.scene.add(this.sidePodsGroup);
    this.leftPod = null;
    this.rightPod = null;

    this.projectiles = [];
    this.effects = [];
    this.particles = [];
    this.drops = [];
    this.turrets = [];

    this.orbitAngle = 0;
    this.dartTimer = 0;
    this.novaTimer = 0;
    this.laserTimer = 0;
    this._lastShotSfx = 0;
    this._lastTurretSfx = 0;

    this.rebuildOrbitBlades();
    this.rebuildSidePods();
  }

  resetUpgrades() {
    this.stats = {
      activeWeapon: 'orbit',
      weaponTier: 1,
      orbitCount: 3,
      orbitRadius: 4.2,
      orbitSpinSpeed: 3.4,
      powerMult: 1.0,
      speedMult: 1.0,
      bladeScale: 1.0
    };
  }

  setActiveWeapon(weaponKey) {
    this.stats.activeWeapon = weaponKey;
    if (weaponKey === 'orbit') {
      this.stats.orbitCount = Math.min(10, 2 + this.stats.weaponTier);
      this.rebuildOrbitBlades();
    }
    if (this.orbitGroup) {
      this.orbitGroup.visible = weaponKey === 'orbit';
    }
    this.rebuildSidePods();
  }

  getWeaponRange() {
    const aw = this.stats.activeWeapon;
    const tierBonus = (this.stats.weaponTier - 1) * 0.4;
    if (aw === 'orbit') return this.stats.orbitRadius + 1.0;
    if (aw === 'dart') return 10.5 + tierBonus;
    if (aw === 'nova') return 7.5 + tierBonus;
    if (aw === 'laser') return 11.5 + tierBonus;
    return 8.0;
  }

  rebuildSidePods() {
    while (this.sidePodsGroup.children.length > 0) {
      this.sidePodsGroup.remove(this.sidePodsGroup.children[0]);
    }
    const aw = this.stats.activeWeapon;
    const colorMap = {
      orbit: 0x38bdf8,
      dart: 0xa855f7,
      nova: 0xf97316,
      laser: 0x06b6d4
    };
    const podColor = colorMap[aw] || 0x38bdf8;
    const podMat = new THREE.MeshToonMaterial({ color: podColor });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.25 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const makePod = (side) => {
      const g = new THREE.Group();
      if (aw === 'laser') {
        // Twin-barrel Rail Cannon
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 1.25), darkMetalMat);
        g.add(body);
        [-0.14, 0.14].forEach((x) => {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.35, 10), podMat);
          barrel.rotation.x = Math.PI / 2;
          barrel.position.set(x, 0.04, 0.45);
          g.add(barrel);
        });
        const accelRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 8, 16), coreMat);
        accelRing.position.z = 0.75;
        g.add(accelRing);
        const cell = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.38), goldMat);
        cell.position.set(0, 0.24, -0.25);
        g.add(cell);
      } else if (aw === 'dart') {
        // Twin-Wing Thunder Launcher
        const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.35, 6), darkMetalMat);
        fuselage.rotation.x = Math.PI / 2;
        g.add(fuselage);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.55), podMat);
        wing.rotation.z = side * 0.22;
        wing.position.z = -0.1;
        g.add(wing);
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 14), coreMat);
        coil.position.z = 0.25;
        g.add(coil);
      } else if (aw === 'nova') {
        // Solar Nova Gyro Reactor
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), coreMat);
        g.add(core);
        const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.07, 8, 20), podMat);
        innerRing.rotation.x = Math.PI / 3;
        g.add(innerRing);
        const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 20), goldMat);
        outerRing.rotation.y = Math.PI / 4;
        g.add(outerRing);
      } else {
        // Floating Sword-Sheath Wing Pod
        const sheath = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.38), darkMetalMat);
        g.add(sheath);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.44), goldMat);
        trim.position.y = 0.22;
        g.add(trim);
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), podMat);
        crystal.position.y = 0.58;
        g.add(crystal);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 4), coreMat);
        fin.rotation.z = side * -Math.PI / 3;
        fin.position.set(side * 0.28, 0.1, 0);
        g.add(fin);
      }
      return g;
    };

    this.leftPod = makePod(-1);
    this.rightPod = makePod(1);
    this.sidePodsGroup.add(this.leftPod);
    this.sidePodsGroup.add(this.rightPod);

    if (this.rangeRing) {
      this.rangeRing.material.color.setHex(podColor);
    }
  }

  clearDynamicEntities() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const e of this.effects) this.scene.remove(e.mesh);
    for (const d of this.drops) this.scene.remove(d.mesh);
    for (const t of this.turrets) this.scene.remove(t.mesh);
    this.projectiles = [];
    this.effects = [];
    this.particles = [];
    this.drops = [];
    this.turrets = [];
    this.bladeHitCooldowns.clear();
    this.buildingHitCooldowns.clear();
  }

  rebuildOrbitBlades() {
    while (this.orbitGroup.children.length > 0) {
      this.orbitGroup.remove(this.orbitGroup.children[0]);
    }
    this.bladeMeshes = [];

    const bladeMat = new THREE.MeshToonMaterial({ color: 0x38bdf8 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.25 });
    const gemMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

    for (let i = 0; i < this.stats.orbitCount; i++) {
      const grp = new THREE.Group();

      // Main crystalline sword blade
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.85, 4), bladeMat);
      blade.rotation.x = Math.PI / 2;
      blade.position.z = 0.72;
      grp.add(blade);

      // Glowing inner energy spine
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 1.55), edgeMat);
      spine.position.z = 0.55;
      grp.add(spine);

      // Metallic gold winged crossguard
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.22), goldMat);
      guard.position.z = -0.15;
      grp.add(guard);

      // Side energy fins on guard
      [-0.42, 0.42].forEach((x) => {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.48, 4), edgeMat);
        fin.rotation.z = x > 0 ? -Math.PI / 2.6 : Math.PI / 2.6;
        fin.position.set(x, 0, -0.15);
        grp.add(fin);
      });

      // Pommel ruby gem
      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), gemMat);
      pommel.position.z = -0.42;
      grp.add(pommel);

      grp.scale.setScalar(this.stats.bladeScale);
      this.orbitGroup.add(grp);
      this.bladeMeshes.push(grp);
    }
  }

  addTurret(landmark) {
    const up = this.planet.getSurfaceNormal(landmark.position);
    const pos = landmark.position.clone().addScaledVector(up, 5.8);

    const grp = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.18, 0),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.48,
        roughness: 0.16,
        metalness: 0.45,
        flatShading: true
      })
    );
    crystal.castShadow = true;
    grp.add(crystal);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.58, 0.16, 12, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0x92400e,
        emissiveIntensity: 0.25,
        roughness: 0.22,
        metalness: 0.78
      })
    );
    ring.rotation.x = Math.PI / 2;
    grp.add(ring);

    // Bright glowing victory pillar & ground halo on the captured building
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.8, 12, 16, 1, true), pillarMat);
    pillar.position.y = -0.5;
    grp.add(pillar);

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.1, 28), haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -5.4;
    grp.add(halo);

    this.planet.orientToSphere(grp, pos, up);
    this.scene.add(grp);

    this.turrets.push({
      mesh: grp,
      crystal,
      pillar,
      halo,
      pos,
      cooldown: 0
    });
  }

  spawnDrop(kind, worldPos) {
    const up = this.planet.getSurfaceNormal(worldPos);
    const basePos = this.planet.projectToSurface(worldPos, 0.06);

    const colorMap = {
      xp: 0x38bdf8,
      heal: 0xf43f5e,
      maxhp: 0xfacc15,
      essence_orbit: 0x22c55e,
      essence_speed: 0x0ea5e9,
      essence_power: 0xf97316,
      weapon_orbit: 0x38bdf8,
      weapon_dart: 0xa855f7,
      weapon_nova: 0xef4444,
      weapon_laser: 0x06b6d4
    };

    const hex = colorMap[kind] || 0xffffff;
    const isEssence = kind.startsWith('essence_');
    const isWeapon = kind.startsWith('weapon_');
    const isBig = kind === 'maxhp' || isWeapon || isEssence;

    const root = new THREE.Group();

    // Grounded contact shadow so drop feels truly 3D on the planet surface
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(isBig ? 0.95 : 0.72, 18),
      new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    root.add(shadow);

    // Floating 3D body with real PBR shading, specular highlights & subtle emissive glow
    const bodyGrp = new THREE.Group();
    bodyGrp.position.y = 0.92;

    if (isEssence) {
      // Sculptural 3D Magic Essence Core: high-contrast specular crystal + dual orthogonal gyro rings + 4 shards
      const orb = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.44, 0),
        new THREE.MeshPhongMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 0.14,
          specular: 0xffffff,
          shininess: 140,
          flatShading: true
        })
      );
      orb.castShadow = true;
      bodyGrp.add(orb);

      const outerGyro = new THREE.Group();
      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.74, 0.085, 12, 24),
        new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          emissive: hex,
          emissiveIntensity: 0.12,
          roughness: 0.18,
          metalness: 0.85
        })
      );
      outerRing.castShadow = true;
      outerGyro.add(outerRing);

      // 4 protruding crystal prongs around the outer ring for unmistakable 3D silhouette
      const prongMat = new THREE.MeshPhongMaterial({
        color: hex,
        specular: 0xffffff,
        shininess: 120,
        flatShading: true
      });
      for (let p = 0; p < 4; p++) {
        const a = (p * Math.PI) / 2;
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 4), prongMat);
        prong.position.set(Math.cos(a) * 0.88, Math.sin(a) * 0.88, 0);
        prong.rotation.z = a - Math.PI / 2;
        outerGyro.add(prong);
      }
      outerGyro.rotation.x = Math.PI / 3;
      bodyGrp.add(outerGyro);

      const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.06, 10, 20),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.25,
          metalness: 0.8
        })
      );
      innerRing.rotation.y = Math.PI / 3;
      bodyGrp.add(innerRing);

      bodyGrp.userData.gyroRing = outerGyro;
      bodyGrp.userData.innerRing = innerRing;
    } else if (isWeapon) {
      // Metallic 3D Supply Crate with glowing weapon core & gold corner trim
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 0.84, 0.84),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.3,
          metalness: 0.7
        })
      );
      crate.castShadow = true;
      bodyGrp.add(crate);

      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.56, 0),
        new THREE.MeshStandardMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 0.52,
          roughness: 0.15,
          metalness: 0.35,
          flatShading: true
        })
      );
      bodyGrp.add(core);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.06, 8, 16),
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          roughness: 0.22,
          metalness: 0.82
        })
      );
      band.rotation.x = Math.PI / 2;
      bodyGrp.add(band);
    } else {
      // Faceted 3D Crystal Gem (XP / Heal / MaxHP Special Gem)
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(isBig ? 0.64 : 0.46, 0),
        new THREE.MeshStandardMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 0.34,
          roughness: 0.12,
          metalness: 0.48,
          flatShading: true
        })
      );
      gem.scale.set(0.88, 1.25, 0.88);
      gem.castShadow = true;
      bodyGrp.add(gem);

      if (kind === 'maxhp') {
        // Golden royal halo ring for Special MaxHP Gem
        const crownRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.76, 0.08, 10, 24),
          new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xd97706,
            emissiveIntensity: 0.38,
            roughness: 0.18,
            metalness: 0.85
          })
        );
        crownRing.rotation.x = Math.PI / 2.3;
        bodyGrp.add(crownRing);
        bodyGrp.userData.gyroRing = crownRing;
      }
    }

    root.add(bodyGrp);
    this.planet.orientToSphere(root, basePos, up);
    this.scene.add(root);

    this.drops.push({
      kind,
      mesh: root,
      bodyGrp,
      pos: basePos.clone(),
      phase: Math.random() * Math.PI * 2,
      age: 0,
      maxAge: isEssence ? 12.0 : 0 // Essences on the ground expire after 12 seconds
    });
  }

  rollZombieDrop(zombie, pos) {
    if (zombie.cfg.boss) {
      // Gorilla Boss guarantees MaxHP Gem + random Essence
      this.spawnDrop('maxhp', pos);
      const essences = ['essence_orbit', 'essence_speed', 'essence_power'];
      const pick = essences[Math.floor(Math.random() * essences.length)];
      this.spawnDrop(pick, pos.clone().add(new THREE.Vector3(1.2, 0, 1.2)));
      return;
    }

    const r = Math.random();
    const eliteBonus = zombie.cfg.elite ? 0.25 : 0;

    if (zombie.cfg.elite && r < 0.03) {
      this.spawnDrop('maxhp', pos);
    } else if (r < (zombie.cfg.elite ? 0.066 : 0.015)) {
      // Weapon drops reduced by 0.6x (~1.5% normal, ~3.6% elite)
      const weapons = ['weapon_orbit', 'weapon_dart', 'weapon_nova', 'weapon_laser'];
      this.spawnDrop(weapons[Math.floor(Math.random() * weapons.length)], pos);
    } else if (r < 0.22 + eliteBonus * 0.4) {
      const essences = ['essence_orbit', 'essence_speed', 'essence_power'];
      this.spawnDrop(essences[Math.floor(Math.random() * essences.length)], pos);
    } else if (r < 0.3) {
      this.spawnDrop('heal', pos);
    } else {
      this.spawnDrop('xp', pos);
    }
  }

  spawnBurstEffect(worldPos, colorHex = 0xfbbf24, count = 7, speed = 8.5, size = 0.28) {
    const up = this.planet.getSurfaceNormal(worldPos);
    const geo = new THREE.OctahedronGeometry(size, 0);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geo, mat);
      const startPos = worldPos.clone().addScaledVector(up, 0.9);
      mesh.position.copy(startPos);
      this.scene.add(mesh);

      const randVec = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      const vel = randVec
        .addScaledVector(up, 0.75)
        .normalize()
        .multiplyScalar(speed * (0.65 + Math.random() * 0.65));

      this.particles.push({
        mesh,
        vel,
        age: 0,
        duration: 0.38 + Math.random() * 0.16
      });
    }
  }

  spawnFireworks(worldPos) {
    const up = this.planet.getSurfaceNormal(worldPos);
    const palette = [0xfacc15, 0x34d399, 0x38bdf8, 0xf43f5e, 0xc084fc];
    const heights = [10, 14, 18];

    heights.forEach((h, idx) => {
      setTimeout(() => {
        const burstCenter = worldPos.clone().addScaledVector(up, h);
        const col1 = palette[idx % palette.length];
        const col2 = palette[(idx + 2) % palette.length];
        this.spawnBurstEffect(burstCenter, col1, 18, 13.5, 0.36);
        this.spawnBurstEffect(burstCenter, col2, 12, 9.5, 0.28);

        const fwRing = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 1.1, 24),
          new THREE.MeshBasicMaterial({
            color: col1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
          })
        );
        this.planet.orientToSphere(fwRing, burstCenter, up);
        fwRing.rotateX(Math.PI / 2);
        this.scene.add(fwRing);
        this.effects.push({ mesh: fwRing, age: 0, duration: 0.65, maxScale: 7.5 });
      }, idx * 220);
    });
  }

  triggerNova(playerPos, zombies, buildings, damageBuildingFn, damageZombieFn, scaleMult = 1.0, isUltimate = false) {
    const up = this.planet.getSurfaceNormal(playerPos);
    const radius = isUltimate ? 15.0 : this.getWeaponRange() * scaleMult;
    const dmg = isUltimate
      ? 95 * this.stats.powerMult
      : 35 * this.stats.powerMult * (1 + (this.stats.weaponTier - 1) * 0.2) * scaleMult;
    const knockForce = isUltimate ? 18 : 11;

    const ringGeo = new THREE.RingGeometry(0.6, isUltimate ? 1.8 : 1.3, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isUltimate ? 0xfacc15 : 0xf97316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.planet.orientToSphere(ring, playerPos.clone().addScaledVector(up, 0.55), up);
    ring.rotateX(Math.PI / 2);
    this.scene.add(ring);

    this.effects.push({
      mesh: ring,
      age: 0,
      duration: isUltimate ? 0.65 : 0.45,
      maxScale: radius
    });

    if (isUltimate) {
      // Second inner fiery ring + expanding 3D energy dome + radial burst particles
      const ring2 = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 1.4, 28),
        new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        })
      );
      this.planet.orientToSphere(ring2, playerPos.clone().addScaledVector(up, 0.8), up);
      ring2.rotateX(Math.PI / 2);
      this.scene.add(ring2);
      this.effects.push({ mesh: ring2, age: 0, duration: 0.5, maxScale: radius * 0.78 });

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 18, 14),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.45,
          wireframe: true
        })
      );
      dome.position.copy(playerPos.clone().addScaledVector(up, 1.0));
      this.scene.add(dome);
      this.effects.push({ mesh: dome, age: 0, duration: 0.5, maxScale: radius * 0.85, isDome: true });

      this.spawnBurstEffect(playerPos, 0xfacc15, 18, 14, 0.34);
      this.spawnBurstEffect(playerPos, 0xf97316, 12, 10, 0.28);
    }

    for (const z of zombies) {
      if (z.pos.distanceTo(playerPos) <= radius) {
        const knock = z.pos.clone().sub(playerPos).normalize();
        damageZombieFn(z, dmg, knock, knockForce);
      }
    }
  }

  fireProjectile(startPos, targetPos, colorHex, dmg, speed = 34, piercing = false, fixedDir = null, maxRange = 28) {
    const dir = fixedDir
      ? fixedDir.clone().normalize()
      : targetPos.clone().sub(startPos).normalize();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(piercing ? 0.52 : 0.36, 8, 8),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      pos: startPos.clone(),
      dir,
      speed,
      dmg,
      piercing,
      hitSet: new Set(),
      travelled: 0,
      maxRange,
      life: piercing ? 0.85 : 1.4
    });
  }

  update(delta, elapsed, ctx) {
    const {
      playerPos,
      playerForward,
      squadCount,
      zombieManager,
      buildings,
      turretCfg,
      damageBuildingFn,
      onDropPicked
    } = ctx;

    const squadAtkMult = 1 + squadCount * 0.03;
    const totalSpeedMult = this.stats.speedMult * squadAtkMult;
    const up = this.planet.getSurfaceNormal(playerPos);
    const fwd = playerForward.clone();
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const weaponRange = this.getWeaponRange();

    // Update visible 3D Weapon Range Ring around hero
    if (this.rangeRing) {
      this.planet.orientToSphere(this.rangeRing, playerPos.clone().addScaledVector(up, 0.22), up);
      this.rangeRing.rotateX(Math.PI / 2);
      this.rangeRing.scale.setScalar(weaponRange);
    }

    // Update physical 3D Left/Right Side Weapon Pods beside the hero
    const bob = Math.sin(elapsed * 4.5) * 0.16;
    const leftPodPos = this.planet.projectToSurface(playerPos.clone().addScaledVector(right, -2.0), 1.35 + bob);
    const rightPodPos = this.planet.projectToSurface(playerPos.clone().addScaledVector(right, 2.0), 1.35 - bob);
    if (this.leftPod && this.rightPod) {
      const podMat = new THREE.Matrix4().makeBasis(right, up, fwd);
      this.leftPod.position.copy(leftPodPos);
      this.leftPod.quaternion.setFromRotationMatrix(podMat);
      this.rightPod.position.copy(rightPodPos);
      this.rightPod.quaternion.setFromRotationMatrix(podMat);
    }

    // 1. Single Active Weapon Execution
    const aw = this.stats.activeWeapon;
    if (this.orbitGroup) this.orbitGroup.visible = aw === 'orbit';

    if (aw === 'orbit') {
      this.orbitAngle += delta * this.stats.orbitSpinSpeed * totalSpeedMult;
      const bladeDmg = 18 * this.stats.powerMult;
      const count = this.bladeMeshes.length;

      for (let i = 0; i < count; i++) {
        const ang = this.orbitAngle + (i * Math.PI * 2) / count;
        const offset = new THREE.Vector3()
          .addScaledVector(right, Math.cos(ang) * this.stats.orbitRadius)
          .addScaledVector(fwd, Math.sin(ang) * this.stats.orbitRadius);

        const bladePos = this.planet.projectToSurface(playerPos.clone().add(offset), 1.15);
        const blade = this.bladeMeshes[i];
        blade.position.copy(bladePos);
        blade.lookAt(playerPos.clone().addScaledVector(up, 1.15));

        for (const z of zombieManager.zombies) {
          const lastHit = this.bladeHitCooldowns.get(z) || 0;
          if (elapsed - lastHit < 0.25) continue;
          if (z.pos.distanceTo(bladePos) < z.radius + 1.05 * this.stats.bladeScale) {
            this.bladeHitCooldowns.set(z, elapsed);
            const knock = z.pos.clone().sub(playerPos).normalize();
            zombieManager.damageZombie(z, bladeDmg, knock, 8);
            if (elapsed - this._lastShotSfx > 0.18) {
              this._lastShotSfx = elapsed;
              brawlAudio.playSwordSlash();
            }
          }
        }
      }
    } else if (aw === 'dart') {
      this.dartTimer -= delta * totalSpeedMult;
      if (this.dartTimer <= 0) {
        this.dartTimer = 0.65;
        const shots = 1 + Math.floor((this.stats.weaponTier - 1) / 2);
        const dmg = 24 * this.stats.powerMult * (1 + (this.stats.weaponTier - 1) * 0.18);
        const inRangeZ = zombieManager.zombies
          .filter((z) => z.pos.distanceTo(playerPos) <= weaponRange)
          .sort((a, b) => a.pos.distanceTo(playerPos) - b.pos.distanceTo(playerPos));
        for (let s = 0; s < shots; s++) {
          const target = inRangeZ[s] ? inRangeZ[s].pos : null;
          if (target) {
            const origin = s % 2 === 0 ? leftPodPos : rightPodPos;
            this.fireProjectile(
              origin,
              target.clone().addScaledVector(this.planet.getSurfaceNormal(target), 1.1),
              0xa855f7,
              dmg,
              32,
              false,
              null,
              weaponRange
            );
            if (elapsed - this._lastShotSfx > 0.16) {
              this._lastShotSfx = elapsed;
              brawlAudio.playDartShot();
            }
          }
        }
      }
    } else if (aw === 'nova') {
      this.novaTimer -= delta * totalSpeedMult;
      if (this.novaTimer <= 0) {
        this.novaTimer = 2.6;
        brawlAudio.playNovaPulse();
        this.triggerNova(
          playerPos,
          zombieManager.zombies,
          buildings,
          damageBuildingFn,
          (z, d, k, ks) => zombieManager.damageZombie(z, d, k, ks)
        );
      }
    } else if (aw === 'laser') {
      this.laserTimer -= delta * totalSpeedMult;
      if (this.laserTimer <= 0) {
        this.laserTimer = 1.85;
        const dmg = 45 * this.stats.powerMult * (1 + (this.stats.weaponTier - 1) * 0.22);
        const pods = [leftPodPos, rightPodPos];
        const countBeams = this.stats.weaponTier >= 3 ? 2 : 1;
        for (let bIdx = 0; bIdx < countBeams; bIdx++) {
          const origin = pods[bIdx % 2];
          this.fireProjectile(
            origin,
            null,
            0x06b6d4,
            dmg,
            40,
            true,
            playerForward,
            weaponRange
          );
        }
        if (elapsed - this._lastShotSfx > 0.16) {
          this._lastShotSfx = elapsed;
          brawlAudio.playLaserShot();
        }
      }
    }

    // 3. Friendly Captured Turrets (with 3D Muzzle Flash + Shock Ring + Recoil + Glow Pulse)
    for (const t of this.turrets) {
      t.crystal.rotation.y += delta * 2.5;
      t.crystal.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, delta * 10));
      if (t.pillar) {
        t.pillar.material.opacity = 0.22 + Math.sin(elapsed * 4.5) * 0.1;
      }
      if (t.halo) {
        const hs = 1 + Math.sin(elapsed * 3.5) * 0.12;
        t.halo.scale.set(hs, hs, 1);
      }
      t.cooldown -= delta;
      if (t.cooldown <= 0) {
        let nearest = null;
        let minDist = 26;
        for (const z of zombieManager.zombies) {
          const d = z.pos.distanceTo(t.pos);
          if (d < minDist) {
            minDist = d;
            nearest = z;
          }
        }
        if (nearest) {
          t.cooldown = turretCfg.interval;
          t.crystal.scale.setScalar(1.45);
          this.fireProjectile(t.pos, nearest.pos, 0x10b981, turretCfg.damage, 38, false, null, 28);
          this.spawnBurstEffect(t.pos, 0x34d399, 5, 6.0, 0.22);
          if (elapsed - this._lastTurretSfx > 0.25) {
            this._lastTurretSfx = elapsed;
            brawlAudio.playTurretFire();
          }

          const tUp = this.planet.getSurfaceNormal(t.pos);
          const flashRing = new THREE.Mesh(
            new THREE.RingGeometry(0.4, 0.9, 18),
            new THREE.MeshBasicMaterial({
              color: 0x6ee7b7,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.9
            })
          );
          this.planet.orientToSphere(flashRing, t.pos, tUp);
          flashRing.rotateX(Math.PI / 2);
          this.scene.add(flashRing);
          this.effects.push({ mesh: flashRing, age: 0, duration: 0.26, maxScale: 2.8 });
        }
      }
    }

    // 4. Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      const step = p.speed * delta;
      p.travelled += step;
      p.pos.addScaledVector(p.dir, step);
      p.pos.copy(this.planet.projectToSurface(p.pos, 1.25));
      p.mesh.position.copy(p.pos);

      let consumed = false;
      for (const z of zombieManager.zombies) {
        if (p.hitSet.has(z)) continue;
        if (z.pos.distanceTo(p.pos) < z.radius + 0.9) {
          p.hitSet.add(z);
          zombieManager.damageZombie(z, p.dmg, p.dir, 5);
          if (!p.piercing) {
            consumed = true;
            break;
          }
        }
      }

      if (consumed || p.life <= 0 || p.travelled >= p.maxRange) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 5. Visual Ring Effects & Burst Particles
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += delta;
      const t = Math.min(1, e.age / e.duration);
      const s = 1 + t * e.maxScale;
      e.mesh.scale.set(s, s, e.isDome ? s : 1);
      e.mesh.material.opacity = 1 - t;
      if (t >= 1) {
        this.scene.remove(e.mesh);
        this.effects.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.age += delta;
      const t = Math.min(1, pt.age / pt.duration);
      pt.mesh.position.addScaledVector(pt.vel, delta);
      pt.mesh.rotation.x += delta * 9;
      pt.mesh.rotation.y += delta * 9;
      pt.mesh.scale.setScalar(1 - t);
      pt.mesh.material.opacity = 1 - t;
      if (t >= 1) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }

    // 6. Direct Pickup Drops (3D bobbing + spin above grounded shadow; essences expire after maxAge)
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += delta;
      if (d.bodyGrp) {
        d.bodyGrp.rotation.y += delta * 2.8;
        d.bodyGrp.position.y = 0.92 + Math.sin(elapsed * 4.2 + d.phase) * 0.16;
        if (d.bodyGrp.userData.gyroRing) {
          d.bodyGrp.userData.gyroRing.rotation.z += delta * 3.4;
          d.bodyGrp.userData.gyroRing.rotation.x += delta * 1.4;
        }
        if (d.bodyGrp.userData.innerRing) {
          d.bodyGrp.userData.innerRing.rotation.y -= delta * 4.2;
          d.bodyGrp.userData.innerRing.rotation.z += delta * 2.0;
        }
      } else {
        d.mesh.rotation.y += delta * 3.0;
      }

      if (d.maxAge > 0) {
        const rem = d.maxAge - d.age;
        if (rem <= 0) {
          this.scene.remove(d.mesh);
          this.drops.splice(i, 1);
          continue;
        }
        if (rem < 3.5) {
          d.mesh.visible = Math.floor(elapsed * 14) % 2 === 0;
          const sc = 0.68 + (rem / 3.5) * 0.32;
          if (d.bodyGrp) d.bodyGrp.scale.setScalar(sc);
        }
      }

      const dist = d.pos.distanceTo(playerPos);
      if (dist < 2.2) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
        onDropPicked(d.kind);
      }
    }
  }
}
