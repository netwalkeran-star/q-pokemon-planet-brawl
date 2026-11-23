import * as THREE from 'three';
import { createContactShadowTexture } from '../src/textures.js';

const zombieShadowTex = createContactShadowTexture();

export const ZOMBIE_TYPES = {
  shiba: {
    name: '柴犬殭屍',
    hp: 25,
    speed: 3.8,
    damage: 6,
    knockbackResist: 0.15,
    scale: 0.95,
    bodyColor: 0xf97316,
    accentColor: 0xfef08a,
    radius: 1.05
  },
  penguin: {
    name: '企鵝殭屍',
    hp: 20,
    speed: 3.0,
    damage: 6,
    knockbackResist: 0.15,
    scale: 0.88,
    bodyColor: 0x1e3a8a,
    accentColor: 0xfbbf24,
    radius: 0.95
  },
  bunny: {
    name: '跳跳兔殭屍',
    hp: 30,
    speed: 4.2,
    damage: 6,
    knockbackResist: 0.15,
    scale: 0.95,
    bodyColor: 0xec4899,
    accentColor: 0xfdf2f8,
    radius: 1.0,
    hopper: true
  },
  panda: {
    name: '熊貓殭屍',
    hp: 75,
    speed: 2.2,
    damage: 6,
    knockbackResist: 0.6,
    scale: 1.25,
    bodyColor: 0x1f2937,
    accentColor: 0xf8fafc,
    radius: 1.35
  },
  fox: {
    name: '暗影狐殭屍',
    hp: 55,
    speed: 4.4,
    damage: 6,
    knockbackResist: 0.25,
    scale: 1.05,
    bodyColor: 0x7e22ce,
    accentColor: 0xe879f9,
    radius: 1.1,
    elite: true
  },
  gorilla: {
    name: '猩猩殭屍隊長',
    hp: 360,
    speed: 2.6,
    damage: 12,
    knockbackResist: 0.82,
    scale: 1.8,
    bodyColor: 0x991b1b,
    accentColor: 0xfacc15,
    radius: 1.9,
    boss: true
  }
};

function createZombieMesh(typeKey) {
  const cfg = ZOMBIE_TYPES[typeKey] || ZOMBIE_TYPES.shiba;
  const root = new THREE.Group();

  // Contact shadow disc so every zombie looks firmly grounded on the 3D sphere
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 16),
    new THREE.MeshBasicMaterial({
      map: zombieShadowTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  root.add(shadow);

  const bodyMat = new THREE.MeshToonMaterial({ color: cfg.bodyColor });
  const accentMat = new THREE.MeshToonMaterial({ color: cfg.accentColor });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
  const talismanMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  // Chibi torso
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), bodyMat);
  torso.scale.set(1, 0.95, 0.9);
  torso.position.y = 0.7;
  torso.castShadow = true;
  root.add(torso);

  // Chibi big head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 10), bodyMat);
  head.position.set(0, 1.55, 0.12);
  head.castShadow = true;
  root.add(head);

  // Glowing red zombie eyes
  [-0.24, 0.24].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    eye.position.set(x, 1.6, 0.72);
    root.add(eye);
  });

  // Forehead talisman (Q-version Jiangshi charm)
  const charm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.04), talismanMat);
  charm.position.set(0, 1.95, 0.68);
  charm.rotation.x = -0.15;
  root.add(charm);

  // Outstretched zombie arms
  [-0.65, 0.65].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.42, 4, 6), accentMat);
    arm.rotation.x = Math.PI / 2.2;
    arm.position.set(x, 0.9, 0.45);
    root.add(arm);
  });

  // Species-specific cute ears / beak / tails
  if (typeKey === 'shiba' || typeKey === 'fox') {
    [-0.36, 0.36].forEach((x) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 5), accentMat);
      ear.position.set(x, 2.22, 0.08);
      ear.rotation.z = -x * 0.45;
      root.add(ear);
    });
  } else if (typeKey === 'bunny') {
    [-0.24, 0.24].forEach((x, idx) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.58, 4, 6), accentMat);
      ear.position.set(x, 2.38, 0.05);
      ear.rotation.z = idx === 0 ? 0.18 : -0.42;
      root.add(ear);
    });
  } else if (typeKey === 'penguin') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 5), accentMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.48, 0.85);
    root.add(beak);
  } else if (typeKey === 'panda') {
    [-0.42, 0.42].forEach((x) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), accentMat);
      ear.position.set(x, 2.1, 0.05);
      root.add(ear);
    });
  } else if (typeKey === 'gorilla') {
    const crest = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), accentMat);
    crest.scale.set(1.2, 0.65, 0.9);
    crest.position.set(0, 2.05, 0.0);
    root.add(crest);
  }

  root.scale.setScalar(cfg.scale);
  return { root, head, bodyMat };
}

export class ZombieManager {
  constructor(scene, planet) {
    this.scene = scene;
    this.planet = planet;
    this.zombies = [];
  }

  clearAll() {
    for (const z of this.zombies) {
      this.scene.remove(z.mesh);
    }
    this.zombies = [];
  }

  spawnZombie(typeKey, worldPos, stageMult = { hp: 1, speed: 1 }) {
    const cfg = ZOMBIE_TYPES[typeKey] || ZOMBIE_TYPES.shiba;
    const { root, head, bodyMat } = createZombieMesh(typeKey);
    const pos = this.planet.projectToSurface(worldPos, 0);
    root.position.copy(pos);
    this.scene.add(root);

    const speedVariance = cfg.boss ? 1.0 : 0.78 + Math.random() * 0.47;
    const zombie = {
      typeKey,
      cfg,
      mesh: root,
      head,
      bodyMat,
      origColor: cfg.bodyColor,
      pos,
      vel: new THREE.Vector3(),
      hp: Math.round(cfg.hp * stageMult.hp),
      maxHp: Math.round(cfg.hp * stageMult.hp),
      speed: cfg.speed * stageMult.speed * speedVariance,
      damage: cfg.damage,
      radius: cfg.radius,
      phase: Math.random() * Math.PI * 2,
      flashTimer: 0
    };
    this.zombies.push(zombie);
    return zombie;
  }

  damageZombie(zombie, amount, knockDir = null, knockStrength = 7) {
    zombie.hp -= amount;
    zombie.flashTimer = 0.1;
    zombie.bodyMat.color.setHex(0xffffff);

    if (knockDir) {
      const resist = zombie.cfg.knockbackResist || 0;
      const force = knockStrength * (1 - resist);
      zombie.vel.addScaledVector(knockDir, force);
    }
  }

  update(delta, elapsed, playerPos, onPlayerHit, onZombieKilled) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      if (z.hp <= 0) {
        this.scene.remove(z.mesh);
        this.zombies.splice(i, 1);
        onZombieKilled(z);
        continue;
      }

      // Flash recovery
      if (z.flashTimer > 0) {
        z.flashTimer -= delta;
        if (z.flashTimer <= 0) {
          z.bodyMat.color.setHex(z.origColor);
        }
      }

      const up = this.planet.getSurfaceNormal(z.pos);
      const toPlayer = new THREE.Vector3().subVectors(playerPos, z.pos);
      const dist = toPlayer.length();

      // Tangent direction toward player
      const dir = toPlayer.sub(up.clone().multiplyScalar(toPlayer.dot(up)));
      if (dir.lengthSq() > 1e-6) {
        dir.normalize();
      } else {
        dir.set(0, 0, 1);
      }

      // Hopper burst every ~2s
      let spd = z.speed;
      let hopY = 0;
      if (z.cfg.hopper) {
        const cyc = (elapsed + z.phase) % 2.0;
        if (cyc < 0.45) {
          spd *= 1.65;
          hopY = Math.sin((cyc / 0.45) * Math.PI) * 1.1;
        }
      } else {
        hopY = Math.abs(Math.sin(elapsed * 8 + z.phase)) * 0.22;
      }

      // Apply movement + decaying knockback velocity
      z.pos.addScaledVector(dir, spd * delta);
      z.pos.addScaledVector(z.vel, delta);
      z.vel.multiplyScalar(Math.max(0, 1 - delta * 6));
      z.pos.copy(this.planet.projectToSurface(z.pos, hopY));

      // Orient to sphere facing player
      const right = new THREE.Vector3().crossVectors(up, dir).normalize();
      const rotMat = new THREE.Matrix4().makeBasis(right, up, dir);
      z.mesh.position.copy(z.pos);
      z.mesh.quaternion.setFromRotationMatrix(rotMat);

      // Cute waddle
      z.mesh.rotateZ(Math.sin(elapsed * 10 + z.phase) * 0.08);

      // Player collision check
      if (dist < z.radius + 1.0) {
        onPlayerHit(z.damage, dir.clone().negate());
      }
    }
  }
}
