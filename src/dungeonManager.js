import * as THREE from 'three';
import { sound } from './sound.js';
import { saveManager, MONSTERS_INC_CAPES } from './saveManager.js';

export class DungeonManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.planet = game.planet;

    // Portal state
    this.portalMesh = null;
    this.portalPosition = null;
    this.portalActive = false;
    this.portalTimer = 0;
    this.portalMaxTime = 45.0; // 45 seconds to find and enter portal
    this.nextSpawnTimer = 8.0; // 開局 8 秒內保證降臨正前方！
    this.restrictedCape = 'sulley';
    this.dungeonType = 'snake'; // 'snake' | 'runner' | 'maze'
    this.dungeonTypeName = '鳥俯視角・真貪吃蛇';

    // In-dungeon challenge state
    this.inDungeon = false;
    this.dungeonTimer = 0;
    this.dungeonMaxTime = 25.0;
    this.targetStars = 10;
    this.collectedStars = 0;
    this.dungeonItems = [];
    this.dungeonGroup = new THREE.Group();
    this.scene.add(this.dungeonGroup);

    // Maze Exits
    this.luckyExitIndex = 3;
    this.exitDoors = [];

    // Snake mode item
    this.specialItemMesh = null;
    this.specialItemPos = null;

    // DOM UI Elements
    this.domBanner = document.getElementById('dungeon-banner');
    this.domTimerText = document.getElementById('dungeon-timer-text');
    this.domSubText = document.getElementById('dungeon-sub-text');
    this.domHud = document.getElementById('dungeon-hud');
    this.domDhTimer = document.getElementById('dh-timer');
    this.domDhCanisters = document.getElementById('dh-canisters');
    this.domDhTarget = document.getElementById('dh-target-cape');

    const btnGuide = document.getElementById('btn-dungeon-guide');
    if (btnGuide) {
      btnGuide.addEventListener('click', () => {
        if (this.portalActive && this.portalPosition && this.game.snake) {
          this.game.snake.setTargetPoint(this.portalPosition);
          this.game.showToast('🎯 已為你設定導航路線，前進怪獸傳送門！');
        }
      });
    }
  }

  /**
   * 🚪 每一關（台北、京都、上海）開局保證重置並在 8 秒內降臨怪獸門！
   */
  resetForStage(stageNum) {
    this.despawnPortal(false);
    this.planet = this.game.planet;
    this.nextSpawnTimer = 8.0;
    this.portalActive = false;
    this.inDungeon = false;
  }

  /**
   * Procedural check in main game loop
   */
  update(delta) {
    if (this.inDungeon) {
      this.updateDungeonChallenge(delta);
      return;
    }

    if (this.portalActive) {
      this.portalTimer -= delta;

      // Animate portal hover & glow
      if (this.portalMesh) {
        this.portalMesh.rotation.y += delta * 1.5;
        const lightBulb = this.portalMesh.userData.lightBulb;
        if (lightBulb) {
          lightBulb.material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.008) * 0.5;
        }
      }

      if (this.domTimerText) {
        this.domTimerText.textContent = Math.ceil(Math.max(0, this.portalTimer));
      }

      // Check player collision with portal
      if (this.game.snake && this.portalPosition) {
        const playerPos = this.game.snake.position;
        if (playerPos.distanceTo(this.portalPosition) < 3.2) {
          this.enterDungeon();
          return;
        }
      }

      if (this.portalTimer <= 0) {
        this.despawnPortal(false);
      }
    } else {
      this.nextSpawnTimer -= delta;
      if (this.nextSpawnTimer <= 0) {
        this.spawnRandomPortal();
      }
    }
  }

  /**
   * Spawns a random Monsters, Inc. Door on the asteroid planet!
   */
  spawnRandomPortal() {
    const capeKeys = Object.keys(MONSTERS_INC_CAPES);
    const unowned = capeKeys.filter((k) => !saveManager.hasCape(k));
    if (unowned.length > 0) {
      this.restrictedCape = unowned[Math.floor(Math.random() * unowned.length)];
    } else {
      this.restrictedCape = capeKeys[Math.floor(Math.random() * capeKeys.length)];
    }

    // Determine which of the 3 new dungeons this portal leads to!
    if (this.restrictedCape === 'sulley') {
      this.dungeonType = 'snake';
      this.dungeonTypeName = '經典貪吃蛇';
    } else if (this.restrictedCape === 'randall') {
      this.dungeonType = 'maze';
      this.dungeonTypeName = '直式滾動迷宮（4個出口）';
    } else {
      this.dungeonType = 'runner';
      this.dungeonTypeName = '橫幅跳躍吃星星';
    }

    const capeDef = MONSTERS_INC_CAPES[this.restrictedCape];

    // 🚪 保證生成在玩家前方視線與前進路徑上，絕對看得到！
    let targetPos;
    if (this.game.snake && this.game.snake.position && this.game.snake.forward) {
      const aheadOffset = this.game.snake.forward.clone().multiplyScalar(16 + Math.random() * 5);
      const rightOffset = new THREE.Vector3()
        .crossVectors(this.game.snake.normal, this.game.snake.forward)
        .multiplyScalar((Math.random() - 0.5) * 4);
      targetPos = this.game.snake.position.clone().add(aheadOffset).add(rightOffset);
    } else {
      targetPos = new THREE.Vector3(0, 0.94, 0.35);
    }

    this.portalPosition = this.planet.projectToSurface(targetPos, 0.4);
    this.portalMesh = this.buildMonsterDoorMesh(capeDef.color);
    this.portalMesh.position.copy(this.portalPosition);

    const normal = this.planet.getSurfaceNormal(this.portalPosition);
    const up = new THREE.Vector3(0, 1, 0);
    this.portalMesh.quaternion.setFromUnitVectors(up, normal);

    this.scene.add(this.portalMesh);
    this.portalActive = true;
    this.portalTimer = this.portalMaxTime;

    // Show Alert Banner
    if (this.domBanner) {
      this.domBanner.classList.remove('dungeon-banner-hidden');
    }
    if (this.domSubText) {
      this.domSubText.innerHTML = `【${this.dungeonTypeName}】限定：<b>${capeDef.icon} ${capeDef.shortName}</b>｜剩餘 <b id="dungeon-timer-text">${Math.ceil(this.portalTimer)}</b> 秒`;
    }

    sound.playDungeonPortal();
    this.game.showToast(`🚨 怪獸電力公司傳送門降臨正前方！【${this.dungeonTypeName}】直接衝進去！`);
  }

  buildMonsterDoorMesh(tintColor = 0x38bdf8) {
    const root = new THREE.Group();

    // 1. Door Frame
    const frameGeo = new THREE.BoxGeometry(2.4, 3.8, 0.28);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 1.9;
    root.add(frame);

    // Behind-the-door White Light Vortex Plane (Glows when door swings open!)
    const portalBackGeo = new THREE.PlaneGeometry(1.9, 3.3);
    const portalBackMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide
    });
    const portalBack = new THREE.Mesh(portalBackGeo, portalBackMat);
    portalBack.position.set(0, 1.9, -0.05);
    root.add(portalBack);

    // Door Hinge Pivot on the left side (x = -1.0) for realistic door swing!
    const hinge = new THREE.Group();
    hinge.position.set(-1.0, 0, 0);
    root.add(hinge);
    root.userData.hinge = hinge;

    // 2. Door Panel attached to hinge
    const panelGeo = new THREE.BoxGeometry(2.0, 3.4, 0.18);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
      metalness: 0.1
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(1.0, 1.9, 0.06); // relative to hinge at -1.0
    hinge.add(panel);

    // Knob
    const knobGeo = new THREE.SphereGeometry(0.14, 12, 12);
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
    const knob = new THREE.Mesh(knobGeo, knobMat);
    knob.position.set(1.72, 1.8, 0.22);
    hinge.add(knob);

    // 3. Warning Light Bulb
    const lightGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff0000,
      emissiveIntensity: 0.85
    });
    const lightBulb = new THREE.Mesh(lightGeo, lightMat);
    lightBulb.position.set(0, 4.05, 0);
    root.add(lightBulb);
    root.userData.lightBulb = lightBulb;

    // 4. Glowing Warning Ring
    const ringGeo = new THREE.RingGeometry(1.8, 2.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: tintColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    root.add(ring);

    // 5. 🌟 Sky-High Light Beacon (衝天光柱，全星球任何角落皆可看見！)
    const beaconGeo = new THREE.CylinderGeometry(0.8, 1.4, 38, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: tintColor,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 19.0;
    root.add(beacon);

    // 6. ⬇️ Pulsing Downward Arrow 指向大門
    const arrowGeo = new THREE.ConeGeometry(0.9, 1.9, 8);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffd000,
      emissiveIntensity: 0.85
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = Math.PI;
    arrow.position.y = 6.4;
    root.add(arrow);
    root.userData.arrow = arrow;

    return root;
  }

  despawnPortal(entered = false) {
    if (this.portalMesh) {
      this.scene.remove(this.portalMesh);
      this.portalMesh = null;
    }
    this.portalActive = false;
    this.portalPosition = null;

    if (this.domBanner) {
      this.domBanner.classList.add('dungeon-banner-hidden');
    }

    if (!entered) {
      this.nextSpawnTimer = 16.0 + Math.random() * 8.0;
    }
  }

  /**
   * 🚪 問題四：電影級開門動畫與白光轉場進入 Mini-Dungeon
   */
  enterDungeon() {
    // 1. 旋轉門扇打開動畫
    if (this.portalMesh && this.portalMesh.userData.hinge) {
      const hinge = this.portalMesh.userData.hinge;
      let openProgress = 0;
      const animateDoorOpen = () => {
        openProgress += 0.08;
        hinge.rotation.y = -Math.sin(Math.min(1.0, openProgress) * (Math.PI / 2)) * 1.6;
        if (openProgress < 1.0) {
          requestAnimationFrame(animateDoorOpen);
        }
      };
      animateDoorOpen();
    }

    // 2. 鏡頭拉近特寫傳送門
    if (this.game) {
      this.game.camZoom = 0.58;
    }

    // 3. 全螢幕柔和白光轉場
    const flashEl = document.getElementById('dungeon-white-flash');
    if (flashEl) {
      flashEl.classList.remove('white-flash-hidden');
      setTimeout(() => flashEl.classList.add('white-flash-active'), 20);
    }

    // 4. 短暫延遲後無縫切換至副本視窗
    setTimeout(() => {
      this.despawnPortal(true);
      this.inDungeon = true;
      this.dungeonTimer = this.dungeonMaxTime;
      this.collectedStars = 0;

      sound.playVictory();

      const capeDef = MONSTERS_INC_CAPES[this.restrictedCape];
      const frameModal = document.getElementById('dungeon-frame-modal');
      const iframe = document.getElementById('dungeon-iframe');
      const charSpecies = this.game.snake?.species || 'pikachu';

      if (frameModal && iframe) {
        iframe.src = `./dungeon_trial.html?mode=${this.dungeonType}&cape=${this.restrictedCape}&char=${charSpecies}`;
        frameModal.classList.remove('hidden');
        this.game.showToast(`🚪 穿越怪獸傳送門！進入【${this.dungeonTypeName}】！`);
      }

      // 淡出白光
      if (flashEl) {
        flashEl.classList.remove('white-flash-active');
        setTimeout(() => flashEl.classList.add('white-flash-hidden'), 350);
      }
      if (this.game) {
        this.game.camZoom = 1.0;
      }
    }, 420);
  }

  clearDungeonObjects() {
    while (this.dungeonGroup.children.length > 0) {
      this.dungeonGroup.remove(this.dungeonGroup.children[0]);
    }
    this.dungeonItems = [];
    this.exitDoors = [];
    this.specialItemMesh = null;
    this.specialItemPos = null;
  }

  // --- 1. Snake Dungeon Setup ---
  setupSnakeDungeon() {
    this.clearDungeonObjects();
    if (!this.game.snake) return;
    const center = this.game.snake.position.clone();
    this.eatenSnakeDots = 0;
    this.targetSnakeDots = 10;
    this.hasHatSpawned = false;

    // Spawn 18 glowing energy dots on planet around player
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6.0 + Math.random() * 14.0;
      const offset = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      const dotPos = this.planet.projectToSurface(center.clone().add(offset), 0.5);

      const dotMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xd97706, emissiveIntensity: 0.8 })
      );
      dotMesh.position.copy(dotPos);
      this.dungeonGroup.add(dotMesh);
      this.dungeonItems.push({ mesh: dotMesh, pos: dotPos, collected: false });
    }
  }

  spawnSnakeHatItem() {
    if (!this.game.snake || this.hasHatSpawned) return;
    this.hasHatSpawned = true;
    const center = this.game.snake.position.clone();

    const offset = new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16);
    this.specialItemPos = this.planet.projectToSurface(center.clone().add(offset), 0.6);

    const capeDef = MONSTERS_INC_CAPES[this.restrictedCape];
    const itemMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({ color: capeDef.color, emissive: capeDef.color, emissiveIntensity: 0.9 })
    );
    itemMesh.position.copy(this.specialItemPos);
    this.dungeonGroup.add(itemMesh);
    this.specialItemMesh = itemMesh;

    sound.playVictory();
    this.game.showToast('🌟 吃滿 10 顆能量豆！怪獸限定魔帽已降臨！快去咬下！');
    if (this.domDhCanisters) {
      this.domDhCanisters.textContent = `⭐ 魔帽已降臨！快吃！`;
    }
  }

  // --- 2. Runner Dungeon Setup ---
  setupRunnerDungeon() {
    this.clearDungeonObjects();
    if (!this.game.snake) return;
    const center = this.game.snake.position.clone();

    // Spawn a chain of stars (positive and negative)
    for (let i = 0; i < this.targetStars + 4; i++) {
      const angle = (i / (this.targetStars + 4)) * Math.PI * 2;
      const dist = 8.0 + i * 2.2;
      const offset = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      const starPos = this.planet.projectToSurface(center.clone().add(offset), 0.6);

      const isNegative = (i > 1 && i % 3 === 0);
      const starMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color: isNegative ? 0x9333ea : 0xfacc15,
          emissive: isNegative ? 0x7e22ce : 0xeab308,
          emissiveIntensity: 0.8
        })
      );
      starMesh.position.copy(starPos);
      this.dungeonGroup.add(starMesh);
      this.dungeonItems.push({ mesh: starMesh, pos: starPos, isNegative, collected: false });
    }
  }

  // --- 3. Maze Dungeon Setup (4 Exits) ---
  setupMazeDungeon() {
    this.clearDungeonObjects();
    if (!this.game.snake) return;
    const center = this.game.snake.position.clone();

    // 1 of 4 is lucky
    this.luckyExitIndex = Math.floor(Math.random() * 4) + 1;

    for (let i = 1; i <= 4; i++) {
      const angle = ((i - 2.5) / 4) * 1.6;
      const dist = 18.0;
      const offset = new THREE.Vector3(Math.sin(angle) * dist, 0, Math.cos(angle) * dist);
      const doorPos = this.planet.projectToSurface(center.clone().add(offset), 0.4);

      const doorMesh = this.buildMonsterDoorMesh(i === this.luckyExitIndex ? 0xfacc15 : 0x38bdf8);
      doorMesh.position.copy(doorPos);

      const normal = this.planet.getSurfaceNormal(doorPos);
      const up = new THREE.Vector3(0, 1, 0);
      doorMesh.quaternion.setFromUnitVectors(up, normal);

      this.dungeonGroup.add(doorMesh);
      this.exitDoors.push({ mesh: doorMesh, pos: doorPos, index: i });
    }
  }

  updateDungeonChallenge(delta) {
    this.dungeonTimer -= delta;

    if (this.domDhTimer) {
      this.domDhTimer.textContent = `${Math.ceil(Math.max(0, this.dungeonTimer))}s`;
    }

    if (this.dungeonTimer <= 0) {
      this.completeDungeon(false);
      return;
    }

    if (!this.game.snake) return;
    const pPos = this.game.snake.position;

    // 1. SNAKE CHALLENGE (Eat 10 dots, then eat hat to win)
    if (this.dungeonType === 'snake') {
      // Eat dots
      for (let dot of this.dungeonItems) {
        if (!dot.collected && pPos.distanceTo(dot.pos) < 2.6) {
          dot.collected = true;
          this.dungeonGroup.remove(dot.mesh);
          this.eatenSnakeDots++;
          sound.playEat();

          if (!this.hasHatSpawned) {
            if (this.domDhCanisters) {
              this.domDhCanisters.textContent = `豆豆進度：${this.eatenSnakeDots} / ${this.targetSnakeDots} 顆`;
            }
            if (this.eatenSnakeDots >= this.targetSnakeDots) {
              this.spawnSnakeHatItem();
            }
          }
        }
      }

      // Check special hat collection
      if (this.specialItemMesh && this.specialItemPos) {
        this.specialItemMesh.rotation.y += delta * 2.5;
        if (pPos.distanceTo(this.specialItemPos) < 3.0) {
          this.completeDungeon(true);
          return;
        }
      }
    }

    // 2. RUNNER CHALLENGE (Collect Stars, avoid negative)
    else if (this.dungeonType === 'runner') {
      for (let s of this.dungeonItems) {
        if (!s.collected && pPos.distanceTo(s.pos) < 2.6) {
          s.collected = true;
          this.dungeonGroup.remove(s.mesh);

          if (s.isNegative) {
            sound.playHurt();
            this.collectedStars = Math.max(0, this.collectedStars - 1);
            this.game.showToast('🟣 誤觸負能量暗星！星星 -1！');
          } else {
            sound.playEat();
            this.collectedStars++;
          }

          if (this.domDhCanisters) {
            this.domDhCanisters.textContent = `${this.collectedStars} / ${this.targetStars} 顆星星`;
          }

          if (this.collectedStars >= this.targetStars) {
            this.completeDungeon(true);
            return;
          }
        }
      }
    }

    // 3. MAZE CHALLENGE (6 Exits)
    else if (this.dungeonType === 'maze') {
      for (let d of this.exitDoors) {
        if (pPos.distanceTo(d.pos) < 3.0) {
          if (d.index === this.luckyExitIndex) {
            this.game.showToast(`🎉 天命之門！你選擇了第 ${d.index} 號出口，成功取得裝備！`);
            this.completeDungeon(true);
            return;
          } else {
            this.game.showToast(`💨 這是空門！第 ${d.index} 號門背後什麼也沒有～`);
            this.completeDungeon(false);
            return;
          }
        }
      }
    }
  }

  completeDungeon(success) {
    this.inDungeon = false;
    this.clearDungeonObjects();

    const frameModal = document.getElementById('dungeon-frame-modal');
    const iframe = document.getElementById('dungeon-iframe');
    if (frameModal) frameModal.classList.add('hidden');
    if (iframe) iframe.src = '';

    if (this.domHud) this.domHud.classList.remove('hidden'); // ensure cleanup
    if (this.domHud) this.domHud.classList.add('hidden');
    this.nextSpawnTimer = 70.0 + Math.random() * 40.0;

    const capeDef = MONSTERS_INC_CAPES[this.restrictedCape];

    if (success) {
      sound.playVictory();
      const isNew = saveManager.unlockCape(this.restrictedCape);

      // Auto-equip or update visual
      saveManager.equipCape(this.restrictedCape);
      if (this.game.snake) {
        this.game.snake.updateEquippedCape();
        this.game.snake.refreshTalents();
      }

      this.game.showToast(
        isNew
          ? `🎉 副本大獲全勝！解鎖並裝備【${capeDef.icon} ${capeDef.name}】！`
          : `🎉 副本通關！已擁有【${capeDef.icon} ${capeDef.name}】，獲得 +300 分數加成！`
      );

      this.game.score += 300;
      this.game.updateScoreUI();
      if (this.game.renderClosetUI) this.game.renderClosetUI();
    } else {
      sound.playHurt();
      this.game.showToast(`❌ 副本挑戰結束！下次怪獸傳送門出現再接再厲！`);
    }
  }
}
