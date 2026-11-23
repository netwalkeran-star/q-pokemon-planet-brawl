import * as THREE from 'three';
import { saveManager } from './saveManager.js';

export class GemManager {
  constructor(scene, planet) {
    this.scene = scene;
    this.planet = planet;
    this.gems = [];
    this.bursts = []; // 3D Pickup Burst & Shockwave particle effects!
    this.maxGems = 16;
    this.rainbowSpawnTimer = 8.0; // 🌟 全能狂熱寶石每隔幾秒定期出現一次！
    this.rainbowSpawnInterval = 10.0;
    this.skillPackSpawnTimer = 4.0; // 🎁 技能包定時降臨 (5次專屬大招)
    this.gemGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();

    this.scene.add(this.gemGroup);
    this.scene.add(this.fxGroup);
    this.initGems();
  }

  initGems() {
    // 🎁 開局第一時間在玩家前方生成技能包，保證每局必定吃得到！
    this.spawnGem('skillpack', new THREE.Vector3(0, 0.94, 0.35));
    for (let i = 0; i < this.maxGems; i++) {
      this.spawnGem();
    }
  }

  spawnGem(forcedType = null, forcedDir = null) {
    const types = ['speed', 'defense', 'multiplier', 'stealth', 'skillpack'];
    const type = forcedType || types[Math.floor(Math.random() * types.length)];

    const gemData = this.createGemMesh(type);
    let surfacePos;
    if (forcedDir) {
      surfacePos = this.planet.projectToSurface(forcedDir, 1.3);
    } else {
      surfacePos = this.planet.getRandomSurfacePoint(1.3);
    }
    gemData.group.position.copy(surfacePos);

    const normal = surfacePos.clone().normalize();
    gemData.normal = normal;
    gemData.basePos = surfacePos.clone();
    gemData.type = type;

    const up = new THREE.Vector3(0, 1, 0);
    gemData.group.quaternion.setFromUnitVectors(up, normal);

    this.gemGroup.add(gemData.group);
    this.gems.push(gemData);
  }

  createGemLabel(text, bgColor, borderColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 204, 48, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Segoe UI", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 110, 33);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, 2.3, 0);
    sprite.scale.set(2.8, 0.82, 1);
    return sprite;
  }

  createGemMesh(type) {
    const group = new THREE.Group();
    let color, emissive, geo, labelText, bgCol, borderCol;

    if (type === 'speed') {
      color = 0xffd60a;
      emissive = 0xffaa00;
      geo = new THREE.OctahedronGeometry(0.95, 0);
      labelText = '⚡ 加速寶石';
      bgCol = 'rgba(180, 120, 0, 0.9)';
      borderCol = '#ffe600';
    } else if (type === 'defense') {
      color = 0x00bbf9;
      emissive = 0x0077b6;
      geo = new THREE.IcosahedronGeometry(0.95, 0);
      labelText = '🛡️ 防禦(防咬)';
      bgCol = 'rgba(0, 95, 140, 0.9)';
      borderCol = '#4cc9f0';
    } else if (type === 'multiplier') {
      color = 0xff4d6d;
      emissive = 0xc9184a;
      geo = new THREE.DodecahedronGeometry(0.95, 0);
      labelText = '✖️ 雙倍成長';
      bgCol = 'rgba(160, 20, 55, 0.9)';
      borderCol = '#ff8fa3';
    } else if (type === 'stealth') {
      color = 0x9b5de5;
      emissive = 0x7209b7;
      geo = new THREE.ConeGeometry(0.85, 1.6, 6);
      labelText = '👻 隱身寶石';
      bgCol = 'rgba(85, 30, 140, 0.9)';
      borderCol = '#c77dff';
    } else if (type === 'skillpack') {
      color = 0xf59e0b;
      emissive = 0xd97706;
      geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      labelText = '🎁 技能包 (5次)';
      bgCol = 'rgba(180, 83, 9, 0.95)';
      borderCol = '#fbbf24';
    } else {
      color = 0xff66cc;
      emissive = 0xd90429;
      geo = new THREE.TetrahedronGeometry(1.05);
      labelText = '🌟 全能狂熱';
      bgCol = 'rgba(160, 30, 130, 0.92)';
      borderCol = '#ffafcc';
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.25,
      clearcoat: 1.0
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);

    // 1. Vertical Glowing Light Beam Pillar ("寶石光柱特效")
    const isPack = type === 'skillpack';
    const beamGeo = new THREE.CylinderGeometry(
      isPack ? 0.8 : 0.55,
      isPack ? 1.4 : 1.15,
      isPack ? 18.0 : 3.6,
      16,
      1,
      true
    );
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isPack ? 0.45 : 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = isPack ? 8.0 : 0.6;
    group.add(beam);

    // 2. Dual Counter-Rotating Magic Rings
    const ringGeo = new THREE.RingGeometry(1.15, 1.38, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const outerRingGeo = new THREE.RingGeometry(1.55, 1.68, 6);
    const outerRing = new THREE.Mesh(outerRingGeo, ringMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -0.25;
    group.add(outerRing);

    // 3. Orbiting 3D Sparkle Particles ("環繞星芒粒子特效")
    const sparklesGroup = new THREE.Group();
    const sparkGeo = new THREE.OctahedronGeometry(0.22, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let s = 0; s < 4; s++) {
      const sp = new THREE.Mesh(sparkGeo, sparkMat);
      const ang = (s / 4) * Math.PI * 2;
      sp.position.set(Math.cos(ang) * 1.45, (s % 2 === 0 ? 0.45 : -0.35), Math.sin(ang) * 1.45);
      sparklesGroup.add(sp);
    }
    group.add(sparklesGroup);

    // Floating attribute badge above the gem
    const label = this.createGemLabel(labelText, bgCol, borderCol);
    group.add(label);

    return { group, mesh, ring, outerRing, sparklesGroup, beam, color, type };
  }

  /**
   * Spawns a dramatic 3D Shockwave + Crystal Particle Explosion when a gem is picked up!
   */
  spawnPickupBurst(worldPos, normal, colorHex) {
    const burstGroup = new THREE.Group();
    burstGroup.position.copy(worldPos);
    const up = new THREE.Vector3(0, 1, 0);
    burstGroup.quaternion.setFromUnitVectors(up, normal);

    // Expanding shockwave ring
    const waveMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const waveRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.35, 28), waveMat);
    waveRing.rotation.x = Math.PI / 2;
    burstGroup.add(waveRing);

    // 12 Flying 3D Star Shards
    const particles = [];
    const shardGeo = new THREE.OctahedronGeometry(0.32, 0);
    const shardMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 1.0
    });

    for (let i = 0; i < 12; i++) {
      const shard = new THREE.Mesh(shardGeo, shardMat);
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const speedH = 4.5 + Math.random() * 4.5;
      const speedV = 4.0 + Math.random() * 5.0;
      shard.userData = {
        vx: Math.cos(angle) * speedH,
        vy: speedV,
        vz: Math.sin(angle) * speedH
      };
      burstGroup.add(shard);
      particles.push(shard);
    }

    this.fxGroup.add(burstGroup);
    this.bursts.push({
      group: burstGroup,
      waveRing,
      waveMat,
      shardMat,
      particles,
      age: 0,
      duration: 0.75
    });
  }

  update(delta) {
    const time = Date.now() * 0.0035;

    // Periodic Rainbow Gem Spawner ("🌟 全能狂熱寶石... 幾秒出現一次")
    this.rainbowSpawnTimer -= delta;
    if (this.rainbowSpawnTimer <= 0) {
      this.rainbowSpawnTimer = this.rainbowSpawnInterval;
      const currentRainbows = this.gems.filter((g) => g.type === 'rainbow').length;
      if (currentRainbows < 3) {
        this.spawnGem('rainbow');
      }
    }

    // Periodic Skill Pack Spawner ("問題三：加入技能包 吃到一個有5次技能")
    this.skillPackSpawnTimer -= delta;
    if (this.skillPackSpawnTimer <= 0) {
      this.skillPackSpawnTimer = 18.0;
      const hasSkillPack = this.gems.some((g) => g.type === 'skillpack');
      if (!hasSkillPack) {
        this.spawnGem('skillpack');
      }
    }

    this.gems.forEach((gem) => {
      gem.mesh.rotation.y += delta * 2.4;
      gem.mesh.rotation.x += delta * 1.3;
      gem.ring.rotation.z += delta * 1.8;
      if (gem.outerRing) gem.outerRing.rotation.z -= delta * 1.4;
      if (gem.sparklesGroup) {
        gem.sparklesGroup.rotation.y -= delta * 3.2;
        gem.sparklesGroup.position.y = Math.sin(time * 2.0) * 0.25;
      }

      const bob = Math.sin(time + gem.basePos.x) * 0.42;
      gem.group.position.copy(gem.basePos).add(gem.normal.clone().multiplyScalar(bob));

      if (gem.type === 'rainbow') {
        const hue = (Date.now() % 1200) / 1200;
        gem.mesh.material.color.setHSL(hue, 1.0, 0.6);
        gem.mesh.material.emissive.setHSL(hue, 1.0, 0.35);
      }
    });

    // Update active 3D pickup bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += delta;
      const progress = b.age / b.duration;

      if (progress >= 1.0) {
        this.fxGroup.remove(b.group);
        this.bursts.splice(i, 1);
        continue;
      }

      // Expand shockwave ring if present
      if (b.waveRing) {
        const scale = 1.0 + progress * 4.2;
        b.waveRing.scale.setScalar(scale);
        if (b.waveMat) b.waveMat.opacity = (1.0 - progress) * 0.9;
        if (b.shardMat) b.shardMat.opacity = 1.0 - progress;
      }
      if (b.waveRing2) {
        const scale2 = 1.0 + progress * 5.5;
        b.waveRing2.scale.setScalar(scale2);
        if (b.waveMat2) b.waveMat2.opacity = (1.0 - progress) * 0.8;
      }

      // Fly & spin crystal shards
      b.particles.forEach((p) => {
        p.position.x += p.userData.vx * delta;
        p.position.y += p.userData.vy * delta;
        p.position.z += p.userData.vz * delta;
        p.userData.vy -= 12.0 * delta; // gravity back toward surface
        p.rotation.x += delta * 8;
        p.rotation.y += delta * 8;
      });
    }
  }

  /**
   * 🌟 跳殺特效：咬斷對手時爆開雙重震撼衝擊波光環 + 彩色旋轉星星糖果碎片雨 (Super Juicy Feedback!)
   */
  spawnStarCandyExplosion(pos, normal, count = 20) {
    const group = new THREE.Group();
    group.position.copy(pos);
    const up = new THREE.Vector3(0, 1, 0);
    group.quaternion.setFromUnitVectors(up, normal);

    // 💫 雙重衝擊波光環 (Dual Expanding Neon Shockwaves)
    const waveGeo = new THREE.RingGeometry(0.5, 0.95, 32);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const waveRing = new THREE.Mesh(waveGeo, waveMat);
    waveRing.rotation.x = Math.PI / 2;
    waveRing.position.y = 0.15;
    group.add(waveRing);

    const waveMat2 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const waveRing2 = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.65, 24), waveMat2);
    waveRing2.rotation.x = Math.PI / 2;
    waveRing2.position.y = 0.18;
    group.add(waveRing2);

    const colors = [0xffd166, 0x06d6a0, 0x118ab2, 0xef476f, 0xc77dff, 0xff70a6, 0xffbe0b];
    const candies = [];

    for (let i = 0; i < count; i++) {
      const geo = Math.random() > 0.5 ? new THREE.OctahedronGeometry(0.42, 0) : new THREE.DodecahedronGeometry(0.35, 0);
      const color = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.15
      });
      const mesh = new THREE.Mesh(geo, mat);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 4.8 + Math.random() * 6.5;
      mesh.userData = {
        vx: Math.cos(angle) * speed,
        vy: 4.2 + Math.random() * 4.8,
        vz: Math.sin(angle) * speed,
        rotSpeedX: (Math.random() - 0.5) * 16,
        rotSpeedY: (Math.random() - 0.5) * 16
      };

      group.add(mesh);
      candies.push(mesh);
    }

    this.fxGroup.add(group);
    this.bursts.push({
      group,
      waveRing,
      waveRing2,
      waveMat,
      waveMat2,
      particles: candies,
      age: 0,
      duration: 1.2,
      isStarCandy: true
    });
  }

  checkCollision(entityPos, pickupRadius = 2.25, isPlayer = false) {
    let effectiveRadius = pickupRadius;
    if (isPlayer) {
      // Magnet Talent + Mike Cape Bonus (+50%): pickup radius
      const magnetBonus = saveManager.getTalentBonus('magnet') + saveManager.getCapeBonus('magnet');
      effectiveRadius = pickupRadius * (1.0 + magnetBonus);
    }

    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      if (gem.group.position.distanceTo(entityPos) < effectiveRadius) {
        const collectedType = gem.type;
        // Trigger 3D Pickup Burst VFX!
        this.spawnPickupBurst(gem.group.position, gem.normal, gem.color);

        this.gemGroup.remove(gem.group);
        this.gems.splice(i, 1);

        if (collectedType !== 'rainbow') {
          setTimeout(() => this.spawnGem(), 2200);
        }
        return collectedType;
      }
    }
    return null;
  }

  getNearestGemPos(pos, maxDist = 22.0) {
    let bestPos = null;
    let bestDist = maxDist;
    for (let i = 0; i < this.gems.length; i++) {
      const d = this.gems[i].group.position.distanceTo(pos);
      if (d < bestDist) {
        bestDist = d;
        bestPos = this.gems[i].group.position;
      }
    }
    return bestPos;
  }

  clear() {
    while (this.gemGroup.children.length > 0) {
      this.gemGroup.remove(this.gemGroup.children[0]);
    }
    while (this.fxGroup.children.length > 0) {
      this.fxGroup.remove(this.fxGroup.children[0]);
    }
    this.gems = [];
    this.bursts = [];
    this.rainbowSpawnTimer = 8.0;
    this.skillPackSpawnTimer = 3.0;
    this.initGems();
  }
}
