import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { createPokemonMesh, animatePokemonRun, updateHeadCountBadge, updateAISpeechBubble, POKEMON_DATA } from './pokemon.js';
import { sound } from './sound.js';
import { saveManager } from './saveManager.js';

export class NPCManager {
  constructor(scene, planet) {
    this.scene = scene;
    this.planet = planet;
    this.npcs = [];
    this.npcGroup = new THREE.Group();
    this.scene.add(this.npcGroup);

    // 每關初始長度皆為 3 隻 (1 隊長頭 + 2 身體隊員)，其中一隻為「真 AI 勁敵耿鬼」("有一隻是真AI 我只要講話就可以對話")
    this.npcConfigs = [
      { species: 'charmander', speed: 6.2, length: 2 },
      { species: 'squirtle', speed: 6.0, length: 2 },
      { species: 'gengar', speed: 6.4, length: 2, isTrueAI: true },
      { species: 'falinks', speed: 6.1, length: 2 }
    ];

    this.initNPCs();
  }

  initNPCs() {
    this.npcConfigs.forEach((cfg, idx) => {
      this.spawnNPC(cfg, idx);
    });
  }

  spawnNPC(cfg, idx) {
    const species = cfg.species;
    const group = createPokemonMesh(species, true, 0.95);

    const startPos = this.planet.getRandomSurfacePoint(0.25);
    const normal = this.planet.getSurfaceNormal(startPos);
    const forward = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    )
      .cross(normal)
      .normalize();

    group.position.copy(startPos);
    this.npcGroup.add(group);

    // Body segments (matching 3D Chibi Pokémon!)
    const segments = [];
    for (let i = 0; i < cfg.length; i++) {
      const segScale = Math.max(0.52, 0.76 - i * 0.015);
      const segMesh = createPokemonMesh(species, false, segScale);
      segMesh.position.copy(this.planet.projectToSurface(startPos, 0.25));
      this.npcGroup.add(segMesh);
      segments.push(segMesh);
    }

    const npcData = {
      idx,
      species,
      group,
      segments,
      position: startPos,
      normal,
      forward,
      baseSpeed: cfg.speed,
      speed: cfg.speed,
      pathHistory: [],
      targetChangeTimer: Math.random() * 2,
      turnTarget: idx % 2 === 0 ? 99 : (idx + 1) % this.npcConfigs.length, // 99 = chase player's body!
      isAlive: true,
      // NPC Jump Physics
      isJumping: false,
      jumpTimer: 0,
      jumpDuration: 0.8,
      maxJumpHeight: 4.2,
      currentJumpOffset: 0,
      jumpCooldown: 1.5 + Math.random() * 2.0,
      biteCooldown: 0,
      buffTimer: 0,
      // True AI Properties ("有一隻是真AI 我只要講話就可以對話 不用按特定鍵")
      isTrueAI: !!cfg.isTrueAI,
      aiAction: 'normal',
      aiActionTimer: 0,
      speechBubbleText: '',
      speechBubbleTimer: 0,
      executeVoiceAction(actionType, playerPos) {
        this.aiAction = actionType;
        if (actionType === 'flee') {
          this.aiActionTimer = 4.5;
          this.speed = this.baseSpeed * 1.6;
          this.buffTimer = 4.5;
        } else if (actionType === 'chase') {
          this.aiActionTimer = 5.0;
          this.speed = this.baseSpeed * 1.5;
          this.buffTimer = 5.0;
          this.turnTarget = 99;
        } else if (actionType === 'dash') {
          this.aiActionTimer = 3.5;
          this.speed = this.baseSpeed * 1.75;
          this.buffTimer = 3.5;
        } else if (actionType === 'taunt') {
          this.aiActionTimer = 2.0;
          if (!this.isJumping) {
            this.isJumping = true;
            this.jumpTimer = 0;
            this.currentJumpOffset = 0.6;
          }
        }
      }
    };

    if (cfg.isTrueAI) {
      updateHeadCountBadge(group, cfg.length + 1, false, true);
    }

    this.npcs.push(npcData);
  }

  addNPCSegment(npc, count = 1) {
    for (let c = 0; c < count; c++) {
      if (npc.segments.length >= 60) return;
      const i = npc.segments.length;
      const segScale = Math.max(0.5, 0.76 - i * 0.014);
      const segMesh = createPokemonMesh(npc.species, false, segScale);
      segMesh.position.copy(npc.position);
      this.npcGroup.add(segMesh);
      npc.segments.push(segMesh);
    }
  }

  removeNPCSegment(npc) {
    if (npc.segments.length === 0) return;
    const seg = npc.segments.pop();
    if (seg) {
      this.npcGroup.remove(seg);
    }
  }

  /**
   * 💥 問題三：角色專屬大招範圍攻擊判定
   */
  hitBySkill(hitPos, radius, skillParams = {}) {
    const hits = [];
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (!npc.isAlive) continue;

      const d = npc.position.distanceTo(hitPos);
      if (d <= radius) {
        // 擊退與減速
        const away = npc.position.clone().sub(hitPos).normalize();
        const normal = this.planet.getSurfaceNormal(npc.position);
        const tangentAway = away.sub(normal.clone().multiplyScalar(away.dot(normal))).normalize();
        if (tangentAway.lengthSq() > 0.001) {
          npc.forward.copy(tangentAway);
          npc.speed = npc.baseSpeed * 0.35; // 短暫擊暈
          setTimeout(() => {
            if (npc.isAlive) npc.speed = npc.baseSpeed;
          }, 1400);
        }

        // 震落 1 節身體
        let severed = false;
        if (npc.segments.length > 0) {
          this.removeNPCSegment(npc);
          severed = true;
        }

        hits.push({
          npc,
          name: POKEMON_DATA[npc.species]?.name || 'NPC',
          pos: npc.position.clone(),
          severed
        });
      }
    }
    return hits;
  }

  update(delta, player, gemManager) {
    this.npcs.forEach((npc) => {
      if (!npc.isAlive) return;

      if (npc.speechBubbleTimer > 0) {
        npc.speechBubbleTimer -= delta;
        if (npc.speechBubbleTimer <= 0) {
          npc.speechBubbleText = '';
          updateAISpeechBubble(npc.group, '');
        }
      }

      if (npc.biteCooldown > 0) npc.biteCooldown -= delta;
      if (npc.buffTimer > 0) {
        npc.buffTimer -= delta;
        if (npc.buffTimer <= 0) npc.speed = npc.baseSpeed;
      }

      // NPC can also pick up gems to grow and race toward the target number! ("NPC 也可以吃寶石")
      if (gemManager) {
        const gemType = gemManager.checkCollision(npc.position, 2.55);
        if (gemType) {
          const gain = gemType === 'multiplier' || gemType === 'rainbow' ? 2 : 1;
          this.addNPCSegment(npc, gain);
          if (gemType === 'speed' || gemType === 'rainbow') {
            npc.speed = npc.baseSpeed * 1.45;
            npc.buffTimer = 8.0;
          }
        }
      }

      // 1. Steering & Chasing AI (Actively targets Gems, Player's body, or other NPCs!)
      npc.targetChangeTimer -= delta;
      if (npc.targetChangeTimer <= 0) {
        npc.targetChangeTimer = 2.0 + Math.random() * 1.8;
        const r = Math.random();
        if (r < 0.42) {
          npc.turnTarget = 88; // Seek nearest Gem!
        } else if (player && !player.isStealthActive() && player.segments.length > 0 && r < 0.78) {
          npc.turnTarget = 99; // Hunt player body!
        } else {
          npc.turnTarget = Math.floor(Math.random() * this.npcs.length);
        }
      }

      npc.normal = this.planet.getSurfaceNormal(npc.position);

      let targetPos = null;
      // If a gem is nearby or npc is in gem-seeking mode, steer toward the gem!
      const nearGemPos = gemManager ? gemManager.getNearestGemPos(npc.position, 22.0) : null;
      if (nearGemPos && (npc.turnTarget === 88 || npc.position.distanceTo(nearGemPos) < 12.0)) {
        targetPos = nearGemPos;
      } else if (npc.turnTarget === 99 && player && !player.isStealthActive() && player.segments.length > 0) {
        // Aim for the middle/tail of the player's body segments!
        const targetSegIdx = Math.floor(player.segments.length * 0.6);
        const seg = player.segments[targetSegIdx] || player.segments[player.segments.length - 1];
        targetPos = seg.group.position;
      } else if (npc.turnTarget < this.npcs.length) {
        const targetNPC = this.npcs[npc.turnTarget];
        if (targetNPC && targetNPC !== npc && targetNPC.isAlive) {
          targetPos =
            targetNPC.segments.length > 0
              ? targetNPC.segments[targetNPC.segments.length - 1].position
              : targetNPC.position;
        }
      }

      // 2. NPC Smart Jump AI (Jumps eagerly when near player's body or other NPC's body!)
      npc.jumpCooldown -= delta;
      const distToTarget = targetPos ? npc.position.distanceTo(targetPos) : 999;
      if (!npc.isJumping && npc.jumpCooldown <= 0) {
        if (distToTarget < 7.5 || Math.random() < 0.35) {
          npc.isJumping = true;
          npc.jumpTimer = 0;
          npc.jumpCooldown = 1.8 + Math.random() * 1.8;
        }
      }

      if (npc.isJumping) {
        npc.jumpTimer += delta;
        const progress = npc.jumpTimer / npc.jumpDuration;
        if (progress >= 1.0) {
          npc.isJumping = false;
          npc.currentJumpOffset = 0;
        } else {
          npc.currentJumpOffset = Math.sin(progress * Math.PI) * npc.maxJumpHeight;
        }
      } else {
        npc.currentJumpOffset = 0;
      }

      let desiredForward = npc.forward.clone();
      if (targetPos) {
        const toTarget = targetPos.clone().sub(npc.position);
        const tangentToTarget = toTarget
          .sub(npc.normal.clone().multiplyScalar(toTarget.dot(npc.normal)))
          .normalize();
        if (tangentToTarget.lengthSq() > 0.0001) {
          desiredForward.lerp(tangentToTarget, delta * 2.8).normalize();
        }
      } else {
        const randomTurn = (Math.random() - 0.5) * delta * 1.6;
        const turnQuat = new THREE.Quaternion().setFromAxisAngle(npc.normal, randomTurn);
        desiredForward.applyQuaternion(turnQuat);
      }

      if (npc.isTrueAI && npc.aiActionTimer > 0 && player) {
        if (npc.aiAction === 'flee') {
          const away = npc.position.clone().sub(player.position);
          const tangentAway = away.sub(npc.normal.clone().multiplyScalar(away.dot(npc.normal))).normalize();
          desiredForward.lerp(tangentAway, delta * 4.5).normalize();
        } else if (npc.aiAction === 'chase') {
          const towards = player.position.clone().sub(npc.position);
          const tangentTowards = towards.sub(npc.normal.clone().multiplyScalar(towards.dot(npc.normal))).normalize();
          desiredForward.lerp(tangentTowards, delta * 4.5).normalize();
        }
      }

      npc.forward.copy(desiredForward);
      npc.forward.sub(npc.normal.clone().multiplyScalar(npc.forward.dot(npc.normal))).normalize();

      // Move forward on sphere
      const moveStep = npc.forward.clone().multiplyScalar(npc.speed * delta);
      npc.position.add(moveStep);
      npc.position = this.planet.projectToSurface(npc.position, 0.25 + npc.currentJumpOffset);
      npc.normal = this.planet.getSurfaceNormal(npc.position);

      npc.group.position.copy(npc.position);
      updateHeadCountBadge(npc.group, npc.segments.length + 1, false, !!npc.isTrueAI);

      const right = new THREE.Vector3().crossVectors(npc.normal, npc.forward).normalize();
      const rotMat = new THREE.Matrix4().makeBasis(right, npc.normal, npc.forward);
      npc.group.quaternion.setFromRotationMatrix(rotMat);

      const nowSec = Date.now() * 0.001;
      animatePokemonRun(npc.group, nowSec, npc.idx * 1.3, npc.isJumping, npc.buffTimer > 0);

      // Path history
      npc.pathHistory.unshift({
        pos: npc.position.clone(),
        forward: npc.forward.clone(),
        jumpOffset: npc.currentJumpOffset
      });
      if (npc.pathHistory.length > 600) npc.pathHistory.pop();

      // Update Segments
      let histIdx = 0;
      let accumDist = 0;
      for (let s = 0; s < npc.segments.length; s++) {
        const targetDist = (s + 1) * 1.55;
        while (histIdx < npc.pathHistory.length - 1 && accumDist < targetDist) {
          accumDist += npc.pathHistory[histIdx].pos.distanceTo(
            npc.pathHistory[histIdx + 1].pos
          );
          histIdx++;
        }
        const histItem = npc.pathHistory[histIdx] || {
          pos: npc.position,
          forward: npc.forward,
          jumpOffset: 0
        };
        const seg = npc.segments[s];
        seg.position.lerp(histItem.pos, 0.5);
        const segJump = (histItem.jumpOffset || 0) * 0.8;
        seg.position.copy(this.planet.projectToSurface(seg.position, 0.25 + segJump));

        const segNormal = this.planet.getSurfaceNormal(seg.position);
        const segForward = histItem.forward.clone();
        segForward.sub(segNormal.clone().multiplyScalar(segForward.dot(segNormal))).normalize();
        const segRight = new THREE.Vector3().crossVectors(segNormal, segForward).normalize();
        seg.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(segRight, segNormal, segForward)
        );

        animatePokemonRun(
          seg,
          nowSec,
          npc.idx * 1.3 + (s + 1) * 0.75,
          segJump > 0.5,
          npc.buffTimer > 0
        );
      }

      // 3. NPC vs NPC Jump-Bite Body Interaction!
      if (npc.isJumping && npc.currentJumpOffset > 0.5 && npc.biteCooldown <= 0) {
        this.npcs.forEach((other) => {
          if (other === npc || !other.isAlive) return;
          for (let s = other.segments.length - 1; s >= 0; s--) {
            if (npc.position.distanceTo(other.segments[s].position) < 2.3) {
              this.removeNPCSegment(other);
              this.addNPCSegment(npc, 1);
              npc.biteCooldown = 2.2;
              break;
            }
          }
        });
      }
    });
  }

  /**
   * Handles:
   * 1. Player jumping to eat NPC ("跳吃 就是一次一節 不管跳到哪一節 NPC 不會死")
   * 2. NPC eating Player's body ("NPC 也可以吃我的身體"):
   *    - Blocked 100% if Player has Stealth ('stealth')
   *    - Blocked up to 80% (16% per stack, 5 stacks = 80%) if Player has Defense ('defense')
   *    - Otherwise Player loses 1 segment and NPC gains +1 segment!
   */
  checkInteractions(player) {
    // A. Player is Jumping -> Eat 1 segment whether landing on NPC Head or any Body Segment! NPC NEVER dies!
    if (player.isJumping && player.currentJumpOffset > 0.45 && player.biteCooldown <= 0) {
      for (let i = 0; i < this.npcs.length; i++) {
        const npc = this.npcs[i];
        if (!npc.isAlive) continue;

        let hitNPC = false;
        if (player.position.distanceTo(npc.position) < 2.85) {
          hitNPC = true;
        } else {
          for (let s = npc.segments.length - 1; s >= 0; s--) {
            if (player.position.distanceTo(npc.segments[s].position) < 2.85) {
              hitNPC = true;
              break;
            }
          }
        }

        if (hitNPC) {
          player.biteCooldown = 0.68; // 一次跳躍咬一節！
          const eatenSpecies = npc.species;
          const pokeName = POKEMON_DATA[eatenSpecies]?.name || '寶可夢';
          // Remove 1 segment from NPC (if it has body segments), NPC never dies!
          this.removeNPCSegment(npc);
          confetti({ particleCount: 35, spread: 50, origin: { y: 0.65 } });
          return {
            event: 'player_ate_npc_body',
            species: eatenSpecies,
            pokemonName: pokeName
          };
        }
      }
    }

    // B. NPC eats Player's Body Segment! ("NPC 也可以吃我的身體")
    // Stealth ('stealth') makes Player completely invisible & untouchable to NPCs!
    if (!player.isInvincible && !player.isStealthActive()) {
      for (let i = 0; i < this.npcs.length; i++) {
        const npc = this.npcs[i];
        if (!npc.isAlive || npc.biteCooldown > 0) continue;

        // NPC can bite player's body either by jumping onto it (radius 2.8) or charging into it (radius 2.15)
        const biteRadius = npc.isJumping && npc.currentJumpOffset > 0.4 ? 2.85 : 2.15;

        for (let s = player.segments.length - 1; s >= 0; s--) {
          const segPos = player.segments[s].group.position;
          if (npc.position.distanceTo(segPos) < biteRadius) {
            npc.biteCooldown = 2.4;
            const npcName = POKEMON_DATA[npc.species]?.name || 'NPC';

            // Check Defense Gem ("🛡️ 防禦寶石：第5次 80%"): 16% * stacks chance to block the bite!
            const defChance = player.getDefenseChance ? player.getDefenseChance() : 0;
            if (defChance > 0 && Math.random() < defChance) {
              sound.playEvolve();
              player.isInvincible = true;
              setTimeout(() => (player.isInvincible = false), 900);

              // Talent: 尖刺反震 (Counter Shock)
              const shockLvl = saveManager.getTalentLevel('counterShock');
              if (shockLvl >= 1) {
                npc.speed = 0;
                npc.buffTimer = 0;
                setTimeout(() => {
                  if (npc.isAlive) npc.speed = npc.baseSpeed;
                }, 1800);
              }
              let stolen = false;
              if (shockLvl >= 2 && npc.segments.length > 0) {
                this.removeNPCSegment(npc);
                player.addSegment();
                stolen = true;
              }

              return {
                event: 'npc_bite_blocked',
                npcName,
                blockPct: Math.round(defChance * 100),
                shocked: shockLvl >= 1,
                stolen
              };
            }

            // Otherwise, NPC successfully eats 1 segment of Player's body!
            player.loseSegment();
            player.isInvincible = true;

            // Talent: 厚實護甲 (無敵延長: 1.4s -> 2.4s / 3.5s)
            const extraInv = saveManager.getTalentBonus('invincibleExt');
            const totalInvDuration = 1400 + extraInv * 1000;
            setTimeout(() => (player.isInvincible = false), totalInvDuration);

            // NPC grows by +1 segment!
            this.addNPCSegment(npc, 1);

            return {
              event: 'npc_ate_player_body',
              npcName,
              npcLength: npc.segments.length + 1
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Returns whether any NPC has reached the target winning length first
   */
  checkNPCReachedTarget(targetLength) {
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.isAlive && npc.segments.length + 1 >= targetLength) {
        return {
          npc,
          name: POKEMON_DATA[npc.species]?.name || 'NPC 寶可夢',
          icon: POKEMON_DATA[npc.species]?.icon || '👾',
          length: npc.segments.length + 1
        };
      }
    }
    return null;
  }

  /**
   * Live Race Leaderboard data sorted by team length
   */
  getLeaderboard(player) {
    const entries = [
      {
        id: 'player',
        name: `${saveManager.getPlayerName()} (${POKEMON_DATA[player.species]?.name || '皮卡丘'})`,
        icon: POKEMON_DATA[player.species]?.icon || '⚡',
        length: player.segments.length + 1,
        isPlayer: true
      }
    ];

    this.npcs.forEach((npc, idx) => {
      const pData = POKEMON_DATA[npc.species] || { name: '寶可夢', icon: '🐾' };
      const isAI = !!npc.isTrueAI;
      const name = isAI ? `🤖 AI ${pData.name}` : `NPC ${pData.name}`;
      entries.push({
        id: `npc-${idx}`,
        name,
        icon: isAI ? '🤖' : pData.icon,
        length: npc.isAlive ? npc.segments.length + 1 : 0,
        isPlayer: false,
        isAI
      });
    });

    return entries.sort((a, b) => b.length - a.length);
  }

  getTrueAINPC() {
    return this.npcs.find((n) => n.isTrueAI) || this.npcs[0];
  }

  setAISpeech(text, duration = 4.0) {
    const ai = this.getTrueAINPC();
    if (ai) {
      ai.speechBubbleText = text;
      ai.speechBubbleTimer = duration;
      updateAISpeechBubble(ai.group, text);
    }
  }

  killAndRespawnNPC(npc) {
    npc.isAlive = false;
    this.npcGroup.remove(npc.group);
    npc.segments.forEach((seg) => this.npcGroup.remove(seg));

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 }
    });

    setTimeout(() => {
      const speciesList = ['charmander', 'squirtle', 'gengar', 'falinks', 'bulbasaur', 'pikachu'];
      const nextSpecies = speciesList[Math.floor(Math.random() * speciesList.length)];
      npc.species = nextSpecies;
      npc.position = this.planet.getRandomSurfacePoint(0.25);
      npc.pathHistory = [];
      npc.isAlive = true;

      npc.group = createPokemonMesh(nextSpecies, true, 0.95);
      npc.group.position.copy(npc.position);
      updateHeadCountBadge(npc.group, npc.segments.length + 1, false);
      this.npcGroup.add(npc.group);

      npc.segments = [];
      for (let i = 0; i < 2; i++) {
        const segScale = Math.max(0.52, 0.76 - i * 0.015);
        const segMesh = createPokemonMesh(nextSpecies, false, segScale);
        segMesh.position.copy(npc.position);
        this.npcGroup.add(segMesh);
        npc.segments.push(segMesh);
      }
    }, 4000);
  }

  clear() {
    while (this.npcGroup.children.length > 0) {
      this.npcGroup.remove(this.npcGroup.children[0]);
    }
    this.npcs = [];
    this.initNPCs();
  }
}
