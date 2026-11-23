/**
 * AIVoiceAgent: Hands-free Continuous Speech Recognition + AI NPC Dialogue & Game Behavioral Reactivity
 * Supports Web Speech API (Hands-free listening without pressing any buttons)
 * + Gemini 1.5 Flash API (when key is provided) / Built-in Smart Rival AI Dialogue Engine (zero key needed)
 * + Web Speech Synthesis (TTS)
 */

import { saveManager } from './saveManager.js';

export class AIVoiceAgent {
  constructor(game) {
    this.game = game;
    this.isListening = false;
    this.isSpeaking = false;
    this.micEnabled = true;
    this.recognition = null;
    this.speechSynth = window.speechSynthesis || null;
    this.activeVoice = null;
    this.apiKey = localStorage.getItem('pkm_gemini_api_key') || '';
    this.aiSpecies = 'gengar'; // 🤖 真 AI NPC 蛇：耿鬼
    this.lastSpokenText = '';
    this.onAIResponseCallbacks = [];

    this.initSpeechSynth();
    this.initRecognition();
  }

  initSpeechSynth() {
    if (!this.speechSynth) return;
    const loadVoices = () => {
      const voices = this.speechSynth.getVoices();
      this.activeVoice =
        voices.find((v) => v.lang.includes('zh-TW') || v.lang.includes('cmn-Hant-TW')) ||
        voices.find((v) => v.lang.includes('zh') || v.lang.includes('cmn')) ||
        voices[0] ||
        null;
    };
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'zh-TW';
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateMicHUD(true);
      };

      this.recognition.onresult = (event) => {
        if (this.isSpeaking) return;

        const lastIndex = event.results.length - 1;
        if (lastIndex < 0) return;
        const result = event.results[lastIndex];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript.length > 0) {
            console.log('[AI Voice Agent] Player said:', transcript);
            this.handlePlayerUtterance(transcript);
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[AI Voice Agent] Recognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.micEnabled = false;
          this.updateMicHUD(false);
          this.game.showToast('⚠️ 請允許麥克風權限以與真 AI 蛇語音對話！');
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        // Hands-free continuous auto-restart while game is active!
        if (this.micEnabled && this.game.isPlaying && !this.isSpeaking) {
          setTimeout(() => {
            if (this.micEnabled && this.game.isPlaying && !this.isSpeaking) {
              try {
                this.recognition.start();
              } catch (_) {}
            }
          }, 350);
        } else {
          this.updateMicHUD(false);
        }
      };
    } catch (e) {
      console.warn('Failed to initialize SpeechRecognition:', e);
    }
  }

  startListening() {
    if (!this.recognition || !this.micEnabled) return;
    if (this.isListening) return;
    try {
      this.recognition.start();
    } catch (e) {}
  }

  stopListening() {
    if (!this.recognition) return;
    this.isListening = false;
    try {
      this.recognition.stop();
    } catch (_) {}
    this.updateMicHUD(false);
  }

  toggleMic() {
    this.micEnabled = !this.micEnabled;
    if (this.micEnabled) {
      this.startListening();
      this.game.showToast('🎙️ AI 語音監聽已開啟！直接開口即可對話（免按鍵）');
    } else {
      this.stopListening();
      this.game.showToast('🔇 AI 麥克風已靜音');
    }
    this.updateMicHUD(this.micEnabled && this.isListening);
    return this.micEnabled;
  }

  updateMicHUD(active) {
    const micBtn = document.getElementById('hud-ai-mic-btn');
    const micDot = document.getElementById('hud-ai-mic-dot');
    const micText = document.getElementById('hud-ai-mic-text');
    if (micBtn) {
      micBtn.classList.toggle('active', active);
      micBtn.classList.toggle('muted', !this.micEnabled);
    }
    if (micDot) {
      micDot.style.background = !this.micEnabled ? '#ef4444' : active ? '#22c55e' : '#eab308';
    }
    if (micText) {
      micText.innerText = !this.micEnabled
        ? '靜音'
        : active
        ? 'AI'
        : '啟動中';
    }
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.apiKey) {
      localStorage.setItem('pkm_gemini_api_key', this.apiKey);
    } else {
      localStorage.removeItem('pkm_gemini_api_key');
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  onAIResponse(cb) {
    this.onAIResponseCallbacks.push(cb);
  }

  /**
   * Process Player's spoken text and get AI response + game behavioral action
   */
  async handlePlayerUtterance(playerText) {
    this.game.showToast(`🗣️ 你：「${playerText}」`);

    const playerName = saveManager.getPlayerName();
    const playerLen = this.game.snake.segments.length + 1;
    const aiNPC = this.game.npcManager ? this.game.npcManager.getTrueAINPC() : null;
    const aiLen = aiNPC ? aiNPC.segments.length + 1 : 3;
    const targetLen = this.game.targetLength;
    const stage = this.game.stage;
    const cityNames = ['台北', '京都', '上海'];
    const currentCity = cityNames[stage - 1] || '台北';

    let distanceMeters = 50;
    if (aiNPC && this.game.snake) {
      distanceMeters = Math.round(aiNPC.position.distanceTo(this.game.snake.position));
    }

    let replyText = '';
    let actionType = 'normal';

    if (this.apiKey) {
      try {
        const geminiRes = await this.queryGeminiAPI(playerText, {
          playerName,
          playerLen,
          aiLen,
          targetLen,
          currentCity,
          distanceMeters
        });
        if (geminiRes) {
          replyText = geminiRes.reply;
          actionType = geminiRes.action;
        }
      } catch (e) {
        console.warn('Gemini query failed, falling back to local engine:', e);
      }
    }

    if (!replyText) {
      const localRes = this.evaluateLocalAI(playerText, {
        playerName,
        playerLen,
        aiLen,
        targetLen,
        currentCity,
        distanceMeters
      });
      replyText = localRes.reply;
      actionType = localRes.action;
    }

    this.speakAndReact(replyText, actionType, aiNPC);
  }

  evaluateLocalAI(text, ctx) {
    const t = text.toLowerCase();
    let reply = '';
    let action = 'normal';

    // 1. Taunts & Biting intent (我要咬你 / 追到你 / 吃了你 / 別跑)
    if (/咬|吃你|吃掉|追|抓到|別跑|站住|後面|受死/.test(t)) {
      if (ctx.playerLen > ctx.aiLen) {
        reply = `哇！${ctx.playerName}你隊伍比我長！我才不會被你咬到，溜囉～！`;
        action = 'flee';
      } else {
        reply = `想咬我？我可是 ${ctx.aiLen} 節的耿鬼！看誰先咬到誰！`;
        action = 'taunt';
      }
    }
    // 2. Challenge & Provocation (單挑 / 過來 / 決鬥 / 敢不敢)
    else if (/過來|單挑|決鬥|敢不敢|怕你|對決|來戰/.test(t)) {
      reply = `來啊！本大爺就在你附近 ${ctx.distanceMeters} 米，正面對決誰怕誰！`;
      action = 'chase';
    }
    // 3. Score & Progress Inquiries (幾節 / 誰領先 / 贏了 / 比賽)
    else if (/幾節|多少隻|誰贏|誰領先|分數|幾隻|長度|第一名/.test(t)) {
      if (ctx.aiLen > ctx.playerLen) {
        reply = `我現在 ${ctx.aiLen} 隻，你只有 ${ctx.playerLen} 隻，我遙遙領先呢！`;
        action = 'taunt';
      } else if (ctx.aiLen < ctx.playerLen) {
        reply = `你 ${ctx.playerLen} 隻我才 ${ctx.aiLen} 隻！等等我，全能寶石我搶定了！`;
        action = 'dash';
      } else {
        reply = `我們現在都是 ${ctx.aiLen} 隻平手！目標是 ${ctx.targetLen} 隻，看誰先達到！`;
        action = 'dash';
      }
    }
    // 4. Landmarks & Navigation (在哪 / 101 / 金閣寺 / 東方明珠 / 名勝 / 錦旗)
    else if (/在哪|101|金閣寺|寺|塔|明珠|外灘|景點|名勝|錦旗|旗/.test(t)) {
      reply = `在【${ctx.currentCity}小行星】的名勝錦旗附近都有屬性寶石，快去打卡吧！`;
      action = 'dash';
    }
    // 5. Help / Mercy / Surrender (求饒 / 等等 / 慢點 / 救命)
    else if (/等等|慢點|救命|不要|暫停|休息/.test(t)) {
      reply = `賽跑場上可沒有暫停鍵！快跟上本大爺的節奏！`;
      action = 'taunt';
    }
    // 6. Greetings & Name (你好 / 嗨 / 你是誰 / 名字)
    else if (/你好|嗨|早|哈囉|你是誰|耿鬼/.test(t)) {
      reply = `嗨 ${ctx.playerName}！我是行星真 AI 耿鬼，今天我一定會率先拿到 ${ctx.targetLen} 隻！`;
      action = 'taunt';
    }
    // 7. Encouragement or Compliments (厲害 / 加油 / 帥 / 酷)
    else if (/厲害|加油|強|好快|好棒|帥/.test(t)) {
      reply = `那是當然！我這可是全行星最靈活的飄移走位！`;
      action = 'taunt';
    }
    // Default banter
    else {
      const banterList = [
        `哈哈，有空說話不如多吃幾顆倍數寶石吧！`,
        `我正在尋找全能狂熱寶石，可別被我搶先了！`,
        `聽見你說話了，但我可是不會放水的喔！`,
        `我們距離才 ${ctx.distanceMeters} 米，小心被我超車！`
      ];
      reply = banterList[Math.floor(Math.random() * banterList.length)];
      action = 'normal';
    }

    return { reply, action };
  }

  async queryGeminiAPI(playerText, ctx) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
    const systemPrompt = `你是一個在 3D 城市小行星賽跑遊戲中的【真 AI 勁敵耿鬼】。
玩家叫「${ctx.playerName}」(當前隊伍長度: ${ctx.playerLen}隻)。
你叫「AI 耿鬼」(當前隊伍長度: ${ctx.aiLen}隻，目標: ${ctx.targetLen}隻)。
當前城市: 【${ctx.currentCity}】。
你與玩家目前的距離約為: ${ctx.distanceMeters} 公尺。
個性: 活潑、幽默、調皮、愛開玩笑但有運動家精神的真 AI 賽跑對手。
規則:
1. 用繁體中文回覆，語氣口語生動，長度限制在 1 到 2 句短話（適合語音朗讀）。
2. 在回答最後附上動作標籤 (只選一個): [ACTION: FLEE] (逃跑), [ACTION: CHASE] (追逐), [ACTION: DASH] (衝刺), [ACTION: TAUNT] (嘲諷跳躍), [ACTION: NORMAL]。`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n玩家剛剛用語音對你說：「${playerText}」` }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 80,
        temperature: 0.8
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) return null;

    let action = 'normal';
    let cleanReply = raw;
    if (raw.includes('[ACTION: FLEE]')) {
      action = 'flee';
      cleanReply = raw.replace('[ACTION: FLEE]', '');
    } else if (raw.includes('[ACTION: CHASE]')) {
      action = 'chase';
      cleanReply = raw.replace('[ACTION: CHASE]', '');
    } else if (raw.includes('[ACTION: DASH]')) {
      action = 'dash';
      cleanReply = raw.replace('[ACTION: DASH]', '');
    } else if (raw.includes('[ACTION: TAUNT]')) {
      action = 'taunt';
      cleanReply = raw.replace('[ACTION: TAUNT]', '');
    } else if (raw.includes('[ACTION: NORMAL]')) {
      action = 'normal';
      cleanReply = raw.replace('[ACTION: NORMAL]', '');
    }

    return { reply: cleanReply.trim(), action };
  }

  speakAndReact(replyText, actionType, aiNPC) {
    if (!replyText) return;
    this.lastSpokenText = replyText;

    this.onAIResponseCallbacks.forEach((cb) => cb(replyText, actionType, aiNPC));

    if (aiNPC) {
      aiNPC.executeVoiceAction(actionType, this.game.snake.position);
    }

    if (this.speechSynth) {
      try {
        this.speechSynth.cancel();
        const utter = new SpeechSynthesisUtterance(replyText);
        if (this.activeVoice) utter.voice = this.activeVoice;
        utter.lang = 'zh-TW';
        utter.pitch = 1.25;
        utter.rate = 1.15;

        this.isSpeaking = true;
        utter.onstart = () => {
          this.isSpeaking = true;
        };
        utter.onend = () => {
          this.isSpeaking = false;
        };
        utter.onerror = () => {
          this.isSpeaking = false;
        };

        this.speechSynth.speak(utter);
      } catch (e) {
        console.warn('TTS error:', e);
        this.isSpeaking = false;
      }
    }
  }
}
