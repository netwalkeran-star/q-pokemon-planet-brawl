/**
 * SaveManager: Handles player profile, total segments accumulated, levels,
 * passive talent tree, and import/export functionality.
 */
export const TALENT_DEFINITIONS = {
  // Branch A: Magnet & Growth
  magnet: {
    id: 'magnet',
    name: '萬有引力 (磁鐵)',
    icon: '🧲',
    branch: 'growth',
    maxLevel: 3,
    desc: ['吃寶石判定半徑 +40%', '半徑 +80%，周圍 4m 寶石自動吸向玩家', '半徑 +130%，全島強力吸寶！'],
    getBonus: (lvl) => [0, 0.4, 0.8, 1.3][lvl] || 0
  },
  starterSquad: {
    id: 'starterSquad',
    name: '大胃王隊伍 (開局優勢)',
    icon: '🐣',
    branch: 'growth',
    maxLevel: 2,
    desc: ['每關開局直接帶 5 隻隊員 (起步+2)', '每關開局直接帶 7 隻隊員 (起步+4)'],
    getBonus: (lvl) => [0, 2, 4][lvl] || 0
  },

  // Branch B: Defense & Survival
  invincibleExt: {
    id: 'invincibleExt',
    name: '厚實護甲 (被咬無敵延長)',
    icon: '🛡️',
    branch: 'defense',
    maxLevel: 2,
    desc: ['被 NPC 偷咬後的無敵時間延長至 2.4 秒', '無敵時間延長至 3.5 秒，且期間移速 +30%'],
    getBonus: (lvl) => [0, 1.0, 2.1][lvl] || 0
  },
  counterShock: {
    id: 'counterShock',
    name: '尖刺反震 (防守反擊)',
    icon: '💥',
    branch: 'defense',
    maxLevel: 2,
    desc: ['防禦護盾成功擋咬時，震暈該 NPC 1.8 秒', '成功防禦時震暈 NPC，並直接震下該 NPC 1 節身體歸我方！'],
    getBonus: (lvl) => lvl
  },

  // Branch C: Speed & Agility
  swiftMove: {
    id: 'swiftMove',
    name: '電光疾行 (常駐移速)',
    icon: '⚡',
    branch: 'speed',
    maxLevel: 3,
    desc: ['常駐基礎移動速度永久 +10%', '常駐基礎移動速度永久 +20%', '常駐基礎移動速度永久 +30%'],
    getBonus: (lvl) => [0, 0.10, 0.20, 0.30][lvl] || 0
  },
  turboCooldown: {
    id: 'turboCooldown',
    name: '蓄能衝刺 (冷卻減半)',
    icon: '🚀',
    branch: 'speed',
    maxLevel: 2,
    desc: ['衝刺技能冷卻從 3.2 秒縮短至 2.2 秒', '冷卻縮短至 1.5 秒，衝刺跳躍幅度加倍！'],
    getBonus: (lvl) => [0, 1.0, 1.7][lvl] || 0
  },

  // Branch D: Landmarks & Adventure
  landmarkGift: {
    id: 'landmarkGift',
    name: '打卡補給站 (景點爆寶)',
    icon: '🎁',
    branch: 'adventure',
    maxLevel: 2,
    desc: ['穿越景點錦旗時，地標旁立即噴出 2 顆隨機屬性寶石', '穿越景點時噴出 4 顆屬性寶石，打卡即補血！'],
    getBonus: (lvl) => [0, 2, 4][lvl] || 0
  },
  landmarkFever: {
    id: 'landmarkFever',
    name: '錦旗狂熱 (終極天賦)',
    icon: '🌟',
    branch: 'adventure',
    maxLevel: 1,
    desc: ['每穿越點亮一面錦旗，立即觸發 5 秒【全能狂熱】(加速+護盾+雙倍)！'],
    getBonus: (lvl) => (lvl >= 1 ? 5.0 : 0)
  }
};

// Thresholds for Level 1 ~ 10
export const LEVEL_THRESHOLDS = [
  0,     // Lv.1 (0)
  30,    // Lv.2 (30)
  90,    // Lv.3 (60)
  190,   // Lv.4 (100)
  340,   // Lv.5 (150)
  560,   // Lv.6 (220)
  860,   // Lv.7 (300)
  1260,  // Lv.8 (400)
  1780,  // Lv.9 (520)
  2480   // Lv.10 (700)
];

/**
 * 🏭 怪獸電力公司・專屬屬性連帽披肩定義
 * 副本掉落獲得，裝備後直接加成屬性！
 */
export const MONSTERS_INC_CAPES = {
  sulley: {
    id: 'sulley',
    name: '毛怪藍斑點連帽披肩',
    shortName: '毛怪披肩',
    icon: '🩵',
    color: 0x38bdf8,
    spotColor: 0x9333ea,
    hornColor: 0xe2e8f0,
    desc: '經典水藍色毛皮 + 俏皮紫色斑點，頭戴圓錐怪獸小角',
    buff: '🛡️ 防禦力 +25%｜防撞擊震退',
    bonusType: 'defense',
    bonusVal: 0.25
  },
  mike: {
    id: 'mike',
    name: '大眼仔亮綠單眼披肩',
    shortName: '大眼仔披肩',
    icon: '💚',
    color: 0x84cc16,
    hornColor: 0x475569,
    desc: '活潑亮綠色滑順連帽，額頭中央有標誌性轉動大眼',
    buff: '🧲 引力吸寶半徑 +50%｜視野更開闊',
    bonusType: 'magnet',
    bonusVal: 0.50
  },
  boo: {
    id: 'boo',
    name: '阿布紫色萌怪連帽披肩',
    shortName: '阿布披肩',
    icon: '🌸',
    color: 0xc084fc,
    desc: '潛入怪獸世界穿的紫色拖把頭連帽，附帶雙彈簧觸角眼球',
    buff: '⚡ 移動速度 +15%｜衝刺冷卻 -1秒',
    bonusType: 'speed',
    bonusVal: 0.15
  },
  randall: {
    id: 'randall',
    name: '藍道迷彩隱形連帽披肩',
    shortName: '藍道披肩',
    icon: '🦎',
    color: 0x475569,
    stripeColor: 0xa855f7,
    desc: '變色龍鱗片流光質感，帶有半透明暗紫科技幽靈邊緣',
    buff: '👻 開局自動隱身 10秒｜免受偷襲',
    bonusType: 'stealth',
    bonusVal: 10.0
  }
};

const STORAGE_KEY = 'pokemon_planet_snake_save_v1';

export class SaveManager {
  constructor() {
    this.data = this.getDefaultData();
    this.load();
  }

  getDefaultData() {
    return {
      version: 1,
      playerName: '',
      totalSegments: 0,
      level: 1,
      talentPoints: 0,
      talents: {
        magnet: 0,
        starterSquad: 0,
        invincibleExt: 0,
        counterShock: 0,
        swiftMove: 0,
        turboCooldown: 0,
        landmarkGift: 0,
        landmarkFever: 0
      },
      capes: {
        sulley: false,
        mike: false,
        boo: false,
        randall: false
      },
      equippedCape: null,
      stats: {
        gamesPlayed: 0,
        highScore: 0,
        maxTeamLength: 3,
        clearedStages: []
      }
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.getDefaultData(),
          ...parsed,
          talents: { ...this.getDefaultData().talents, ...(parsed.talents || {}) },
          capes: { ...this.getDefaultData().capes, ...(parsed.capes || {}) },
          equippedCape: parsed.equippedCape || null,
          stats: { ...this.getDefaultData().stats, ...(parsed.stats || {}) }
        };
        this.recalculateLevel();
      }
    } catch (e) {
      console.warn('Failed to load save from localStorage', e);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  setPlayerName(name) {
    this.data.playerName = (name || '小智').trim().slice(0, 12);
    this.save();
  }

  getPlayerName() {
    return this.data.playerName || '訓練家';
  }

  hasPlayerName() {
    return !!this.data.playerName && this.data.playerName.trim().length > 0;
  }

  /**
   * Adds newly gained segments (from eating gems or biting NPC body)
   * returns object with levelUp boolean and old/new level info
   */
  addSegments(count) {
    if (count <= 0) return { levelUp: false, oldLevel: this.data.level, newLevel: this.data.level };
    const oldLevel = this.data.level;
    this.data.totalSegments += count;
    this.recalculateLevel();
    const levelUp = this.data.level > oldLevel;
    if (levelUp) {
      const pointsGained = this.data.level - oldLevel;
      this.data.talentPoints += pointsGained;
    }
    this.save();
    return {
      levelUp,
      oldLevel,
      newLevel: this.data.level,
      total: this.data.totalSegments
    };
  }

  recalculateLevel() {
    let lvl = 1;
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      if (this.data.totalSegments >= LEVEL_THRESHOLDS[i]) {
        lvl = i + 1;
      } else {
        break;
      }
    }
    this.data.level = Math.min(10, lvl);
  }

  getCurrentLevelProgress() {
    const lvl = this.data.level;
    if (lvl >= 10) {
      return { current: LEVEL_THRESHOLDS[9], next: LEVEL_THRESHOLDS[9], percent: 100 };
    }
    const currentBase = LEVEL_THRESHOLDS[lvl - 1];
    const nextTarget = LEVEL_THRESHOLDS[lvl];
    const range = nextTarget - currentBase;
    const progress = Math.max(0, this.data.totalSegments - currentBase);
    const percent = Math.min(100, Math.round((progress / range) * 100));
    return {
      current: progress,
      range,
      percent,
      total: this.data.totalSegments,
      nextTotal: nextTarget
    };
  }

  upgradeTalent(talentId) {
    const def = TALENT_DEFINITIONS[talentId];
    if (!def) return false;
    const currentLvl = this.data.talents[talentId] || 0;
    if (currentLvl >= def.maxLevel) return false;
    if (this.data.talentPoints <= 0) return false;

    this.data.talents[talentId] = currentLvl + 1;
    this.data.talentPoints -= 1;
    this.save();
    return true;
  }

  resetTalents() {
    let spentPoints = 0;
    Object.keys(this.data.talents).forEach((k) => {
      spentPoints += this.data.talents[k] || 0;
      this.data.talents[k] = 0;
    });
    this.data.talentPoints += spentPoints;
    this.save();
  }

  getTalentLevel(talentId) {
    return this.data.talents[talentId] || 0;
  }

  getTalentBonus(talentId) {
    const def = TALENT_DEFINITIONS[talentId];
    if (!def) return 0;
    return def.getBonus(this.getTalentLevel(talentId));
  }

  // --- Monsters, Inc. Hooded Cape Management ---
  hasCape(capeId) {
    return !!(this.data.capes && this.data.capes[capeId]);
  }

  unlockCape(capeId) {
    if (!MONSTERS_INC_CAPES[capeId]) return false;
    if (!this.data.capes) this.data.capes = {};
    const isNew = !this.data.capes[capeId];
    this.data.capes[capeId] = true;
    if (!this.data.equippedCape) {
      this.data.equippedCape = capeId;
    }
    this.save();
    return isNew;
  }

  equipCape(capeId) {
    if (capeId === null || capeId === 'none') {
      this.data.equippedCape = null;
      this.save();
      return true;
    }
    if (this.hasCape(capeId)) {
      this.data.equippedCape = capeId;
      this.save();
      return true;
    }
    return false;
  }

  unequipCape() {
    this.data.equippedCape = null;
    this.save();
  }

  getEquippedCape() {
    return this.data.equippedCape || null;
  }

  getCapeBonus(bonusType) {
    const eq = this.getEquippedCape();
    if (!eq) return 0;
    const def = MONSTERS_INC_CAPES[eq];
    if (def && def.bonusType === bonusType) {
      return def.bonusVal;
    }
    return 0;
  }

  getCollectedCapeCount() {
    if (!this.data.capes) return 0;
    return Object.values(this.data.capes).filter(Boolean).length;
  }

  recordGameEnd(score, teamLen, stageNum) {
    this.data.stats.gamesPlayed = (this.data.stats.gamesPlayed || 0) + 1;
    if (score > (this.data.stats.highScore || 0)) {
      this.data.stats.highScore = score;
    }
    if (teamLen > (this.data.stats.maxTeamLength || 0)) {
      this.data.stats.maxTeamLength = teamLen;
    }
    if (stageNum && !this.data.stats.clearedStages.includes(stageNum)) {
      this.data.stats.clearedStages.push(stageNum);
    }
    this.save();
  }

  /**
   * Exports progress into a base64 encoded string
   */
  exportCode() {
    try {
      const jsonStr = JSON.stringify(this.data);
      const encoded = btoa(encodeURIComponent(jsonStr));
      return `PKM_${encoded}`;
    } catch (e) {
      console.error('Export error', e);
      return null;
    }
  }

  /**
   * Imports progress from a base64 encoded string
   */
  importCode(code) {
    try {
      if (!code || !code.startsWith('PKM_')) return false;
      const base64 = code.slice(4).trim();
      const jsonStr = decodeURIComponent(atob(base64));
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.totalSegments === 'number') {
        this.data = {
          ...this.getDefaultData(),
          ...parsed,
          talents: { ...this.getDefaultData().talents, ...(parsed.talents || {}) },
          capes: { ...this.getDefaultData().capes, ...(parsed.capes || {}) },
          equippedCape: parsed.equippedCape || null,
          stats: { ...this.getDefaultData().stats, ...(parsed.stats || {}) }
        };
        this.recalculateLevel();
        this.save();
        return true;
      }
    } catch (e) {
      console.error('Import error', e);
    }
    return false;
  }
}

export const saveManager = new SaveManager();
