import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { POKEMON_DATA, createPokemonMesh, animatePokemonRun } from '../src/pokemon.js';
import { Planet } from '../src/planet.js';
import { brawlAudio } from './brawlAudio.js';
import { ZombieManager } from './zombies.js';
import { WeaponAndDropManager, WEAPON_INFO } from './weaponsAndDrops.js';

const MAX_POWER_MULT = 3.0; // 300% 火力上限
const MAX_SPEED_MULT = 2.5; // 250% 攻速上限
const MAX_WEAPON_TIER = 10; // Lv.10 武器階級上限

const STAGE_CONFIGS = {
  1: {
    label: '🏙️ 台北 (第1關)',
    name: '台北小行星',
    captureTime: 8.0,
    spawnInterval: 3.8,
    maxZombies: 55,
    maxSquadCap: 120,
    hpMult: 1.0,
    speedMult: 1.0,
    turret: { interval: 0.65, damage: 35 },
    pool: ['shiba', 'penguin', 'bunny']
  },
  2: {
    label: '⛩️ 京都 (第2關)',
    name: '京都小行星',
    captureTime: 11.0,
    spawnInterval: 3.0,
    maxZombies: 80,
    maxSquadCap: 140,
    hpMult: 1.6,
    speedMult: 1.15,
    turret: { interval: 0.55, damage: 50 },
    pool: ['shiba', 'penguin', 'bunny', 'panda', 'fox']
  },
  3: {
    label: '🥮 上海 (第3關)',
    name: '上海小行星',
    captureTime: 14.0,
    spawnInterval: 2.3,
    maxZombies: 110,
    maxSquadCap: 160,
    hpMult: 2.4,
    speedMult: 1.3,
    turret: { interval: 0.45, damage: 70 },
    pool: ['shiba', 'penguin', 'bunny', 'panda', 'fox', 'fox']
  }
};

class BrawlApp {
  constructor() {
    this.container = document.getElementById('game-container');
    this.state = {
      running: false,
      paused: false,
      stage: 1,
      species: 'pikachu',
      deviceMode: 'auto',
      muted: false,
      hp: 100,
      maxHp: 100,
      energy: 0,
      feverTimer: 0,
      kills: 0,
      score: 0,
      iFrameTimer: 0,
      dashCd: 0,
      dashActive: 0,
      dashTrailTimer: 0,
      skillCd: 0,
      guideTimer: 0,
      guideTarget: null,
      screenShakeTimer: 0
    };

    this.keys = new Set();
    this.joyVec = { x: 0, y: 0, active: false };
    this.baseMoveSpeed = 8.25;

    this.playerPos = new THREE.Vector3(0, 48, 0);
    this.playerForward = new THREE.Vector3(0, 0, 1);
    this.camNorth = new THREE.Vector3(0, 0, -1);
    this.orbitPitch = 0.72;
    this.camZoom = 1.0;
    this.isDraggingOrbit = false;
    this.orbitPointerId = null;
    this.lastPointerPos = { x: 0, y: 0 };
    this.lastPinchDist = 0;

    this.squadUnits = [];
    this.trailHistory = [];
    this.buildings = [];

    this.initThree();
    this.initWorld();
    this.initUI();
    this.applyDeviceMode();

    this.clock = new THREE.Clock();
    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x9bdaf5, 0.0042);

    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x5c8f58, 1.02);
    this.scene.add(hemi);

    this.dirLight = new THREE.DirectionalLight(0xfff7e6, 1.4);
    this.dirLight.position.set(60, 95, 55);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 160;
    const d = 42;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    const syncViewport = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.state.deviceMode === 'auto') this.applyDeviceMode();
    };
    window.addEventListener('resize', syncViewport);
    document.addEventListener('fullscreenchange', syncViewport);
    syncViewport();
  }

  initWorld() {
    this.planet = new Planet(this.scene, this.state.stage);
    this.zombieManager = new ZombieManager(this.scene, this.planet);
    this.weaponManager = new WeaponAndDropManager(this.scene, this.planet);
    this.initGuideVisuals();
    this.setupStage(this.state.stage, true);
  }

  initGuideVisuals() {
    // 3D Direction Arrow hovering near hero pointing to nearest uncaptured building
    this.guideArrow = new THREE.Group();
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.38,
      metalness: 0.65,
      roughness: 0.2
    });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.15, 6), arrowMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.6;
    this.guideArrow.add(tip);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8), arrowMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.25;
    this.guideArrow.add(shaft);
    this.guideArrow.visible = false;
    this.scene.add(this.guideArrow);

    // Tall Sky Beacon over the target uncaptured building
    this.guideBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 1.4, 24, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.guideBeacon.visible = false;
    this.scene.add(this.guideBeacon);
  }

  setupStage(stageNum, resetProgress = false) {
    this.state.stage = stageNum;
    if (this.planet.stage !== stageNum) {
      this.planet.setStage(stageNum);
    }

    this.zombieManager.clearAll();
    this.weaponManager.clearDynamicEntities();
    if (resetProgress) {
      this.state.hp = 100;
      this.state.maxHp = 100;
      this.state.kills = 0;
      this.state.score = 0;
      this.state.energy = 0;
      this.state.feverTimer = 0;
      this.weaponManager.resetUpgrades();
      this.weaponManager.rebuildOrbitBlades();
      this.weaponManager.rebuildSidePods();
    }

    // Clean up previous building 3D HP bars
    for (const oldB of this.buildings) {
      if (oldB.hpBarGroup) this.scene.remove(oldB.hpBarGroup);
    }

    // Initialize 13 building siege states from planet.landmarkCheckpoints
    const cfg = STAGE_CONFIGS[stageNum] || STAGE_CONFIGS[1];
    this.buildings = this.planet.landmarkCheckpoints.map((cp, idx) => {
      // Zombie nest dark-purple aura initially
      cp.bannerMat.color.setHex(0x9333ea);
      cp.bannerMat.emissive.setHex(0x3b0764);
      cp.ringMat.color.setHex(0xa855f7);
      cp.visited = false;

      // Independent 3D floating capture progress bar above each building (0% -> 100%)
      const hpBarGroup = new THREE.Group();
      const bg = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.42),
        new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
      );
      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
      );
      fill.position.z = 0.02;
      fill.scale.x = 0.001;
      fill.position.x = -1.6;
      hpBarGroup.add(bg);
      hpBarGroup.add(fill);
      const bUp = this.planet.getSurfaceNormal(cp.position);
      hpBarGroup.position.copy(cp.position.clone().addScaledVector(bUp, 6.2));
      this.scene.add(hpBarGroup);

      return {
        index: idx,
        cp,
        name: cp.name,
        position: cp.position.clone(),
        radius: Math.max(3.6, cp.triggerRadius - 1.2),
        progress: 0,
        captureTime: cfg.captureTime,
        captured: false,
        bossSpawned: false,
        spawnTimer: 1.0 + (idx % 4) * 0.9,
        hpBarGroup,
        hpBarFill: fill
      };
    });

    this.playerPos.set(0, this.planet.radius, 0);
    this.playerForward.set(0, 0, -1);
    this.camNorth.set(0, 0, -1);
    this.trailHistory = [];
    for (let i = 0; i < 160; i++) {
      this.trailHistory.push({
        pos: this.playerPos.clone(),
        fwd: this.playerForward.clone()
      });
    }

    this.syncSquadMeshes();
    this.updateAllHUD();

    // Spawn an immediate starter wave from the 3 nearest buildings
    const nearest = [...this.buildings]
      .sort((a, b) => a.position.distanceTo(this.playerPos) - b.position.distanceTo(this.playerPos))
      .slice(0, 3);
    for (const b of nearest) {
      for (let k = 0; k < 2; k++) {
        const typeKey = cfg.pool[Math.floor(Math.random() * cfg.pool.length)];
        const jitter = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
        this.zombieManager.spawnZombie(typeKey, b.position.clone().add(jitter), {
          hp: cfg.hpMult,
          speed: cfg.speedMult
        });
      }
    }
  }

  syncSquadMeshes() {
    const desiredCount = Math.max(0, Math.ceil(this.state.hp / 10));
    while (this.squadUnits.length < desiredCount) {
      const isLeader = this.squadUnits.length === 0;
      const scale = isLeader ? 1.0 : 0.86;
      const mesh = createPokemonMesh(this.state.species, isLeader, scale);
      this.scene.add(mesh);
      this.squadUnits.push(mesh);
    }
    while (this.squadUnits.length > desiredCount) {
      const removed = this.squadUnits.pop();
      this.scene.remove(removed);
    }
    this.orientSquad();
  }

  orientUnitOnSphere(mesh, pos, fwdVec) {
    const up = this.planet.getSurfaceNormal(pos);
    const fwd = fwdVec.clone().sub(up.clone().multiplyScalar(fwdVec.dot(up)));
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    else fwd.normalize();
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const rotMat = new THREE.Matrix4().makeBasis(right, up, fwd);
    mesh.position.copy(pos);
    mesh.quaternion.setFromRotationMatrix(rotMat);
  }

  orientSquad() {
    const spacingSteps = 6;
    for (let i = 0; i < this.squadUnits.length; i++) {
      const idx = Math.min(this.trailHistory.length - 1, i * spacingSteps);
      const sample = this.trailHistory[idx];
      if (sample) {
        this.orientUnitOnSphere(this.squadUnits[i], sample.pos, sample.fwd);
      }
    }
  }

  showToast(msg) {
    const el = document.getElementById('brawl-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  updateAllHUD() {
    const cfg = STAGE_CONFIGS[this.state.stage] || STAGE_CONFIGS[1];
    const poke = POKEMON_DATA[this.state.species] || POKEMON_DATA.pikachu;
    const livingUnits = Math.max(0, Math.ceil(this.state.hp / 10));
    const maxUnits = Math.ceil(this.state.maxHp / 10);
    const capturedCount = this.buildings.filter((b) => b.captured).length;

    document.getElementById('stage-title').textContent = cfg.label;
    document.getElementById('hud-poke-icon').textContent = poke.icon;
    document.getElementById('hud-squad-text').textContent = `${livingUnits}/${maxUnits} 隻`;
    document.getElementById('capture-count').textContent = `${capturedCount}/${this.buildings.length}`;
    document.getElementById('kill-count').textContent = String(this.state.kills);
    document.getElementById('score-count').textContent = String(this.state.score);

    const hpPct = Math.max(0, Math.min(100, (this.state.hp / this.state.maxHp) * 100));
    document.getElementById('player-hp-fill').style.width = `${hpPct}%`;
    document.getElementById('player-hp-text').textContent = `${this.state.hp} / ${this.state.maxHp} HP (${livingUnits} 隻)`;

    const energyPct = this.state.feverTimer > 0 ? 100 : Math.min(100, this.state.energy);
    document.getElementById('xp-bar-fill').style.width = `${energyPct}%`;
    document.getElementById('xp-level-badge').textContent =
      this.state.feverTimer > 0 ? `🔥 狂熱加速 ${this.state.feverTimer.toFixed(1)}s` : `能量狂熱 ${Math.floor(energyPct)}%`;

    const ws = this.weaponManager.stats;
    const wInfo = WEAPON_INFO[ws.activeWeapon] || WEAPON_INFO.orbit;
    document.getElementById('ws-active-weapon').textContent = `${wInfo.name} Lv.${ws.weaponTier}`;
    const pwrPct = Math.round(ws.powerMult * 100);
    const spdPct = Math.round(ws.speedMult * 100);
    document.getElementById('ws-power').textContent =
      ws.powerMult >= MAX_POWER_MULT ? `🔥 火力 ${pwrPct}% (MAX)` : `🔥 火力 ${pwrPct}%`;
    document.getElementById('ws-speed').textContent =
      ws.speedMult >= MAX_SPEED_MULT ? `⚡ 攻速 ${spdPct}% (MAX)` : `⚡ 攻速 ${spdPct}%`;
  }

  initUI() {
    document.querySelectorAll('#stage-selector .pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#stage-selector .pill-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.setupStage(Number(btn.dataset.stage) || 1, true);
      });
    });

    document.querySelectorAll('#poke-selector .poke-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#poke-selector .poke-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.species = btn.dataset.species || 'pikachu';
        for (const u of this.squadUnits) this.scene.remove(u);
        this.squadUnits = [];
        this.syncSquadMeshes();
        this.updateAllHUD();
      });
    });

    document.querySelectorAll('#device-selector .pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#device-selector .pill-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.deviceMode = btn.dataset.device || 'auto';
        this.applyDeviceMode();
      });
    });

    const startModal = document.getElementById('start-modal');
    const unlockAudio = () => {
      brawlAudio.init();
      if (this.state.running && !brawlAudio.bgmRunning) {
        brawlAudio.startBGM();
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    document.getElementById('btn-start-brawl').addEventListener('click', () => {
      brawlAudio.init();
      brawlAudio.playStartJingle();
      brawlAudio.startBGM();
      this.enterFullscreenAndLockLandscape();
      startModal.classList.add('hidden');
      document.getElementById('result-modal').classList.add('hidden');
      this.state.running = true;
      this.state.paused = false;
    });

    document.getElementById('hud-fullscreen-btn').addEventListener('click', () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        this.enterFullscreenAndLockLandscape();
      }
    });

    document.getElementById('hud-pause-btn').addEventListener('click', () => {
      if (!this.state.running) return;
      this.state.paused = !this.state.paused;
      startModal.classList.toggle('hidden', !this.state.paused);
    });

    document.getElementById('hud-sound-btn').addEventListener('click', () => {
      this.state.muted = !this.state.muted;
      brawlAudio.setMuted(this.state.muted);
      document.getElementById('svg-sound-on').classList.toggle('hidden', this.state.muted);
      document.getElementById('svg-sound-off').classList.toggle('hidden', !this.state.muted);
    });

    const triggerDash = () => {
      if (!this.state.running || this.state.paused || this.state.dashCd > 0) return;
      this.state.dashActive = 0.55;
      this.state.dashTrailTimer = 0;
      this.state.dashCd = 3.0;
      this.state.iFrameTimer = Math.max(this.state.iFrameTimer, 0.65);
      brawlAudio.playDash();
      this.weaponManager.spawnBurstEffect(this.playerPos, 0x38bdf8, 8, 9, 0.28);
      this.showToast('⚡ 極速閃避衝刺！');
    };

    const triggerSkill = () => {
      if (!this.state.running || this.state.paused || this.state.skillCd > 0) return;
      this.state.skillCd = 6.0;
      this.state.screenShakeTimer = 0.28;
      brawlAudio.playUltimate();
      this.weaponManager.triggerNova(
        this.playerPos,
        this.zombieManager.zombies,
        this.buildings,
        () => {},
        (z, d, k, ks) => this.zombieManager.damageZombie(z, d, k, ks),
        1.65,
        true
      );

      // Find nearest uncaptured building and activate 8s 3D direction guide
      let nearest = null;
      let minDist = Infinity;
      for (const b of this.buildings) {
        if (b.captured) continue;
        const d = b.position.distanceTo(this.playerPos);
        if (d < minDist) {
          minDist = d;
          nearest = b;
        }
      }
      if (nearest) {
        this.state.guideTarget = nearest;
        this.state.guideTimer = 8.0;
        this.showToast(`🧭 奧義震波 ＋ 指引最近未攻佔【${nearest.name}】(${Math.round(minDist)}m)！`);
      } else {
        this.showToast('💥 全隊奧義震波釋放！');
      }
    };

    document.getElementById('btn-dash').addEventListener('click', triggerDash);
    document.getElementById('btn-mob-dash').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerDash();
    });
    document.getElementById('btn-skill').addEventListener('click', triggerSkill);
    document.getElementById('btn-mob-skill').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerSkill();
    });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') triggerDash();
      if (e.code === 'Space' || e.code === 'KeyE') triggerSkill();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.initJoystick();
    this.initCameraControls();
  }

  initCameraControls() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0 || e.button === 1 || e.pointerType === 'touch') {
        this.isDraggingOrbit = true;
        this.orbitPointerId = e.pointerId;
        this.lastPointerPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDraggingOrbit || e.pointerId !== this.orbitPointerId) return;
      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };

      const up = this.planet.getSurfaceNormal(this.playerPos);
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(up, -dx * 0.0065);
      this.camNorth.applyQuaternion(yawQuat).normalize();
      this.orbitPitch = Math.max(0.18, Math.min(1.42, this.orbitPitch + dy * 0.006));
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isDraggingOrbit && e.pointerId === this.orbitPointerId) {
        this.isDraggingOrbit = false;
        this.orbitPointerId = null;
      }
    });
    window.addEventListener('pointercancel', (e) => {
      if (this.isDraggingOrbit && e.pointerId === this.orbitPointerId) {
        this.isDraggingOrbit = false;
        this.orbitPointerId = null;
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camZoom = Math.max(0.55, Math.min(2.1, this.camZoom + e.deltaY * 0.0008));
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        if (e.touches.length >= 2) {
          this.isDraggingOrbit = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.lastPinchDist = Math.hypot(dx, dy);
        }
      },
      { passive: false }
    );

    // Prevent iPadOS / iOS Safari 1-finger rubber-band scrolling (white screen) & multi-finger pinch exit
    const preventIPadGesture = (e) => {
      if (this.state.running && !this.state.paused) {
        e.preventDefault();
      }
    };
    document.addEventListener('gesturestart', preventIPadGesture, { passive: false });
    document.addEventListener('gesturechange', preventIPadGesture, { passive: false });
    document.addEventListener('gestureend', preventIPadGesture, { passive: false });
    document.addEventListener(
      'touchmove',
      (e) => {
        if (this.state.running && !this.state.paused) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (e.touches.length === 2 && this.lastPinchDist > 0) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const deltaPinch = this.lastPinchDist - dist;
          this.camZoom = Math.max(0.55, Math.min(2.1, this.camZoom + deltaPinch * 0.004));
          this.lastPinchDist = dist;
        }
      },
      { passive: false }
    );

    canvas.addEventListener('touchend', () => {
      this.lastPinchDist = 0;
    });
  }

  initJoystick() {
    const zone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    const base = document.getElementById('joystick-base');
    if (!zone || !stick || !base) return;

    let pointerId = null;
    const maxDist = 66;

    const updateStick = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joyVec.x = dx / maxDist;
      this.joyVec.y = dy / maxDist;
      this.joyVec.active = dist > 6;
    };

    const resetStick = () => {
      pointerId = null;
      zone.classList.remove('touching');
      stick.style.transform = 'translate(0px, 0px)';
      this.joyVec.x = 0;
      this.joyVec.y = 0;
      this.joyVec.active = false;
    };

    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointerId = e.pointerId;
      zone.setPointerCapture(pointerId);
      zone.classList.add('touching');
      updateStick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === pointerId) updateStick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointerup', (e) => {
      if (e.pointerId === pointerId) resetStick();
    });
    zone.addEventListener('pointercancel', (e) => {
      if (e.pointerId === pointerId) resetStick();
    });
  }

  async enterFullscreenAndLockLandscape() {
    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      }
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if ((this.state.deviceMode === 'mobile' || isTouch) && screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch {
      // Ignore if browser blocks fullscreen or orientation lock
    }
  }

  applyDeviceMode() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const useMobile =
      this.state.deviceMode === 'mobile' ||
      (this.state.deviceMode === 'auto' && isTouch && window.innerWidth <= 1024);

    document.getElementById('mobile-controls').classList.toggle('hidden', !useMobile);
    document.getElementById('hud-bottom').classList.toggle('hidden', useMobile);
  }

  advanceBuildingCapture(b, effectiveDelta) {
    if (b.captured) return;
    b.progress = Math.min(1, b.progress + effectiveDelta / b.captureTime);

    if (b.hpBarFill) {
      const ratio = Math.max(0.001, b.progress);
      b.hpBarFill.scale.x = ratio;
      b.hpBarFill.position.x = -(1 - ratio) * 1.6;
      b.hpBarFill.material.color.setHex(b.progress >= 0.5 ? 0x10b981 : 0xf59e0b);
    }

    // 50% progress -> Gorilla Boss leaps out to defend!
    if (!b.bossSpawned && b.progress >= 0.5 && b.progress < 1) {
      b.bossSpawned = true;
      const cfg = STAGE_CONFIGS[this.state.stage] || STAGE_CONFIGS[1];
      this.zombieManager.spawnZombie('gorilla', b.position, {
        hp: cfg.hpMult,
        speed: cfg.speedMult
      });
      brawlAudio.playBossSpawn();
      this.showToast(`🦍 ${b.name} 派出猩猩殭屍隊長！`);
    }

    if (b.progress >= 1) {
      b.captured = true;
      if (b.hpBarGroup) b.hpBarGroup.visible = false;
      b.cp.visited = true;
      b.cp.bannerMat.color.setHex(0x10b981);
      b.cp.bannerMat.emissive.setHex(0x10b981);
      b.cp.bannerMat.emissiveIntensity = 1.1;
      b.cp.ringMat.color.setHex(0x34d399);
      b.cp.ringMat.opacity = 1.0;
      b.cp.pennantGroup.scale.setScalar(1.3);
      if (this.state.guideTarget === b) {
        this.state.guideTimer = 0;
        this.state.guideTarget = null;
      }
      this.weaponManager.addTurret(b);
      this.weaponManager.spawnBurstEffect(b.position, 0x34d399, 16, 12, 0.4);
      this.weaponManager.spawnFireworks(b.position);
      confetti({ particleCount: 45, spread: 70, origin: { y: 0.55 } });
      brawlAudio.playCapture();

      this.state.score += 300;
      this.showToast(`🎆 成功攻佔 ${b.name}！已轉化為我方砲台！`);

      const capturedCount = this.buildings.filter((x) => x.captured).length;
      if (capturedCount >= this.buildings.length) {
        this.onStageClear();
      }
      this.updateAllHUD();
    }
  }

  onStageClear() {
    this.state.running = false;
    brawlAudio.playVictory();
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });

    const cfg = STAGE_CONFIGS[this.state.stage] || STAGE_CONFIGS[1];
    const modal = document.getElementById('result-modal');
    const isFinal = this.state.stage >= 3;

    document.getElementById('result-badge').textContent = isFinal ? 'ALL CLEAR' : 'STAGE CLEAR';
    document.getElementById('result-title').textContent = isFinal
      ? '🏆 全三座小行星制霸！'
      : `🎉 ${cfg.name}全面攻佔！`;
    document.getElementById('result-desc').textContent = isFinal
      ? '你已帶領寶可夢大軍攻佔台北、京都、上海全部建築砲台！'
      : '全部 13 座建築已轉化為我方砲台！隊伍上限與武器強化將繼承至下一關！';
    document.getElementById('res-kills').textContent = String(this.state.kills);
    document.getElementById('res-maxhp').textContent = `${this.state.maxHp} HP`;
    document.getElementById('res-score').textContent = String(this.state.score);
    document.getElementById('btn-result-text').textContent = isFinal
      ? '重新挑戰第 1 關'
      : `前往第 ${this.state.stage + 1} 關：${STAGE_CONFIGS[this.state.stage + 1].name}`;

    const actionBtn = document.getElementById('btn-result-action');
    actionBtn.onclick = () => {
      modal.classList.add('hidden');
      if (isFinal) {
        this.setupStage(1, true);
      } else {
        this.setupStage(this.state.stage + 1, false);
      }
      this.state.running = true;
    };
    modal.classList.remove('hidden');
  }

  onGameOver() {
    this.state.running = false;
    const modal = document.getElementById('result-modal');
    document.getElementById('result-badge').textContent = 'DEFEAT';
    document.getElementById('result-title').textContent = '💫 寶可夢隊伍全滅';
    document.getElementById('result-desc').textContent = '血量歸零！點擊下方按鈕重新挑戰本關。';
    document.getElementById('res-kills').textContent = String(this.state.kills);
    document.getElementById('res-maxhp').textContent = `${this.state.maxHp} HP`;
    document.getElementById('res-score').textContent = String(this.state.score);
    document.getElementById('btn-result-text').textContent = '重新挑戰本關';

    const actionBtn = document.getElementById('btn-result-action');
    actionBtn.onclick = () => {
      modal.classList.add('hidden');
      this.setupStage(this.state.stage, true);
      this.state.running = true;
    };
    modal.classList.remove('hidden');
  }

  promptWeaponSwap(newWeaponKey) {
    const ws = this.weaponManager.stats;
    const curInfo = WEAPON_INFO[ws.activeWeapon] || WEAPON_INFO.orbit;
    const newInfo = WEAPON_INFO[newWeaponKey] || WEAPON_INFO.dart;

    this.state.paused = true;
    const modal = document.getElementById('weapon-swap-modal');
    document.getElementById('swap-cur-name').textContent = `${curInfo.name} Lv.${ws.weaponTier}`;
    document.getElementById('swap-new-name').textContent = `${newInfo.name} Lv.${ws.weaponTier}`;
    document.getElementById('swap-inherit-note').textContent =
      `更換後將完整繼承：🔥火力 ${Math.round(ws.powerMult * 100)}%・⚡攻速 ${Math.round(ws.speedMult * 100)}%・階級 Lv.${ws.weaponTier}`;

    document.getElementById('btn-swap-confirm').onclick = () => {
      this.weaponManager.setActiveWeapon(newWeaponKey);
      modal.classList.add('hidden');
      this.state.paused = false;
      this.showToast(`🔄 已更換為 ${newInfo.name}（繼承 Lv.${ws.weaponTier} 效果比例）！`);
      this.updateAllHUD();
    };

    document.getElementById('btn-swap-keep').onclick = () => {
      this.state.score += 50;
      modal.classList.add('hidden');
      this.state.paused = false;
      this.showToast(`🛡️ 保留 ${curInfo.name}（+50 積分）`);
      this.updateAllHUD();
    };

    modal.classList.remove('hidden');
  }

  handleDropPicked(kind) {
    const ws = this.weaponManager.stats;
    const cfg = STAGE_CONFIGS[this.state.stage] || STAGE_CONFIGS[1];

    if (kind === 'xp') {
      brawlAudio.playPickup('xp');
      this.state.score += 15;
      this.state.energy += 20;
      if (this.state.energy >= 100) {
        this.state.energy = 0;
        this.state.feverTimer = 6.0;
        this.showToast('🔥 能量滿格！全隊狂熱加速 6 秒！');
      }
    } else if (kind === 'heal') {
      brawlAudio.playPickup('xp');
      if (this.state.hp < this.state.maxHp) {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + 10);
        this.syncSquadMeshes();
        this.showToast('❤️ 紅蓮寶石：+10 HP 召喚 1 隻隊友歸隊！');
      } else {
        this.state.score += 30;
      }
    } else if (kind === 'maxhp') {
      brawlAudio.playPickup('special');
      if (this.state.maxHp < cfg.maxSquadCap) {
        this.state.maxHp = Math.min(cfg.maxSquadCap, this.state.maxHp + 10);
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + 10);
        this.syncSquadMeshes();
        this.showToast(`👑 特殊寶石！隊伍上限提升至 ${this.state.maxHp} HP (${this.state.maxHp / 10}/${cfg.maxSquadCap / 10} 隻)！`);
      } else {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + 10);
        this.state.score += 50;
        this.syncSquadMeshes();
        this.showToast(`👑 已達本關上限 (${cfg.maxSquadCap / 10} 隻)，改為回復並 +50 分！`);
      }
    } else if (kind === 'essence_orbit') {
      brawlAudio.playPickup('essence');
      if (ws.weaponTier < MAX_WEAPON_TIER) {
        ws.weaponTier += 1;
        if (ws.activeWeapon === 'orbit') {
          ws.orbitCount = Math.min(10, 2 + ws.weaponTier);
          this.weaponManager.rebuildOrbitBlades();
        }
        this.showToast(`🟢 階級精華：武器升至 Lv.${ws.weaponTier}！`);
      } else {
        this.state.score += 40;
        this.showToast(`🟢 武器階級已達上限 Lv.${MAX_WEAPON_TIER}（+40 積分）！`);
      }
    } else if (kind === 'essence_speed') {
      if (ws.speedMult < MAX_SPEED_MULT) {
        ws.speedMult = Math.min(MAX_SPEED_MULT, ws.speedMult * 1.18);
        this.showToast(`🔵 疾風精華：武器攻速 ${Math.round(ws.speedMult * 100)}%！`);
      } else {
        this.state.score += 40;
        this.showToast(`🔵 攻速已達上限 ${Math.round(MAX_SPEED_MULT * 100)}%（+40 積分）！`);
      }
    } else if (kind === 'essence_power') {
      if (ws.powerMult < MAX_POWER_MULT) {
        ws.powerMult = Math.min(MAX_POWER_MULT, ws.powerMult * 1.2);
        ws.bladeScale = Math.min(1.6, ws.bladeScale * 1.06);
        if (ws.activeWeapon === 'orbit') {
          this.weaponManager.rebuildOrbitBlades();
        }
        this.showToast(`🟠 狂暴精華：武器火力 ${Math.round(ws.powerMult * 100)}%！`);
      } else {
        this.state.score += 40;
        this.showToast(`🟠 火力已達上限 ${Math.round(MAX_POWER_MULT * 100)}%（+40 積分）！`);
      }
    } else if (kind.startsWith('weapon_')) {
      const newKey = kind.replace('weapon_', '');
      if (newKey === ws.activeWeapon) {
        ws.weaponTier = Math.min(MAX_WEAPON_TIER, ws.weaponTier + 1);
        ws.powerMult = Math.min(MAX_POWER_MULT, ws.powerMult * 1.08);
        if (ws.activeWeapon === 'orbit') {
          ws.orbitCount = Math.min(10, 2 + ws.weaponTier);
          this.weaponManager.rebuildOrbitBlades();
        }
        const info = WEAPON_INFO[newKey] || WEAPON_INFO.orbit;
        this.showToast(`⬆️ 相同武器強化！${info.name} Lv.${ws.weaponTier}！`);
      } else {
        this.promptWeaponSwap(newKey);
      }
    }
    this.updateAllHUD();
  }

  getMoveInput() {
    let ix = 0;
    let iy = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iy += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
    if (this.joyVec.active) {
      ix = this.joyVec.x;
      iy = this.joyVec.y;
    }
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    return { ix, iy, moving: len > 0.05 };
  }

  updateMovement(delta) {
    const { ix, iy, moving } = this.getMoveInput();
    if (!moving && this.state.dashActive <= 0) return false;

    const up = this.planet.getSurfaceNormal(this.playerPos);
    const screenUp = this.camNorth
      .clone()
      .sub(up.clone().multiplyScalar(this.camNorth.dot(up)));
    if (screenUp.lengthSq() < 1e-6) {
      screenUp.set(0, 0, -1).sub(up.clone().multiplyScalar(-up.z));
    }
    screenUp.normalize();
    this.camNorth.copy(screenUp);
    const screenRight = new THREE.Vector3().crossVectors(screenUp, up).normalize();

    const moveDir = new THREE.Vector3()
      .addScaledVector(screenRight, ix)
      .addScaledVector(screenUp, -iy);

    if (moveDir.lengthSq() < 1e-6 && this.state.dashActive > 0) {
      moveDir.copy(this.playerForward);
    }

    if (moveDir.lengthSq() > 1e-6) {
      moveDir.normalize();
      const dashMult = this.state.dashActive > 0 ? 2.8 : 1.0;
      const feverMult = this.state.feverTimer > 0 ? 1.3 : 1.0;
      this.playerPos.addScaledVector(moveDir, this.baseMoveSpeed * dashMult * feverMult * delta);
      this.playerPos.copy(this.planet.projectToSurface(this.playerPos, 0));
      this.playerForward.lerp(moveDir, Math.min(1, delta * 14)).normalize();

      if (this.state.dashActive > 0) {
        this.state.dashTrailTimer -= delta;
        if (this.state.dashTrailTimer <= 0) {
          this.state.dashTrailTimer = 0.08;
          this.weaponManager.spawnBurstEffect(this.playerPos, 0x38bdf8, 4, 5.5, 0.2);
        }
      }

      this.trailHistory.unshift({
        pos: this.playerPos.clone(),
        fwd: this.playerForward.clone()
      });
      if (this.trailHistory.length > 180) this.trailHistory.pop();
      this.orientSquad();
    }
    return true;
  }

  updateCooldownBadges(delta) {
    if (this.state.dashCd > 0) this.state.dashCd = Math.max(0, this.state.dashCd - delta);
    if (this.state.dashActive > 0) this.state.dashActive = Math.max(0, this.state.dashActive - delta);
    if (this.state.skillCd > 0) this.state.skillCd = Math.max(0, this.state.skillCd - delta);
    if (this.state.iFrameTimer > 0) this.state.iFrameTimer = Math.max(0, this.state.iFrameTimer - delta);
    if (this.state.feverTimer > 0) this.state.feverTimer = Math.max(0, this.state.feverTimer - delta);
    if (this.state.guideTimer > 0) this.state.guideTimer = Math.max(0, this.state.guideTimer - delta);

    const dashText = Math.ceil(this.state.dashCd);
    const skillText = Math.ceil(this.state.skillCd);
    document.getElementById('pc-dash-cd').classList.toggle('hidden', this.state.dashCd <= 0);
    document.getElementById('pc-dash-cd').textContent = `${dashText}s`;
    document.getElementById('mob-dash-cd').classList.toggle('hidden', this.state.dashCd <= 0);
    document.getElementById('mob-dash-cd').textContent = String(dashText);

    document.getElementById('pc-skill-cd').classList.toggle('hidden', this.state.skillCd <= 0);
    document.getElementById('pc-skill-cd').textContent = `${skillText}s`;
    document.getElementById('mob-skill-cd').classList.toggle('hidden', this.state.skillCd <= 0);
    document.getElementById('mob-skill-cd').textContent = String(skillText);
  }

  updateBuildingsAndSpawns(delta) {
    const cfg = STAGE_CONFIGS[this.state.stage] || STAGE_CONFIGS[1];
    let activeSiegeBuilding = null;
    let activeContested = false;

    for (const b of this.buildings) {
      if (b.captured) continue;
      if (b.hpBarGroup) {
        b.hpBarGroup.quaternion.copy(this.camera.quaternion);
      }

      // Spawn zombies periodically from uncaptured buildings
      b.spawnTimer -= delta;
      if (b.spawnTimer <= 0) {
        b.spawnTimer = cfg.spawnInterval;
        if (this.zombieManager.zombies.length < cfg.maxZombies) {
          const typeKey = cfg.pool[Math.floor(Math.random() * cfg.pool.length)];
          const count = typeKey === 'penguin' ? 2 : 1;
          for (let c = 0; c < count; c++) {
            const jitter = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
            this.zombieManager.spawnZombie(typeKey, b.position.clone().add(jitter), {
              hp: cfg.hpMult,
              speed: cfg.speedMult
            });
          }
        }
      }

      // Time-based capture when standing inside the building ring
      const dist = this.playerPos.distanceTo(b.position);
      if (dist <= b.radius + 4.2) {
        activeSiegeBuilding = b;
        let zombiesInRing = 0;
        for (const z of this.zombieManager.zombies) {
          if (z.pos.distanceTo(b.position) <= b.radius + 4.5) {
            zombiesInRing += 1;
          }
        }
        const contested = zombiesInRing >= 3;
        activeContested = contested;
        const rate = contested ? 0.65 : 1.0;
        this.advanceBuildingCapture(b, delta * rate);
      }
    }

    const siegeHud = document.getElementById('siege-hud');
    if (activeSiegeBuilding && !activeSiegeBuilding.captured) {
      siegeHud.classList.remove('hidden');
      const pct = Math.floor(activeSiegeBuilding.progress * 100);
      const remSec = Math.max(0, (1 - activeSiegeBuilding.progress) * activeSiegeBuilding.captureTime).toFixed(1);
      document.getElementById('siege-name').textContent = activeContested
        ? `⚠️ ${activeSiegeBuilding.name} (干擾減速)`
        : `🏰 佔領 ${activeSiegeBuilding.name}`;
      document.getElementById('siege-hp-text').textContent = `${pct}% · 剩 ${remSec}s`;
      document.getElementById('siege-hp-fill').style.width = `${pct}%`;
    } else {
      siegeHud.classList.add('hidden');
    }
  }

  updateCamera(delta) {
    const up = this.planet.getSurfaceNormal(this.playerPos);
    const tangentNorth = this.camNorth
      .clone()
      .sub(up.clone().multiplyScalar(this.camNorth.dot(up)));
    if (tangentNorth.lengthSq() > 1e-6) {
      this.camNorth.copy(tangentNorth.normalize());
    }

    const dist = 28 * this.camZoom;
    const horiz = this.camNorth.clone().multiplyScalar(-Math.cos(this.orbitPitch) * dist);
    const vert = up.clone().multiplyScalar(Math.sin(this.orbitPitch) * dist);
    const desired = this.playerPos.clone().add(horiz).add(vert);

    const smooth = Math.min(1, delta * 10);
    this.camera.position.lerp(desired, smooth);
    this.camera.up.lerp(up, smooth).normalize();
    this.camera.lookAt(this.playerPos);

    if (this.state.screenShakeTimer > 0) {
      this.state.screenShakeTimer = Math.max(0, this.state.screenShakeTimer - delta);
      const amt = 0.55;
      this.camera.position.x += (Math.random() - 0.5) * amt;
      this.camera.position.y += (Math.random() - 0.5) * amt;
      this.camera.position.z += (Math.random() - 0.5) * amt;
    }

    // Keep Directional Sun Light following the player around the planet so no hemisphere goes dark!
    if (this.dirLight) {
      const screenRight = new THREE.Vector3().crossVectors(this.camNorth, up).normalize();
      const lightPos = this.playerPos
        .clone()
        .addScaledVector(up, 52)
        .addScaledVector(screenRight, 22)
        .addScaledVector(this.camNorth, 16);
      this.dirLight.position.copy(lightPos);
      this.dirLight.target.position.copy(this.playerPos);
      this.dirLight.target.updateMatrixWorld();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    let isMoving = false;
    if (this.state.running && !this.state.paused) {
      this.updateCooldownBadges(delta);
      isMoving = this.updateMovement(delta);
      this.updateBuildingsAndSpawns(delta);

      const cfg = STAGE_CONFIGS[this.state.stage] || STAGE_CONFIGS[1];
      const livingUnits = Math.max(0, Math.ceil(this.state.hp / 10));

      this.weaponManager.update(delta, elapsed, {
        playerPos: this.playerPos,
        playerForward: this.playerForward,
        squadCount: livingUnits,
        zombieManager: this.zombieManager,
        buildings: this.buildings,
        turretCfg: cfg.turret,
        damageBuildingFn: () => {},
        onDropPicked: (kind) => this.handleDropPicked(kind)
      });

      this.zombieManager.update(
        delta,
        elapsed,
        this.playerPos,
        (dmg) => {
          if (this.state.iFrameTimer > 0) return;
          this.state.iFrameTimer = 0.6;
          this.state.hp = Math.max(0, this.state.hp - dmg);
          brawlAudio.playHurt();
          this.syncSquadMeshes();
          this.updateAllHUD();
          if (this.state.hp <= 0) {
            this.onGameOver();
          }
        },
        (killedZombie) => {
          this.state.kills += 1;
          this.state.score += killedZombie.cfg.boss ? 200 : 25;
          if (!this._lastKillSfx || elapsed - this._lastKillSfx > 0.12) {
            this._lastKillSfx = elapsed;
            brawlAudio.playKill();
          }
          this.weaponManager.spawnBurstEffect(
            killedZombie.pos,
            killedZombie.origColor,
            killedZombie.cfg.boss ? 16 : 7,
            killedZombie.cfg.boss ? 12 : 8.5,
            killedZombie.cfg.boss ? 0.42 : 0.26
          );
          this.weaponManager.rollZombieDrop(killedZombie, killedZombie.pos);
          this.updateAllHUD();
        }
      );
    }

    for (let i = 0; i < this.squadUnits.length; i++) {
      animatePokemonRun(
        this.squadUnits[i],
        elapsed * (isMoving ? 1.45 : 0.45),
        i * 0.45,
        false,
        this.state.dashActive > 0
      );
      // Blink during i-frames
      this.squadUnits[i].visible =
        this.state.iFrameTimer <= 0 || Math.floor(elapsed * 20) % 2 === 0;
    }

    this.planet.update(delta, this.playerPos);
    this.updateGuideVisuals(elapsed);
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
  }

  updateGuideVisuals(elapsed) {
    const target = this.state.guideTarget;
    const active = this.state.guideTimer > 0 && target && !target.captured;
    if (this.guideArrow) this.guideArrow.visible = active;
    if (this.guideBeacon) this.guideBeacon.visible = active;
    if (!active) return;

    const up = this.planet.getSurfaceNormal(this.playerPos);
    const toTarget = target.position.clone().sub(this.playerPos);
    const dir = toTarget.sub(up.clone().multiplyScalar(toTarget.dot(up)));
    if (dir.lengthSq() > 1e-6) {
      dir.normalize();
      const arrowPos = this.planet.projectToSurface(
        this.playerPos.clone().addScaledVector(dir, 3.8),
        1.7 + Math.sin(elapsed * 8) * 0.25
      );
      this.orientUnitOnSphere(this.guideArrow, arrowPos, dir);
    }

    const tUp = this.planet.getSurfaceNormal(target.position);
    this.planet.orientToSphere(
      this.guideBeacon,
      target.position.clone().addScaledVector(tUp, 12),
      tUp
    );
    this.guideBeacon.material.opacity = 0.28 + Math.sin(elapsed * 6) * 0.16;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.brawlApp = new BrawlApp();
});
