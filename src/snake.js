import * as THREE from 'three';
import { sound } from './sound.js';
import { createPokemonMesh, animatePokemonRun, updateHeadCountBadge, createMonstersIncCapeMesh, POKEMON_DATA } from './pokemon.js';
import { saveManager } from './saveManager.js';

export class ChibiSnake {
  constructor(scene, planet, initialSpecies = 'pikachu') {
    this.scene = scene;
    this.planet = planet;
    this.radius = planet.radius;
    this.hoverHeight = 0.25;

    // Movement params - Controlled walking (Up/W or Click-to-Walk)
    const passiveSpeedBonus = saveManager.getTalentBonus('swiftMove'); // +10% ~ +30%
    const capeSpeedBonus = saveManager.getCapeBonus('speed'); // Boo Cape: +15%
    this.baseSpeed = 7.2 * (1.0 + passiveSpeedBonus + capeSpeedBonus);
    this.speed = this.baseSpeed;
    this.turnSpeed = 2.2;
    this.currentTurn = 0;
    this.isMoving = false;
    this.targetPoint = null;

    // Jump Physics
    this.isJumping = false;
    this.jumpTimer = 0;
    this.jumpDuration = 0.85;
    this.maxJumpHeight = 4.8;
    this.currentJumpOffset = 0;

    // Pokémon Species (Locked once chosen!) & Stackable Gem Buffs ("寶石效能可以重疊 5次")
    this.species = initialSpecies;
    this.element = 'normal';
    this.buffs = {
      speed: { stacks: 0, maxStacks: 5, timer: 0, maxDuration: 20.0 },      // 第5次 2x (1.2x -> 2.0x)
      defense: { stacks: 0, maxStacks: 5, timer: 0, maxDuration: 20.0 },    // 第5次 80% (16% -> 80%)
      multiplier: { stacks: 0, maxStacks: 5, timer: 0, maxDuration: 20.0 }, // 第5次 100% 2節機率 (20% -> 100%)
      stealth: { stacks: 0, maxStacks: 1, timer: 0, maxDuration: 30.0 }     // 不累計 一次 30秒
    };

    // Randall Cape: 10s automatic stealth on start!
    const startingStealth = saveManager.getCapeBonus('stealth');
    if (startingStealth > 0) {
      this.buffs.stealth.timer = startingStealth;
    }

    this.skillCooldown = 0;
    this.isDashing = false;
    this.dashTimer = 0;
    this.isInvincible = false;
    this.biteCooldown = 0;

    // 🎁 問題三：技能包 5 次專屬大招充能
    this.skillCharges = 0;
    this.maxSkillCharges = 5;

    // 🍔 問題二：吃豆子/身體時的頭部彈簧動畫 (Squish & Stretch)
    this.headSquishTimer = 0;
    this.headBaseScale = 1.05 * 1.3 * 1.2;

    // Mesh Groups
    this.group = new THREE.Group();
    this.segments = [];
    this.pathHistory = [];
    this.minSegmentDist = 1.65;

    // Start at upper-front hemisphere
    this.position = this.planet.projectToSurface(new THREE.Vector3(0, 0.92, 0.38), this.hoverHeight);
    this.normal = this.planet.getSurfaceNormal(this.position);
    this.forward = new THREE.Vector3(0, 0.38, -0.92)
      .sub(this.normal.clone().multiplyScalar(new THREE.Vector3(0, 0.38, -0.92).dot(this.normal)))
      .normalize();

    this.createPokemonHead();
    this.createTargetMarker();

    // Starter Squad Talent Bonus (開局多帶 2 ~ 4 隻隊員)
    const extraSquad = saveManager.getTalentBonus('starterSquad');
    this.createInitialBody(2 + extraSquad); // 預設 2 身體 + 額外天賦隊員

    for (let i = 120; i >= 0; i--) {
      const p = this.planet.projectToSurface(
        this.position.clone().sub(this.forward.clone().multiplyScalar(i * 0.12)),
        this.hoverHeight
      );
      this.pathHistory.push({
        pos: p,
        normal: this.planet.getSurfaceNormal(p),
        forward: this.forward.clone(),
        jumpOffset: 0
      });
    }

    this.scene.add(this.group);
  }

  createTargetMarker() {
    this.targetMarker = new THREE.Group();
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.35, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffb703,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      })
    );
    outerRing.rotation.x = Math.PI / 2;
    this.targetMarker.add(outerRing);

    const innerDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 20),
      new THREE.MeshBasicMaterial({
        color: 0xfb8500,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      })
    );
    innerDot.rotation.x = Math.PI / 2;
    innerDot.position.y = 0.05;
    this.targetMarker.add(innerDot);

    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);
  }

  setTargetPoint(worldPoint) {
    this.targetPoint = this.planet.projectToSurface(worldPoint, this.hoverHeight);
    if (this.targetMarker) {
      const normal = this.planet.getSurfaceNormal(this.targetPoint);
      this.targetMarker.position.copy(this.planet.projectToSurface(worldPoint, 0.45));
      const up = new THREE.Vector3(0, 1, 0);
      this.targetMarker.quaternion.setFromUnitVectors(up, normal);
      this.targetMarker.visible = true;
    }
  }

  clearTargetPoint() {
    this.targetPoint = null;
    if (this.targetMarker) {
      this.targetMarker.visible = false;
    }
  }

  createPokemonHead() {
    if (this.headGroup) {
      this.group.remove(this.headGroup);
    }
    this.headGroup = new THREE.Group();

    // ⭐ 第一個主體加大 1.3X，並依需求再加大 1.2X (共 1.56X 突出霸氣！)
    const leaderScale = 1.05 * 1.3 * 1.2;
    this.pokemonHead = createPokemonMesh(this.species, true, leaderScale);
    this.headGroup.add(this.pokemonHead);

    const color = POKEMON_DATA[this.species]?.color || 0xffd924;

    // ⭐ 真人貪吃蛇頭頂光柱 (垂直衝天光柱，遠處一目了然！)
    const beaconGeo = new THREE.CylinderGeometry(0.12, 0.45, 5.5, 16, 1, true);
    beaconGeo.translate(0, 2.75, 0); // Base at head, upward
    const beaconMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.headGroup.add(this.beaconMesh);

    // 光柱頂端星光結晶
    const beaconOrbGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const beaconOrbMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    this.beaconOrb = new THREE.Mesh(beaconOrbGeo, beaconOrbMat);
    this.beaconOrb.position.y = 5.5;
    this.headGroup.add(this.beaconOrb);

    // Aura Ring under the leader (scaled for 1.56x)
    const auraGeo = new THREE.TorusGeometry(1.75 * 1.3 * 1.2, 0.14, 12, 32);
    this.auraMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55
    });
    this.auraMesh = new THREE.Mesh(auraGeo, this.auraMat);
    this.auraMesh.rotation.x = Math.PI / 2;
    this.auraMesh.position.y = 0.08;
    this.headGroup.add(this.auraMesh);

    // 3D Protective Defense Shield Bubble (Scaled for 1.56x)
    const shieldGeo = new THREE.SphereGeometry(2.1 * 1.3 * 1.2, 20, 20);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x00bbf9,
      emissive: 0x0077b6,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      clearcoat: 1.0,
      wireframe: false
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.1 * 1.3 * 1.2;
    this.shieldMesh.visible = false;
    this.headGroup.add(this.shieldMesh);

    // 3D Orbiting Gem Buff Sparkles around Player when Buff is Active!
    this.buffSparkles = new THREE.Group();
    this.buffSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffd60a });
    const spGeo = new THREE.OctahedronGeometry(0.28, 0);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(spGeo, this.buffSparkleMat);
      const ang = (i / 6) * Math.PI * 2;
      sp.position.set(Math.cos(ang) * 2.3 * 1.2, 0.8 + (i % 2) * 0.6, Math.sin(ang) * 2.3 * 1.2);
      this.buffSparkles.add(sp);
    }
    this.buffSparkles.visible = false;
    this.headGroup.add(this.buffSparkles);

    // Attach equipped Monsters, Inc. Floating Hat
    this.updateEquippedCape();

    this.group.add(this.headGroup);
  }

  /**
   * 🏭 裝備怪獸電力公司頭頂懸空魔幻帽子（3D 即時穿脫）
   */
  updateEquippedCape() {
    if (!this.headGroup) return;

    // Remove old hat if present
    const oldCape = this.headGroup.children.find((c) => c.userData && c.userData.isCape);
    if (oldCape) {
      this.headGroup.remove(oldCape);
    }

    const equippedId = saveManager.getEquippedCape();
    if (equippedId) {
      const capeMesh = createMonstersIncCapeMesh(equippedId, this.species);
      if (capeMesh) {
        // Position hat to fit on 1.56x enlarged leader (1.3 * 1.2)
        capeMesh.scale.set(1.3 * 1.2, 1.3 * 1.2, 1.3 * 1.2);
        this.headGroup.add(capeMesh);
      }
    }
  }

  createInitialBody(count) {
    for (let i = 0; i < count; i++) {
      this.addSegment();
    }
  }

  addSegment() {
    const index = this.segments.length;
    const scale = Math.max(0.54, 0.82 - index * 0.012);

    const segGroup = createPokemonMesh(this.species, false, scale);

    const initPos = this.position
      .clone()
      .add(this.forward.clone().multiplyScalar(-(index + 1) * this.minSegmentDist));
    segGroup.position.copy(this.planet.projectToSurface(initPos, this.hoverHeight));

    // If currently in stealth mode, apply translucency to new segment too
    if (this.isStealthActive()) {
      this.setObjectOpacity(segGroup, 0.35);
    }

    this.group.add(segGroup);
    this.segments.push({ group: segGroup, scale, species: this.species });
  }

  transformToPokemon(newSpecies) {
    if (!POKEMON_DATA[newSpecies]) return;
    this.species = newSpecies;

    this.createPokemonHead();

    const count = this.segments.length;
    this.segments.forEach((seg) => this.group.remove(seg.group));
    this.segments = [];
    for (let i = 0; i < count; i++) {
      this.addSegment();
    }

    sound.playEvolve();
  }

  // Lose 1 body segment when bitten by an NPC (Does NOT die!)
  loseSegment() {
    if (this.segments.length === 0) return false;
    const removed = this.segments.pop();
    if (removed) {
      this.group.remove(removed.group);
    }
    sound.playHurt();
    return true;
  }

  setObjectOpacity(obj, opacity) {
    obj.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (opacity < 1.0) {
            if (m.userData.origOpacity === undefined) {
              m.userData.origOpacity = m.opacity;
              m.userData.origTransparent = m.transparent;
            }
            m.transparent = true;
            m.opacity = Math.min(m.userData.origOpacity ?? 1.0, opacity);
          } else if (m.userData.origOpacity !== undefined) {
            m.opacity = m.userData.origOpacity;
            m.transparent = m.userData.origTransparent;
          }
        });
      }
    });
  }

  applyStealthVisual(isStealth) {
    const targetOpacity = isStealth ? 0.32 : 1.0;
    if (this.pokemonHead) this.setObjectOpacity(this.pokemonHead, targetOpacity);
    this.segments.forEach((seg) => this.setObjectOpacity(seg.group, targetOpacity));
  }

  // ⚡ Speed Multiplier: Stack 1..5 -> 1.2x, 1.4x, 1.6x, 1.8x, 2.0x ("第5次 2x")
  getSpeedMultiplier() {
    return 1.0 + 0.2 * (this.buffs.speed.stacks || 0);
  }

  // 🛡️ Defense Block Chance: Stack 1..5 -> 16%, 32%, 48%, 64%, 80% + Sulley Cape +25%
  getDefenseChance() {
    const capeBonus = saveManager.getCapeBonus('defense');
    return Math.min(0.95, 0.16 * (this.buffs.defense.stacks || 0) + capeBonus);
  }

  // ✖️ Multiplier 2-Segment Chance: Stack 1..5 -> 20%, 40%, 60%, 80%, 100% ("隊伍節數機率 2節 第5次 100%")
  getMultiplierChance() {
    return 0.2 * (this.buffs.multiplier.stacks || 0);
  }

  rollSegmentGain() {
    const chance = this.getMultiplierChance();
    return Math.random() < chance ? 2 : 1;
  }

  isMultiplierActive() {
    return this.buffs.multiplier.stacks > 0;
  }

  isDefenseActive() {
    return this.buffs.defense.stacks > 0 || saveManager.getCapeBonus('defense') > 0;
  }

  isStealthActive() {
    return this.buffs.stealth.stacks > 0 && this.buffs.stealth.timer > 0;
  }

  applyGemBuff(gemType) {
    if (gemType === 'rainbow') {
      // 🌟 全能狂熱寶石：同時啟動 ⚡加速 + 🛡️防禦護盾 + ✖️雙倍成長 三重效果！
      ['speed', 'defense', 'multiplier'].forEach((k) => {
        const b = this.buffs[k];
        b.stacks = Math.min(b.maxStacks, b.stacks + 1);
        b.timer = b.maxDuration;
      });
      this.element = 'fever';
    } else if (gemType === 'stealth') {
      // 👻 隱身寶石：不累計，一次 30 秒
      this.buffs.stealth.stacks = 1;
      this.buffs.stealth.timer = 30.0;
      this.buffs.stealth.maxDuration = 30.0;
      this.element = 'stealth';
    } else if (this.buffs[gemType]) {
      const b = this.buffs[gemType];
      b.stacks = Math.min(b.maxStacks, b.stacks + 1);
      b.timer = b.maxDuration;
      this.element = gemType;
    }

    this.refreshBuffVisuals();
    sound.playEvolve();
  }

  refreshBuffVisuals() {
    const hasSpeed = this.buffs.speed.stacks > 0;
    const hasDefense = this.buffs.defense.stacks > 0;
    const hasMult = this.buffs.multiplier.stacks > 0;
    const hasStealth = this.isStealthActive();
    const anyBuff = hasSpeed || hasDefense || hasMult || hasStealth;

    // 3D 藍色立體防護罩 ("開啟 3D 藍色立體防護罩")
    if (this.shieldMesh) {
      this.shieldMesh.visible = hasDefense;
    }

    // 隱身半透明效果
    this.applyStealthVisual(hasStealth);

    // 環繞星芒與腳下光環
    if (this.buffSparkles && this.buffSparkleMat) {
      this.buffSparkles.visible = anyBuff;
      const colorMap = {
        speed: 0xffd60a,
        defense: 0x00bbf9,
        multiplier: 0xff4d6d,
        stealth: 0x9b5de5,
        fever: 0xff66cc
      };
      this.buffSparkleMat.color.setHex(colorMap[this.element] || 0xffd60a);
    }

    if (this.auraMat) {
      this.auraMat.opacity = anyBuff ? 0.9 : 0.45;
    }

    if (!this.isDashing) {
      this.speed = this.baseSpeed * this.getSpeedMultiplier();
    }
  }

  jump() {
    if (this.isJumping) return false;
    this.isJumping = true;
    this.jumpTimer = 0;
    sound.playJump();
    return true;
  }

  activateSkill() {
    if (this.skillCooldown > 0) return false;

    // Turbo Cooldown Talent: 3.2s -> 2.2s / 1.5s, Boo Cape: -1.0s
    const cdReduction = saveManager.getTalentBonus('turboCooldown');
    const capeCdReduction = saveManager.getEquippedCape() === 'boo' ? 1.0 : 0;
    this.skillCooldown = Math.max(1.0, 3.2 - cdReduction - capeCdReduction);
    this.isDashing = true;
    this.dashTimer = 0.85;
    this.speed = this.baseSpeed * Math.max(2.1, this.getSpeedMultiplier() * 1.25);

    sound.playSkill(this.element);
    return true;
  }

  refreshTalents() {
    const passiveSpeedBonus = saveManager.getTalentBonus('swiftMove');
    const capeSpeedBonus = saveManager.getCapeBonus('speed');
    this.baseSpeed = 7.2 * (1.0 + passiveSpeedBonus + capeSpeedBonus);
    if (!this.buffs.speed.stacks && !this.isDashing) {
      this.speed = this.baseSpeed;
    }
    this.updateEquippedCape();
  }

  update(delta) {
    if (this.biteCooldown > 0) {
      this.biteCooldown -= delta;
    }

    // 🍔 問題二：吃豆/咬對手時的頭部彈簧動畫 (Squish & Stretch)
    if (this.headSquishTimer > 0) {
      this.headSquishTimer -= delta;
      const t = Math.max(0, this.headSquishTimer) / 0.16;
      const squishY = 1.0 + Math.sin(t * Math.PI) * 0.35;
      const squishXZ = 1.0 - Math.sin(t * Math.PI) * 0.15;
      if (this.pokemonHead) {
        this.pokemonHead.scale.set(
          this.headBaseScale * squishXZ,
          this.headBaseScale * squishY,
          this.headBaseScale * squishXZ
        );
      }
    } else if (this.pokemonHead && this.pokemonHead.scale.y !== this.headBaseScale) {
      this.pokemonHead.scale.set(this.headBaseScale, this.headBaseScale, this.headBaseScale);
    }

    // 0. Gem Buffs: speed, defense, and multiplier are PERMANENT for the whole stage ("寶石不會因為吃了一個 另一個寶石效果都消逝 都會一直存在")!
    // Only stealth counts down its 30-second timer ("👻 隱身寶石：不累計 一次 30秒").
    let buffChanged = false;
    const st = this.buffs.stealth;
    if (st.timer > 0) {
      st.timer -= delta;
      if (st.timer <= 0) {
        st.timer = 0;
        st.stacks = 0;
        buffChanged = true;
      }
    }

    if (this.buffSparkles && this.buffSparkles.visible) {
      this.buffSparkles.rotation.y += delta * 4.5;
      this.buffSparkles.position.y = Math.sin(Date.now() * 0.008) * 0.25;
    }

    // ⭐ 真人頭頂光柱微光呼吸律動
    if (this.beaconMesh) {
      const bPulse = 0.52 + Math.sin(Date.now() * 0.006) * 0.25;
      this.beaconMesh.material.opacity = bPulse;
    }

    if (buffChanged) {
      this.refreshBuffVisuals();
    }

    // 1. Dash countdown
    if (this.isDashing) {
      this.dashTimer -= delta;
      if (this.auraMesh) this.auraMesh.rotation.z += delta * 12.0;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.speed = this.baseSpeed * this.getSpeedMultiplier();
      }
    }

    if (this.skillCooldown > 0) {
      this.skillCooldown -= delta;
    }

    if (this.targetMarker && this.targetMarker.visible) {
      const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.18;
      this.targetMarker.scale.setScalar(pulse);
    }

    // 2. Jump Physics Calculation
    if (this.isJumping) {
      this.jumpTimer += delta;
      const progress = this.jumpTimer / this.jumpDuration;
      if (progress >= 1.0) {
        this.isJumping = false;
        this.currentJumpOffset = 0;
      } else {
        this.currentJumpOffset = Math.sin(progress * Math.PI) * this.maxJumpHeight;
      }
    } else {
      this.currentJumpOffset = 0;
    }

    // 3. Spherical Orientation & Steering
    this.normal = this.planet.getSurfaceNormal(this.position);

    if (this.currentTurn !== 0) {
      const turnQuat = new THREE.Quaternion().setFromAxisAngle(
        this.normal,
        -this.currentTurn * this.turnSpeed * delta
      );
      this.forward.applyQuaternion(turnQuat);
    }

    // Click-to-Walk ("滑鼠點哪走哪")
    let walkingToTarget = false;
    if (this.targetPoint) {
      const surfacePos = this.planet.projectToSurface(this.position, this.hoverHeight);
      const dist = surfacePos.distanceTo(this.targetPoint);
      if (dist < 1.6) {
        this.clearTargetPoint();
      } else {
        walkingToTarget = true;
        const toTarget = this.targetPoint.clone().sub(surfacePos);
        const tangent = toTarget
          .sub(this.normal.clone().multiplyScalar(toTarget.dot(this.normal)))
          .normalize();
        if (tangent.lengthSq() > 0.0001) {
          this.forward.lerp(tangent, Math.min(1.0, delta * 7.5)).normalize();
        }
      }
    }

    this.forward.sub(this.normal.clone().multiplyScalar(this.forward.dot(this.normal))).normalize();

    const shouldAdvance = this.isMoving || walkingToTarget || this.isJumping || this.isDashing;

    if (shouldAdvance) {
      const moveDist = this.speed * delta;
      this.position.add(this.forward.clone().multiplyScalar(moveDist));
    }

    const totalHeight = this.hoverHeight + this.currentJumpOffset;
    this.position = this.planet.projectToSurface(this.position, totalHeight);
    this.normal = this.planet.getSurfaceNormal(this.position);

    this.headGroup.position.copy(this.position);
    updateHeadCountBadge(this.pokemonHead, this.segments.length + 1, true);

    const headMat = new THREE.Matrix4();
    const right = new THREE.Vector3().crossVectors(this.normal, this.forward).normalize();
    headMat.makeBasis(right, this.normal, this.forward);
    this.headGroup.quaternion.setFromRotationMatrix(headMat);

    const nowSec = Date.now() * 0.001;
    const isFast = this.isDashing || this.buffs.speed.stacks > 0;
    if (shouldAdvance) {
      animatePokemonRun(this.pokemonHead, nowSec, 0, this.isJumping, isFast);
    } else {
      animatePokemonRun(this.pokemonHead, nowSec * 0.15, 0, false, false);
    }

    // Cute Eye Blinking on Head
    const blinkCycle = Math.sin(Date.now() * 0.0035);
    const blinkScale = blinkCycle > 0.96 ? 0.15 : 1.15;
    if (this.pokemonHead?.userData?.eyes) {
      this.pokemonHead.userData.eyes.forEach((eye) => {
        if (eye.children[0]) eye.children[0].scale.y = blinkScale;
      });
    }

    // 4. Update Path History only when moving
    if (shouldAdvance) {
      this.pathHistory.unshift({
        pos: this.position.clone(),
        normal: this.normal.clone(),
        forward: this.forward.clone(),
        jumpOffset: this.currentJumpOffset
      });
      if (this.pathHistory.length > 850) {
        this.pathHistory.pop();
      }
    }

    // 5. Update Body Pokémon Segments
    let historyIdx = 0;
    let accumulatedDist = 0;

    for (let i = 0; i < this.segments.length; i++) {
      const targetDist = (i + 1) * this.minSegmentDist;

      while (historyIdx < this.pathHistory.length - 1 && accumulatedDist < targetDist) {
        accumulatedDist += this.pathHistory[historyIdx].pos.distanceTo(
          this.pathHistory[historyIdx + 1].pos
        );
        historyIdx++;
      }

      const historyItem = this.pathHistory[historyIdx] || {
        pos: this.position,
        normal: this.normal,
        forward: this.forward,
        jumpOffset: 0
      };
      const seg = this.segments[i];

      if (shouldAdvance) {
        seg.group.position.lerp(historyItem.pos, 0.48);
      }

      const segJumpH = (historyItem.jumpOffset || 0) * 0.85;
      seg.group.position.copy(
        this.planet.projectToSurface(seg.group.position, this.hoverHeight + segJumpH)
      );

      const segNormal = this.planet.getSurfaceNormal(seg.group.position);
      const segForward = historyItem.forward.clone();
      segForward.sub(segNormal.clone().multiplyScalar(segForward.dot(segNormal))).normalize();
      const segRight = new THREE.Vector3().crossVectors(segNormal, segForward).normalize();
      const segRot = new THREE.Matrix4().makeBasis(segRight, segNormal, segForward);
      seg.group.quaternion.setFromRotationMatrix(segRot);

      if (shouldAdvance) {
        animatePokemonRun(seg.group, nowSec, (i + 1) * 0.75, segJumpH > 0.5, isFast);
      } else {
        animatePokemonRun(seg.group, nowSec * 0.15, (i + 1) * 0.75, false, false);
      }
    }
  }

  grow(gemType) {
    sound.playEat();
    this.headSquishTimer = 0.16; // 🍔 彈簧縮放動畫
    // Apply stackable gem buff first so if it's a multiplier/rainbow gem, the updated multiplier chance applies immediately!
    this.applyGemBuff(gemType);

    const addCount = this.rollSegmentGain();
    for (let i = 0; i < addCount; i++) {
      this.addSegment();
    }
    return addCount;
  }

  eatNPCBody(npcSpecies) {
    sound.playChomp();
    this.headSquishTimer = 0.16; // 🍔 彈簧縮放動畫
    // 跳吃一次一節，若倍數寶石生效則依機率 (20%~100%) 獲得 2 節！
    const totalAdded = this.rollSegmentGain();
    for (let i = 0; i < totalAdded; i++) {
      this.addSegment();
    }
    return totalAdded;
  }

  addSkillCharges(amount = 5) {
    this.skillCharges = Math.min(this.maxSkillCharges, (this.skillCharges || 0) + amount);
    sound.playEvolve();
  }

  /**
   * 💥 問題三：吃到技能包後的 5 次專屬角色技能攻擊！
   */
  unleashCharacterSkill(game) {
    if (this.skillCharges > 0) {
      this.skillCharges--;

      const pData = POKEMON_DATA[this.species] || POKEMON_DATA.pikachu;
      const skillName = pData.skillName || '全能衝擊';

      // 觸發鏡頭微震 + 星星糖果與大招特效
      if (game) {
        if (game.triggerScreenShake) game.triggerScreenShake(0.24, 0.42);
        if (game.gemManager) {
          game.gemManager.spawnStarCandyExplosion(this.position, this.normal, 14);
        }
      }

      // 1. 各角色專屬技能實作
      if (this.species === 'pikachu') {
        // ⚡ 十萬伏特雷暴：直徑 14 碼雷電光環，電擊震退周邊 NPC
        this.createShockwaveRing(0xffd700, 14.0);
        if (game && game.npcManager) {
          const hits = game.npcManager.hitBySkill(this.position, 14.0, { element: 'thunder' });
          if (hits.length > 0) {
            sound.playSkill('lightning');
            return {
              usedCharge: true,
              skillName: '⚡ 十萬伏特雷暴',
              desc: `雷暴轟炸！電擊了 ${hits.length} 位勁敵！`,
              remaining: this.skillCharges
            };
          }
        }
        sound.playSkill('lightning');
        return {
          usedCharge: true,
          skillName: '⚡ 十萬伏特雷暴',
          desc: '釋放金色雷霆衝擊波！周圍進入麻痺電場！',
          remaining: this.skillCharges
        };
      } else if (this.species === 'charmander') {
        // 🔥 大字爆炎噴火：強大向前突進 + 烈焰屏障，擊退前方敵人
        this.createShockwaveRing(0xff4500, 13.0);
        this.isDashing = true;
        this.dashTimer = 1.2;
        this.speed = this.baseSpeed * 2.5;
        if (game && game.npcManager) {
          game.npcManager.hitBySkill(this.position, 13.0, { element: 'fire' });
        }
        sound.playSkill('fire');
        return {
          usedCharge: true,
          skillName: '🔥 大字爆炎噴火',
          desc: '噴射滔天烈焰！極速突進並逼退前方所有對手！',
          remaining: this.skillCharges
        };
      } else if (this.species === 'squirtle') {
        // 💧 強力水炮衝浪：水流旋渦擊退敵人，自身獲得水盾免傷 2 秒
        this.createShockwaveRing(0x00bbf9, 13.5);
        this.isInvincible = true;
        setTimeout(() => (this.isInvincible = false), 2200);
        this.isDashing = true;
        this.dashTimer = 1.0;
        this.speed = this.baseSpeed * 2.2;
        if (game && game.npcManager) {
          game.npcManager.hitBySkill(this.position, 13.5, { element: 'ice' });
        }
        sound.playSkill('ice');
        return {
          usedCharge: true,
          skillName: '💧 強力水炮衝浪',
          desc: '狂浪滔天！震退周邊對手並獲得 2.2 秒水流無敵護盾！',
          remaining: this.skillCharges
        };
      } else if (this.species === 'bulbasaur') {
        // 🌱 飛葉快刀風暴：飛葉旋轉風暴，橫掃周圍敵方身體
        this.createShockwaveRing(0x22c55e, 14.0);
        if (game && game.npcManager) {
          game.npcManager.hitBySkill(this.position, 14.0, { element: 'normal' });
        }
        sound.playSkill('normal');
        return {
          usedCharge: true,
          skillName: '🌱 飛葉快刀風暴',
          desc: '飛葉快刀旋轉漫天！橫掃周遭奪取敵隊節數！',
          remaining: this.skillCharges
        };
      } else if (this.species === 'gengar') {
        // 👻 暗影球・百鬼夜行：暗影球震波 + 立即獲得 4 秒全速潛行
        this.createShockwaveRing(0x9b5de5, 14.0);
        this.buffs.stealth.stacks = 1;
        this.buffs.stealth.timer = 4.0;
        this.element = 'stealth';
        this.refreshBuffVisuals();
        if (game && game.npcManager) {
          game.npcManager.hitBySkill(this.position, 14.0, { element: 'titan' });
        }
        sound.playSkill('titan');
        return {
          usedCharge: true,
          skillName: '👻 暗影球・百鬼夜行',
          desc: '暗影球炸裂！自身進入 4 秒全速潛行！',
          remaining: this.skillCharges
        };
      } else {
        // 🦊 高速星星雨 (伊布)：吸取周圍所有寶石
        this.createShockwaveRing(0xffd166, 16.0);
        if (game && game.gemManager) {
          // 吸取 18 碼內所有寶石
          const pPos = this.position;
          for (let g = game.gemManager.gems.length - 1; g >= 0; g--) {
            const gem = game.gemManager.gems[g];
            if (gem.group.position.distanceTo(pPos) < 18.0) {
              this.grow(gem.type);
              game.score += 30;
              game.gemGroup?.remove(gem.group);
              game.gemManager.gems.splice(g, 1);
            }
          }
        }
        sound.playSkill('fever');
        return {
          usedCharge: true,
          skillName: '🦊 高速星星雨',
          desc: '漫天星星散射！自動吸取全場 18 碼內所有寶石！',
          remaining: this.skillCharges
        };
      }
    }

    // 次數為 0 時，執行一般衝刺
    const dashed = this.activateSkill();
    return {
      usedCharge: false,
      dashed,
      remaining: 0
    };
  }

  createShockwaveRing(colorHex, maxRadius = 14.0) {
    const ringGeo = new THREE.RingGeometry(0.8, 1.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(this.position);
    ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.normal);
    this.scene.add(ringMesh);

    let progress = 0;
    const expandAnim = () => {
      progress += 0.055;
      const s = 1.0 + progress * (maxRadius / 1.4);
      ringMesh.scale.set(s, s, s);
      ringMat.opacity = Math.max(0, 1.0 - progress);
      if (progress < 1.0) {
        requestAnimationFrame(expandAnim);
      } else {
        this.scene.remove(ringMesh);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    expandAnim();
  }

  checkSelfCollision() {
    return false;
  }

  dispose() {
    if (this.targetMarker) {
      this.scene.remove(this.targetMarker);
    }
  }
}
