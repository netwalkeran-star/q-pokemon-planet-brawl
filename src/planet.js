import * as THREE from 'three';
import {
  buildTaipeiLandmarks,
  buildKyotoLandmarks,
  buildShanghaiLandmarks
} from './landmarks.js';
import {
  createStorybookGrassTexture,
  createCliffSideTexture,
  createAsphaltRoadTexture,
  createStoneWallTexture,
  createContactShadowTexture
} from './textures.js';

export class Planet {
  constructor(scene, stage = 1) {
    this.scene = scene;
    this.stage = stage;
    this.radius = 48; // 1.5x Large Toy-Box Diorama Planet
    this.meshGroup = new THREE.Group();
    this.cloudsGroup = new THREE.Group();
    this.boats = [];
    this.decorations = [];
    this.obstacles = [];
    this.landmarkCheckpoints = [];

    this.initPlanet();
    this.scene.add(this.meshGroup);
    this.scene.add(this.cloudsGroup);
  }

  getStageTheme(stage) {
    if (stage === 1) {
      return {
        name: '第 1 關：台北小行星 (Taipei City)',
        cityKey: 'taipei',
        groundColor: 0x62a630, // Overcooked rich toy-grass green
        waterColor: 0x1e64bd,  // Overcooked deep cobalt-azure water
        foamColor: 0x7cb2f0,
        plateauTopA: 0x6b4b34, // Earthy cocoa plateau top
        plateauTopB: 0x354a3e  // Dark pine-slate plateau top
      };
    } else if (stage === 2) {
      return {
        name: '第 2 關：⛩️ 京都小行星 (Kyoto City)',
        cityKey: 'kyoto',
        groundColor: 0x5d9e2e,
        waterColor: 0x1e64bd,
        foamColor: 0x7cb2f0,
        plateauTopA: 0x704d32,
        plateauTopB: 0x384d40
      };
    } else {
      return {
        name: '第 3 關：🥮 上海小行星 (Shanghai City)',
        cityKey: 'shanghai',
        groundColor: 0x599a2d,
        waterColor: 0x1e64bd,
        foamColor: 0x7cb2f0,
        plateauTopA: 0x684933,
        plateauTopB: 0x32463b
      };
    }
  }

  initPlanet() {
    while (this.meshGroup.children.length > 0) {
      this.meshGroup.remove(this.meshGroup.children[0]);
    }
    while (this.cloudsGroup.children.length > 0) {
      this.cloudsGroup.remove(this.cloudsGroup.children[0]);
    }
    this.boats = [];
    this.decorations = [];
    this.obstacles = [];
    this.landmarkCheckpoints = [];

    const theme = this.getStageTheme(this.stage);

    // 1. Base Spherical Toy-Box Grass Terrain (smooth matte-satin finish)
    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
    const grassHex = '#' + new THREE.Color(theme.groundColor).getHexString();
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createStorybookGrassTexture(grassHex),
      roughness: 0.72,
      metalness: 0.02
    });

    this.planetMesh = new THREE.Mesh(geometry, planetMat);
    this.planetMesh.receiveShadow = true;
    this.meshGroup.add(this.planetMesh);

    // 2. Overcooked-Style Asphalt Roads with White Dashed Lines & Toy Houses (柏油馬路 + 白虛線 + 玩具屋)
    this.spawnOvercookedRoadsAndToyHouses(theme);

    // 3. Deep Cobalt Rivers, Lakes & Wooden Log Sail Rafts (深藍湖泊與木筏帆船)
    this.spawnRiversAndLakes(theme);

    // 4. Overcooked-Style Stepped Cliff Plateaus with Ochre Soil Stripes & Pebbles (階梯斷層高地與岩石群)
    this.spawnTerracedPlateaus(theme);

    // 5. All 10 Iconic 3D Landmarks per City (10 大精緻地標建築)
    this.spawnCityLandmarks(theme);

    // 6. Overcooked-Style 3-Tier Pine Trees, Berry-Pink Puff Trees & Rock Clusters
    this.spawnStorybookFoliage(theme);

    // 7. Fluffy Toy-Box Billowing Clouds
    this.spawnFloatingClouds();
  }

  /**
   * Overcooked-style curved asphalt roads with raised curbs, white dashed center lines,
   * stage flags, and chunky toy buildings with rooftop AC vents!
   */
  spawnOvercookedRoadsAndToyHouses(theme) {
    const roadTex = createAsphaltRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      roughness: 0.8,
      metalness: 0.05
    });

    const rings = [
      { axis: new THREE.Vector3(1, 0.25, 0.15).normalize(), steps: 64 },
      { axis: new THREE.Vector3(0.15, 1, 0.35).normalize(), steps: 64 },
      { axis: new THREE.Vector3(0.25, 0.35, 1).normalize(), steps: 64 }
    ];

    rings.forEach((ring, rIdx) => {
      const tempVec =
        Math.abs(ring.axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const u = new THREE.Vector3().crossVectors(ring.axis, tempVec).normalize();
      const v = new THREE.Vector3().crossVectors(ring.axis, u).normalize();

      for (let i = 0; i < ring.steps; i++) {
        const angle = (i / ring.steps) * Math.PI * 2;
        const nextAngle = ((i + 1) / ring.steps) * Math.PI * 2;
        const meander = Math.sin(angle * 4) * 0.05;
        const nextMeander = Math.sin(nextAngle * 4) * 0.05;

        const dir = u
          .clone()
          .multiplyScalar(Math.cos(angle))
          .add(v.clone().multiplyScalar(Math.sin(angle)))
          .add(ring.axis.clone().multiplyScalar(meander))
          .normalize();

        const nextDir = u
          .clone()
          .multiplyScalar(Math.cos(nextAngle))
          .add(v.clone().multiplyScalar(Math.sin(nextAngle)))
          .add(ring.axis.clone().multiplyScalar(nextMeander))
          .normalize();

        const pos = dir.clone().multiplyScalar(this.radius + 0.08);
        const tangent = nextDir.clone().sub(dir).normalize();
        const right = new THREE.Vector3().crossVectors(dir, tangent).normalize();
        const forward = new THREE.Vector3().crossVectors(right, dir).normalize();

        const segMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 5.2), roadMat);
        segMesh.receiveShadow = true;
        segMesh.position.copy(pos);
        const rotMat = new THREE.Matrix4().makeBasis(right, dir, forward);
        segMesh.quaternion.setFromRotationMatrix(rotMat);
        this.meshGroup.add(segMesh);

        // Place cute Overcooked Stage Pennant Flags & Toy Houses beside the road at intervals!
        if (i % 16 === 0) {
          const sidePos = pos.clone().add(right.clone().multiplyScalar(3.2));
          const sideNormal = sidePos.clone().normalize();
          const flag = this.createOvercookedFlag(`${this.stage}-${(i / 16) + 1 + rIdx * 2}`);
          this.orientToSphere(flag, sidePos.normalize().multiplyScalar(this.radius + 0.05), sideNormal);
          this.meshGroup.add(flag);
        } else if (i % 16 === 8) {
          const housePos = pos.clone().add(right.clone().multiplyScalar(-4.2));
          const houseNormal = housePos.clone().normalize();
          const toyHouse = this.createOvercookedToyBuilding(i % 32 === 8 ? 0x2ec4b6 : 0xe07a3c);
          this.orientToSphere(
            toyHouse,
            housePos.normalize().multiplyScalar(this.radius + 0.05),
            houseNormal
          );
          this.meshGroup.add(toyHouse);
        }
      }
    });
  }

  /**
   * Cute chunky toy building with thick white roof molding & rooftop AC fan units
   * (Exact match to the cyan & orange buildings in the Overcooked screenshot!)
   */
  createOvercookedToyBuilding(wallHex = 0x2ec4b6) {
    const g = new THREE.Group();
    const cStr = '#' + new THREE.Color(wallHex).getHexString();
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createStoneWallTexture(cStr, '#e8eef2'),
      roughness: 0.55
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xdce4ec, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });

    // Chunky body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.3, 2.4), wallMat);
    body.position.y = 1.15;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Thick overhanging toy roof slab
    const roofRim = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.35, 2.75), trimMat);
    roofRim.position.y = 2.4;
    roofRim.castShadow = true;
    g.add(roofRim);

    // Recessed roof top
    const roofInner = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 2.2), darkMat);
    roofInner.position.y = 2.58;
    g.add(roofInner);

    // 2 Rooftop AC / Fan Units (just like in the Overcooked screenshot!)
    [-0.65, 0.65].forEach((rx) => {
      const acBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.75), trimMat);
      acBox.position.set(rx, 2.75, 0);
      acBox.castShadow = true;
      g.add(acBox);

      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.38, 12), darkMat);
      fan.position.set(rx, 2.76, 0);
      g.add(fan);
    });

    // Arched front doorway
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.25), trimMat);
    door.position.set(0, 0.5, 1.22);
    g.add(door);

    // Contact shadow
    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 20),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        depthWrite: false
      })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.05;
    g.add(sh);

    return g;
  }

  /**
   * Green pennant flag on a golden pole + white stage tile (like "1-3" / "1-4" in the screenshot!)
   */
  createOvercookedFlag(labelText = '1-1') {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.4, metalness: 0.3 });
    const flagMat = new THREE.MeshStandardMaterial({ color: 0x38b000, roughness: 0.6 });
    const starMat = new THREE.MeshBasicMaterial({ color: 0xe2f1e8 });

    // Golden base & pole
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 12), poleMat);
    base.position.y = 0.15;
    base.castShadow = true;
    g.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 10), poleMat);
    pole.position.y = 1.6;
    pole.castShadow = true;
    g.add(pole);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), poleMat);
    ball.position.y = 3.25;
    g.add(ball);

    // Green Pennant Banner
    const banner = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.12), flagMat);
    banner.position.set(0.75, 2.65, 0);
    banner.castShadow = true;
    g.add(banner);

    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), starMat);
    emblem.position.set(0.75, 2.65, 0.08);
    g.add(emblem);

    return g;
  }

  spawnRiversAndLakes(theme) {
    // Rich cobalt blue water with satin finish
    const waterMat = new THREE.MeshStandardMaterial({
      color: theme.waterColor,
      roughness: 0.22,
      metalness: 0.1
    });
    const foamMat = new THREE.MeshBasicMaterial({
      color: theme.foamColor,
      transparent: true,
      opacity: 0.65
    });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6c7a89, roughness: 0.8 });

    // 4 Scenic Cobalt-Blue Lakes with Shoreline Foam & Wooden Log Sail Rafts!
    for (let i = 0; i < 4; i++) {
      const lakePos = this.getRandomSurfacePoint(0.06);
      const lakeNormal = lakePos.clone().normalize();
      const lakeRadius = 7.5 + Math.random() * 2.8;

      const lakeGroup = new THREE.Group();

      // White foam outer rim
      const foamMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(lakeRadius + 0.35, lakeRadius + 0.35, 0.28, 32),
        foamMat
      );
      lakeGroup.add(foamMesh);

      // Deep cobalt water surface
      const lakeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(lakeRadius, lakeRadius * 0.98, 0.34, 32),
        waterMat
      );
      lakeMesh.receiveShadow = true;
      lakeGroup.add(lakeMesh);

      // Clusters of bevelled grey shoreline rocks
      for (let r = 0; r < 10; r++) {
        const ang = (r / 10) * Math.PI * 2 + Math.random() * 0.25;
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.65 + Math.random() * 0.5, 0),
          rockMat
        );
        rock.scale.set(1.25, 0.75, 1.0);
        rock.position.set(
          Math.cos(ang) * (lakeRadius - 0.2),
          0.35,
          Math.sin(ang) * (lakeRadius - 0.2)
        );
        rock.castShadow = true;
        rock.receiveShadow = true;
        lakeGroup.add(rock);
      }

      // Wooden Log Raft with White Sail (just like the raft in the Overcooked screenshot!)
      const raft = this.createOvercookedLogRaft();
      raft.position.set(lakeRadius * 0.35, 0.26, 0);
      lakeGroup.add(raft);
      this.boats.push({
        mesh: raft,
        baseAngle: Math.random() * Math.PI * 2,
        radius: lakeRadius * 0.38
      });

      this.orientToSphere(lakeGroup, lakePos, lakeNormal);
      this.meshGroup.add(lakeGroup);
    }

    // Winding Cobalt Rivers + Wooden Bridges
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xa86420, roughness: 0.65 });
    for (let i = 0; i < 4; i++) {
      const riverPos = this.getRandomSurfacePoint(0.1);
      const riverNormal = riverPos.clone().normalize();
      const riverGroup = new THREE.Group();

      const riverGeo = new THREE.TorusGeometry(6.4, 1.6, 10, 28, Math.PI * 0.9);
      const riverMesh = new THREE.Mesh(riverGeo, waterMat);
      riverMesh.rotation.x = Math.PI / 2;
      riverMesh.receiveShadow = true;
      riverGroup.add(riverMesh);

      const bridgeArch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.65, 2.0), bridgeMat);
      bridgeArch.position.set(6.4, 0.55, 0);
      bridgeArch.castShadow = true;
      riverGroup.add(bridgeArch);

      this.orientToSphere(riverGroup, riverPos, riverNormal);
      this.meshGroup.add(riverGroup);
    }
  }

  /**
   * Wooden Log Raft with a White Triangular Sail (Exact match to Overcooked screenshot!)
   */
  createOvercookedLogRaft() {
    const raft = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({ color: 0x9c5a25, roughness: 0.7 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd9a05b, roughness: 0.6 });
    const sailMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
      side: THREE.DoubleSide
    });

    // 5 parallel wooden logs
    for (let i = -2; i <= 2; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.3, 10), logMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.2, i * 0.42);
      log.castShadow = true;
      raft.add(log);
    }

    // Cross bindings
    [-0.75, 0.75].forEach((x) => {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 2.1), ropeMat);
      tie.position.set(x, 0.2, 0);
      raft.add(tie);
    });

    // Mast & Triangular White Sail
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), logMat);
    mast.position.set(0.1, 1.25, 0);
    mast.castShadow = true;
    raft.add(mast);

    const sailGeo = new THREE.ConeGeometry(0.95, 1.75, 3);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(-0.2, 1.35, 0);
    sail.scale.set(1.0, 1.0, 0.25);
    sail.castShadow = true;
    raft.add(sail);

    return raft;
  }

  /**
   * Overcooked-Style Stepped / Terraced Cliff Plateaus (胡鬧廚房招牌：階梯式斷層高地 + 橘黃泥土橫紋 + 碎石群)
   */
  spawnTerracedPlateaus(theme) {
    const plateauCount = 9;
    const cliffSideMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createCliffSideTexture(),
      roughness: 0.78
    });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x767b80, roughness: 0.75 });
    const brownPebbleMat = new THREE.MeshStandardMaterial({ color: 0x8c6d53, roughness: 0.8 });

    for (let i = 0; i < plateauCount; i++) {
      const mPos = this.getRandomSurfacePoint(0);
      const mNormal = mPos.clone().normalize();
      const mGroup = new THREE.Group();

      // Alternate between Cocoa-Brown cliffs (left of screenshot) & Dark Pine-Slate cliffs (right of screenshot)
      const topColor = i % 2 === 0 ? theme.plateauTopA : theme.plateauTopB;
      const topMat = new THREE.MeshStandardMaterial({
        color: topColor,
        roughness: 0.75
      });

      const baseRadius = 4.2 + Math.random() * 1.6;
      const h1 = 2.0 + Math.random() * 0.6;
      const sides = 7 + (i % 3); // Crisp faceted low-poly cliff walls!

      // Tier 1 (Lower Terrace)
      const tier1Wall = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius * 0.94, baseRadius, h1, sides, 1, true),
        cliffSideMat
      );
      tier1Wall.position.y = h1 * 0.5;
      tier1Wall.castShadow = true;
      tier1Wall.receiveShadow = true;
      mGroup.add(tier1Wall);

      const tier1Cap = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius * 0.97, baseRadius * 0.94, 0.32, sides),
        topMat
      );
      tier1Cap.position.y = h1;
      tier1Cap.castShadow = true;
      tier1Cap.receiveShadow = true;
      mGroup.add(tier1Cap);

      // Tier 2 (Upper Stepped Mesa offset slightly)
      const r2 = baseRadius * 0.62;
      const h2 = 1.9 + Math.random() * 0.5;
      const tier2Group = new THREE.Group();
      tier2Group.position.set(baseRadius * 0.15, h1, -baseRadius * 0.1);

      const tier2Wall = new THREE.Mesh(
        new THREE.CylinderGeometry(r2 * 0.94, r2, h2, sides, 1, true),
        cliffSideMat
      );
      tier2Wall.position.y = h2 * 0.5;
      tier2Wall.castShadow = true;
      tier2Wall.receiveShadow = true;
      tier2Group.add(tier2Wall);

      const tier2Cap = new THREE.Mesh(
        new THREE.CylinderGeometry(r2 * 0.97, r2 * 0.94, 0.32, sides),
        topMat
      );
      tier2Cap.position.y = h2;
      tier2Cap.castShadow = true;
      tier2Cap.receiveShadow = true;
      tier2Group.add(tier2Cap);

      // Put 2 conifer pine trees on top of the plateau!
      const topTree1 = this.createConiferPineTree();
      topTree1.position.set(0.4, h2 + 0.15, 0.3);
      tier2Group.add(topTree1);

      mGroup.add(tier2Group);

      // Scatter bevelled rocks & pebbles at the cliff base and terrace ledge
      for (let p = 0; p < 7; p++) {
        const ang = (p / 7) * Math.PI * 2 + Math.random() * 0.4;
        const pebble = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.35, 0),
          p % 2 === 0 ? rockMat : brownPebbleMat
        );
        pebble.scale.set(1.2, 0.65, 1.0);
        pebble.position.set(
          Math.cos(ang) * (baseRadius + 0.35),
          0.25,
          Math.sin(ang) * (baseRadius + 0.35)
        );
        pebble.castShadow = true;
        mGroup.add(pebble);
      }

      // Soft contact shadow under the entire plateau
      const plateauShadow = new THREE.Mesh(
        new THREE.CircleGeometry(baseRadius * 1.28, 24),
        new THREE.MeshBasicMaterial({
          map: createContactShadowTexture(),
          transparent: true,
          depthWrite: false
        })
      );
      plateauShadow.rotation.x = -Math.PI / 2;
      plateauShadow.position.y = 0.04;
      mGroup.add(plateauShadow);

      this.orientToSphere(mGroup, mPos, mNormal);
      this.meshGroup.add(mGroup);

      this.obstacles.push({
        position: mPos.clone().multiplyScalar(1.02),
        radius: baseRadius * 0.95,
        mesh: mGroup
      });
    }
  }

  /**
   * Creates a 3D Pennant Banner (錦旗) + Checkpoint Ring for each of the 10 City Landmarks!
   */
  createLandmarkPennant(radius = 2.6) {
    const group = new THREE.Group();

    // Glowing Checkpoint Ring around the landmark base ("穿越景點")
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffbe0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.05, radius * 1.25, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.14;
    group.add(ring);

    // 3D Pennant Flagpole (錦旗金桿) positioned beside the landmark entrance
    const pennantGroup = new THREE.Group();
    pennantGroup.position.set(radius * 0.92, 0, radius * 0.55);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      roughness: 0.3,
      metalness: 0.6
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.58, 0.35, 12), goldMat);
    base.position.y = 0.18;
    pennantGroup.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 4.6, 10), goldMat);
    pole.position.y = 2.3;
    pole.castShadow = true;
    pennantGroup.add(pole);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), goldMat);
    finial.position.y = 4.65;
    pennantGroup.add(finial);

    // Crossbar for traditional hanging/waving Pennant (錦旗橫桿與三角旗面)
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 8), goldMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0.95, 4.2, 0);
    pennantGroup.add(crossbar);

    // Pennant Cloth (Starts Crimson-Orange = Unvisited, turns Emerald-Green when Visited!)
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xff4d6d,
      emissive: 0x590d22,
      emissiveIntensity: 0.25,
      roughness: 0.45,
      side: THREE.DoubleSide
    });

    // Upper rectangular body of the 錦旗
    const bannerTop = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.35, 0.12), bannerMat);
    bannerTop.position.set(0.95, 3.45, 0);
    bannerTop.castShadow = true;
    pennantGroup.add(bannerTop);

    // Lower triangular tip of the 錦旗
    const bannerTip = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.95, 4), bannerMat);
    bannerTip.rotation.z = Math.PI;
    bannerTip.rotation.y = Math.PI / 4;
    bannerTip.scale.set(1.35, 1.0, 0.18);
    bannerTip.position.set(0.95, 2.32, 0);
    pennantGroup.add(bannerTip);

    // Golden Star Emblem on the center of the 錦旗
    const starEmblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), goldMat);
    starEmblem.position.set(0.95, 3.45, 0.1);
    pennantGroup.add(starEmblem);

    group.add(pennantGroup);

    return { group, ringMat, bannerMat, pennantGroup, starEmblem };
  }

  /**
   * Places all 10 specific city landmarks evenly across the 1.5x globe, each with a 3D Pennant (錦旗)
   */
  spawnCityLandmarks(theme) {
    this.landmarkCheckpoints = [];
    let landmarks = [];
    if (theme.cityKey === 'taipei') {
      landmarks = buildTaipeiLandmarks();
    } else if (theme.cityKey === 'kyoto') {
      landmarks = buildKyotoLandmarks();
    } else {
      landmarks = buildShanghaiLandmarks();
    }

    const total = landmarks.length;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    landmarks.forEach((item, index) => {
      let dir;
      if (index === 0) {
        dir = new THREE.Vector3(0.18, 0.92, 0.35).normalize();
      } else if (index === 1) {
        dir = new THREE.Vector3(-0.35, 0.86, 0.36).normalize();
      } else if (index === 2) {
        dir = new THREE.Vector3(0.42, 0.82, -0.38).normalize();
      } else {
        const y = 0.72 - ((index - 2) / (total - 2)) * 1.45;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = index * goldenAngle * 2.1;
        dir = new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).normalize();
      }

      const pos = dir.clone().multiplyScalar(this.radius + 0.12);

      item.group.scale.setScalar(1.3);

      item.group.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const baseR = item.radius || 2.6;
      const shadowRadius = baseR * 1.4;
      const landmarkShadow = new THREE.Mesh(
        new THREE.CircleGeometry(shadowRadius, 24),
        new THREE.MeshBasicMaterial({
          map: createContactShadowTexture(),
          transparent: true,
          depthWrite: false
        })
      );
      landmarkShadow.rotation.x = -Math.PI / 2;
      landmarkShadow.position.y = 0.06;
      item.group.add(landmarkShadow);

      // Attach 3D Pennant (錦旗) & Checkpoint Ring to this Landmark!
      const pennantData = this.createLandmarkPennant(baseR);
      item.group.add(pennantData.group);

      this.orientToSphere(item.group, pos, dir);
      this.meshGroup.add(item.group);

      this.obstacles.push({
        name: item.name,
        position: pos.clone(),
        radius: baseR * 1.25,
        mesh: item.group
      });

      let labelSprite = null;
      item.group.traverse((child) => {
        if (child.isSprite && child.userData && child.userData.isLandmarkLabel) {
          labelSprite = child;
        }
      });

      this.landmarkCheckpoints.push({
        name: item.name,
        position: pos.clone(),
        triggerRadius: baseR * 1.35 + 2.8,
        visited: false,
        ringMat: pennantData.ringMat,
        bannerMat: pennantData.bannerMat,
        pennantGroup: pennantData.pennantGroup,
        starEmblem: pennantData.starEmblem,
        labelSprite
      });
    });
  }

  /**
   * Checks if Player passed through any unvisited Landmark to claim its Pennant (錦旗)
   */
  checkLandmarkVisit(playerPos) {
    for (let i = 0; i < this.landmarkCheckpoints.length; i++) {
      const cp = this.landmarkCheckpoints[i];
      if (!cp.visited && playerPos.distanceTo(cp.position) < cp.triggerRadius) {
        cp.visited = true;
        // Turn Pennant (錦旗) & Ring into Bright Emerald Victory Green!
        cp.bannerMat.color.setHex(0x10b981);
        cp.bannerMat.emissive.setHex(0x065f46);
        cp.ringMat.color.setHex(0x10b981);
        cp.pennantGroup.scale.setScalar(1.22);

        const visitedCount = this.getVisitedLandmarkCount();
        return {
          name: cp.name,
          visitedCount,
          total: this.landmarkCheckpoints.length
        };
      }
    }
    return null;
  }

  getVisitedLandmarkCount() {
    return this.landmarkCheckpoints.filter((c) => c.visited).length;
  }

  getTotalLandmarkCount() {
    return this.landmarkCheckpoints.length || 13;
  }

  /**
   * Overcooked-Style Foliage:
   * - 3-Tier Stacked Conifer Pine Trees (深綠三層松樹)
   * - Berry-Pink Cluster Puff Trees (桃紅球球樹)
   * - Lush Round Toy Trees
   */
  spawnStorybookFoliage(theme) {
    const treeCount = 60;
    for (let i = 0; i < treeCount; i++) {
      const pos = this.getRandomSurfacePoint(0.08);
      const tooClose = this.obstacles.some(
        (obs) => obs.position.distanceTo(pos) < obs.radius + 2.2
      );
      if (tooClose) continue;

      const normal = pos.clone().normalize();
      let tree;

      if (i % 3 === 0) {
        // 3-Tier Stacked Conifer Pine Tree (right side of Overcooked screenshot)
        tree = this.createConiferPineTree();
      } else if (i % 3 === 1) {
        // Berry-Pink Cluster Puff Tree (top-left of Overcooked screenshot)
        tree = this.createBerryPuffTree(0xc92666);
      } else {
        // Lush Toy Green Puff Tree
        tree = this.createBerryPuffTree(0x4ea82f);
      }

      tree.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const treeShadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.75, 18),
        new THREE.MeshBasicMaterial({
          map: createContactShadowTexture(),
          transparent: true,
          depthWrite: false
        })
      );
      treeShadow.rotation.x = -Math.PI / 2;
      treeShadow.position.y = 0.05;
      tree.add(treeShadow);

      this.orientToSphere(tree, pos, normal);
      this.meshGroup.add(tree);
    }
  }

  /**
   * Overcooked-style 3-Tier Stacked Conifer Pine Tree (三層圓潤松樹)
   */
  createConiferPineTree() {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.75 });
    const pineDarkMat = new THREE.MeshStandardMaterial({ color: 0x3b6e38, roughness: 0.65 });
    const pineLightMat = new THREE.MeshStandardMaterial({ color: 0x4d8a45, roughness: 0.65 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 1.2, 8), trunkMat);
    trunk.position.y = 0.6;
    group.add(trunk);

    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.5, 9), pineDarkMat);
    cone1.position.y = 1.45;
    group.add(cone1);

    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.35, 9), pineLightMat);
    cone2.position.y = 2.25;
    group.add(cone2);

    const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.15, 9), pineLightMat);
    cone3.position.y = 2.95;
    group.add(cone3);

    const scale = 0.85 + Math.random() * 0.4;
    group.scale.setScalar(scale);
    return group;
  }

  /**
   * Overcooked-style Berry-Pink / Toy-Green Multi-Sphere Cluster Tree (桃紅/翠綠球球樹)
   */
  createBerryPuffTree(foliageColor = 0xc92666) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e472b, roughness: 0.75 });
    const leafMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.55 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.7, 8), trunkMat);
    trunk.position.y = 0.85;
    group.add(trunk);

    const puffs = [
      { x: 0, y: 2.35, z: 0, r: 0.95 },
      { x: 0.62, y: 1.95, z: 0.35, r: 0.72 },
      { x: -0.62, y: 1.95, z: 0.35, r: 0.72 },
      { x: 0.35, y: 2.0, z: -0.58, r: 0.72 },
      { x: -0.45, y: 2.05, z: -0.48, r: 0.68 },
      { x: 0, y: 1.85, z: 0.68, r: 0.65 }
    ];

    puffs.forEach((p) => {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(p.r, 12, 12), leafMat);
      sp.position.set(p.x, p.y, p.z);
      group.add(sp);
    });

    const scale = 0.85 + Math.random() * 0.38;
    group.scale.setScalar(scale);
    return group;
  }

  spawnFloatingClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf4f9fc,
      roughness: 0.45,
      transparent: true,
      opacity: 0.94
    });
    const cloudCount = 16;

    for (let i = 0; i < cloudCount; i++) {
      const cloudGroup = new THREE.Group();
      const cloudPos = this.getRandomSurfacePoint(11.0 + Math.random() * 3.0);
      const normal = cloudPos.clone().normalize();

      const puffCount = 5 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p++) {
        const puffSize = 1.35 + Math.random() * 1.1;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(puffSize, 14, 14), cloudMat);
        puff.scale.set(1.25, 0.75, 1.0);
        puff.position.set(
          (Math.random() - 0.5) * 3.6,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 1.9
        );
        puff.castShadow = true;
        cloudGroup.add(puff);
      }

      this.orientToSphere(cloudGroup, cloudPos, normal);
      this.cloudsGroup.add(cloudGroup);
    }
  }

  update(delta, playerPos = null) {
    if (this.cloudsGroup) {
      this.cloudsGroup.rotation.y += delta * 0.03;
      this.cloudsGroup.rotation.x += delta * 0.01;
    }

    const t = Date.now() * 0.0006;
    this.boats.forEach((b, idx) => {
      const ang = b.baseAngle + t * (idx % 2 === 0 ? 1 : -1);
      b.mesh.position.x = Math.cos(ang) * b.radius;
      b.mesh.position.z = Math.sin(ang) * b.radius;
      b.mesh.rotation.y = -ang + (idx % 2 === 0 ? 0 : Math.PI);
    });

    // Gently wave each landmark's 3D Pennant (錦旗) & fade landmark labels smoothly by distance
    const waveTime = Date.now() * 0.004;
    this.landmarkCheckpoints.forEach((cp, idx) => {
      if (cp.pennantGroup) {
        cp.pennantGroup.rotation.y = Math.sin(waveTime + idx) * 0.16;
      }
      if (cp.starEmblem) {
        cp.starEmblem.rotation.y += delta * 2.5;
      }
      if (cp.labelSprite) {
        if (playerPos) {
          const dist = playerPos.distanceTo(cp.position);
          // Visible within 22 units, smooth fade-out from 22 -> 32 units, hidden beyond 32 units
          const targetOpacity = dist <= 22 ? 0.96 : dist >= 32 ? 0 : (1 - (dist - 22) / 10) * 0.96;
          cp.labelSprite.material.opacity += (targetOpacity - cp.labelSprite.material.opacity) * Math.min(1, delta * 8);
          cp.labelSprite.visible = cp.labelSprite.material.opacity > 0.03;
        } else {
          cp.labelSprite.visible = false;
        }
      }
    });
  }

  orientToSphere(object, position, normal) {
    object.position.copy(position);
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    object.quaternion.copy(quat);
  }

  projectToSurface(position, offset = 0) {
    return position.clone().normalize().multiplyScalar(this.radius + offset);
  }

  getSurfaceNormal(position) {
    return position.clone().normalize();
  }

  getRandomSurfacePoint(offset = 0) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = this.radius + offset;
    const sinPhi = Math.sin(phi);

    return new THREE.Vector3(
      r * sinPhi * Math.cos(theta),
      r * sinPhi * Math.sin(theta),
      r * Math.cos(phi)
    );
  }

  setStage(newStage) {
    this.stage = newStage;
    this.initPlanet();
  }
}
