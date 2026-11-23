import * as THREE from 'three';

const textureCache = new Map();

function getCachedTexture(key, generatorFn) {
  if (textureCache.has(key)) {
    return textureCache.get(key);
  }
  const tex = generatorFn();
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * 0A. Overcooked-Style Layered Cliff Wall Texture (胡鬧廚房風格：階梯高地橘黃泥土斷層橫紋)
 */
export function createCliffSideTexture() {
  return getCachedTexture('overcooked_cliff_side', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Horizontal geological bands from top lip to bottom base
    const bands = [
      { y: 0, h: 36, color: '#583922' },   // Dark top overhang lip
      { y: 36, h: 48, color: '#a86420' },  // Warm ochre soil
      { y: 84, h: 44, color: '#c47d2b' },  // Golden caramel band
      { y: 128, h: 52, color: '#8f5119' }, // Deep amber earth
      { y: 180, h: 40, color: '#b87225' }, // Mid ochre
      { y: 220, h: 36, color: '#5c3614' }  // Dark base shadow
    ];

    bands.forEach((b) => {
      ctx.fillStyle = b.color;
      ctx.fillRect(0, b.y, 256, b.h);
    });

    // Subtle verticalfaceted rock creases
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = (x / 32) % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(x, 0, 32, 256);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

/**
 * 0B. Overcooked-Style Asphalt Road with White Dashed Lines & Curbs (胡鬧廚房風格：柏油馬路與白色虛線)
 */
export function createAsphaltRoadTexture() {
  return getCachedTexture('overcooked_road', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Raised light-grey stone curbs on left & right edges
    ctx.fillStyle = '#8b959e';
    ctx.fillRect(0, 0, 256, 256);

    // Dark slate asphalt pavement in center
    ctx.fillStyle = '#49525c';
    ctx.fillRect(24, 0, 208, 256);

    // Inner curb shadow line
    ctx.fillStyle = '#373e47';
    ctx.fillRect(24, 0, 6, 256);
    ctx.fillRect(226, 0, 6, 256);

    // Crisp White Dashed Center Line
    ctx.fillStyle = '#f1f5f9';
    for (let y = 16; y < 256; y += 64) {
      ctx.beginPath();
      ctx.roundRect(120, y, 16, 36, 4);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

/**
 * 1. Modern Skyscraper Curtain-Wall Glass Window Texture (摩天大樓玻璃帷幕窗格皮膚)
 */
export function createGlassTowerTexture(baseHex = '#38a3b8', mullionHex = '#1d4e5c') {
  const key = `glass_${baseHex}_${mullionHex}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    const cols = 6;
    const rows = 8;
    const w = 256 / cols;
    const h = 256 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isLit = (r * 7 + c * 13) % 5 === 0;
        ctx.fillStyle = isLit ? 'rgba(255, 248, 190, 0.55)' : 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(c * w + 4, r * h + 4, w - 8, h - 8);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(c * w + 5, r * h + 5, (w - 10) * 0.38, h - 10);
      }
    }

    // Chunky Toy-Box white/dark mullions
    ctx.strokeStyle = mullionHex;
    ctx.lineWidth = 4;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * w, 0);
      ctx.lineTo(c * w, 256);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * h);
      ctx.lineTo(256, r * h);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  });
}

/**
 * 2. Traditional Ceramic / Glazed Roof Tile Texture (傳統宮殿與寺院瓦片皮膚)
 */
export function createRoofTileTexture(baseHex = '#2a9d8f', ridgeHex = '#165b53') {
  const key = `roof_${baseHex}_${ridgeHex}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    const cols = 10;
    const rows = 8;
    const colW = 256 / cols;
    const rowH = 256 / rows;

    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = c % 2 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.16)';
      ctx.fillRect(c * colW, 0, colW * 0.6, 256);
    }

    ctx.strokeStyle = ridgeHex;
    ctx.lineWidth = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.beginPath();
        ctx.arc(c * colW + colW / 2, r * rowH + rowH * 0.6, colW * 0.48, 0, Math.PI, false);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  });
}

/**
 * 3. Toy-Box Brick & Window Facade Texture (玩具模型感厚邊窗格與紅磚建築皮膚)
 */
export function createBrickFacadeTexture(brickHex = '#d96b27', trimHex = '#e8eef2') {
  const key = `brick_${brickHex}_${trimHex}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = brickHex;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle toy brick courses
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 2;
    const brickH = 16;
    const brickW = 32;
    for (let y = 0; y < 256; y += brickH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      const offset = (y / brickH) % 2 === 0 ? 0 : brickW / 2;
      for (let x = offset; x < 256; x += brickW) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + brickH);
        ctx.stroke();
      }
    }

    // Thick Overcooked-style white cornice bands
    ctx.fillStyle = trimHex;
    ctx.fillRect(0, 0, 256, 14);
    ctx.fillRect(0, 120, 256, 12);
    ctx.fillRect(0, 242, 256, 14);

    // Chunky rounded toy windows with thick frames
    const winCols = 3;
    const winFloors = 2;
    for (let f = 0; f < winFloors; f++) {
      const wy = 28 + f * 120;
      for (let c = 0; c < winCols; c++) {
        const wx = 22 + c * 78;
        ctx.fillStyle = trimHex;
        ctx.beginPath();
        ctx.roundRect(wx - 5, wy - 5, 46, 62, 8);
        ctx.fill();

        ctx.fillStyle = '#263849';
        ctx.beginPath();
        ctx.roundRect(wx, wy, 36, 52, 5);
        ctx.fill();

        // Warm lit window reflection
        ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
        ctx.fillRect(wx + 4, wy + 4, 14, 44);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

/**
 * 4. Japanese / Traditional Wood Lattice & Shoji Facade Texture (日式木造格柵與障子窗皮膚)
 */
export function createWoodLatticeTexture(woodHex = '#6f4518', screenHex = '#fff8eb') {
  const key = `wood_${woodHex}_${screenHex}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = screenHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = woodHex;
    ctx.lineWidth = 6;

    const cols = 6;
    const rows = 6;
    const w = 256 / cols;
    const h = 256 / rows;

    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * w, 0);
      ctx.lineTo(c * w, 256);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * h);
      ctx.lineTo(256, r * h);
      ctx.stroke();
    }

    ctx.fillStyle = woodHex;
    ctx.fillRect(0, 0, 256, 20);
    ctx.fillRect(0, 120, 256, 18);
    ctx.fillRect(0, 236, 256, 20);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

/**
 * 5. Toy-Box Building Facade & Stone Wall Texture (胡鬧廚房玩具屋立面與厚窗框皮膚)
 */
export function createStoneWallTexture(baseHex = '#38b6c4', lineHex = '#d8e2dc') {
  const key = `stone_${baseHex}_${lineHex}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Thick white toy roof & floor molding bands (just like the cyan/blue building in the reference!)
    ctx.fillStyle = '#e8eef2';
    ctx.fillRect(0, 0, 256, 22);
    ctx.fillRect(0, 118, 256, 16);
    ctx.fillRect(0, 236, 256, 20);

    // Chunky windows with thick white frames
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const wx = 22 + c * 78;
        const wy = 36 + r * 118;
        ctx.fillStyle = '#e8eef2';
        ctx.beginPath();
        ctx.roundRect(wx - 5, wy - 5, 48, 56, 8);
        ctx.fill();

        ctx.fillStyle = '#2b3d4f';
        ctx.beginPath();
        ctx.roundRect(wx, wy, 38, 46, 5);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(wx + 4, wy + 4, 14, 38);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

/**
 * 6. Overcooked-Style Soft Painterly Toy Grass Texture (柔和繪本草地皮膚，去除生硬圓圈拉伸感)
 */
export function createStorybookGrassTexture(baseHex = '#65a832') {
  const key = `grass_soft_${baseHex}`;
  return getCachedTexture(key, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    // Broad, ultra-soft radial color mottling (no sharp circles that stretch on the sphere)
    for (let i = 0; i < 42; i++) {
      const x = (i * 137 + 41) % 512;
      const y = (i * 193 + 29) % 512;
      const r = 38 + (i % 34);
      const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
      if (i % 2 === 0) {
        grad.addColorStop(0, 'rgba(155, 224, 82, 0.14)');
        grad.addColorStop(1, 'rgba(155, 224, 82, 0)');
      } else {
        grad.addColorStop(0, 'rgba(34, 92, 24, 0.10)');
        grad.addColorStop(1, 'rgba(34, 92, 24, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle tiny grass blades & delicate warm wildflowers
    for (let i = 0; i < 160; i++) {
      const x = (i * 89 + 17) % 512;
      const y = (i * 149 + 53) % 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(210, 245, 130, 0.14)' : 'rgba(28, 78, 18, 0.10)';
      ctx.fillRect(x, y, 2, 5);

      if (i % 14 === 0) {
        ctx.fillStyle = i % 28 === 0 ? 'rgba(253, 224, 71, 0.72)' : 'rgba(251, 146, 60, 0.65)';
        ctx.beginPath();
        ctx.arc(x + 3, y + 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
  });
}

/**
 * 7. Deep Soft Contact Drop Shadow Texture (濃郁玩具模型落地陰影貼圖)
 */
export function createContactShadowTexture() {
  return getCachedTexture('contact_shadow', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
    grad.addColorStop(0, 'rgba(10, 22, 12, 0.72)');
    grad.addColorStop(0.55, 'rgba(10, 22, 12, 0.42)');
    grad.addColorStop(1, 'rgba(10, 22, 12, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
  });
}
