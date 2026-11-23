import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT = 8080;
const ROOT = 'd:\\kenji xai\\asteroid-snake';
const APK_NAME = 'pokemon-planet-snake-ai.apk';
const APK_PATH = path.join(ROOT, APK_NAME);

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIP = getLocalIP();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/' || urlPath === '/index.html') {
    // Mobile-friendly landing page with direct download button
    const fileSizeMB = fs.existsSync(APK_PATH)
      ? (fs.statSync(APK_PATH).size / (1024 * 1024)).toFixed(2)
      : '0.2';
    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>下載 寶可夢城市小行星 AI 版 APK</title>
  <style>
    body {
      margin: 0; padding: 24px;
      background: linear-gradient(135deg, #0f172a, #1e1b4b);
      color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh;
      box-sizing: border-box; text-align: center;
    }
    .card {
      background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px;
      padding: 32px 24px; max-width: 400px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .icon { font-size: 56px; margin-bottom: 12px; }
    h1 { font-size: 22px; margin: 0 0 8px; color: #38bdf8; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0 0 24px; }
    .badge {
      display: inline-block; background: #0369a1; color: #e0f2fe;
      padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; margin-bottom: 18px;
    }
    .btn-download {
      display: block; width: 100%; box-sizing: border-box;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white; text-decoration: none; padding: 16px; border-radius: 16px;
      font-size: 18px; font-weight: 700; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
      transition: transform 0.15s;
    }
    .btn-download:active { transform: scale(0.97); }
    .footer { margin-top: 18px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🤖</div>
    <div class="badge">同網域快速安裝</div>
    <h1>寶可夢城市小行星 AI 版</h1>
    <p>包含【真 AI 耿鬼】全時免按鍵語音對話、被動天賦樹與都市名勝探險</p>
    <a href="/${APK_NAME}" class="btn-download" download="${APK_NAME}">
      📥 下載貪吃蛇 AI 版 APK (${fileSizeMB} MB)
    </a>
    <a href="/pokemon-planet-brawl.apk" class="btn-download" style="margin-top:10px; background:linear-gradient(135deg, #0ea5e9, #6366f1); box-shadow:0 8px 20px rgba(14,165,233,0.4);" download="pokemon-planet-brawl.apk">
      ⚔️ 下載大亂鬥 Brawl 版 APK
    </a>
    <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
      <a href="/game" style="background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; text-decoration:none; padding:12px; border-radius:12px; font-weight:800; font-size:15px; text-align:center;">
        🎮 免安裝・直接網頁暢玩主遊戲
      </a>
      <div style="display: flex; gap: 8px;">
        <a href="/brawl" style="flex:1; background:linear-gradient(135deg, #10b981, #0ea5e9); color:#fff; text-decoration:none; padding:10px; border-radius:12px; font-weight:800; font-size:13px; text-align:center;">
          ⚔️ 小行星大亂鬥 (Brawl)
        </a>
        <a href="/dungeon_trial.html" style="flex:1; background:#0284c7; color:#fff; text-decoration:none; padding:10px; border-radius:12px; font-weight:700; font-size:13px; text-align:center;">
          🚪 三大副本獨立試玩
        </a>
        <a href="/cape_showcase.html" style="flex:1; background:#334155; color:#38bdf8; text-decoration:none; padding:10px; border-radius:12px; font-weight:700; font-size:13px; text-align:center;">
          🎽 3D披肩試衣間
        </a>
      </div>
    </div>
    <div class="footer">檔案名稱：${APK_NAME}<br>手機 Android 可下載 APK 體驗原生全螢幕！</div>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.end(html);
    return;
  }

  if (urlPath === `/${APK_NAME}` || urlPath === '/apk') {
    if (fs.existsSync(APK_PATH)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${APK_NAME}"`);
      res.setHeader('Content-Length', fs.statSync(APK_PATH).size);
      fs.createReadStream(APK_PATH).pipe(res);
      return;
    }
  }

  // Redirect /brawl to /brawl/ so relative assets (./brawl.css, ./main.js, ../src/*) resolve cleanly
  if (urlPath === '/brawl') {
    res.writeHead(302, { Location: '/brawl/' });
    res.end();
    return;
  }

  // Route /game or /game.html to index.html, and /brawl/ to brawl/index.html
  let filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
  if (urlPath === '/game' || urlPath === '/game.html') {
    filePath = path.join(ROOT, 'index.html');
  } else if (urlPath === '/brawl/' || urlPath === '/brawl/index.html') {
    filePath = path.join(ROOT, 'brawl', 'index.html');
  }

  // Handle static files with proper MIME types
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.html': 'text/html; charset=UTF-8',
      '.js': 'application/javascript; charset=UTF-8',
      '.css': 'text/css; charset=UTF-8',
      '.json': 'application/json; charset=UTF-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.apk': 'application/vnd.android.package-archive'
    };
    if (mimeMap[ext]) {
      res.setHeader('Content-Type', mimeMap[ext]);
    }
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on all interfaces at port ${PORT}`);
  console.log(`Download page: http://${localIP}:${PORT}/`);
  console.log(`Direct APK: http://${localIP}:${PORT}/${APK_NAME}`);
});
