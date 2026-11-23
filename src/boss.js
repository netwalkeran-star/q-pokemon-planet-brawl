import * as THREE from 'three';
import { sound } from './sound.js';

export class BossManager {
  constructor(scene, planet, stage = 1) {
    this.scene = scene;
    this.planet = planet;
    this.stage = stage;
    this.bossGroup = new THREE.Group();
    this.isAlive = false;
    this.health = 100;
    this.maxHealth = 100;
    this.speed = 5.8;
    this.state = 'idle';
    this.stunTimer = 0;
    this.dizzyStars = [];

    this.scene.add(this.bossGroup);
  }

  spawnBoss(stage = 1) {
    this.stage = stage;
    this.isAlive = true;
    this.maxHealth = 100 + (stage - 1) * 50;
    this.health = this.maxHealth;
    this.state = 'idle';

    while (this.bossGroup.children.length > 0) {
      this.bossGroup.remove(this.bossGroup.children[0]);
    }
    this.dizzyStars = [];

    this.position = this.planet.getRandomSurfacePoint(2.6);
    this.normal = this.planet.getSurfaceNormal(this.position);
    this.forward = new THREE.Vector3(1, 0, 0).cross(this.normal).normalize();

    this.buildChibiBossModel(stage);
    sound.playBossSpawn();
  }

  buildChibiBossModel(stage) {
    if (stage === 1) {
      // 台北守護神：超極巨岩石巨獸 (Weak to Thunder / Pikachu)
      this.bossName = '台北守護神・超極巨大岩怪';
      this.weakness = 'thunder';

      // Round chunky body
      const bodyGeo = new THREE.SphereGeometry(3.0, 24, 20);
      this.bossMat = new THREE.MeshToonMaterial({ color: 0x8d6e63 });
      this.bodyMesh = new THREE.Mesh(bodyGeo, this.bossMat);
      this.bodyMesh.scale.set(1.15, 1.0, 1.1);
      this.bossGroup.add(this.bodyMesh);

      // Cute Giant Cartoon Eye
      const eyeGeo = new THREE.SphereGeometry(1.25, 20, 20);
      const eyeMat = new THREE.MeshToonMaterial({ color: 0xffffff });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0, 0.5, 2.3);

      // Big Purple/Red Pupil
      const pupilGeo = new THREE.SphereGeometry(0.7, 16, 16);
      this.pupilMat = new THREE.MeshBasicMaterial({ color: 0x9c27b0 });
      this.pupil = new THREE.Mesh(pupilGeo, this.pupilMat);
      this.pupil.position.set(0, 0, 0.7);

      // Cartoon highlight
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      spark.position.set(0.2, 0.25, 0.6);
      this.pupil.add(spark);

      eye.add(this.pupil);
      this.bodyMesh.add(eye);

      // Tiny Flapping Wings (Cute contrast to big rock body!)
      this.wings = [];
      [-1, 1].forEach((side) => {
        const wingGeo = new THREE.ConeGeometry(0.9, 2.2, 4);
        const wingMat = new THREE.MeshToonMaterial({ color: 0xffe082 });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(side * 3.2, 0.5, -0.5);
        wing.rotation.z = side * 1.2;
        this.bodyMesh.add(wing);
        this.wings.push({ mesh: wing, side });
      });

      // Dizzy Stars Ring (shows when stunned!)
      this.starRing = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const star = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
        const angle = (i / 4) * Math.PI * 2;
        star.position.set(Math.cos(angle) * 1.8, 3.8, Math.sin(angle) * 1.8);
        this.starRing.add(star);
      }
      this.starRing.visible = false;
      this.bossGroup.add(this.starRing);
    } else if (stage === 2) {
      // 京都守護神：傳說冰晶神鳥 (Weak to Fire / Charmander)
      this.bossName = '京都守護神・急凍冰晶鳥';
      this.weakness = 'fire';

      const bodyGeo = new THREE.CapsuleGeometry(1.6, 2.2, 8, 16);
      this.bossMat = new THREE.MeshToonMaterial({ color: 0x81d4fa });
      this.bodyMesh = new THREE.Mesh(bodyGeo, this.bossMat);
      this.bossGroup.add(this.bodyMesh);

      // Big Glitter Wings
      this.wings = [];
      [-1, 1].forEach((side) => {
        const wingGeo = new THREE.ConeGeometry(2.4, 4.2, 3);
        const wingMat = new THREE.MeshToonMaterial({
          color: 0xe1f5fe,
          transparent: true,
          opacity: 0.88
        });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(side * 2.8, 0.6, 0);
        wing.rotation.z = side * 1.1;
        this.bodyMesh.add(wing);
        this.wings.push({ mesh: wing, side });
      });
    } else {
      // 上海守護神：烈焰噴火巨龍 (Weak to Ice / Squirtle)
      this.bossName = '上海守護神・超極巨噴火龍';
      this.weakness = 'ice';

      const bodyGeo = new THREE.SphereGeometry(3.2, 24, 20);
      this.bossMat = new THREE.MeshToonMaterial({ color: 0xff5252 });
      this.bodyMesh = new THREE.Mesh(bodyGeo, this.bossMat);
      this.bossGroup.add(this.bodyMesh);

      // Cute Dragon Horns
      [-1, 1].forEach((side) => {
        const hornGeo = new THREE.ConeGeometry(0.6, 2.0, 6);
        const hornMat = new THREE.MeshToonMaterial({ color: 0xffd740 });
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(side * 1.8, 2.4, 0);
        horn.rotation.z = -side * 0.4;
        this.bodyMesh.add(horn);
      });
    }
  }

  update(delta, playerPos) {
    if (!this.isAlive) return;

    // Wing flapping
    if (this.wings) {
      const flap = Math.sin(Date.now() * 0.015) * 0.4;
      this.wings.forEach((w) => {
        w.mesh.rotation.x = flap;
      });
    }

    // Stunned State & Dizzy stars
    if (this.state === 'stunned') {
      this.stunTimer -= delta;
      if (this.starRing) {
        this.starRing.visible = true;
        this.starRing.rotation.y += delta * 6.0;
      }
      if (this.stunTimer <= 0) {
        this.state = 'idle';
        if (this.starRing) this.starRing.visible = false;
        this.bossMat.color.setHex(this.stage === 1 ? 0x8d6e63 : this.stage === 2 ? 0x81d4fa : 0xff5252);
      }
      return;
    }

    // Normal Tracking AI
    this.normal = this.planet.getSurfaceNormal(this.position);
    const toPlayer = playerPos.clone().sub(this.position);
    const tangentToPlayer = toPlayer.sub(this.normal.clone().multiplyScalar(toPlayer.dot(this.normal))).normalize();

    this.forward.lerp(tangentToPlayer, delta * 2.8).normalize();

    const moveStep = this.forward.clone().multiplyScalar(this.speed * delta);
    this.position.add(moveStep);
    this.position = this.planet.projectToSurface(this.position, 2.6);

    this.bossGroup.position.copy(this.position);

    const right = new THREE.Vector3().crossVectors(this.normal, this.forward).normalize();
    const rotMat = new THREE.Matrix4().makeBasis(right, this.normal, this.forward);
    this.bossGroup.quaternion.setFromRotationMatrix(rotMat);

    // Cute bouncing while hopping forward
    const hop = Math.abs(Math.sin(Date.now() * 0.008)) * 0.8;
    this.bodyMesh.position.y = hop;
  }

  takeDamage(amount, element) {
    if (!this.isAlive) return;

    let multiplier = 1.0;
    let isCrit = false;

    if (element === this.weakness) {
      multiplier = 2.5;
      isCrit = true;
      this.state = 'stunned';
      this.stunTimer = 2.2;
    } else if (element === 'fever') {
      multiplier = 3.0;
      isCrit = true;
    }

    const finalDamage = amount * multiplier;
    this.health = Math.max(0, this.health - finalDamage);

    sound.playBossHit();

    this.bossMat.color.setHex(0xffffff);
    setTimeout(() => {
      if (this.isAlive && this.state !== 'stunned') {
        this.bossMat.color.setHex(this.stage === 1 ? 0x8d6e63 : this.stage === 2 ? 0x81d4fa : 0xff5252);
      }
    }, 120);

    if (this.health <= 0) {
      this.isAlive = false;
      this.scene.remove(this.bossGroup);
      sound.playVictory();
    }

    return { finalDamage, isCrit, isDefeated: !this.isAlive };
  }
}
