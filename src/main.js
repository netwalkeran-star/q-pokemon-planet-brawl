import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { Planet } from './planet.js';
import { ChibiSnake } from './snake.js';
import { GemManager } from './gems.js';
import { BossManager } from './boss.js';
import { NPCManager } from './npc.js';
import { POKEMON_DATA } from './pokemon.js';
import { sound } from './sound.js';
import { saveManager, TALENT_DEFINITIONS, MONSTERS_INC_CAPES } from './saveManager.js';
import { AIVoiceAgent } from './aiVoiceAgent.js';

class Game {
  constructor() {
    this.stage = 1;
    this.score = 0;
    this.isPlaying = false;
    this.isSelectingChar = false;
    this.bossSpawned = false;
    this.targetLength = this.getTargetLengthForStage(1);
    this.stageTimeLeft = 240.0; // 4分鐘計時 ("加一個計時 4分鐘後 結束 後比")
    this.clearedStages = new Set(); // 記錄已通關的城市 ("三個城市都過了 跳出完成都市探險")

    // Control Modes: 'pc' (電腦滑鼠/鍵盤) | 'mobile' (手機橫屏搖桿操作)
    const isTouchDevice =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && window.innerWidth <= 1280);
    this.controlMode = isTouchDevice ? 'mobile' : 'pc';

    // Orbital Camera & Planet Rotation ("可以旋轉小行星") - 1.3x Closer Overcooked 45° Diorama Angle!
    this.orbitYaw = 0;
    this.orbitPitch = 0.54;
    this.camZoom = 1.0;
    this.isDraggingOrbit = false;
    this.orbitPointerId = null;
    this.pointerDownPos = { x: 0, y: 0 };
    this.lastPointerPos = { x: 0, y: 0 };
    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();
    this.btnForwardHeld = false;

    // Mobile Virtual Joystick State
    this.joystickActive = false;
    this.joystickPointerId = null;
    this.joystickVec = { x: 0, y: 0 };

    // Pinch-to-Zoom State for Mobile
    this.lastPinchDist = 0;

    // 📳 問題二：鏡頭打擊微震 (Screen Shake)
    this.screenShakeTimer = 0;
    this.screenShakeIntensity = 0;
    this.fadeBottomTimer = null;

    this.syncViewportHeight();
    this.initThree();
    this.initGameObjects();
    this.initUI();
    this.initInputs();
    this.initMobileControls();
    this.applyControlModeUI();
    this.checkFirstTimeName();
    this.renderProfileUI();

    // Hands-free True AI Voice Rival Agent ("有一隻是真AI 我只要講話就可以對話 不用按特定鍵")
    this.aiVoiceAgent = new AIVoiceAgent(this);
    this.aiVoiceAgent.onAIResponse((reply) => {
      if (this.npcManager) {
        this.npcManager.setAISpeech(reply, 4.0);
      }
    });

    window.addEventListener('resize', () => this.onResize());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.onResize());
    }
  }

  /**
   * Syncs exact visible height (--app-height) so LINE In-App Browser top/bottom bars never clip UI!
   */
  syncViewportHeight() {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
  }

  getTargetLengthForStage(stage) {
    // 第一關 25 隻，之後每關 +8 (第1關: 25, 第2關: 33, 第3關: 41...)
    return 25 + (stage - 1) * 8;
  }

  initThree() {
    this.container = document.getElementById('game-container');
    this.scene = new THREE.Scene();
    // Bright Sunny Daytime Sky ("感覺像晚上可以是白天嗎")
    this.scene.background = new THREE.Color(0x87ceeb);

    // 45° Miniature Toy-Box Diorama FOV (Overcooked World Map style!)
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 1200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.24;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Bright Sunny Daytime Hemisphere + Crisp Golden Sunlight & Shadows!
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x62a832, 1.25);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff9e6, 2.2);
    this.dirLight.position.set(45, 85, 45);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 160;
    const shadowBound = 36;
    this.dirLight.shadow.camera.left = -shadowBound;
    this.dirLight.shadow.camera.right = shadowBound;
    this.dirLight.shadow.camera.top = shadowBound;
    this.dirLight.shadow.camera.bottom = -shadowBound;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.rimLight = new THREE.DirectionalLight(0x90e0ef, 0.75);
    this.rimLight.position.set(-60, -40, -50);
    this.scene.add(this.rimLight);

    this.createTwinklingStarfield();

    this.clock = new THREE.Clock();
  }

  updateStageSky(stage) {
    if (stage === 1) {
      this.scene.background = new THREE.Color(0x87ceeb); // Sunny Taipei Blue Sky
    } else if (stage === 2) {
      this.scene.background = new THREE.Color(0x9be2ff); // Bright Kyoto Spring Daylight Sky
    } else {
      this.scene.background = new THREE.Color(0x76c7f0); // Clear Shanghai Daytime Sky
    }
  }

  createTwinklingStarfield() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 700;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const palette = [
      new THREE.Color(0xfff3b0),
      new THREE.Color(0xffd166),
      new THREE.Color(0xffffff),
      new THREE.Color(0xa8dadc),
      new THREE.Color(0xffb5a7)
    ];

    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 320 + Math.random() * 180;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i] = col.r;
      colors[i + 1] = col.g;
      colors[i + 2] = col.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.75
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  initGameObjects() {
    this.selectedSpecies = 'pikachu';
    this.planet = new Planet(this.scene, this.stage);
    this.snake = new ChibiSnake(this.scene, this.planet, this.selectedSpecies);
    this.gemManager = new GemManager(this.scene, this.planet);
    this.bossManager = new BossManager(this.scene, this.planet, this.stage);
    this.npcManager = new NPCManager(this.scene, this.planet);
    this.updateCamera();
  }

  initUI() {
    this.stageTitle = document.getElementById('stage-title');
    this.stageTimerEl = document.getElementById('stage-timer');
    this.snakeLengthEl = document.getElementById('snake-length');
    this.targetLengthEl = document.getElementById('target-length');
    this.flagCountEl = document.getElementById('flag-count');
    this.hudPokeIconEl = document.getElementById('hud-poke-icon');
    this.gameScoreEl = document.getElementById('game-score');
    this.landmarkFxEl = document.getElementById('landmark-fx-text');

    this.bossHud = document.getElementById('boss-hud');
    this.bossNameEl = document.getElementById('boss-name');
    this.bossWeaknessEl = document.getElementById('boss-weakness');
    this.bossHpFill = document.getElementById('boss-hp-fill');

    this.toastEl = document.getElementById('game-toast');
    this.startModal = document.getElementById('start-modal');
    this.charSelectOverlay = document.getElementById('char-select-overlay');
    this.victoryModal = document.getElementById('victory-modal');
    this.grandCompleteModal = document.getElementById('grand-complete-modal');
    this.gameoverModal = document.getElementById('gameover-modal');
    this.gameoverTitleEl = document.getElementById('gameover-title');
    this.gameoverDescEl = document.getElementById('gameover-desc');

    this.hudBottomPC = document.getElementById('hud-bottom');
    this.mobileControlsEl = document.getElementById('mobile-controls');
    this.landscapeTipEl = document.getElementById('landscape-tip');

    this.startModePCBtn = document.getElementById('start-mode-pc');
    this.startModeMobileBtn = document.getElementById('start-mode-mobile');

    if (this.startModePCBtn && this.startModeMobileBtn) {
      this.startModePCBtn.addEventListener('click', () => {
        this.controlMode = 'pc';
        this.applyControlModeUI();
      });
      this.startModeMobileBtn.addEventListener('click', () => {
        this.controlMode = 'mobile';
        this.applyControlModeUI();
      });
    }

    const btnFsLandscape = document.getElementById('btn-fullscreen-landscape');
    if (btnFsLandscape) {
      btnFsLandscape.addEventListener('click', () => {
        this.enterFullscreenAndLockLandscape();
      });
    }

    // Pokémon Selection Grid inside In-Game Character Select Overlay ("進遊戲後再選角色")
    const pokeCards = document.querySelectorAll('.poke-card');
    pokeCards.forEach((card) => {
      card.addEventListener('click', () => {
        pokeCards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        const sp = card.getAttribute('data-species');
        this.selectedSpecies = sp;
        this.snake.transformToPokemon(sp);
        if (this.hudPokeIconEl && POKEMON_DATA[sp]) {
          this.hudPokeIconEl.innerText = POKEMON_DATA[sp].icon;
        }
      });
    });

    // Step 1 Button: Enter Fullscreen Game -> Opens In-Game 3D Character Selection!
    document.getElementById('btn-start').addEventListener('click', () => {
      sound.init();
      this.enterFullscreenAndLockLandscape();
      this.startModal.classList.add('hidden');
      this.isSelectingChar = true;
      this.camZoom = 0.72; // Zoom in slightly to showcase the 3D Pokémon on the planet!
      this.applyControlModeUI();
      this.charSelectOverlay.classList.remove('hidden');
      this.showToast('✨ 已進入全螢幕！請點選你的 3D 寶可夢隊長後按「正式開戰」');
    });

    // Step 2 Button: Confirm Character inside the 3D Game -> Start Race!
    document.getElementById('btn-confirm-char').addEventListener('click', () => {
      this.charSelectOverlay.classList.add('hidden');
      this.isSelectingChar = false;
      this.camZoom = 1.0;
      this.stageTimeLeft = 240.0;
      this.isPlaying = true;
      this.applyControlModeUI();
      if (this.aiVoiceAgent) this.aiVoiceAgent.startListening();
      const pokeName = POKEMON_DATA[this.selectedSpecies]?.name || '皮卡丘';
      this.showToast(
        `🏁 爭霸開始！帶著【${pokeName}】在 4 分鐘內率先達到 ${this.targetLength} 隻！🎙️ 直接講話即可與 🤖AI耿鬼 對話！`
      );

      // Auto-fade tutorial labels after 4 seconds to keep the 3D diorama clear
      setTimeout(() => {
        const tips = document.querySelectorAll('.joystick-label, .mobile-center-tip');
        tips.forEach((t) => t.classList.add('tip-faded'));
      }, 4000);

      // 💻 問題一：PC 底部操作按鈕於開局 3 秒後自動半透明化，滑鼠靠近才復原
      setTimeout(() => {
        if (this.hudBottomPC) this.hudBottomPC.classList.add('faded');
      }, 3000);
    });

    document.getElementById('btn-next-stage').addEventListener('click', () => {
      this.victoryModal.classList.add('hidden');
      this.advanceStage();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.gameoverModal.classList.add('hidden');
      this.resetCurrentStage();
      this.isPlaying = true;
      this.applyControlModeUI();
    });

    // Grand Complete Modal City Picker & End Adventure Buttons ("三個城市都過了 跳出完成都市探險 繼續(三個城市跳出來選) 還是結束")
    const cityPickBtns = document.querySelectorAll('.btn-city-pick');
    cityPickBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenStage = parseInt(btn.getAttribute('data-stage'), 10) || 1;
        if (this.grandCompleteModal) this.grandCompleteModal.classList.add('hidden');
        this.goToStage(chosenStage);
      });
    });

    const btnEndAdv = document.getElementById('btn-end-adventure');
    if (btnEndAdv) {
      btnEndAdv.addEventListener('click', () => {
        if (this.grandCompleteModal) this.grandCompleteModal.classList.add('hidden');
        this.clearedStages.clear();
        this.score = 0;
        this.gameScoreEl.innerText = '0';
        this.stage = 1;
        this.goToStage(1, false);
        this.isPlaying = false;
        this.applyControlModeUI();
        this.startModal.classList.remove('hidden');
      });
    }

    // --- Player Profile & Trainer Name Modal Binding ("第一次進去可寫人名") ---
    const nameModal = document.getElementById('name-modal');
    const inputPlayerName = document.getElementById('input-player-name');
    const btnSaveName = document.getElementById('btn-save-name');
    const btnEditName = document.getElementById('btn-edit-name');

    if (btnEditName && nameModal && inputPlayerName) {
      btnEditName.addEventListener('click', () => {
        inputPlayerName.value = saveManager.getPlayerName();
        nameModal.classList.remove('hidden');
        inputPlayerName.focus();
      });
    }

    const saveTrainerNameAction = () => {
      const val = (inputPlayerName ? inputPlayerName.value : '').trim();
      if (!val) {
        this.showToast('⚠️ 請輸入至少 1 個字元的訓練家名字！');
        return;
      }
      saveManager.setPlayerName(val);
      if (nameModal) nameModal.classList.add('hidden');
      this.renderProfileUI();
      sound.playEvolve();
      this.showToast(`✨ 歡迎訓練家【${saveManager.getPlayerName()}】！`);
    };

    if (btnSaveName) {
      btnSaveName.addEventListener('click', saveTrainerNameAction);
    }
    if (inputPlayerName) {
      inputPlayerName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTrainerNameAction();
      });
    }

    // Quick tag suggestions for name
    const nameTags = document.querySelectorAll('.name-tag');
    nameTags.forEach((tag) => {
      tag.addEventListener('click', () => {
        const chosen = tag.getAttribute('data-name');
        if (inputPlayerName && chosen) {
          inputPlayerName.value = chosen;
          saveTrainerNameAction();
        }
      });
    });

    // --- Passive Talent Tree Modal Binding ("升級被動天賦樹 累積多少節升級") ---
    const talentModal = document.getElementById('talent-modal');
    const btnOpenTalents = document.getElementById('btn-open-talents');
    const hudPlayerBadge = document.getElementById('hud-player-badge');
    const btnCloseTalents = document.getElementById('btn-close-talents');
    const btnResetTalents = document.getElementById('btn-reset-talents');

    const openTalentsAction = () => {
      this.renderTalentTreeUI();
      if (talentModal) talentModal.classList.remove('hidden');
    };

    if (btnOpenTalents) btnOpenTalents.addEventListener('click', openTalentsAction);
    if (hudPlayerBadge) hudPlayerBadge.addEventListener('click', openTalentsAction);

    if (btnCloseTalents && talentModal) {
      btnCloseTalents.addEventListener('click', () => {
        talentModal.classList.add('hidden');
        if (this.snake) this.snake.refreshTalents();
      });
    }

    if (btnResetTalents) {
      btnResetTalents.addEventListener('click', () => {
        saveManager.resetTalents();
        sound.playSkill('lightning');
        this.renderTalentTreeUI();
        this.renderProfileUI();
        if (this.snake) this.snake.refreshTalents();
        this.showToast('🔄 已免費洗點！所有天賦點數已全額退回');
      });
    }

    // --- Progress Export & Import Modal Binding ("可以匯出匯入進度") ---
    const saveIoModal = document.getElementById('save-io-modal');
    const btnOpenSaveIo = document.getElementById('btn-open-save-io');
    const exportCodeInput = document.getElementById('export-code-input');
    const btnCopyExport = document.getElementById('btn-copy-export');
    const importCodeInput = document.getElementById('import-code-input');
    const btnExecImport = document.getElementById('btn-exec-import');
    const btnCloseSaveIo = document.getElementById('btn-close-save-io');

    if (btnOpenSaveIo && saveIoModal) {
      btnOpenSaveIo.addEventListener('click', () => {
        if (exportCodeInput) {
          exportCodeInput.value = saveManager.exportCode() || '';
        }
        if (importCodeInput) importCodeInput.value = '';
        saveIoModal.classList.remove('hidden');
      });
    }

    if (btnCopyExport && exportCodeInput) {
      btnCopyExport.addEventListener('click', async () => {
        const code = exportCodeInput.value;
        if (!code) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
          } else {
            exportCodeInput.select();
            document.execCommand('copy');
          }
          this.showToast('📋 進度代碼已複製到剪貼簿！可貼到 LINE 或其他裝置');
        } catch (_) {
          exportCodeInput.select();
          document.execCommand('copy');
          this.showToast('📋 進度代碼已選取/複製！');
        }
      });
    }

    if (btnExecImport && importCodeInput) {
      btnExecImport.addEventListener('click', () => {
        const code = (importCodeInput.value || '').trim();
        if (!code) {
          this.showToast('⚠️ 請先貼上 PKM_ 開頭的存檔代碼！');
          return;
        }
        const success = saveManager.importCode(code);
        if (success) {
          sound.playEvolve();
          this.renderProfileUI();
          if (this.snake) this.snake.refreshTalents();
          if (saveIoModal) saveIoModal.classList.add('hidden');
          this.showToast(`✅ 成功還原進度！歡迎回來，${saveManager.getPlayerName()} (Lv.${saveManager.data.level})`);
        } else {
          sound.playHurt();
          this.showToast('❌ 進度代碼無效或格式錯誤，請確認是以 PKM_ 開頭的代碼！');
        }
      });
    }

    if (btnCloseSaveIo && saveIoModal) {
      btnCloseSaveIo.addEventListener('click', () => {
        saveIoModal.classList.add('hidden');
      });
    }

    // --- True AI Voice & Hands-free Mic UI Binding ("有一隻是真AI 我只要講話就可以對話 不用按特定鍵") ---
    const hudAiMicBtn = document.getElementById('hud-ai-mic-btn');
    if (hudAiMicBtn) {
      hudAiMicBtn.addEventListener('click', () => {
        if (this.aiVoiceAgent) {
          this.aiVoiceAgent.toggleMic();
        }
      });
    }

    // --- Settings Modal Wiring (Sound, AI Voice, Save IO) ---
    const settingsModal = document.getElementById('settings-modal');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');

    if (btnOpenSettings && settingsModal) {
      btnOpenSettings.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
      });
    }
    if (btnCloseSettings && settingsModal) {
      btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
    }

    const aiSettingsModal = document.getElementById('ai-settings-modal');
    const btnOpenAiSettings = document.getElementById('btn-open-ai-settings');
    const inputGeminiKey = document.getElementById('input-gemini-key');
    const btnSaveAiSettings = document.getElementById('btn-save-ai-settings');
    const btnCloseAiSettings = document.getElementById('btn-close-ai-settings');

    if (btnOpenAiSettings && aiSettingsModal) {
      btnOpenAiSettings.addEventListener('click', () => {
        if (settingsModal) settingsModal.classList.add('hidden');
        if (inputGeminiKey && this.aiVoiceAgent) {
          inputGeminiKey.value = this.aiVoiceAgent.getApiKey();
        }
        aiSettingsModal.classList.remove('hidden');
      });
    }

    if (btnSaveAiSettings && aiSettingsModal) {
      btnSaveAiSettings.addEventListener('click', () => {
        const key = inputGeminiKey ? inputGeminiKey.value.trim() : '';
        if (this.aiVoiceAgent) {
          this.aiVoiceAgent.setApiKey(key);
          this.aiVoiceAgent.micEnabled = true;
          this.aiVoiceAgent.startListening();
        }
        sound.playEvolve();
        aiSettingsModal.classList.add('hidden');
        this.showToast(
          key
            ? '✨ 已啟用 Google Gemini 1.5 Flash 旗艦真 AI 思考大腦！'
            : '🎙️ 已啟用內建賽跑語音大腦！直接說話即可對話（免按鍵）'
        );
      });
    }

    if (btnCloseAiSettings && aiSettingsModal) {
      btnCloseAiSettings.addEventListener('click', () => {
        aiSettingsModal.classList.add('hidden');
      });
    }

    // --- Sound Toggle UI Binding ("跳殺音效改音樂 我關音量還是聽的到") ---
    const hudSoundBtn = document.getElementById('hud-sound-btn');
    const hudSoundIcon = document.getElementById('hud-sound-icon');
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    const startSoundIcon = document.getElementById('start-sound-icon');

    const updateSoundIcons = (isMuted) => {
      const icon = isMuted ? '🔇' : '🔊';
      if (hudSoundIcon) hudSoundIcon.textContent = icon;
      if (startSoundIcon) startSoundIcon.textContent = isMuted ? '🔇 音效：靜音' : '🔊 音效：開啟';
    };
    updateSoundIcons(sound.getMuted());

    const toggleSoundAction = () => {
      const isMuted = sound.toggleMute();
      updateSoundIcons(isMuted);
      this.showToast(isMuted ? '🔇 遊戲已全面靜音' : '🔊 遊戲音效已開啟');
    };

    if (hudSoundBtn) hudSoundBtn.addEventListener('click', toggleSoundAction);
    if (btnToggleSound) btnToggleSound.addEventListener('click', toggleSoundAction);

    // Also close settings modal when opening Save IO
    const btnOpenSaveIoForSettings = document.getElementById('btn-open-save-io');
    if (btnOpenSaveIoForSettings && settingsModal) {
      btnOpenSaveIoForSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
    }

    this.updateTopCounters();
    this.updateElementHUD();
    this.updateSkillChargesUI();
  }

  /**
   * Prompts the player to type their name upon first launch ("第一次進去可寫人名")
   */
  checkFirstTimeName() {
    if (!saveManager.hasPlayerName()) {
      const nameModal = document.getElementById('name-modal');
      const input = document.getElementById('input-player-name');
      if (nameModal) {
        nameModal.classList.remove('hidden');
        if (input) setTimeout(() => input.focus(), 300);
      }
    }
  }

  /**
   * Refreshes the top-level player profile display across Start Modal and Game HUD
   */
  renderProfileUI() {
    const name = saveManager.getPlayerName();
    const data = saveManager.data;
    const progress = saveManager.getCurrentLevelProgress();

    const startNameEl = document.getElementById('start-player-name');
    if (startNameEl) startNameEl.innerText = name;

    const startLvlEl = document.getElementById('start-player-level');
    if (startLvlEl) startLvlEl.innerText = `Lv.${data.level}`;

    const startExpEl = document.getElementById('start-player-exp');
    const startExpFill = document.getElementById('start-player-exp-fill');
    if (startExpEl) {
      if (data.level >= 10) {
        startExpEl.innerText = `MAX (${data.totalSegments})`;
        if (startExpFill) startExpFill.style.width = '100%';
      } else {
        startExpEl.innerText = `${progress.current}/${progress.range}`;
        if (startExpFill) startExpFill.style.width = `${Math.max(4, progress.percent)}%`;
      }
    }

    const badgePointsEl = document.getElementById('badge-talent-points');
    if (badgePointsEl) {
      badgePointsEl.innerText = data.talentPoints;
      badgePointsEl.style.display = data.talentPoints > 0 ? 'inline-block' : 'none';
    }

    const hudNameEl = document.getElementById('hud-player-name');
    if (hudNameEl) {
      hudNameEl.innerText = `${name} (Lv.${data.level})`;
    }
  }

  /**
   * 🏭 Renders the Monsters, Inc. Closet & Cape Collection Window
   */
  renderClosetUI() {
    const closetGrid = document.getElementById('closet-grid');
    const closetCollectRate = document.getElementById('closet-collect-rate');
    const hudClosetBadge = document.getElementById('hud-closet-badge');
    const badgeClosetCapes = document.getElementById('badge-closet-capes');

    const count = saveManager.getCollectedCapeCount();
    const rateText = `收集進度: ${count} / 4`;
    if (closetCollectRate) closetCollectRate.textContent = rateText;
    if (hudClosetBadge) hudClosetBadge.textContent = `${count}/4`;
    if (badgeClosetCapes) badgeClosetCapes.textContent = `${count}/4`;

    if (!closetGrid) return;
    closetGrid.innerHTML = '';

    const equippedId = saveManager.getEquippedCape();

    Object.values(MONSTERS_INC_CAPES).forEach((cape) => {
      const isOwned = saveManager.hasCape(cape.id);
      const isEquipped = equippedId === cape.id;

      const card = document.createElement('div');
      card.className = `closet-card ${isEquipped ? 'closet-card-equipped' : ''} ${!isOwned ? 'closet-card-locked' : ''}`;

      let statusTag = '';
      if (isEquipped) {
        statusTag = '<span class="closet-status-tag tag-equipped">🎽 穿戴中</span>';
      } else if (isOwned) {
        statusTag = '<span class="closet-status-tag tag-owned">✅ 已擁有</span>';
      } else {
        statusTag = '<span class="closet-status-tag tag-locked">🔒 未解鎖</span>';
      }

      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button class="btn-equip-cape btn-unequip-cape" data-cape-action="unequip">卸下披肩</button>`;
      } else if (isOwned) {
        btnHtml = `<button class="btn-equip-cape" data-cape-action="equip" data-cape-id="${cape.id}">裝備披肩</button>`;
      } else {
        btnHtml = `<button class="btn-equip-cape btn-unequip-cape" disabled style="opacity:0.6; cursor:not-allowed;">通關怪獸副本獲取</button>`;
      }

      card.innerHTML = `
        <div class="closet-card-header">
          <div class="closet-card-name">
            <span>${cape.icon}</span>
            <span>${cape.name}</span>
          </div>
          ${statusTag}
        </div>
        <div class="closet-desc">${cape.desc}</div>
        <div class="closet-buff-badge">${cape.buff}</div>
        ${btnHtml}
      `;

      const btn = card.querySelector('.btn-equip-cape');
      if (btn && isOwned) {
        btn.addEventListener('click', () => {
          if (isEquipped) {
            saveManager.unequipCape();
            if (this.snake) {
              this.snake.updateEquippedCape();
              this.snake.refreshTalents();
            }
            sound.playEvolve();
            this.showToast('已卸下連帽披肩');
          } else {
            saveManager.equipCape(cape.id);
            if (this.snake) {
              this.snake.updateEquippedCape();
              this.snake.refreshTalents();
            }
            sound.playVictory();
            this.showToast(`✨ 成功裝備【${cape.name}】！${cape.buff}`);
          }
          this.renderClosetUI();
        });
      }

      closetGrid.appendChild(card);
    });
  }

  /**
   * Renders the 8 Talent cards in the Passive Talent Tree UI
   */
  renderTalentTreeUI() {
    const data = saveManager.data;
    const progress = saveManager.getCurrentLevelProgress();

    const lvlEl = document.getElementById('talent-ui-level');
    if (lvlEl) lvlEl.innerText = `Lv.${data.level}`;

    const expEl = document.getElementById('talent-ui-exp');
    if (expEl) {
      if (data.level >= 10) {
        expEl.innerText = `總累積: ${data.totalSegments} 節 (MAX)`;
      } else {
        expEl.innerText = `本級進度: ${progress.current} / ${progress.range} 節 (差 ${progress.range - progress.current} 節升級)`;
      }
    }

    const pointsEl = document.getElementById('talent-ui-points');
    if (pointsEl) pointsEl.innerText = data.talentPoints;

    const grid = document.getElementById('talent-grid');
    if (!grid) return;

    grid.innerHTML = '';
    Object.keys(TALENT_DEFINITIONS).forEach((tid) => {
      const def = TALENT_DEFINITIONS[tid];
      const curLvl = saveManager.getTalentLevel(tid);
      const isMax = curLvl >= def.maxLevel;
      const canUpgrade = !isMax && data.talentPoints > 0;

      const card = document.createElement('div');
      card.className = `talent-card ${curLvl > 0 ? 'active' : ''}`;

      const descCurrent = curLvl > 0 ? def.desc[curLvl - 1] : '尚未習得';
      const descNext = !isMax ? `下一級: ${def.desc[curLvl]}` : '已達到最高等級！';

      card.innerHTML = `
        <div class="talent-card-header">
          <div class="talent-card-title">${def.icon} ${def.name}</div>
          <span class="talent-card-level ${isMax ? 'max' : ''}">${curLvl}/${def.maxLevel}</span>
        </div>
        <div class="talent-card-desc">
          <div style="color: #cbd5e1; font-weight: 600;">當前: ${descCurrent}</div>
          ${!isMax ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 3px;">${descNext}</div>` : ''}
        </div>
        <button class="btn-talent-up" ${canUpgrade ? '' : 'disabled'}>
          ${isMax ? '已滿級' : canUpgrade ? '▲ 升級 (+1點)' : '需要天賦點'}
        </button>
      `;

      const upBtn = card.querySelector('.btn-talent-up');
      if (canUpgrade) {
        upBtn.addEventListener('click', () => {
          if (saveManager.upgradeTalent(tid)) {
            sound.playEvolve();
            this.renderTalentTreeUI();
            this.renderProfileUI();
            if (this.snake) this.snake.refreshTalents();
          }
        });
      }

      grid.appendChild(card);
    });
  }

  /**
   * Immediately enters Fullscreen when entering the game ("進遊戲後就是全螢幕")
   */
  async enterFullscreenAndLockLandscape() {
    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      }
      if (this.controlMode === 'mobile' && screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (_) {
      // Ignore if browser blocks fullscreen or orientation lock
    }
    this.checkOrientationBanner();
  }

  checkOrientationBanner() {
    if (!this.landscapeTipEl) return;
    if (this.controlMode === 'mobile' && window.innerHeight > window.innerWidth) {
      this.landscapeTipEl.classList.remove('hidden');
    } else {
      this.landscapeTipEl.classList.add('hidden');
    }
  }

  applyControlModeUI() {
    if (this.controlMode === 'mobile') {
      this.hudBottomPC.classList.add('hidden');
      if (this.isPlaying) {
        this.mobileControlsEl.classList.remove('hidden');
      } else {
        this.mobileControlsEl.classList.add('hidden');
      }
      if (this.startModeMobileBtn && this.startModePCBtn) {
        this.startModeMobileBtn.classList.add('active');
        this.startModePCBtn.classList.remove('active');
      }
    } else {
      if (this.isPlaying) {
        this.hudBottomPC.classList.remove('hidden');
      } else {
        this.hudBottomPC.classList.add('hidden');
      }
      this.mobileControlsEl.classList.add('hidden');
      if (this.startModeMobileBtn && this.startModePCBtn) {
        this.startModePCBtn.classList.add('active');
        this.startModeMobileBtn.classList.remove('active');
      }
    }
    this.checkOrientationBanner();
  }

  toggleControlMode() {
    if (this.controlMode === 'pc') {
      this.controlMode = 'mobile';
      this.applyControlModeUI();
      this.enterFullscreenAndLockLandscape();
      this.showToast('📱 已切換為【手機橫屏搖桿模式】！左手推搖桿移動、右手按跳躍/衝刺');
    } else {
      this.controlMode = 'pc';
      this.joystickActive = false;
      this.joystickVec = { x: 0, y: 0 };
      this.applyControlModeUI();
      this.showToast('💻 已切換為【電腦鍵鼠模式】！點地面走動、拖曳旋轉星球、按 ↑ 走、空白/右鍵跳躍');
    }
  }

  initMobileControls() {
    const joyZone = document.getElementById('joystick-zone');
    const joyBase = document.getElementById('joystick-base');
    const joyStick = document.getElementById('joystick-stick');
    const maxRadius = 62; // 📱 配合 1.5X 加大方向搖桿

    const updateStick = (clientX, clientY) => {
      const rect = joyBase.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joystickVec.x = dx / maxRadius;
      this.joystickVec.y = dy / maxRadius;
    };

    const resetStick = () => {
      this.joystickActive = false;
      this.joystickPointerId = null;
      this.joystickVec.x = 0;
      this.joystickVec.y = 0;
      joyStick.style.transform = 'translate(0px, 0px)';
      joyZone.classList.remove('touching');
    };

    joyZone.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.joystickActive = true;
      this.joystickPointerId = e.pointerId;
      joyZone.classList.add('touching');
      joyZone.setPointerCapture(e.pointerId);
      if (this.snake) this.snake.clearTargetPoint();
      updateStick(e.clientX, e.clientY);
    });

    joyZone.addEventListener('pointermove', (e) => {
      if (!this.joystickActive || e.pointerId !== this.joystickPointerId) return;
      e.stopPropagation();
      updateStick(e.clientX, e.clientY);
    });

    joyZone.addEventListener('pointerup', (e) => {
      if (e.pointerId === this.joystickPointerId) {
        resetStick();
      }
    });

    joyZone.addEventListener('pointercancel', (e) => {
      if (e.pointerId === this.joystickPointerId) {
        resetStick();
      }
    });

    const btnMobJump = document.getElementById('btn-mob-jump');
    const btnMobDash = document.getElementById('btn-mob-dash');
    const btnMobAttack = document.getElementById('btn-mob-attack');
    const btnMobCam = document.getElementById('btn-mob-cam');

    if (btnMobJump) {
      btnMobJump.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (this.isPlaying) this.snake.jump();
      });
    }

    if (btnMobDash) {
      btnMobDash.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (this.isPlaying) this.handleDash();
      });
    }

    if (btnMobAttack) {
      btnMobAttack.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (this.isPlaying) this.handleSkillActivation();
      });
    }

    if (btnMobCam) {
      btnMobCam.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.orbitYaw = 0;
        if (Math.abs(this.camZoom - 1.0) < 0.1) {
          this.camZoom = 1.4;
          this.showToast('🔭 視角已拉遠（全景模式）');
        } else if (this.camZoom > 1.2) {
          this.camZoom = 0.78;
          this.showToast('🔍 視角已拉近（特寫模式）');
        } else {
          this.camZoom = 1.0;
          this.showToast('🎥 視角已回正（標準距離）');
        }
      });
    }

    const canvasEl = this.renderer.domElement;
    canvasEl.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.lastPinchDist = Math.hypot(dx, dy);
        }
      },
      { passive: true }
    );

    canvasEl.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this.lastPinchDist > 0) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const deltaPinch = this.lastPinchDist - dist;
          this.camZoom = Math.max(0.55, Math.min(2.1, this.camZoom + deltaPinch * 0.004));
          this.lastPinchDist = dist;
        }
      },
      { passive: true }
    );

    canvasEl.addEventListener('touchend', () => {
      this.lastPinchDist = 0;
    });
  }

  initInputs() {
    this.keys = {};
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;
      this.keys[e.key] = true;

      if (e.code === 'Space') {
        e.preventDefault();
        this.snake.jump();
      }
      if (e.key === 'Shift') {
        this.handleDash();
      }
      if (e.key === 'e' || e.key === 'E' || e.key === 'q' || e.key === 'Q') {
        this.handleSkillActivation();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });

    const canvasEl = this.renderer.domElement;

    canvasEl.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying && !this.isSelectingChar) return;
      if (e.pointerId === this.joystickPointerId) return;

      if (e.button === 2 && this.isPlaying) {
        this.snake.jump();
        return;
      }

      if (e.button === 0 || e.button === 1) {
        this.isDraggingOrbit = true;
        this.orbitPointerId = e.pointerId;
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
        this.lastPointerPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if ((!this.isPlaying && !this.isSelectingChar) || !this.isDraggingOrbit || e.pointerId !== this.orbitPointerId) return;

      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };

      const totalDrag = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y
      );

      if (totalDrag >= 5) {
        // Rotate snake's forward direction directly with horizontal planet rotation so moving forward ALWAYS goes straight ahead! ("用手指全選轉後 往前方向會跑掉 修改 旋轉後 還是往前")
        if (this.snake && this.snake.forward && this.snake.normal) {
          const turnQuat = new THREE.Quaternion().setFromAxisAngle(
            this.snake.normal,
            -dx * 0.0075
          );
          this.snake.forward.applyQuaternion(turnQuat).normalize();
          this.snake.clearTargetPoint();
        }
        this.orbitYaw = 0;
        this.orbitPitch = Math.max(0.08, Math.min(1.35, this.orbitPitch + dy * 0.0065));
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isPlaying && !this.isSelectingChar) return;

      if (this.isDraggingOrbit && e.pointerId === this.orbitPointerId) {
        const totalDrag = Math.hypot(
          e.clientX - this.pointerDownPos.x,
          e.clientY - this.pointerDownPos.y
        );

        if (totalDrag < 6 && e.button === 0 && this.isPlaying) {
          this.handlePlanetClick(e.clientX, e.clientY);
        }
        this.isDraggingOrbit = false;
        this.orbitPointerId = null;
      }
    });

    canvasEl.addEventListener(
      'wheel',
      (e) => {
        if (!this.isPlaying && !this.isSelectingChar) return;
        e.preventDefault();
        this.camZoom = Math.max(0.55, Math.min(2.1, this.camZoom + e.deltaY * 0.0008));
      },
      { passive: false }
    );

    window.addEventListener('contextmenu', (e) => {
      if (this.isPlaying || this.isSelectingChar) e.preventDefault();
    });

    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnForward = document.getElementById('btn-forward');
    const btnDash = document.getElementById('btn-dash');
    const btnJump = document.getElementById('btn-jump');
    const btnSkill = document.getElementById('btn-skill');

    const setTurn = (val) => {
      if (this.isPlaying) this.snake.currentTurn = val;
    };

    if (btnLeft) {
      btnLeft.addEventListener('pointerdown', () => setTurn(-1));
      btnLeft.addEventListener('pointerup', () => setTurn(0));
      btnLeft.addEventListener('pointerleave', () => setTurn(0));
    }

    if (btnRight) {
      btnRight.addEventListener('pointerdown', () => setTurn(1));
      btnRight.addEventListener('pointerup', () => setTurn(0));
      btnRight.addEventListener('pointerleave', () => setTurn(0));
    }

    if (btnForward) {
      btnForward.addEventListener('pointerdown', () => {
        this.btnForwardHeld = true;
        this.snake.clearTargetPoint();
      });
      btnForward.addEventListener('pointerup', () => {
        this.btnForwardHeld = false;
      });
      btnForward.addEventListener('pointerleave', () => {
        this.btnForwardHeld = false;
      });
    }

    if (btnDash) {
      btnDash.addEventListener('click', () => {
        if (this.isPlaying) this.handleDash();
      });
    }

    btnJump.addEventListener('click', () => {
      if (this.isPlaying) this.snake.jump();
    });

    btnSkill.addEventListener('click', () => {
      if (this.isPlaying) this.handleSkillActivation();
    });

    if (this.hudBottomPC) {
      this.hudBottomPC.addEventListener('mouseenter', () => {
        this.hudBottomPC.classList.remove('faded');
        clearTimeout(this.fadeBottomTimer);
      });
      this.hudBottomPC.addEventListener('mouseleave', () => {
        clearTimeout(this.fadeBottomTimer);
        this.fadeBottomTimer = setTimeout(() => {
          if (this.isPlaying) this.hudBottomPC.classList.add('faded');
        }, 2500);
      });
    }
  }

  handlePlanetClick(clientX, clientY) {
    this.mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hits = this.raycaster.intersectObject(this.planet.planetMesh, false);

    if (hits.length > 0) {
      const hitPoint = hits[0].point;
      const normal = hits[0].face ? hits[0].face.normal : this.planet.getSurfaceNormal(hitPoint);
      this.snake.setTargetPoint(hitPoint);
      // 🎯 問題一：地面點擊導航引導光圈 (Click Ripple)
      this.spawnClickRipple(hitPoint, normal);
    }
  }

  /**
   * 🎯 問題一：在小行星表面點擊處擴散淡出的綠色光環
   */
  spawnClickRipple(point, normal) {
    const ringGeo = new THREE.RingGeometry(0.35, 0.75, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(point).add(normal.clone().multiplyScalar(0.08));
    ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.scene.add(ringMesh);

    let progress = 0;
    const anim = () => {
      progress += 0.08;
      const s = 1.0 + progress * 3.5;
      ringMesh.scale.set(s, s, s);
      ringMat.opacity = Math.max(0, 0.95 - progress);
      if (progress < 1.0) {
        requestAnimationFrame(anim);
      } else {
        this.scene.remove(ringMesh);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    anim();
  }

  /**
   * ⚡ 極速衝刺（Dash - CD 3.2 秒）
   */
  handleDash() {
    if (!this.isPlaying || !this.snake) return;
    const ok = this.snake.activateSkill();
    if (ok) {
      this.showToast('⚡ 極速衝刺爆發！速度提升至 2.1x！');
    } else {
      const cd = Math.ceil(this.snake.skillCooldown);
      this.showToast(`⏳ 衝刺冷卻中 (剩餘 ${cd} 秒)`);
    }
  }

  /**
   * 💥 專屬大招攻擊（消耗技能包次數）
   */
  handleSkillActivation() {
    if (!this.isPlaying || !this.snake) return;
    if ((this.snake.skillCharges || 0) <= 0) {
      this.showToast('⚠️ 尚無大招次數！請在場上尋找「🎁 技能包」充填 5 次大招！');
      this.handleDash();
      return;
    }
    const result = this.snake.unleashCharacterSkill(this);
    this.updateSkillChargesUI();
    if (result.usedCharge) {
      this.showToast(`${result.skillName}！${result.desc} (剩餘 ${result.remaining} 次)`);
    }
  }

  updateSkillChargesUI() {
    const pillPC = document.getElementById('skill-charges-pill');
    const pillMob = document.getElementById('mob-skill-charges');
    const skillText = document.getElementById('skill-text');
    const charges = this.snake ? (this.snake.skillCharges || 0) : 0;

    if (pillPC) {
      pillPC.textContent = `${charges}`;
      pillPC.style.background = charges > 0 ? '#fde047' : 'rgba(255, 255, 255, 0.2)';
      pillPC.style.color = charges > 0 ? '#0f172a' : '#e2e8f0';
      pillPC.style.boxShadow = charges > 0 ? '0 0 14px rgba(253, 224, 71, 0.9)' : 'none';
    }
    if (skillText) {
      skillText.textContent = '大招';
    }
    if (pillMob) {
      pillMob.textContent = `${charges}`;
      pillMob.style.background = charges > 0 ? '#fde047' : 'rgba(255, 255, 255, 0.22)';
      pillMob.style.color = charges > 0 ? '#0f172a' : '#cbd5e1';
      pillMob.style.boxShadow = charges > 0 ? '0 0 12px rgba(253, 224, 71, 0.9)' : 'none';
    }
  }

  /**
   * 📳 問題二：鏡頭微震 (Screen Shake)
   */
  triggerScreenShake(duration = 0.2, intensity = 0.35) {
    this.screenShakeTimer = duration;
    this.screenShakeIntensity = intensity;
  }

  showToast(msg) {
    this.toastEl.innerText = msg;
    this.toastEl.classList.remove('toast-hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.add('toast-hidden');
    }, 3200);
  }

  updateCamera() {
    const headPos = this.snake.position;
    const normal = this.snake.normal;
    const forward = this.snake.forward;
    const right = new THREE.Vector3().crossVectors(normal, forward).normalize();

    // 1.3x Closer Camera Distance ("現在視角有點太遠 先變大1.3x": 34.0 / 1.3 ≈ 25.5)
    const dist = 25.5 * this.camZoom;

    const horizDir = forward
      .clone()
      .multiplyScalar(-Math.cos(this.orbitYaw))
      .add(right.clone().multiplyScalar(Math.sin(this.orbitYaw)))
      .normalize();

    const offset = horizDir
      .multiplyScalar(Math.cos(this.orbitPitch) * dist)
      .add(normal.clone().multiplyScalar(Math.sin(this.orbitPitch) * dist));

    const targetCamPos = headPos.clone().add(offset);

    this.camera.position.lerp(targetCamPos, 0.16);
    this.camera.lookAt(headPos);
    this.camera.up.lerp(normal, 0.18);

    // 📳 問題二：打擊微震 (Screen Shake)
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= 0.016;
      const shakeAmt = this.screenShakeIntensity || 0.35;
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }

    // Keep Directional Sun Light aimed directly at the player's local patch so 3D shadows are super crisp!
    if (this.dirLight) {
      const sunOffset = normal
        .clone()
        .multiplyScalar(48)
        .add(right.clone().multiplyScalar(32))
        .add(forward.clone().multiplyScalar(22));
      this.dirLight.position.copy(headPos).add(sunOffset);
      this.dirLight.target.position.copy(headPos);
      this.dirLight.target.updateMatrixWorld();
    }
  }

  updateTopCounters() {
    const playerLen = this.snake.segments.length + 1;
    this.snakeLengthEl.innerText = playerLen;
    if (this.targetLengthEl) this.targetLengthEl.innerText = this.targetLength;
    const lenFill = document.getElementById('hud-length-fill');
    if (lenFill && this.targetLength > 0) {
      const pct = Math.min(100, Math.max(4, Math.round((playerLen / this.targetLength) * 100)));
      lenFill.style.width = `${pct}%`;
    }
    if (this.flagCountEl && this.planet) {
      this.flagCountEl.innerText = this.planet.getVisitedLandmarkCount();
    }
    const flagTotalEl = document.getElementById('flag-total');
    if (flagTotalEl && this.planet) {
      flagTotalEl.innerText = this.planet.getTotalLandmarkCount();
    }
    if (this.stageTimerEl) {
      const sec = Math.max(0, Math.ceil(this.stageTimeLeft));
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      this.stageTimerEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      this.stageTimerEl.style.color = sec <= 30 ? '#f87171' : '#38bdf8';
    }
  }

  /**
   * Shows the 1.5s large pure text effect when crossing a building ("穿越建築時會有大的字特效1.5秒 只有字喔")
   */
  showLandmarkFxText(landmarkName) {
    if (!this.landmarkFxEl) return;
    this.landmarkFxEl.innerText = `🚩 ${landmarkName}`;
    this.landmarkFxEl.classList.remove('landmark-fx-hidden');
    clearTimeout(this.landmarkFxTimer);
    this.landmarkFxTimer = setTimeout(() => {
      this.landmarkFxEl.classList.add('landmark-fx-hidden');
    }, 1500);
  }

  /**
   * Renders the final leaderboard HTML inside the Victory or Gameover modal ("排行拿掉 過關後在顯示就好")
   */
  renderEndStageLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = this.npcManager.getLeaderboard(this.snake);
    container.innerHTML = list
      .map((item, idx) => {
        const pct = Math.min(100, Math.round((item.length / this.targetLength) * 100));
        const rowClass = item.isPlayer ? 'lb-row lb-player' : 'lb-row';
        return `
          <div class="${rowClass}">
            <div class="lb-info">
              <span>${idx === 0 ? '👑' : `${idx + 1}.`} ${item.icon} ${item.name}</span>
              <b>${item.length} / ${this.targetLength} 隻</b>
            </div>
            <div class="lb-bar"><div class="lb-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      })
      .join('');
  }

  checkRaceWinCondition() {
    const playerLen = this.snake.segments.length + 1;
    if (playerLen >= this.targetLength) {
      this.handleStageVictory('length');
      return true;
    }

    if (this.planet && this.planet.getVisitedLandmarkCount() >= this.planet.getTotalLandmarkCount()) {
      this.handleStageVictory('landmarks');
      return true;
    }

    const npcWinner = this.npcManager.checkNPCReachedTarget(this.targetLength);
    if (npcWinner) {
      this.handleNPCRaceWin(npcWinner);
      return true;
    }

    // 4-Minute Countdown Timer End Comparison ("加一個計時 4分鐘後 結束 後比")
    if (this.stageTimeLeft <= 0) {
      this.handleTimeUpComparison();
      return true;
    }

    return false;
  }

  handleTimeUpComparison() {
    const list = this.npcManager.getLeaderboard(this.snake);
    const topEntry = list[0];
    if (topEntry && topEntry.isPlayer) {
      this.handleStageVictory('timeup');
    } else if (topEntry) {
      this.isPlaying = false;
      this.applyControlModeUI();
      sound.playHurt();
      const playerLen = this.snake.segments.length + 1;
      saveManager.recordGameEnd(this.score, playerLen, this.stage);
      this.renderProfileUI();
      if (this.gameoverTitleEl) {
        this.gameoverTitleEl.innerText = `⏱️ 4 分鐘時間到！【${topEntry.name}】以 ${topEntry.length} 隻領先獲勝！`;
      }
      if (this.gameoverDescEl) {
        this.gameoverDescEl.innerText = `4 分鐘計時結束比長短！你的隊伍為 ${this.snake.segments.length + 1} 隻，再挑戰一次奪下第一名吧！`;
      }
      this.renderEndStageLeaderboard('gameover-leaderboard-list');
      this.gameoverModal.classList.remove('hidden');
    }
  }

  update() {
    requestAnimationFrame(() => this.update());
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // While in In-Game Character Selection mode, gently animate the 3D Pokémon & planet preview!
    if (this.isSelectingChar && !this.isPlaying) {
      this.snake.update(delta);
      this.planet.update(delta, this.snake.position);
      this.updateCamera();
    }

    if (this.isPlaying) {
      this.stageTimeLeft = Math.max(0, this.stageTimeLeft - delta);

      const joyMag = Math.hypot(this.joystickVec.x, this.joystickVec.y);

      if (this.joystickActive && joyMag > 0.12) {
        this.snake.clearTargetPoint();
        this.snake.isMoving = true;
        this.snake.currentTurn = this.joystickVec.x * 1.15;
      } else {
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
          this.snake.currentTurn = -1;
        } else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
          this.snake.currentTurn = 1;
        } else if (!this.btnForwardHeld) {
          this.snake.currentTurn = 0;
        }

        const walkKeyPressed =
          this.keys['ArrowUp'] ||
          this.keys['w'] ||
          this.keys['W'] ||
          this.btnForwardHeld;

        if (walkKeyPressed) {
          this.snake.clearTargetPoint();
          this.snake.isMoving = true;
          if (!this.isDraggingOrbit) {
            this.orbitYaw *= 0.92;
          }
        } else {
          this.snake.isMoving = false;
        }
      }

      this.snake.update(delta);
      this.planet.update(delta, this.snake.position);
      this.npcManager.update(delta, this.snake, this.gemManager);
      this.gemManager.update(delta);

      if (this.stars) {
        this.stars.rotation.y += delta * 0.015;
      }

      // 1. Mutual Jump-Eat Body Interactions ("跳吃 就是一次一節 不管跳到哪一節 NPC 不會死") + Defense Shield Block!
      const myPokeName = POKEMON_DATA[this.snake.species]?.name || '皮卡丘';
      const interaction = this.npcManager.checkInteractions(this.snake);
      if (interaction) {
        if (interaction.event === 'player_ate_npc_body') {
          const added = this.snake.eatNPCBody(interaction.species);
          const pts = 60 * added;
          this.score += pts;
          this.gameScoreEl.innerText = this.score;

          // 🌟 問題二：咬斷對手時爆開彩色旋轉星星糖果碎片雨 + 鏡頭微震！
          if (this.gemManager) {
            this.gemManager.spawnStarCandyExplosion(this.snake.position, this.snake.normal, 12);
          }
          this.triggerScreenShake(0.2, 0.38);

          // Accumulate segments for player leveling
          const lvlRes = saveManager.addSegments(added);
          if (lvlRes.levelUp) {
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
            this.showToast(`🎉 升級到 Lv.${lvlRes.newLevel}！獲得 1 點天賦點數！`);
            this.renderProfileUI();
          }

          this.showToast(
            `🦘 跳吃【${interaction.pokemonName}】1 節！同化 +${added} 隻【${myPokeName}】`
          );
        } else if (interaction.event === 'npc_bite_blocked') {
          let msg = `🛡️ 3D 防護罩生效 (${interaction.blockPct || 80}%防咬)！抵擋了【${interaction.npcName}】偷咬`;
          if (interaction.shocked) msg += ' 💥反震擊暈！';
          if (interaction.stolen) msg += ' 掠奪+1節！';
          this.showToast(msg);
        } else if (interaction.event === 'npc_ate_player_body') {
          this.showToast(
            `😮 被【${interaction.npcName}】咬走 1 節身體！牠長到 ${interaction.npcLength}/${this.targetLength} 隻了`
          );
        }
      }

      // 2. Gem Pickup (Stackable up to 5x!)
      const collected = this.gemManager.checkCollision(this.snake.position, 2.25, true);
      if (collected) {
        const added = this.snake.grow(collected);
        const pts = 30 * added;
        this.score += pts;
        this.gameScoreEl.innerText = this.score;

        // Accumulate segments for player leveling & talents
        const lvlRes = saveManager.addSegments(added);
        if (lvlRes.levelUp) {
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
          this.showToast(`🎉 升級到 Lv.${lvlRes.newLevel}！獲得 1 點天賦點數！`);
          this.renderProfileUI();
        }

        // 🎁 問題三：吃到技能包直接獲得 5 次專屬角色大招次數！
        if (collected === 'skillpack') {
          this.snake.addSkillCharges(5);
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
          const pokeName = POKEMON_DATA[this.snake.species]?.name || '寶可夢';
          const skillTitle = POKEMON_DATA[this.snake.species]?.skillName || '專屬大招';
          this.showToast(`🎁 拾獲技能包！【${pokeName}】已裝填 5 次【${skillTitle}】！按 [Shift/E] 或點技能鍵發射！`);
          this.updateSkillChargesUI();
          return;
        }

        const b = this.snake.buffs;
        const spdMult = this.snake.getSpeedMultiplier().toFixed(1);
        const defPct = Math.round(this.snake.getDefenseChance() * 100);
        const mulPct = Math.round(this.snake.getMultiplierChance() * 100);

        const gemNames = {
          speed: `⚡ 加速寶石 (${b.speed.stacks}/5層)！移速提升至 ${spdMult}x (+${added} 隻)`,
          defense: `🛡️ 防禦寶石 (${b.defense.stacks}/5層)！開啟 3D 藍光防護罩，防咬機率 ${defPct}% (+${added} 隻)`,
          multiplier: `✖️ 倍數寶石 (${b.multiplier.stacks}/5層)！吃寶石/咬身體 ${mulPct}% 機率得 2 節 (+${added} 隻)`,
          stealth: `👻 隱身寶石！進入 30 秒半透明隱身，NPC 看不見也咬不到你 (+${added} 隻)`,
          rainbow: `🌟 全能狂熱寶石！同時疊加【⚡加速 + 🛡️防禦護盾 + ✖️雙倍成長】(+${added} 隻)`
        };
        this.showToast(gemNames[collected] || '吃到了屬性寶石！');
      }

      // 3. Landmark Pennant Visit Check ("穿越建築時會有大的字特效1.5秒 只有字喔")
      const visitedLm = this.planet.checkLandmarkVisit(this.snake.position);
      if (visitedLm) {
        sound.playEvolve();
        this.score += 100;
        this.gameScoreEl.innerText = this.score;
        this.showLandmarkFxText(visitedLm.name);
        this.showToast(
          `🚩 穿越打卡【${visitedLm.name}】點亮錦旗！(${visitedLm.visitedCount}/${visitedLm.total} 景點)`
        );

        // Passive Talent: landmarkGift (打卡爆寶 2 ~ 4 顆)
        const giftCount = saveManager.getTalentBonus('landmarkGift');
        if (giftCount > 0 && this.gemManager) {
          for (let g = 0; g < giftCount; g++) {
            this.gemManager.spawnGem();
          }
          this.showToast(`🎁 打卡天賦生效！景點爆出 ${giftCount} 顆寶石！`);
        }

        // Passive Talent: landmarkFever (終極天賦：打卡立即啟動 5 秒全能狂熱)
        const feverSec = saveManager.getTalentBonus('landmarkFever');
        if (feverSec > 0) {
          this.snake.setElement('rainbow', feverSec);
          this.showToast(`🌟 錦旗狂熱天賦觸發！啟動 ${feverSec} 秒全能狂熱！`);
        }
      }

      this.updateTopCounters();
      this.updateElementHUD();
      this.updateCamera();

      this.checkRaceWinCondition();
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Updates the 4 Right-Side Small Circular % Ring Buff Indicators ("寶石效能可以重疊 5次 放在右邊 小小的 用圓的%還顯示")
   */
  updateElementHUD() {
    if (!this.snake || !this.snake.buffs) return;
    const circumference = 113.1; // 2 * Math.PI * 18
    const b = this.snake.buffs;

    // 0. ⚡ Dash Cooldown Visual Overlay (Mobile & PC)
    const dashCd = this.snake.skillCooldown || 0;
    const mobDashCd = document.getElementById('mob-dash-cd');
    const pcDashCd = document.getElementById('pc-dash-cd');
    if (mobDashCd) {
      if (dashCd > 0.05) {
        mobDashCd.textContent = Math.ceil(dashCd);
        mobDashCd.classList.remove('hidden');
      } else {
        mobDashCd.classList.add('hidden');
      }
    }
    if (pcDashCd) {
      if (dashCd > 0.05) {
        pcDashCd.textContent = `${Math.ceil(dashCd)}s`;
        pcDashCd.classList.remove('hidden');
      } else {
        pcDashCd.classList.add('hidden');
      }
    }

    // 1. ⚡ Speed (1~5 stacks -> 20%, 40%, 60%, 80%, 100% [2.0x])
    const spdItem = document.getElementById('buff-ring-speed');
    const spdProg = document.getElementById('buff-prog-speed');
    const spdPctEl = document.getElementById('buff-pct-speed');
    if (spdItem && spdProg && spdPctEl) {
      const pct = (b.speed.stacks / 5) * 100;
      spdItem.classList.toggle('active', b.speed.stacks > 0);
      spdProg.style.strokeDashoffset = `${circumference * (1 - pct / 100)}`;
      spdPctEl.innerText = b.speed.stacks >= 5 ? '2.0x' : `${Math.round(pct)}%`;
    }

    // 2. 🛡️ Defense (1~5 stacks -> 16%, 32%, 48%, 64%, 80%)
    const defItem = document.getElementById('buff-ring-defense');
    const defProg = document.getElementById('buff-prog-defense');
    const defPctEl = document.getElementById('buff-pct-defense');
    if (defItem && defProg && defPctEl) {
      const defChancePct = Math.round(b.defense.stacks * 16);
      const ringRatio = b.defense.stacks / 5;
      defItem.classList.toggle('active', b.defense.stacks > 0);
      defProg.style.strokeDashoffset = `${circumference * (1 - ringRatio)}`;
      defPctEl.innerText = `${defChancePct}%`;
    }

    // 3. ✖️ Multiplier (1~5 stacks -> 20%, 40%, 60%, 80%, 100%)
    const mulItem = document.getElementById('buff-ring-multiplier');
    const mulProg = document.getElementById('buff-prog-multiplier');
    const mulPctEl = document.getElementById('buff-pct-multiplier');
    if (mulItem && mulProg && mulPctEl) {
      const pct = Math.round((b.multiplier.stacks / 5) * 100);
      mulItem.classList.toggle('active', b.multiplier.stacks > 0);
      mulProg.style.strokeDashoffset = `${circumference * (1 - pct / 100)}`;
      mulPctEl.innerText = `${pct}%`;
    }

    // 4. 👻 Stealth (Non-stacking, 30s countdown ring)
    const stlItem = document.getElementById('buff-ring-stealth');
    const stlProg = document.getElementById('buff-prog-stealth');
    const stlPctEl = document.getElementById('buff-pct-stealth');
    if (stlItem && stlProg && stlPctEl) {
      const active = b.stealth.stacks > 0 && b.stealth.timer > 0;
      const ratio = active ? b.stealth.timer / 30.0 : 0;
      stlItem.classList.toggle('active', active);
      stlProg.style.strokeDashoffset = `${circumference * (1 - ratio)}`;
      stlPctEl.innerText = active ? `${Math.ceil(b.stealth.timer)}s` : '0%';
    }
  }

  handleStageVictory(reason = 'length') {
    this.isPlaying = false;
    this.applyControlModeUI();
    this.bossHud.classList.add('hidden');
    this.clearedStages.add(this.stage);

    confetti({
      particleCount: 160,
      spread: 95,
      origin: { y: 0.6 }
    });

    const playerLen = this.snake.segments.length + 1;
    saveManager.recordGameEnd(this.score, playerLen, this.stage);
    this.renderProfileUI();
    const visitedFlags = this.planet ? this.planet.getVisitedLandmarkCount() : 0;
    const totalFlags = this.planet ? this.planet.getTotalLandmarkCount() : 13;

    // Check if ALL 3 Cities have been cleared! ("三個城市都過了 跳出完成都市探險 繼續(三個城市跳出來選) 還是結束")
    if (this.clearedStages.size >= 3 && this.grandCompleteModal) {
      document.getElementById('grand-final-score').innerText = this.score;
      document.getElementById('grand-final-length').innerText = `${playerLen}/${this.targetLength} 隻 (🚩錦旗 ${visitedFlags}/${totalFlags})`;
      this.renderEndStageLeaderboard('grand-leaderboard-list');
      setTimeout(() => {
        this.grandCompleteModal.classList.remove('hidden');
      }, 500);
      return;
    }

    document.getElementById('final-score').innerText = this.score;
    document.getElementById('final-length').innerText = `${playerLen}/${this.targetLength} 隻 (🚩錦旗 ${visitedFlags}/${totalFlags})`;

    const cityNames = ['台北小行星 (Taipei)', '⛩️ 京都小行星 (Kyoto)', '🥮 上海小行星 (Shanghai)'];
    if (reason === 'landmarks') {
      document.getElementById('victory-title').innerText = `🚩 ${totalFlags} 大名勝錦旗全數穿越！第 ${this.stage} 關獲勝！`;
      document.getElementById('victory-desc').innerText = `你在【${cityNames[this.stage - 1]}】集齊全部 ${totalFlags} 面景點錦旗完美通關，準備航向下一座城市！`;
    } else if (reason === 'timeup') {
      document.getElementById('victory-title').innerText = `⏱️ 4 分鐘時間到！你以 ${playerLen} 隻奪冠獲勝！`;
      document.getElementById('victory-desc').innerText = `你在【${cityNames[this.stage - 1]}】時間結束時隊伍最長，成功晉級下一座城市！`;
    } else {
      document.getElementById('victory-title').innerText = `🎉 率先達到 ${this.targetLength} 隻！第 ${this.stage} 關獲勝！`;
      document.getElementById('victory-desc').innerText = `你在【${cityNames[this.stage - 1]}】擊敗所有 NPC 率先達標，準備航向下一座城市！`;
    }

    // Render Final Leaderboard inside Victory Modal!
    this.renderEndStageLeaderboard('victory-leaderboard-list');

    setTimeout(() => {
      this.victoryModal.classList.remove('hidden');
    }, 500);
  }

  handleNPCRaceWin(npcWinner) {
    this.isPlaying = false;
    this.applyControlModeUI();
    sound.playHurt();
    const playerLen = this.snake.segments.length + 1;
    saveManager.recordGameEnd(this.score, playerLen, this.stage);
    this.renderProfileUI();
    if (this.gameoverTitleEl) {
      this.gameoverTitleEl.innerText = `😮 ${npcWinner.icon}【NPC ${npcWinner.name}】率先達到 ${this.targetLength} 隻了！`;
    }
    if (this.gameoverDescEl) {
      this.gameoverDescEl.innerText = `NPC 搶先一步達標獲勝！善用「✖️倍數寶石」、「🛡️防禦寶石」與「🦘跳躍咬身體」重新挑戰本關吧！`;
    }

    // Render Final Leaderboard inside Gameover Modal!
    this.renderEndStageLeaderboard('gameover-leaderboard-list');

    this.gameoverModal.classList.remove('hidden');
  }

  goToStage(stageNum, startPlaying = true) {
    this.stage = stageNum;
    this.targetLength = this.getTargetLengthForStage(this.stage);
    this.stageTimeLeft = 240.0;

    const cityNames = [
      '🏙️ 台北',
      '⛩️ 京都',
      '🥮 上海'
    ];
    this.stageTitle.innerText = cityNames[this.stage - 1];

    this.updateStageSky(this.stage);
    this.planet.setStage(this.stage);

    this.snake.dispose();
    this.scene.remove(this.snake.group);
    this.snake = new ChibiSnake(this.scene, this.planet, this.selectedSpecies || 'pikachu');

    this.gemManager.clear();
    this.npcManager.clear();
    this.updateSkillChargesUI();
    this.updateTopCounters();
    this.updateElementHUD();
    this.updateSkillChargesUI();
    this.updateCamera();

    this.isPlaying = startPlaying;
    this.applyControlModeUI();
    if (this.aiVoiceAgent) {
      if (startPlaying) this.aiVoiceAgent.startListening();
      else this.aiVoiceAgent.stopListening();
    }
    if (startPlaying) {
      this.showToast(
        `✈️ 抵達【${cityNames[this.stage - 1]}】！4 分鐘內達到 ${this.targetLength} 隻 或 穿越 10 景點即獲勝！`
      );
    }
  }

  advanceStage() {
    let nextStage = this.stage + 1;
    if (nextStage > 3) nextStage = 1;
    this.goToStage(nextStage, true);
  }

  resetCurrentStage() {
    this.goToStage(this.stage, true);
  }

  onResize() {
    this.syncViewportHeight();
    const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.checkOrientationBanner();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game;
  game.update();
});
