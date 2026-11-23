import * as THREE from 'three';
import {
  createGlassTowerTexture,
  createRoofTileTexture,
  createBrickFacadeTexture,
  createWoodLatticeTexture,
  createStoneWallTexture
} from './textures.js';

function mat(color, roughness = 0.35, metalness = 0.05) {
  const c = new THREE.Color(color);
  const hexStr = '#' + c.getHexString();
  const hsl = {};
  c.getHSL(hsl);

  let map = null;
  // Red/Terracotta Brick facades (Presidential Office, Wukang Mansion, Xujiahui Cathedral, etc.)
  if (hsl.h >= 0.0 && hsl.h <= 0.06 && hsl.s > 0.45 && hsl.l < 0.62) {
    map = createBrickFacadeTexture(hexStr, '#f8f5ee');
  }
  // Wood & Timber Temple facades (Kiyomizu-dera, Sanjusangendo, Katsura, Xinbeitou Station)
  else if (hsl.h > 0.06 && hsl.h <= 0.11 && hsl.l < 0.55) {
    map = createWoodLatticeTexture(hexStr, '#fff7e6');
  }
  // Glazed Palace & Temple Roofs (Jade green, Royal blue, Dark slate roofs, Golden roofs)
  else if (
    (hsl.h >= 0.42 && hsl.h <= 0.72 && hsl.s > 0.3) ||
    (hsl.l < 0.32) ||
    (metalness > 0.4 && hsl.h >= 0.1 && hsl.h <= 0.16)
  ) {
    const darker = c.clone().multiplyScalar(0.65);
    map = createRoofTileTexture(hexStr, '#' + darker.getHexString());
  }
  // Stone, Marble & Heritage Walls (CKS Memorial Hall, Peace Hotel, 1933 Old Millfun, Palace Base)
  else if (hsl.l >= 0.62 && hsl.s < 0.55) {
    const lineCol = c.clone().multiplyScalar(0.82);
    map = createStoneWallTexture(hexStr, '#' + lineCol.getHexString());
  }

  return new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : color,
    map,
    roughness,
    metalness
  });
}

function glassMat(color) {
  const c = new THREE.Color(color);
  const hexStr = '#' + c.getHexString();
  const mullion = '#' + c.clone().multiplyScalar(0.45).getHexString();
  const map = createGlassTowerTexture(hexStr, mullion);

  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map,
    roughness: 0.14,
    metalness: 0.25,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.96
  });
}

/**
 * Creates a crisp high-contrast floating landmark label sprite (auto-faded by distance in Planet.update)
 */
export function createLandmarkLabel(text, yOffset = 6.5) {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 88;
  const ctx = canvas.getContext('2d');

  // Deep translucent slate pill with warm gold rim for crystal-clear legibility
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.92)';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.roundRect(10, 10, 340, 68, 34);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px "Segoe UI", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 180, 45);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(0, yOffset, 0);
  sprite.scale.set(5.4, 1.32, 1);
  sprite.userData.isLandmarkLabel = true;
  return sprite;
}

// ============================================================================
// 🏙️ 台北 10 大精緻 3D 地標建築 (Taipei Landmarks)
// ============================================================================

export function buildTaipeiLandmarks() {
  const list = [];

  // 1. 台北 101 (Taipei 101 - Iconic Jade-Blue Stacked Bamboo Skyscraper)
  {
    const g = new THREE.Group();
    const jadeGlass = glassMat(0x7ac7c4);
    const frameMat = mat(0x4a8f8c);
    const goldMat = mat(0xeab308, 0.2, 0.6);

    // Podium & Tapered Base
    const podium = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.4, 4.0), frameMat);
    podium.position.y = 0.7;
    g.add(podium);

    const baseTower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.2, 3.6, 4), jadeGlass);
    baseTower.rotation.y = Math.PI / 4;
    baseTower.position.y = 2.5;
    g.add(baseTower);

    // 8 Stacked Bamboo Sections
    for (let i = 0; i < 8; i++) {
      const y = 4.6 + i * 1.35;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.32, 1.32, 4), jadeGlass);
      seg.rotation.y = Math.PI / 4;
      seg.position.y = y;
      seg.castShadow = true;
      g.add(seg);

      const belt = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.14, 2.35), frameMat);
      belt.position.y = y + 0.64;
      g.add(belt);

      // Ruyi cloud medallions on all 4 faces
      [-1, 1].forEach((dir) => {
        const coin1 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16), goldMat);
        coin1.position.set(0, y + 0.35, dir * 1.12);
        g.add(coin1);
      });
    }

    // Spire pedestal & multi-ringed antenna
    const topCap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), jadeGlass);
    topCap.position.y = 15.4;
    g.add(topCap);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.28, 3.8, 12), frameMat);
    spire.position.y = 17.8;
    g.add(spire);

    g.add(createLandmarkLabel('台北 101', 20.6));
    list.push({ name: '台北 101', group: g, radius: 2.8 });
  }

  // 2. 國立故宮博物院 (National Palace Museum - Cream Palace & Imperial Green/Gold Roofs)
  {
    const g = new THREE.Group();
    const wallMat = mat(0xfcf6e5);
    const yellowWall = mat(0xf3d58d);
    const greenRoof = mat(0x2d8a61);
    const goldRidge = mat(0xd99b26, 0.25, 0.5);

    // Grand tiered stone terrace + central staircase
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.0, 4.4), wallMat);
    base1.position.y = 0.5;
    g.add(base1);

    const base2 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 3.4), wallMat);
    base2.position.y = 1.55;
    g.add(base2);

    const stairs = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.6), wallMat);
    stairs.position.set(0, 0.9, 2.2);
    stairs.rotation.x = -0.35;
    g.add(stairs);

    // Main Yellow Palace Hall & Side Wings
    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.6, 2.4), yellowWall);
    mainHall.position.y = 2.9;
    g.add(mainHall);

    // Double-eaved Green Glazed Roof with Gold Ridges
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.0, 4), greenRoof);
    roof1.rotation.y = Math.PI / 4;
    roof1.scale.set(1.3, 1, 0.9);
    roof1.position.y = 4.0;
    g.add(roof1);

    const upperHall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.8), yellowWall);
    upperHall.position.y = 4.4;
    g.add(upperHall);

    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.1, 4), greenRoof);
    roof2.rotation.y = Math.PI / 4;
    roof2.scale.set(1.25, 1, 0.9);
    roof2.position.y = 5.3;
    g.add(roof2);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.18), goldRidge);
    ridge.position.y = 5.82;
    g.add(ridge);

    g.add(createLandmarkLabel('國立故宮博物院', 7.2));
    list.push({ name: '國立故宮博物院', group: g, radius: 3.4 });
  }

  // 3. 總統府 (Presidential Office Building - Red Brick & White Bands + Central Tower)
  {
    const g = new THREE.Group();
    const redBrick = mat(0xc85a48);
    const whiteBand = mat(0xfaf8f5);
    const roofSlate = mat(0x4a5568);

    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.2, 2.2), redBrick);
    mainWing.position.y = 1.1;
    g.add(mainWing);

    // White horizontal decorative bands
    [0.6, 1.2, 1.8].forEach((y) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(5.68, 0.16, 2.26), whiteBand);
      band.position.y = y;
      g.add(band);
    });

    // Iconic Central Tower
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.3, 4.8, 1.3), redBrick);
    tower.position.set(0, 2.4, 0.3);
    g.add(tower);

    const towerBand = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.25, 1.36), whiteBand);
    towerBand.position.set(0, 3.8, 0.3);
    g.add(towerBand);

    const dome = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.2, 8), roofSlate);
    dome.position.set(0, 5.4, 0.3);
    g.add(dome);

    g.add(createLandmarkLabel('總統府', 7.0));
    list.push({ name: '總統府', group: g, radius: 3.0 });
  }

  // 4. 國立中正紀念堂 (Chiang Kai-shek Memorial Hall + White Archway)
  {
    const g = new THREE.Group();
    const marbleMat = mat(0xf8f9fa);
    const royalBlue = mat(0x2563eb);
    const goldMat = mat(0xf59e0b);

    // Tiered Square Base
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.8, 4.6), marbleMat);
    base1.position.y = 0.4;
    g.add(base1);

    const hall = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.0, 2.4, 8), marbleMat);
    hall.position.y = 2.0;
    g.add(hall);

    const stairs = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.8), marbleMat);
    stairs.position.set(0, 0.6, 2.2);
    stairs.rotation.x = -0.4;
    g.add(stairs);

    // Octagonal Blue Glazed Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.1, 8), royalBlue);
    roof.position.y = 4.2;
    g.add(roof);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), goldMat);
    finial.position.y = 5.35;
    g.add(finial);

    g.add(createLandmarkLabel('國立中正紀念堂', 6.8));
    list.push({ name: '國立中正紀念堂', group: g, radius: 2.8 });
  }

  // 5. 艋舺龍山寺 (Lungshan Temple - Ornate Swallowtail Roof & Red Columns)
  {
    const g = new THREE.Group();
    const redMat = mat(0xd62828);
    const goldRoof = mat(0xe09f3e);
    const greenTile = mat(0x2a9d8f);
    const stoneBase = mat(0xd8e2dc);

    const base = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.6, 3.4), stoneBase);
    base.position.y = 0.3;
    g.add(base);

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.8, 2.6), redMat);
    body.position.y = 1.5;
    g.add(body);

    // Curved Swallowtail Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 4), goldRoof);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.25, 1, 0.85);
    roof.position.y = 3.0;
    g.add(roof);

    // Upturned swallowtail ridge horns
    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 6), greenTile);
      horn.position.set(side * 2.1, 3.8, 0);
      horn.rotation.z = -side * 0.6;
      g.add(horn);
    });

    g.add(createLandmarkLabel('艋舺龍山寺', 5.4));
    list.push({ name: '艋舺龍山寺', group: g, radius: 2.6 });
  }

  // 6. 台北表演藝術中心 (Taipei Performing Arts Center - Cube + Protruding Silver Sphere)
  {
    const g = new THREE.Group();
    const cubeMat = glassMat(0xcbd5e1);
    const sphereMat = mat(0xe2e8f0, 0.2, 0.6);

    const mainCube = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 3.2), cubeMat);
    mainCube.position.y = 2.2;
    g.add(mainCube);

    // Famous Protruding Giant Globe Theater
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.55, 24, 24), sphereMat);
    globe.position.set(1.6, 2.6, 0.6);
    g.add(globe);

    g.add(createLandmarkLabel('台北表演藝術中心', 5.6));
    list.push({ name: '台北表演藝術中心', group: g, radius: 2.6 });
  }

  // 7. 陶朱隱園 (Tao Zhu Yin Yuan - Double Helix Twisted Green Residential Tower)
  {
    const g = new THREE.Group();
    const slabMat = mat(0xe2e8f0);
    const glassCore = glassMat(0x94a3b8);
    const treeMat = mat(0x4ade80);

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6.2, 12), glassCore);
    core.position.y = 3.1;
    g.add(core);

    // 12 Twisted Floors (rotating 4.5 deg per floor!)
    for (let i = 0; i < 12; i++) {
      const floorGrp = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 1.5), slabMat);
      floorGrp.add(slab);

      // Balcony shrubs on ends
      [-1.4, 1.4].forEach((x) => {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), treeMat);
        bush.position.set(x, 0.2, 0);
        floorGrp.add(bush);
      });

      floorGrp.position.y = 0.5 + i * 0.48;
      floorGrp.rotation.y = i * 0.14;
      g.add(floorGrp);
    }

    g.add(createLandmarkLabel('陶朱隱園', 7.6));
    list.push({ name: '陶朱隱園', group: g, radius: 2.2 });
  }

  // 8. 台北流行音樂中心 (Taipei Music Center - Crystalline Geometric Peaks)
  {
    const g = new THREE.Group();
    const crystalMat = mat(0x94d2bd, 0.25, 0.3);
    const baseMat = mat(0xe9d8a6);

    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 3.0), baseMat);
    base.position.y = 0.6;
    g.add(base);

    for (let i = 0; i < 3; i++) {
      const peak = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), crystalMat);
      peak.position.set((i - 1) * 1.2, 2.0 + (i === 1 ? 0.5 : 0), 0);
      peak.scale.set(1.0, 1.5, 1.0);
      g.add(peak);
    }

    g.add(createLandmarkLabel('台北流行音樂中心', 5.2));
    list.push({ name: '台北流行音樂中心', group: g, radius: 2.5 });
  }

  // 9. 台北郵局 (Taipei Post Office - Classic Cream-Green Arched Facade)
  {
    const g = new THREE.Group();
    const wallMat = mat(0xd8e2dc);
    const trimMat = mat(0xfefae0);

    const bldg = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.5, 2.6), wallMat);
    bldg.position.y = 1.25;
    g.add(bldg);

    for (let i = -2; i <= 2; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.5, 8), trimMat);
      col.position.set(i * 0.85, 1.25, 1.35);
      g.add(col);
    }

    const pediment = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), trimMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.position.set(0, 2.9, 0.8);
    g.add(pediment);

    g.add(createLandmarkLabel('台北郵局', 4.8));
    list.push({ name: '台北郵局', group: g, radius: 2.4 });
  }

  // 10. 新北投車站 (Xinbeitou Historic Station - Warm Wood & Dormer Windows)
  {
    const g = new THREE.Group();
    const woodMat = mat(0xc68b59);
    const roofMat = mat(0x4a4e69);
    const creamMat = mat(0xfff1e6);

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 2.4), woodMat);
    body.position.y = 0.9;
    g.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.5, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.2, 1, 0.85);
    roof.position.y = 2.5;
    g.add(roof);

    // 3 Cute Dormer Windows (老虎窗)
    [-0.9, 0, 0.9].forEach((x) => {
      const dormer = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.6), creamMat);
      dormer.position.set(x, 2.3, 0.95);
      g.add(dormer);
    });

    g.add(createLandmarkLabel('新北投車站', 4.6));
    list.push({ name: '新北投車站', group: g, radius: 2.2 });
  }

  // 11. 圓山大飯店 (Grand Hotel Taipei - Vermilion Columns & Golden Palace Roof + Archway)
  {
    const g = new THREE.Group();
    const redPalace = mat(0xdc2626);
    const goldRoof = mat(0xf59e0b, 0.25, 0.45);
    const whiteBase = mat(0xf8fafc);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.0, 3.2), whiteBase);
    podium.position.y = 0.5;
    g.add(podium);

    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.8, 2.6), redPalace);
    mainHall.position.y = 2.4;
    g.add(mainHall);

    // Golden Palace Double-Eave Roofs
    const lowerRoof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.1, 4), goldRoof);
    lowerRoof.rotation.y = Math.PI / 4;
    lowerRoof.scale.set(1.25, 1, 0.85);
    lowerRoof.position.y = 4.0;
    g.add(lowerRoof);

    const upperTier = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 2.0), redPalace);
    upperTier.position.y = 4.7;
    g.add(upperTier);

    const topRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.3, 4), goldRoof);
    topRoof.rotation.y = Math.PI / 4;
    topRoof.scale.set(1.25, 1, 0.85);
    topRoof.position.y = 5.8;
    g.add(topRoof);

    g.add(createLandmarkLabel('圓山大飯店', 7.4));
    list.push({ name: '圓山大飯店', group: g, radius: 2.8 });
  }

  // 12. 西門紅樓 (The Red House Ximending - Historic Red-Brick Octagon Building)
  {
    const g = new THREE.Group();
    const brickMat = mat(0xc2410c);
    const whiteBand = mat(0xf8fafc);
    const roofSlate = mat(0x334155);

    // Iconic Octagonal Tower (八角堂)
    const octagon = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 2.5, 8), brickMat);
    octagon.position.y = 1.25;
    g.add(octagon);

    // White Horizontal Stone Bands (紅磚白帶)
    [0.8, 1.6, 2.3].forEach((y) => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.16, 8), whiteBand);
      band.position.y = y;
      g.add(band);
    });

    const octRoof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.3, 8), roofSlate);
    octRoof.position.y = 3.15;
    g.add(octRoof);

    const entrancePediment = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 0.8), brickMat);
    entrancePediment.position.set(0, 0.9, 1.75);
    g.add(entrancePediment);

    g.add(createLandmarkLabel('西門紅樓', 5.0));
    list.push({ name: '西門紅樓', group: g, radius: 2.3 });
  }

  // 13. 美麗華摩天輪 (Miramar Ferris Wheel - Giant Neon Emerald Ferris Wheel)
  {
    const g = new THREE.Group();
    const neonGreen = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.45,
      roughness: 0.25
    });
    const steelMat = mat(0xe2e8f0, 0.3, 0.4);
    const mallMat = mat(0xfef3c7);

    // Mall base
    const mall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.4, 2.4), mallMat);
    mall.position.y = 0.7;
    g.add(mall);

    // A-Frame Support Legs
    [-0.55, 0.55].forEach((z) => {
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.8, 8), steelMat);
      leg1.position.set(-0.7, 2.8, z);
      leg1.rotation.z = -0.22;
      g.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.8, 8), steelMat);
      leg2.position.set(0.7, 2.8, z);
      leg2.rotation.z = 0.22;
      g.add(leg2);
    });

    // Giant Emerald Wheel Rim & Cabins
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 12, 32), neonGreen);
    wheelRim.position.y = 4.6;
    g.add(wheelRim);

    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 10, 24), neonGreen);
    innerRim.position.y = 4.6;
    g.add(innerRim);

    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const cab = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), neonGreen);
      cab.position.set(Math.cos(ang) * 2.3, 4.6 + Math.sin(ang) * 2.3, 0);
      g.add(cab);
    }

    g.add(createLandmarkLabel('美麗華摩天輪', 7.8));
    list.push({ name: '美麗華摩天輪', group: g, radius: 2.6 });
  }

  return list;
}

// ============================================================================
// ⛩️ 京都 10 大精緻 3D 地標建築 (Kyoto Landmarks)
// ============================================================================

export function buildKyotoLandmarks() {
  const list = [];

  // 1. 金閣寺 (Kinkaku-ji - 3-Story Gold Leaf Pavilion + Reflective Mirror Pond!)
  {
    const g = new THREE.Group();
    const goldMat = mat(0xfbbf24, 0.18, 0.65);
    const woodMat = mat(0x6b4423);
    const roofMat = mat(0x4a3b32);
    const pondMat = glassMat(0xa5f3fc);

    // Reflective Mirror Pond at base
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.25, 24), pondMat);
    pond.position.set(0.8, 0.12, 1.2);
    g.add(pond);

    // 1st Floor (Shinden-zukuri wood & white plaster)
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 2.8), woodMat);
    f1.position.y = 0.75;
    g.add(f1);

    const r1 = new THREE.Mesh(new THREE.ConeGeometry(3.1, 0.8, 4), roofMat);
    r1.rotation.y = Math.PI / 4;
    r1.position.y = 1.7;
    g.add(r1);

    // 2nd Floor (Pure Gold Leaf!)
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.2, 2.3), goldMat);
    f2.position.y = 2.4;
    g.add(f2);

    const r2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 0.8, 4), roofMat);
    r2.rotation.y = Math.PI / 4;
    r2.position.y = 3.3;
    g.add(r2);

    // 3rd Floor (Pure Gold Leaf + Pyramid Roof + Golden Phoenix!)
    const f3 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.9), goldMat);
    f3.position.y = 4.0;
    g.add(f3);

    const r3 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.1, 4), roofMat);
    r3.rotation.y = Math.PI / 4;
    r3.position.y = 4.95;
    g.add(r3);

    const phoenix = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), goldMat);
    phoenix.position.y = 5.75;
    g.add(phoenix);

    g.add(createLandmarkLabel('金閣寺', 7.2));
    list.push({ name: '金閣寺', group: g, radius: 3.4 });
  }

  // 2. 清水寺 (Kiyomizu-dera - Wooden Stage Supported by Tall Pillars)
  {
    const g = new THREE.Group();
    const woodMat = mat(0x7c4728);
    const roofMat = mat(0x3d352e);

    // Tall wooden stilts (清水舞台木柱)
    for (let x = -1.6; x <= 1.6; x += 0.8) {
      for (let z = -0.8; z <= 1.2; z += 1.0) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), woodMat);
        pillar.position.set(x, 1.2, z);
        g.add(pillar);
      }
    }

    const stageDeck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 3.2), woodMat);
    stageDeck.position.y = 2.4;
    g.add(stageDeck);

    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 2.2), woodMat);
    mainHall.position.set(0, 3.3, -0.3);
    g.add(mainHall);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.2, 1, 0.85);
    roof.position.set(0, 4.7, -0.3);
    g.add(roof);

    g.add(createLandmarkLabel('清水寺', 6.8));
    list.push({ name: '清水寺', group: g, radius: 2.8 });
  }

  // 3. 伏見稻荷大社 (Fushimi Inari Taisha - Curved Senbon Torii Gate Tunnel & Foxes)
  {
    const g = new THREE.Group();
    const vermilion = mat(0xe63946);
    const blackBase = mat(0x1f2937);

    // Row of 5 Torii Gates forming an iconic pathway!
    for (let i = 0; i < 5; i++) {
      const gate = new THREE.Group();
      [-1.0, 1.0].forEach((side) => {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.5, 8), blackBase);
        foot.position.set(side, 0.25, 0);
        gate.add(foot);

        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 2.5, 8), vermilion);
        col.position.set(side, 1.5, 0);
        gate.add(col);
      });

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.28, 0.35), vermilion);
      topBar.position.y = 2.8;
      gate.add(topBar);

      const subBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.25), vermilion);
      subBar.position.y = 2.25;
      gate.add(subBar);

      gate.position.set(Math.sin(i * 0.3) * 0.6, 0, (i - 2) * 0.95);
      gate.rotation.y = i * 0.12;
      g.add(gate);
    }

    g.add(createLandmarkLabel('伏見稻荷大社', 4.8));
    list.push({ name: '伏見稻荷大社', group: g, radius: 2.8 });
  }

  // 4. 銀閣寺 (Ginkaku-ji - Dark Wood Pavilion & Silver Sand Cone)
  {
    const g = new THREE.Group();
    const darkWood = mat(0x4a3525);
    const sandMat = mat(0xf1f5f9);

    const f1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 2.4), darkWood);
    f1.position.y = 0.7;
    g.add(f1);

    const r1 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 0.9, 4), darkWood);
    r1.rotation.y = Math.PI / 4;
    r1.position.y = 1.75;
    g.add(r1);

    const f2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 1.9), darkWood);
    f2.position.y = 2.5;
    g.add(f2);

    const r2 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.1, 4), darkWood);
    r2.rotation.y = Math.PI / 4;
    r2.position.y = 3.5;
    g.add(r2);

    // Iconic Silver Sand Cone (向月台)
    const sandCone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 16), sandMat);
    sandCone.position.set(1.8, 0.55, 1.4);
    g.add(sandCone);

    g.add(createLandmarkLabel('銀閣寺', 5.4));
    list.push({ name: '銀閣寺', group: g, radius: 2.5 });
  }

  // 5. 二条城 (Nijo Castle - White Castle Walls, Stone Base & Karamon Gate)
  {
    const g = new THREE.Group();
    const stoneMat = mat(0x94a3b8);
    const whiteWall = mat(0xf8fafc);
    const tileRoof = mat(0x334155);

    const stoneWall = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.2, 4), stoneMat);
    stoneWall.rotation.y = Math.PI / 4;
    stoneWall.position.y = 0.6;
    g.add(stoneWall);

    const castleKeep = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2.4), whiteWall);
    castleKeep.position.y = 2.0;
    g.add(castleKeep);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.3, 4), tileRoof);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.2, 1, 0.9);
    roof.position.y = 3.3;
    g.add(roof);

    g.add(createLandmarkLabel('二条城', 5.2));
    list.push({ name: '二条城', group: g, radius: 2.8 });
  }

  // 6. 京都車站大樓 (Kyoto Station - Modern Glass & Steel Concourse)
  {
    const g = new THREE.Group();
    const steelMat = glassMat(0x93c5fd);
    const frameMat = mat(0x475569);

    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 2.2), steelMat);
    leftWing.position.set(-1.4, 1.4, 0);
    g.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 2.2), steelMat);
    rightWing.position.set(1.4, 1.4, 0);
    g.add(rightWing);

    const skyRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 2.4), frameMat);
    skyRoof.position.y = 2.95;
    g.add(skyRoof);

    g.add(createLandmarkLabel('京都車站大樓', 4.8));
    list.push({ name: '京都車站大樓', group: g, radius: 2.6 });
  }

  // 7. 三十三間堂 (Sanjusangendo - Extra Long Traditional Wooden Hall)
  {
    const g = new THREE.Group();
    const woodMat = mat(0x78350f);
    const roofMat = mat(0x3f3f46);

    const longHall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.4, 1.8), woodMat);
    longHall.position.y = 0.7;
    g.add(longHall);

    const longRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.2, 4), roofMat);
    longRoof.rotation.y = Math.PI / 4;
    longRoof.scale.set(1.55, 1, 0.65);
    longRoof.position.y = 1.9;
    g.add(longRoof);

    g.add(createLandmarkLabel('三十三間堂', 4.2));
    list.push({ name: '三十三間堂', group: g, radius: 2.8 });
  }

  // 8. 龍安寺 (Ryoan-ji - Karesansui Zen Rock Garden)
  {
    const g = new THREE.Group();
    const gravelMat = mat(0xf1f5f9);
    const rockMat = mat(0x475569);
    const woodMat = mat(0x7c4728);

    const gardenBed = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 2.8), gravelMat);
    gardenBed.position.y = 0.15;
    g.add(gardenBed);

    const veranda = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 1.2), woodMat);
    veranda.position.set(0, 0.6, -1.2);
    g.add(veranda);

    // Zen Rocks on white gravel
    [
      [-1.2, 0.4],
      [-0.3, -0.2],
      [0.6, 0.5],
      [1.3, -0.1]
    ].forEach(([x, z]) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), rockMat);
      rock.position.set(x, 0.4, z);
      g.add(rock);
    });

    g.add(createLandmarkLabel('龍安寺', 3.8));
    list.push({ name: '龍安寺', group: g, radius: 2.4 });
  }

  // 9. 平安神宮 (Heian Jingu - Vermilion Columns & Emerald Green Roof)
  {
    const g = new THREE.Group();
    const vermilion = mat(0xdc2626);
    const greenRoof = mat(0x059669);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.8, 2.2), vermilion);
    hall.position.y = 0.9;
    g.add(hall);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.3, 4), greenRoof);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.25, 1, 0.85);
    roof.position.y = 2.4;
    g.add(roof);

    g.add(createLandmarkLabel('平安神宮', 4.6));
    list.push({ name: '平安神宮', group: g, radius: 2.5 });
  }

  // 10. 桂離宮 (Katsura Imperial Villa - Stepped Shoin Pavilions & Pond)
  {
    const g = new THREE.Group();
    const creamWall = mat(0xfef3c7);
    const barkRoof = mat(0x57534e);

    const p1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2.0), creamWall);
    p1.position.set(-0.7, 0.65, 0.4);
    g.add(p1);

    const r1 = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 4), barkRoof);
    r1.rotation.y = Math.PI / 4;
    r1.position.set(-0.7, 1.65, 0.4);
    g.add(r1);

    const p2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.0), creamWall);
    p2.position.set(0.8, 0.75, -0.4);
    g.add(p2);

    const r2 = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.0, 4), barkRoof);
    r2.rotation.y = Math.PI / 4;
    r2.position.set(0.8, 1.85, -0.4);
    g.add(r2);

    g.add(createLandmarkLabel('桂離宮', 4.2));
    list.push({ name: '桂離宮', group: g, radius: 2.4 });
  }

  // 11. 京都塔 (Kyoto Tower - Iconic Red & White Lighthouse-Style Observation Tower)
  {
    const g = new THREE.Group();
    const whiteMat = mat(0xf8fafc, 0.25, 0.2);
    const redMat = mat(0xe63946, 0.25, 0.2);

    // Base Building
    const baseBldg = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.6), whiteMat);
    baseBldg.position.y = 1.1;
    g.add(baseBldg);

    // Red-Ringed Base Support
    const redBase = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 1.6, 16), redMat);
    redBase.position.y = 2.9;
    g.add(redBase);

    // Tapered White Lighthouse Shaft
    const whiteShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 4.6, 20), whiteMat);
    whiteShaft.position.y = 5.9;
    g.add(whiteShaft);

    // Red Observation Deck & Spire
    const obsDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.72, 0.95, 20), redMat);
    obsDeck.position.y = 8.4;
    g.add(obsDeck);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 2.4, 10), redMat);
    spire.position.y = 10.0;
    g.add(spire);

    g.add(createLandmarkLabel('京都塔', 11.8));
    list.push({ name: '京都塔', group: g, radius: 2.4 });
  }

  // 12. 嵐山渡月橋 (Arashiyama Togetsukyo Bridge - Wooden Bridge over Katsura River)
  {
    const g = new THREE.Group();
    const woodMat = mat(0xa16207);
    const waterMat = glassMat(0x38bdf8);
    const sakuraMat = mat(0xf472b6);

    // Katsura River Base
    const river = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 3.4), waterMat);
    river.position.y = 0.14;
    g.add(river);

    // Bridge Piers (木造橋墩)
    for (let x = -1.6; x <= 1.6; x += 0.8) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 1.2), woodMat);
      pier.position.set(x, 0.6, 0);
      g.add(pier);
    }

    // Arched Wooden Deck & Railings
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 1.4), woodMat);
    deck.position.y = 1.25;
    g.add(deck);

    [-0.62, 0.62].forEach((z) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 0.12), woodMat);
      rail.position.set(0, 1.5, z);
      g.add(rail);
    });

    // Cherry Blossom Trees on Riverbank
    [-1.7, 1.7].forEach((x) => {
      const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 12), sakuraMat);
      blossom.position.set(x, 1.6, -1.2);
      g.add(blossom);
    });

    g.add(createLandmarkLabel('嵐山渡月橋', 4.2));
    list.push({ name: '嵐山渡月橋', group: g, radius: 2.6 });
  }

  // 13. 八坂神社 (Yasaka Shrine - Gion Vermilion Gate & Glowing Lantern Stage)
  {
    const g = new THREE.Group();
    const vermilion = mat(0xdc2626);
    const darkRoof = mat(0x27272a);
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });

    // Dance Stage (舞殿) with rows of glowing white lanterns!
    const stageBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 2.6), vermilion);
    stageBase.position.y = 0.9;
    g.add(stageBase);

    for (let x = -1.4; x <= 1.4; x += 0.4) {
      for (let z of [-1.32, 1.32]) {
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lanternMat);
        lantern.position.set(x, 1.45, z);
        g.add(lantern);
      }
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.5, 4), darkRoof);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.2, 1, 0.9);
    roof.position.y = 2.5;
    g.add(roof);

    g.add(createLandmarkLabel('八坂神社', 4.6));
    list.push({ name: '八坂神社', group: g, radius: 2.5 });
  }

  return list;
}

// ============================================================================
// 🥮 上海 10 大精緻 3D 地標建築 (Shanghai Landmarks)
// ============================================================================

export function buildShanghaiLandmarks() {
  const list = [];

  // 1. 東方明珠廣播電視塔 (Oriental Pearl Tower - Tripod Legs + Pink Spheres + Rings)
  {
    const g = new THREE.Group();
    const silverMat = mat(0xf1f5f9, 0.25, 0.3);
    const pinkPearl = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6,
      roughness: 0.15,
      metalness: 0.1,
      clearcoat: 1.0
    });

    // 3 Angled Tripod Support Columns
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 4.2, 10), silverMat);
      leg.position.set(Math.cos(angle) * 1.1, 1.8, Math.sin(angle) * 1.1);
      leg.rotation.z = Math.cos(angle) * 0.35;
      leg.rotation.x = -Math.sin(angle) * 0.35;
      g.add(leg);
    }

    // Central Trio Shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 11.5, 12), silverMat);
    shaft.position.y = 6.2;
    g.add(shaft);

    // Lower Giant Pink Sphere + Silver Observation Ring
    const lowerSphere = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 24), pinkPearl);
    lowerSphere.position.y = 4.2;
    g.add(lowerSphere);

    const lowerRing = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.15, 10, 28), silverMat);
    lowerRing.rotation.x = Math.PI / 2;
    lowerRing.position.y = 4.2;
    g.add(lowerRing);

    // Upper Medium Pink Sphere
    const upperSphere = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 20), pinkPearl);
    upperSphere.position.y = 9.2;
    g.add(upperSphere);

    // Space Capsule & Tall Antenna Spire
    const topSphere = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 14), pinkPearl);
    topSphere.position.y = 12.2;
    g.add(topSphere);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 3.6, 8), silverMat);
    spire.position.y = 14.3;
    g.add(spire);

    g.add(createLandmarkLabel('東方明珠廣播電視塔', 17.2));
    list.push({ name: '東方明珠廣播電視塔', group: g, radius: 2.8 });
  }

  // 2. 上海中心大廈 (Shanghai Tower - 120° Twisted Spiral Glass Supertall)
  {
    const g = new THREE.Group();
    const skyGlass = glassMat(0xbae6fd);
    const ringMat = mat(0xe2e8f0);

    // 14 Spiraling Asymmetric Segments
    for (let i = 0; i < 14; i++) {
      const t = i / 14;
      const radius = 1.85 * (1 - t * 0.42);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.96, radius, 1.05, 6), skyGlass);
      seg.position.y = 0.6 + i * 1.02;
      seg.rotation.y = i * 0.18;
      g.add(seg);

      const belt = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 6, 18), ringMat);
      belt.rotation.x = Math.PI / 2;
      belt.position.y = 1.1 + i * 1.02;
      g.add(belt);
    }

    g.add(createLandmarkLabel('上海中心大廈', 16.2));
    list.push({ name: '上海中心大廈', group: g, radius: 2.6 });
  }

  // 3. 上海環球金融中心 (SWFC - Sleek Blue Glass "Bottle Opener" Tower)
  {
    const g = new THREE.Group();
    const blueGlass = glassMat(0x60a5fa);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9.5, 1.6), blueGlass);
    body.position.y = 4.75;
    g.add(body);

    // Trapezoidal Bottle-Opener Top Aperture
    [-0.85, 0.85].forEach((side) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.8, 1.6), blueGlass);
      col.position.set(side, 10.9, 0);
      g.add(col);
    });

    const skyBridge = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.6), blueGlass);
    skyBridge.position.y = 12.5;
    g.add(skyBridge);

    g.add(createLandmarkLabel('上海環球金融中心', 14.5));
    list.push({ name: '上海環球金融中心', group: g, radius: 2.4 });
  }

  // 4. 金茂大廈 (Jin Mao Tower - Neo-Pagoda Stepped Silver Skyscraper)
  {
    const g = new THREE.Group();
    const silverGlass = glassMat(0x94a3b8);
    const goldSpire = mat(0xfbbf24);

    for (let i = 0; i < 8; i++) {
      const w = 2.4 - i * 0.2;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(w, 1.25, w), silverGlass);
      tier.position.y = 0.65 + i * 1.2;
      g.add(tier);
    }

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.35, 2.2, 8), goldSpire);
    spire.position.y = 10.8;
    g.add(spire);

    g.add(createLandmarkLabel('金茂大廈', 12.8));
    list.push({ name: '金茂大廈', group: g, radius: 2.4 });
  }

  // 5. 和平飯店 (Peace Hotel - Bund Art Deco Stone Facade + Green Copper Pyramid Roof)
  {
    const g = new THREE.Group();
    const sandStone = mat(0xf3e5ab);
    const copperGreen = mat(0x10b981);

    const bldg = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 2.8), sandStone);
    bldg.position.y = 1.8;
    g.add(bldg);

    const pyramidRoof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.0, 4), copperGreen);
    pyramidRoof.rotation.y = Math.PI / 4;
    pyramidRoof.position.set(0, 4.6, 0.6);
    g.add(pyramidRoof);

    g.add(createLandmarkLabel('和平飯店', 6.6));
    list.push({ name: '和平飯店', group: g, radius: 2.6 });
  }

  // 6. 武康大樓 (Wukang Mansion - Flatiron Wedge Terracotta Building)
  {
    const g = new THREE.Group();
    const brickMat = mat(0xe07a5f);
    const creamBase = mat(0xf4f1de);

    // 30-degree wedge flatiron prism
    const wedgeGeo = new THREE.CylinderGeometry(2.2, 2.2, 3.4, 3);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.9, 3), creamBase);
    base.position.y = 0.45;
    g.add(base);

    const upper = new THREE.Mesh(wedgeGeo, brickMat);
    upper.position.y = 2.15;
    g.add(upper);

    g.add(createLandmarkLabel('武康大樓', 5.2));
    list.push({ name: '武康大樓', group: g, radius: 2.4 });
  }

  // 7. 豫園 (Yu Garden + Nine-Turn Zigzag Bridge over Lotus Pond!)
  {
    const g = new THREE.Group();
    const redWood = mat(0xb91c1c);
    const darkTile = mat(0x1f2937);
    const whiteRail = mat(0xf8fafc);
    const pondMat = glassMat(0x67e8f9);

    // Lotus Pond
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.25, 24), pondMat);
    pond.position.set(0, 0.12, 1.0);
    g.add(pond);

    // Classical Jiangnan Pavilion (湖心亭)
    const pav = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.2), redWood);
    pav.position.set(0, 0.9, -0.8);
    g.add(pav);

    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.0, 4), darkTile);
    roof1.rotation.y = Math.PI / 4;
    roof1.position.set(0, 2.1, -0.8);
    g.add(roof1);

    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.0, 4), darkTile);
    roof2.rotation.y = Math.PI / 4;
    roof2.position.set(0, 3.1, -0.8);
    g.add(roof2);

    // Nine-Turn Zigzag Bridge (九曲橋)
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.5), whiteRail);
      seg.position.set((i % 2 === 0 ? -0.4 : 0.4), 0.35, 0.5 + i * 0.75);
      seg.rotation.y = i % 2 === 0 ? 0.5 : -0.5;
      g.add(seg);
    }

    g.add(createLandmarkLabel('豫園・九曲橋', 5.0));
    list.push({ name: '豫園', group: g, radius: 3.0 });
  }

  // 8. 石庫門建築 (Shikumen - Grey & Red Brick Lane Houses with Stone Archways)
  {
    const g = new THREE.Group();
    const greyBrick = mat(0x64748b);
    const redBrick = mat(0xd97706);
    const stoneArch = mat(0xe2e8f0);

    [-1.1, 1.1].forEach((x) => {
      const house = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 2.0), greyBrick);
      house.position.set(x, 1.1, 0);
      g.add(house);

      const band = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.3, 2.05), redBrick);
      band.position.set(x, 1.4, 0);
      g.add(band);

      const gate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.25), stoneArch);
      gate.position.set(x, 0.6, 1.02);
      g.add(gate);
    });

    g.add(createLandmarkLabel('石庫門建築', 4.2));
    list.push({ name: '石庫門建築', group: g, radius: 2.4 });
  }

  // 9. 徐家匯天主堂 (St. Ignatius Cathedral - Twin Gothic Red-Brick Spires)
  {
    const g = new THREE.Group();
    const brickMat = mat(0xb91c1c);
    const spireMat = mat(0x334155);
    const windowMat = mat(0xfef08a);

    const nave = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 3.6), brickMat);
    nave.position.y = 1.3;
    g.add(nave);

    // Twin Bell Towers & Pointed Spires
    [-0.95, 0.95].forEach((x) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.0, 0.9), brickMat);
      tower.position.set(x, 2.0, 1.5);
      g.add(tower);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.4, 4), spireMat);
      spire.rotation.y = Math.PI / 4;
      spire.position.set(x, 5.2, 1.5);
      g.add(spire);
    });

    // Rose Window
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 16), windowMat);
    rose.rotation.x = Math.PI / 2;
    rose.position.set(0, 2.0, 1.82);
    g.add(rose);

    g.add(createLandmarkLabel('徐家匯天主堂', 7.4));
    list.push({ name: '徐家匯天主堂', group: g, radius: 2.6 });
  }

  // 10. 1933 老場坊 (1933 Old Millfun - Concrete Rotunda & Criss-Crossing Bridges)
  {
    const g = new THREE.Group();
    const concreteMat = mat(0x94a3b8);
    const innerMat = mat(0xcbd5e1);

    const outerShell = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), concreteMat);
    outerShell.position.y = 1.3;
    g.add(outerShell);

    const centralCore = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.1, 16), innerMat);
    centralCore.position.y = 1.55;
    g.add(centralCore);

    g.add(createLandmarkLabel('1933 老場坊', 4.6));
    list.push({ name: '1933 老場坊', group: g, radius: 2.4 });
  }

  // 11. 外白渡橋 (Waibaidu Bridge - Historic Steel Truss Bridge over Suzhou Creek)
  {
    const g = new THREE.Group();
    const steelMat = mat(0x94a3b8, 0.3, 0.55);
    const waterMat = glassMat(0x38bdf8);

    const creek = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.25, 2.8), waterMat);
    creek.position.y = 0.12;
    g.add(creek);

    const roadDeck = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.28, 1.6), steelMat);
    roadDeck.position.y = 0.85;
    g.add(roadDeck);

    // Twin Parabolic Steel Truss Arches
    [-1.15, 1.15].forEach((cx) => {
      [-0.75, 0.75].forEach((z) => {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(1.1, 0.1, 8, 16, Math.PI),
          steelMat
        );
        arch.position.set(cx, 0.9, z);
        g.add(arch);
      });
    });

    g.add(createLandmarkLabel('外白渡橋', 4.2));
    list.push({ name: '外白渡橋', group: g, radius: 2.6 });
  }

  // 12. 中華藝術宮 (China Art Museum - Iconic Red "Oriental Crown" Inverted Pyramid)
  {
    const g = new THREE.Group();
    const chinaRed = mat(0xdc2626);
    const podiumMat = mat(0xe2e8f0);

    // 4 Corner Support Pillars
    [
      [-1.1, -1.1],
      [1.1, -1.1],
      [-1.1, 1.1],
      [1.1, 1.1]
    ].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.6, 0.65), chinaRed);
      col.position.set(x, 1.8, z);
      g.add(col);
    });

    // Stepped Inverted Pyramid Tiers (東方之冠層疊斗拱)
    for (let i = 0; i < 4; i++) {
      const w = 2.6 + i * 0.55;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(w, 0.48, w), chinaRed);
      tier.position.y = 2.0 + i * 0.62;
      g.add(tier);
    }

    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.5, 3.8), podiumMat);
    basePlinth.position.y = 0.25;
    g.add(basePlinth);

    g.add(createLandmarkLabel('中華藝術宮', 5.8));
    list.push({ name: '中華藝術宮', group: g, radius: 2.7 });
  }

  // 13. 靜安寺 (Jing'an Temple - Dazzling Pure Gold Roofs & Diamond Stupa Pagoda)
  {
    const g = new THREE.Group();
    const pureGold = mat(0xfbbf24, 0.15, 0.75);
    const templeWall = mat(0x78350f);

    const courtyard = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.4, 3.2), templeWall);
    courtyard.position.y = 0.7;
    g.add(courtyard);

    // Golden Main Hall Roof
    const mainGoldRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.4, 4), pureGold);
    mainGoldRoof.rotation.y = Math.PI / 4;
    mainGoldRoof.scale.set(1.2, 1, 0.9);
    mainGoldRoof.position.set(0, 2.1, -0.3);
    g.add(mainGoldRoof);

    // Tall Golden Stupa Pagoda (金剛寶座塔)
    const stupaBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1.5), templeWall);
    stupaBase.position.set(0, 2.2, 0.7);
    g.add(stupaBase);

    const goldSpire = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.4, 8), pureGold);
    goldSpire.position.set(0, 4.4, 0.7);
    g.add(goldSpire);

    g.add(createLandmarkLabel('靜安寺', 6.8));
    list.push({ name: '靜安寺', group: g, radius: 2.6 });
  }

  return list;
}
