import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class GestureController {
  constructor(onSteer, onSkill, onJump) {
    this.onSteer = onSteer; // (turnVal: -1 to 1)
    this.onSkill = onSkill; // ()
    this.onJump = onJump;   // ()
    this.isActive = false;
    this.isCameraReady = false;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.camera = null;
    this.hands = null;

    this.lastPinch = false;
    this.lastJumpGesture = false;
    this.statusText = '視訊手勢未啟動';
  }

  async init(videoElement, canvasElement, statusEl) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.statusEl = statusEl;
    this.canvasCtx = canvasElement.getContext('2d');

    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.6
    });

    this.hands.onResults((results) => this.processResults(results));
  }

  async start() {
    if (this.isActive) return;
    this.isActive = true;
    this.statusText = '啟動鏡頭中...';
    if (this.statusEl) this.statusEl.innerText = this.statusText;

    try {
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.isActive) {
            await this.hands.send({ image: this.videoElement });
          }
        },
        width: 320,
        height: 240
      });
      await this.camera.start();
      this.isCameraReady = true;
      this.statusText = '手勢辨識中：向左/右傾斜手掌轉向';
      if (this.statusEl) this.statusEl.innerText = this.statusText;
    } catch (err) {
      console.error('Webcam access error:', err);
      this.statusText = '無法啟動視訊鏡頭，請檢查權限';
      if (this.statusEl) this.statusEl.innerText = this.statusText;
      this.isActive = false;
    }
  }

  stop() {
    this.isActive = false;
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }
    this.onSteer(0);
    this.statusText = '視訊手勢已暫停';
    if (this.statusEl) this.statusEl.innerText = this.statusText;
  }

  processResults(results) {
    if (!this.isActive || !this.canvasCtx) return;

    const ctx = this.canvasCtx;
    const w = this.canvasElement.width;
    const h = this.canvasElement.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(results.image, 0, 0, w, h);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      this.drawCuteSkeleton(ctx, landmarks, w, h);

      const wrist = landmarks[0];
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];

      // 1. Steering via Hand Position / Tilt
      const palmX = 1.0 - (wrist.x + indexTip.x) * 0.5; // mirror X
      const diffFromCenter = (palmX - 0.5) * 2.0;

      let turnVal = 0;
      if (diffFromCenter < -0.15) {
        turnVal = -1;
        this.statusText = '🖐️ 往左轉 ◀';
      } else if (diffFromCenter > 0.15) {
        turnVal = 1;
        this.statusText = '🖐️ 往右轉 ▶';
      } else {
        turnVal = 0;
        this.statusText = '🖐️ 直行中';
      }
      this.onSteer(turnVal);

      // 2. Skill Dash: Pinch (Thumb + Index)
      const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      const isPinch = pinchDist < 0.08;

      if (isPinch && !this.lastPinch) {
        this.onSkill();
        this.statusText = '💥 手勢發動技能！';
      }
      this.lastPinch = isPinch;

      // 3. Jump: Hand Raised High (Wrist Y < 0.38) or All 5 fingers extended upward
      const isHandHigh = wrist.y < 0.38 && middleTip.y < 0.25;
      if (isHandHigh && !this.lastJumpGesture) {
        if (this.onJump) this.onJump();
        this.statusText = '🦘 手勢空中跳躍！';
      }
      this.lastJumpGesture = isHandHigh;

      if (isPinch) {
        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc((1 - thumbTip.x) * w, thumbTip.y * h, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      this.onSteer(0);
      this.statusText = '等待手掌進入畫面...';
    }

    if (this.statusEl) this.statusEl.innerText = this.statusText;
    ctx.restore();
  }

  drawCuteSkeleton(ctx, lm, w, h) {
    ctx.strokeStyle = '#4deeea';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ffe600';

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    connections.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo((1 - lm[i].x) * w, lm[i].y * h);
      ctx.lineTo((1 - lm[j].x) * w, lm[j].y * h);
      ctx.stroke();
    });

    lm.forEach((pt) => {
      ctx.beginPath();
      ctx.arc((1 - pt.x) * w, pt.y * h, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
