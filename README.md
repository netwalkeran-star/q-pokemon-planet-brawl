# ⚡ 寶可夢城市小行星 3D（貪吃蛇爭霸賽 ＋ 大亂鬥攻城生存 Brawl）

以 Three.js 打造的 3D 繪本風球面小行星動作遊戲，收錄 **台北、京都、上海** 三座 3D 城市地標小行星與 6 隻 3D 寶可夢角色，同時提供兩種完整玩法：

- **⚔️ 寶可夢小行星・大亂鬥（Brawl）**：10 隻主角連線出戰、擊殺城市建築湧出的 Q 版動物殭屍、收集 3D 寶石與限時精華強化武器、以時間讀條攻佔全部 13 座建築轉化為我方水晶砲台！
- **🐍 寶可夢城市小行星・貪吃蛇爭霸賽（經典主遊戲）**：經典球面貪吃蛇、景點巡禮、三大副本與 AI 耿鬼語音互動。

---

## 🌐 線上直接玩（GitHub Pages）

點擊以下連結即可在手機、iPad 或電腦瀏覽器免安裝直接開玩：

| 模式 | 線上遊玩網址 |
| :--- | :--- |
| **⚔️ 小行星大亂鬥（Brawl）** | [點此線上玩大亂鬥（Brawl）](https://netwalkeran-star.github.io/q-pokemon-planet-brawl/brawl/) |
| **🐍 城市小行星貪吃蛇（主遊戲）** | [點此線上玩貪吃蛇爭霸賽](https://netwalkeran-star.github.io/q-pokemon-planet-brawl/) |

---

## 📱 Android APK 直接下載

| APK 版本 | 說明 | 下載連結 |
| :--- | :--- | :--- |
| **⚔️ 寶可夢小行星・大亂鬥 APK** | 橫屏全螢幕原生 WebView 封裝，開啟直達大亂鬥模式 | [直接下載 APK（Pages）](https://netwalkeran-star.github.io/q-pokemon-planet-brawl/pokemon-planet-brawl.apk) ｜ [Releases 下載](https://github.com/netwalkeran-star/q-pokemon-planet-brawl/releases/latest/download/pokemon-planet-brawl.apk) |
| **🐍 寶可夢城市小行星 AI 版 APK** | 原版貪吃蛇爭霸賽＋副本模式 | [直接下載 APK（Pages）](https://netwalkeran-star.github.io/q-pokemon-planet-brawl/pokemon-planet-snake-ai.apk) |

---

## 🎮 大亂鬥（Brawl）核心特色

- **6 隻 3D 寶可夢連線小隊**：開局 `100 HP = 10 隻主角` 連線出戰，每少 10 點血隊尾減員 1 隻；拾取特殊擴編寶石可突破上限（第 1 關 12 隻 → 第 2 關 14 隻 → 第 3 關 16 隻）。
- **三座 3D 城市小行星關卡**：依序挑戰 **台北（8 秒佔領）→ 京都（11 秒佔領）→ 上海（14 秒佔領）**，攻佔全部 13 座建築轉化為自動開砲水晶砲台，每次攻佔成功施放三連發 3D 空中煙花。
- **4 種單一裝備 3D 武器（拾獲暫停詢問更換、完整繼承強化比例）**：
  - 🌀 **迴旋星環刃**：多段水晶巨劍環繞切割與擊退
  - ⚡ **追蹤雷羽鏢**：雙翼機砲自動鎖定範圍內敵人
  - 🔥 **烈焰震地波**：雙環陀螺爐心 360° 衝擊波
  - ☄️ **貫穿星能砲**：雙管脈衝磁軌砲直線貫穿
- **3D PBR 掉落物與限時精華**：多面切面寶石、雙軸旋轉金屬陀螺精華（地上 12 秒限時）與金屬武器箱。
- **獨立 WebAudio 高質感音效與 124 BPM 動作背景音樂**。
- **跨裝置操作**：支援電腦 `WASD`/方向鍵 + `Shift` 衝刺 + `Space` 奧義指引，以及手機／iPad **1.5X 半透明虛擬搖桿**、單指旋轉星球、雙指縮放與防誤觸退全螢幕鎖定。

---

## 🛠️ 本機開發與打包指令

```bash
# 安裝套件
npm install

# 啟動開發伺服器（Vite）
npm run dev

# 啟動同網域手機測試與 APK 下載伺服器（Port 8080）
node serve_apk.js

# 打包生產版網頁（輸出至 ./dist，含 / 與 /brawl/）
npm run build

# 打包大亂鬥 Android APK（需本機 Android SDK Build-Tools 與 JDK）
powershell -ExecutionPolicy Bypass -File .\build_brawl_apk.ps1
```

---

## 🚀 GitHub Pages 一鍵自動部署步驟

本專案已內建 `.github/workflows/deploy.yml`：

1. 在 GitHub 建立一個新的 Public Repository（例如 `asteroid-snake-brawl`）。
2. 將本專案檔案（包含 `brawl/`、`src/`、`vite.config.js`、`.github/workflows/deploy.yml` 與 `pokemon-planet-brawl.apk`）上傳或推送到 `main` 分支。
3. 到 GitHub Repository 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
4. 等待約 1 分鐘部署完成，即可透過 `https://<帳號>.github.io/<Repo>/brawl/` 線上遊玩，並透過 `https://<帳號>.github.io/<Repo>/pokemon-planet-brawl.apk` 直接下載 APK！
