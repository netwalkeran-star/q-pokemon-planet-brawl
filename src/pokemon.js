import * as THREE from 'three';
import { createContactShadowTexture } from './textures.js';

export const POKEMON_DATA = {
  pikachu: {
    name: '皮卡丘',
    element: 'thunder',
    icon: '⚡',
    color: 0xffd924,
    skillName: '十萬伏特衝刺'
  },
  charmander: {
    name: '小火龍',
    element: 'fire',
    icon: '🔥',
    color: 0xff7722,
    skillName: '噴射火焰突進'
  },
  squirtle: {
    name: '傑尼龜',
    element: 'ice',
    icon: '💧',
    color: 0x5cc8ff,
    skillName: '水砲寒霜衝浪'
  },
  bulbasaur: {
    name: '妙蛙種子',
    element: 'normal',
    icon: '🌱',
    color: 0x45c4a0,
    skillName: '飛葉快刀疾行'
  },
  gengar: {
    name: '耿鬼',
    element: 'titan',
    icon: '👻',
    color: 0x734f9a,
    skillName: '暗影潛襲護盾'
  },
  falinks: {
    name: '伊布',
    element: 'fever',
    icon: '🦊',
    color: 0xc68642,
    skillName: '高速星星狂熱'
  }
};

function makeMat(hex) {
  return new THREE.MeshToonMaterial({ color: hex });
}

function addAnimeEyes(headGroup, yPos, zPos, xSpread, isGengar = false) {
  const eyes = [];
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: isGengar ? 0xff1744 : 0x1a1a1a });
  const irisMat = new THREE.MeshBasicMaterial({ color: isGengar ? 0xd50000 : 0x3b2314 });

  [-1, 1].forEach((side) => {
    const eyeGrp = new THREE.Group();
    if (isGengar) {
      const eyeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 3), pupilMat);
      eyeMesh.rotation.z = side * 0.5;
      eyeMesh.rotation.x = Math.PI / 2;
      eyeGrp.add(eyeMesh);

      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), whiteMat);
      shine.position.set(0.05 * side, 0.06, 0.14);
      eyeGrp.add(shine);
    } else {
      const darkBase = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), pupilMat);
      darkBase.scale.set(0.95, 1.15, 0.55);
      eyeGrp.add(darkBase);

      const lowerIris = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), irisMat);
      lowerIris.position.set(0, -0.04, 0.05);
      lowerIris.scale.set(0.9, 0.8, 0.4);
      eyeGrp.add(lowerIris);

      const hi1 = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), whiteMat);
      hi1.position.set(0.05 * side, 0.08, 0.1);
      eyeGrp.add(hi1);

      const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), whiteMat);
      hi2.position.set(-0.04 * side, -0.07, 0.1);
      eyeGrp.add(hi2);
    }

    eyeGrp.position.set(side * xSpread, yPos, zPos);
    eyeGrp.rotation.y = side * 0.25;
    headGroup.add(eyeGrp);
    eyes.push(eyeGrp);
  });
  return eyes;
}

/**
 * Builds a full-body 3D Chibi Pokémon with articulated head, torso, arms, legs, and tail for running animations!
 */
export function createPokemonMesh(species = 'pikachu', isLeader = true, scale = 1.0) {
  if (!POKEMON_DATA[species]) species = 'pikachu';

  const root = new THREE.Group();
  root.userData.species = species;

  const rig = new THREE.Group();
  root.add(rig);

  const headGroup = new THREE.Group();
  const torsoGroup = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const tailGroup = new THREE.Group();
  const ears = [];
  let eyes = [];
  let isQuadruped = false;

  if (species === 'pikachu') {
    const yellowMat = makeMat(0xffdc26);
    const darkMat = makeMat(0x1f1f1f);
    const brownMat = makeMat(0x7a4419);
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
    const noseMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xff6b81 });

    // 1. Bipedal Pear-shaped Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.55, 12, 18), yellowMat);
    torso.position.y = 0.85;
    torso.scale.set(1.05, 1.0, 0.95);
    torso.castShadow = true;
    torsoGroup.add(torso);

    // Iconic 2 Brown Stripes on Pikachu's Back
    [1.05, 0.72].forEach((y) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.22), brownMat);
      stripe.position.set(0, y, -0.48);
      torsoGroup.add(stripe);
    });

    // 2. Pikachu Head
    headGroup.position.set(0, 1.65, 0.12);
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.66, 22, 18), yellowMat);
    cranium.scale.set(1.08, 0.96, 1.02);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Puffy lower cheeks & Red Electric Pouches
    [-1, 1].forEach((side) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 14), yellowMat);
      puff.position.set(side * 0.42, -0.15, 0.22);
      headGroup.add(puff);

      const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), cheekMat);
      pouch.position.set(side * 0.56, -0.14, 0.44);
      pouch.scale.set(0.9, 0.9, 0.45);
      headGroup.add(pouch);
    });

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), noseMat);
    nose.position.set(0, -0.02, 0.68);
    headGroup.add(nose);

    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), mouthMat);
    mouth.position.set(0, -0.18, 0.64);
    mouth.scale.set(1.2, 0.7, 0.4);
    headGroup.add(mouth);

    eyes = addAnimeEyes(headGroup, 0.12, 0.58, 0.34);

    // Long Pikachu Ears with Black Tips
    [-1, 1].forEach((side) => {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.38, 0.52, 0.0);
      earPivot.rotation.z = -side * 0.45;
      earPivot.rotation.x = -0.18;

      const earLower = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.65, 12), yellowMat);
      earLower.position.y = 0.32;
      earLower.scale.set(0.85, 1, 0.65);
      earPivot.add(earLower);

      const earTip = new THREE.Mesh(new THREE.ConeGeometry(0.135, 0.45, 12), darkMat);
      earTip.position.y = 0.85;
      earTip.scale.set(0.85, 1, 0.65);
      earPivot.add(earTip);

      headGroup.add(earPivot);
      ears.push(earPivot);
    });

    // 3. Swinging Arms
    [-1, 1].forEach((side) => {
      const armGrp = side === -1 ? leftArm : rightArm;
      armGrp.position.set(side * 0.58, 1.05, 0.15);
      const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.38, 8, 10), yellowMat);
      armMesh.position.set(side * 0.08, -0.18, 0.1);
      armMesh.rotation.z = side * 0.3;
      armGrp.add(armMesh);
    });

    // 4. Running Legs & Long Hind Feet
    [-1, 1].forEach((side) => {
      const legGrp = side === -1 ? leftLeg : rightLeg;
      legGrp.position.set(side * 0.32, 0.45, 0.0);

      const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), yellowMat);
      thigh.position.y = -0.1;
      legGrp.add(thigh);

      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.36, 8, 10), yellowMat);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(0, -0.32, 0.15);
      legGrp.add(foot);
    });

    // 5. Iconic Zig-Zag Lightning Bolt Tail
    tailGroup.position.set(0, 0.58, -0.52);
    const tSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.22), brownMat);
    tSeg1.position.set(0, 0.18, -0.15);
    tSeg1.rotation.x = -0.6;
    tailGroup.add(tSeg1);

    const tSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.28), yellowMat);
    tSeg2.position.set(0, 0.48, -0.38);
    tSeg2.rotation.x = 0.4;
    tailGroup.add(tSeg2);

    const tSeg3 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.42), yellowMat);
    tSeg3.position.set(0, 0.88, -0.62);
    tSeg3.rotation.x = -0.45;
    tailGroup.add(tSeg3);

  } else if (species === 'charmander') {
    const orangeMat = makeMat(0xff7722);
    const creamMat = makeMat(0xffe6a3);
    const clawMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // 1. Bipedal Dino Torso + Cream Belly
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 0.6, 12, 18), orangeMat);
    torso.position.y = 0.9;
    torso.castShadow = true;
    torsoGroup.add(torso);

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.52, 10, 14), creamMat);
    belly.position.set(0, 0.86, 0.18);
    belly.scale.set(0.95, 1.0, 0.65);
    torsoGroup.add(belly);

    // 2. Dino Head with Snout
    headGroup.position.set(0, 1.72, 0.15);
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 18), orangeMat);
    cranium.castShadow = true;
    headGroup.add(cranium);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), orangeMat);
    snout.position.set(0, -0.12, 0.36);
    snout.scale.set(1.05, 0.78, 1.05);
    headGroup.add(snout);

    eyes = addAnimeEyes(headGroup, 0.12, 0.52, 0.35);

    // 3. Swinging Arms
    [-1, 1].forEach((side) => {
      const armGrp = side === -1 ? leftArm : rightArm;
      armGrp.position.set(side * 0.58, 1.15, 0.15);
      const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.36, 8, 10), orangeMat);
      armMesh.position.set(side * 0.08, -0.18, 0.12);
      armMesh.rotation.z = side * 0.35;
      armGrp.add(armMesh);
    });

    // 4. Dino Running Legs with White Claws
    [-1, 1].forEach((side) => {
      const legGrp = side === -1 ? leftLeg : rightLeg;
      legGrp.position.set(side * 0.35, 0.5, 0.0);

      const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 8, 10), orangeMat);
      legMesh.position.y = -0.18;
      legGrp.add(legMesh);

      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), orangeMat);
      foot.position.set(0, -0.38, 0.12);
      foot.scale.set(0.9, 0.6, 1.3);
      legGrp.add(foot);

      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), clawMat);
      claw.rotation.x = Math.PI / 2;
      claw.position.set(0, -0.4, 0.35);
      legGrp.add(claw);
    });

    // 5. Long Dino Tail + Burning 3D Flame Tip
    tailGroup.position.set(0, 0.55, -0.48);
    const tailBody = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.15, 10), orangeMat);
    tailBody.position.set(0, 0.25, -0.45);
    tailBody.rotation.x = -1.1;
    tailGroup.add(tailBody);

    const flameOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.78, 10),
      new THREE.MeshBasicMaterial({ color: 0xff3b00 })
    );
    flameOuter.position.set(0, 0.68, -0.92);
    tailGroup.add(flameOuter);

    const flameInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe600 })
    );
    flameInner.position.set(0, 0.65, -0.92);
    tailGroup.add(flameInner);
    ears.push(flameOuter);

  } else if (species === 'squirtle') {
    const blueMat = makeMat(0x52c4ff);
    const shellBackMat = makeMat(0xa85824);
    const shellBellyMat = makeMat(0xfae29c);
    const whiteRimMat = makeMat(0xffffff);

    // 1. Turtle Torso + 3D Shell with White Rim + Plated Yellow Chest
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.54, 0.5, 12, 16), shellBellyMat);
    chest.position.set(0, 0.88, 0.08);
    torsoGroup.add(chest);

    const shellDomed = new THREE.Mesh(new THREE.SphereGeometry(0.76, 16, 14), shellBackMat);
    shellDomed.position.set(0, 0.92, -0.25);
    shellDomed.scale.set(0.95, 1.1, 0.75);
    shellDomed.castShadow = true;
    torsoGroup.add(shellDomed);

    const shellRim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.1, 10, 22), whiteRimMat);
    shellRim.position.set(0, 0.92, -0.05);
    shellRim.scale.set(0.92, 1.08, 0.8);
    torsoGroup.add(shellRim);

    // 2. Squirtle Head
    headGroup.position.set(0, 1.68, 0.16);
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.64, 22, 18), blueMat);
    cranium.scale.set(1.06, 0.98, 1.02);
    cranium.castShadow = true;
    headGroup.add(cranium);

    const cheekPuff = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), blueMat);
    cheekPuff.position.set(0, -0.12, 0.24);
    cheekPuff.scale.set(1.25, 0.65, 0.85);
    headGroup.add(cheekPuff);

    eyes = addAnimeEyes(headGroup, 0.1, 0.56, 0.34);

    // 3. Swinging Arms
    [-1, 1].forEach((side) => {
      const armGrp = side === -1 ? leftArm : rightArm;
      armGrp.position.set(side * 0.62, 1.1, 0.15);
      const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 8, 10), blueMat);
      armMesh.position.set(side * 0.08, -0.15, 0.12);
      armMesh.rotation.z = side * 0.4;
      armGrp.add(armMesh);
    });

    // 4. Running Legs
    [-1, 1].forEach((side) => {
      const legGrp = side === -1 ? leftLeg : rightLeg;
      legGrp.position.set(side * 0.36, 0.48, 0.05);
      const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 8, 10), blueMat);
      legMesh.position.y = -0.18;
      legGrp.add(legMesh);

      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), blueMat);
      foot.position.set(0, -0.36, 0.12);
      foot.scale.set(0.95, 0.6, 1.25);
      legGrp.add(foot);
    });

    // 5. Big Curled Squirrel Tail
    tailGroup.position.set(0, 0.52, -0.58);
    const curlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 10), blueMat);
    curlBase.position.set(0, 0.1, -0.25);
    curlBase.rotation.x = Math.PI / 2;
    tailGroup.add(curlBase);

    const curlRoll = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 14), blueMat);
    curlRoll.position.set(0, 0.32, -0.55);
    curlRoll.scale.set(0.65, 1.0, 1.0);
    tailGroup.add(curlRoll);

  } else if (species === 'bulbasaur') {
    isQuadruped = true;
    const bodyMat = makeMat(0x45c4a0);
    const bulbMat = makeMat(0x2eb85c);
    const bulbTipMat = makeMat(0x228b22);

    // 1. Quadruped Torso + Large Plant Bulb on Back
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 16), bodyMat);
    torso.position.set(0, 0.72, -0.1);
    torso.scale.set(1.05, 0.82, 1.25);
    torso.castShadow = true;
    torsoGroup.add(torso);

    const bulbBase = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 14), bulbMat);
    bulbBase.position.set(0, 1.28, -0.22);
    bulbBase.scale.set(1.05, 0.9, 1.05);
    bulbBase.castShadow = true;
    torsoGroup.add(bulbBase);

    const bulbTip = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.65, 7), bulbTipMat);
    bulbTip.position.set(0, 1.75, -0.22);
    torsoGroup.add(bulbTip);

    // 2. Wide Frog Head + Pointed Ears
    headGroup.position.set(0, 0.95, 0.72);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), bodyMat);
    headMesh.scale.set(1.22, 0.92, 1.0);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 8), bodyMat);
      ear.position.set(side * 0.52, 0.5, -0.05);
      ear.rotation.z = -side * 0.35;
      headGroup.add(ear);
      ears.push(ear);
    });

    eyes = addAnimeEyes(headGroup, 0.08, 0.54, 0.38);

    // 3. 4 Running Legs
    [-1, 1].forEach((side) => {
      const fLeg = side === -1 ? leftArm : rightArm;
      fLeg.position.set(side * 0.52, 0.52, 0.42);
      const fMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.52, 10), bodyMat);
      fMesh.position.y = -0.22;
      fLeg.add(fMesh);

      const bLeg = side === -1 ? leftLeg : rightLeg;
      bLeg.position.set(side * 0.55, 0.52, -0.52);
      const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.52, 10), bodyMat);
      bMesh.position.y = -0.22;
      bLeg.add(bMesh);
    });

  } else if (species === 'gengar') {
    const purpleMat = makeMat(0x6c4696);
    const grinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.92, 24, 20), purpleMat);
    body.position.set(0, 1.05, 0);
    body.scale.set(1.12, 1.08, 1.02);
    body.castShadow = true;
    torsoGroup.add(body);

    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 6), purpleMat);
      spike.position.set(0, 1.75 - i * 0.32, -0.45 - i * 0.14);
      spike.rotation.x = -0.75;
      torsoGroup.add(spike);
    }

    headGroup.position.set(0, 1.15, 0.32);
    eyes = addAnimeEyes(headGroup, 0.22, 0.52, 0.38, true);

    const grin = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.26, 0.2), grinMat);
    grin.position.set(0, -0.15, 0.54);
    headGroup.add(grin);

    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.78, 8), purpleMat);
      ear.position.set(side * 0.65, 0.72, -0.25);
      ear.rotation.z = -side * 0.52;
      headGroup.add(ear);
      ears.push(ear);
    });

    [-1, 1].forEach((side) => {
      const armGrp = side === -1 ? leftArm : rightArm;
      armGrp.position.set(side * 0.85, 1.05, 0.15);
      const arm = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 10), purpleMat);
      arm.rotation.z = side * 1.1;
      arm.position.set(side * 0.15, -0.1, 0.1);
      armGrp.add(arm);

      const legGrp = side === -1 ? leftLeg : rightLeg;
      legGrp.position.set(side * 0.45, 0.42, 0.0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.26, 8, 10), purpleMat);
      leg.position.y = -0.15;
      legGrp.add(leg);
    });

    tailGroup.position.set(0, 0.45, -0.75);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 8), purpleMat);
    tail.rotation.x = -1.2;
    tail.position.set(0, 0.0, -0.25);
    tailGroup.add(tail);

  } else {
    // 🦊 伊布 (Eevee - Running 4-legged Fox Pokémon with Fluffy Cream Mane & Big Tail)
    isQuadruped = true;
    const brownMat = makeMat(0xc68642);
    const creamMat = makeMat(0xfff3d1);
    const darkEarMat = makeMat(0x4a2c11);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.65, 10, 14), brownMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.75, -0.05);
    torso.castShadow = true;
    torsoGroup.add(torso);

    const mane = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 1), creamMat);
    mane.position.set(0, 0.92, 0.38);
    mane.scale.set(1.15, 0.85, 0.95);
    torsoGroup.add(mane);

    headGroup.position.set(0, 1.38, 0.52);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.54, 18, 16), brownMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    [-1, 1].forEach((side) => {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.35, 0.42, 0.0);
      earPivot.rotation.z = -side * 0.45;

      const earOuter = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 8), brownMat);
      earOuter.position.y = 0.4;
      earOuter.scale.set(0.85, 1.0, 0.45);
      earPivot.add(earOuter);

      const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 8), darkEarMat);
      earInner.position.set(0, 0.36, 0.06);
      earInner.scale.set(0.8, 1.0, 0.3);
      earPivot.add(earInner);

      headGroup.add(earPivot);
      ears.push(earPivot);
    });

    eyes = addAnimeEyes(headGroup, 0.05, 0.48, 0.28);

    [-1, 1].forEach((side) => {
      const fLeg = side === -1 ? leftArm : rightArm;
      fLeg.position.set(side * 0.35, 0.55, 0.35);
      const fMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 8, 10), brownMat);
      fMesh.position.y = -0.22;
      fLeg.add(fMesh);

      const bLeg = side === -1 ? leftLeg : rightLeg;
      bLeg.position.set(side * 0.35, 0.55, -0.45);
      const bMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.42, 8, 10), brownMat);
      bMesh.position.y = -0.22;
      bLeg.add(bMesh);
    });

    tailGroup.position.set(0, 0.82, -0.58);
    const tailBase = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), brownMat);
    tailBase.position.set(0, 0.25, -0.35);
    tailBase.scale.set(0.8, 0.9, 1.3);
    tailGroup.add(tailBase);

    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.65, 10), creamMat);
    tailTip.position.set(0, 0.55, -0.75);
    tailTip.rotation.x = -0.85;
    tailGroup.add(tailTip);
  }

  // Leader Crown & Floating Team Count Text on Head ("頭上數字 加大 2x 但只顯示字 沒有字框")
  let countBadge = null;
  if (isLeader) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.36, 5),
      new THREE.MeshBasicMaterial({ color: 0xffea00 })
    );
    crown.position.set(0, 0.72, 0.0);
    headGroup.add(crown);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false
    });
    countBadge = new THREE.Sprite(spriteMat);
    countBadge.position.set(0, 3.15, 0);
    // 2x Larger scale, pure text without any box!
    countBadge.scale.set(4.2, 2.1, 1);
    countBadge.userData = { canvas, tex, lastCount: -1, lastIsPlayer: null };
    root.add(countBadge);
  }

  rig.add(torsoGroup, headGroup, leftArm, rightArm, leftLeg, rightLeg, tailGroup);

  // Soft 3D Contact Shadow Disc under feet
  const shadowPlane = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 20),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.04;
  root.add(shadowPlane);

  // Ensure every part of the Pokémon casts & receives real 3D shadows
  rig.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  root.scale.set(scale, scale, scale);

  root.userData = {
    species,
    rig,
    headGroup,
    torsoGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    tailGroup,
    ears,
    eyes,
    isQuadruped,
    baseScale: scale,
    countBadge
  };

  if (isLeader) {
    updateHeadCountBadge(root, 3, false);
  }

  return root;
}

/**
 * Updates the floating head number showing current team count ("頭上數字 加大 2x 但只顯示字 沒有字框")
 */
export function updateHeadCountBadge(meshRoot, count, isPlayer = false, isAI = false) {
  const badge = meshRoot?.userData?.countBadge;
  if (!badge) return;
  if (badge.userData.lastCount === count && badge.userData.lastIsPlayer === isPlayer && badge.userData.lastIsAI === isAI) return;

  badge.userData.lastCount = count;
  badge.userData.lastIsPlayer = isPlayer;
  badge.userData.lastIsAI = isAI;

  const { canvas, tex } = badge.userData;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pure 2x Large Text ONLY — NO background box or border!
  const text = isAI ? `🤖 ${count}` : `${count}`;
  ctx.font = '900 86px "Segoe UI", "Arial Black", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Crisp 3D-style stroke outline so pure text stands out on any background without a box
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.lineWidth = 14;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = isPlayer ? '#fde047' : isAI ? '#38bdf8' : '#ffffff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  tex.needsUpdate = true;
}

/**
 * Creates or updates an overhead 3D speech bubble sprite for the True AI NPC
 */
export function updateAISpeechBubble(meshRoot, text = '') {
  if (!meshRoot) return;
  let bubble = meshRoot.userData.aiSpeechBubble;
  if (!bubble) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false
    });
    bubble = new THREE.Sprite(spriteMat);
    bubble.position.set(0, 4.6, 0);
    bubble.scale.set(6.4, 2.0, 1);
    bubble.userData = { canvas, tex, lastText: null };
    meshRoot.add(bubble);
    meshRoot.userData.aiSpeechBubble = bubble;
  }

  if (bubble.userData.lastText === text) return;
  bubble.userData.lastText = text;

  const { canvas, tex } = bubble.userData;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!text || text.trim().length === 0) {
    bubble.visible = false;
    tex.needsUpdate = true;
    return;
  }

  bubble.visible = true;

  // Draw rounded speech bubble
  const w = canvas.width - 20;
  const h = canvas.height - 35;
  const x = 10;
  const y = 8;
  const r = 24;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(canvas.width / 2 + 18, y + h);
  ctx.lineTo(canvas.width / 2, canvas.height - 8); // Pointer tail
  ctx.lineTo(canvas.width / 2 - 18, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw speech text
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px "Segoe UI", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Truncate if too long for bubble
  const display = text.length > 24 ? text.slice(0, 23) + '…' : text;
  ctx.fillText(`💬 耿鬼：「${display}」`, canvas.width / 2, y + h / 2 - 2);

  tex.needsUpdate = true;
}

/**
 * Animates a Pokémon's limbs, tail, ears, and torso in an energetic running cycle!
 */
export function animatePokemonRun(meshRoot, timeSeconds, phaseOffset = 0, isJumping = false, isDashing = false) {
  const ud = meshRoot?.userData;
  if (!ud || !ud.rig) return;

  const freq = isDashing ? 22.0 : 14.0;
  const t = timeSeconds * freq - phaseOffset;

  if (isJumping) {
    ud.leftLeg.rotation.x = -0.7;
    ud.rightLeg.rotation.x = 0.6;
    ud.leftArm.rotation.x = -1.1;
    ud.rightArm.rotation.x = -1.1;
    ud.rig.position.y = 0.2;
    ud.rig.rotation.x = -0.2;
    ud.tailGroup.rotation.y = Math.sin(t * 1.5) * 0.4;
    return;
  }

  const strideAngle = isDashing ? 1.05 : 0.82;
  const sinT = Math.sin(t);
  const cosT = Math.cos(t);

  if (ud.isQuadruped) {
    ud.leftArm.rotation.x = sinT * strideAngle;
    ud.rightArm.rotation.x = cosT * strideAngle;
    ud.leftLeg.rotation.x = -sinT * strideAngle;
    ud.rightLeg.rotation.x = -cosT * strideAngle;
  } else {
    ud.leftLeg.rotation.x = sinT * strideAngle;
    ud.rightLeg.rotation.x = -sinT * strideAngle;
    ud.leftArm.rotation.x = -sinT * strideAngle * 0.85;
    ud.rightArm.rotation.x = sinT * strideAngle * 0.85;
  }

  const bob = Math.abs(sinT) * 0.22;
  ud.rig.position.y = bob;
  ud.rig.rotation.x = isDashing ? 0.28 : 0.14;
  ud.rig.rotation.z = cosT * 0.08;

  ud.tailGroup.rotation.y = cosT * 0.35;
  ud.headGroup.rotation.x = Math.sin(t * 2) * 0.08 - 0.08;

  if (ud.ears) {
    ud.ears.forEach((ear, idx) => {
      ear.rotation.x = -0.15 + Math.sin(t * 2 + idx) * 0.12;
    });
  }
}

/**
 * 🏭 怪獸電力公司・全新高階訂製連帽披肩 3D 模型生成（三分之一頭・精緻短披肩）
 */
export function createMonstersIncCapeMesh(capeType, species = 'pikachu') {
  if (!capeType || capeType === 'none') return null;

  const capeRoot = new THREE.Group();
  capeRoot.userData.isCape = true;

  let primaryColor = 0x38bdf8; // Sulley
  let accentColor = 0x9333ea;
  if (capeType === 'mike') {
    primaryColor = 0x84cc16; // Mike
    accentColor = 0x16a34a;
  } else if (capeType === 'boo') {
    primaryColor = 0xc084fc; // Boo
    accentColor = 0xe879f9;
  } else if (capeType === 'randall') {
    primaryColor = 0x475569; // Randall
    accentColor = 0xa855f7;
  }

  const clothMat = new THREE.MeshToonMaterial({
    color: primaryColor,
    roughness: 0.6,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  const goldMat = new THREE.MeshToonMaterial({
    color: 0xffd700,
    metalness: 0.85,
    roughness: 0.2
  });

  // Character-specific Floating Hat Hover Anchors (Unscaled Pokémon space)
  // 精準懸浮於頭頂上方約 0.15~0.25 單位，自然親切如魔幻王冠
  let hatPosY = 2.48;
  let hatPosZ = 0.08;

  if (species === 'gengar') {
    hatPosY = 2.42;
    hatPosZ = -0.05;
  } else if (species === 'falinks') { // Eevee (四足獸，頭部位於前方)
    hatPosY = 2.05;
    hatPosZ = 0.48;
  } else if (species === 'charmander') {
    hatPosY = 2.45;
    hatPosZ = 0.06;
  } else if (species === 'squirtle') {
    hatPosY = 2.42;
    hatPosZ = 0.05;
  } else if (species === 'pikachu') {
    hatPosY = 2.48;
    hatPosZ = 0.08;
  }

  // ========================================================
  // 🎩 頭頂懸空魔幻帽子 (FLOATING MAGIC HAT - 徹底告別遮面與穿模)
  // ========================================================
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, hatPosY, hatPosZ);
  hatGroup.rotation.x = 0.15; // 自然向前微傾，完美展示帽子正面特徵！
  hatGroup.userData.basePosY = hatPosY;
  hatGroup.userData.isFloatingHat = true;

  // 1. 懸空魔法微光光環 (Floating Magic Energy Halo)
  const haloMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.85
  });
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.022, 16, 36), haloMat);
  haloRing.rotation.x = Math.PI / 2;
  haloRing.position.y = -0.14;
  hatGroup.add(haloRing);

  // Orbiting magic sparkle gems under the hat
  for (let i = 0; i < 4; i++) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), haloMat);
    const a = (i / 4) * Math.PI * 2;
    gem.position.set(Math.cos(a) * 0.38, -0.14, Math.sin(a) * 0.38);
    hatGroup.add(gem);
  }

  // 2. 帽子本體造型 (Distinctive Monsters, Inc. Floating Hats)
  if (capeType === 'sulley') {
    // 【毛怪藍斑點角角貝雷帽】
    const beretGeo = new THREE.SphereGeometry(0.38, 20, 16);
    const beret = new THREE.Mesh(beretGeo, clothMat);
    beret.scale.set(1.15, 0.55, 1.15);
    beret.castShadow = true;
    hatGroup.add(beret);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.08, 24), clothMat);
    rim.position.y = -0.10;
    hatGroup.add(rim);

    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.30, 10), makeMat(0xffffff));
      horn.position.set(side * 0.35, 0.14, 0);
      horn.rotation.z = -side * 0.55;
      horn.rotation.x = -0.12;
      hatGroup.add(horn);
    });

    const spotMat = makeMat(accentColor);
    [
      [0.18, 0.12, 0.18],
      [-0.20, 0.14, -0.12],
      [0.05, 0.18, -0.20]
    ].forEach(([x, y, z]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), spotMat);
      s.position.set(x, y, z);
      hatGroup.add(s);
    });

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), makeMat(accentColor));
    stem.position.y = 0.24;
    hatGroup.add(stem);

  } else if (capeType === 'mike') {
    // 【大眼仔怪獸電力公司工廠安全帽 + 招牌水汪汪大眼】
    const hardhatMat = makeMat(0x84cc16); // Lime green
    const hardhatGeo = new THREE.SphereGeometry(0.38, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const hardhat = new THREE.Mesh(hardhatGeo, hardhatMat);
    hardhat.scale.set(1.05, 0.75, 1.15);
    hardhat.castShadow = true;
    hatGroup.add(hardhat);

    const brimGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.04, 24);
    const brim = new THREE.Mesh(brimGeo, hardhatMat);
    brim.position.y = 0;
    hatGroup.add(brim);

    const visorGeo = new THREE.CylinderGeometry(0.45, 0.46, 0.04, 16, 1, false, -Math.PI * 0.28, Math.PI * 0.56);
    const visor = new THREE.Mesh(visorGeo, hardhatMat);
    visor.position.set(0, -0.02, 0.06);
    hatGroup.add(visor);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.65), makeMat(0x65a30d));
    ridge.position.set(0, 0.25, 0);
    hatGroup.add(ridge);

    // Mike's ICONIC GIANT EYE
    const eyeRig = new THREE.Group();
    eyeRig.position.set(0, 0.15, 0.32);
    eyeRig.rotation.x = 0.12;

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    sclera.scale.set(1.0, 1.0, 0.65);
    eyeRig.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), new THREE.MeshStandardMaterial({ color: 0x16a34a }));
    iris.position.set(0, 0, 0.10);
    sclera.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), new THREE.MeshBasicMaterial({ color: 0x090d16 }));
    pupil.position.set(0, 0, 0.06);
    iris.add(pupil);

    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.025, 0.025, 0.05);
    pupil.add(shine);

    hatGroup.add(eyeRig);

    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), makeMat(0x334155));
      horn.position.set(side * 0.28, 0.24, -0.05);
      horn.rotation.z = -side * 0.35;
      hatGroup.add(horn);
    });

  } else if (capeType === 'boo') {
    // 【阿布紫色怪獸偽裝雙彈簧眼帽】
    const booMat = makeMat(0xa855f7);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), booMat);
    cap.scale.set(1.08, 0.72, 1.08);
    cap.castShadow = true;
    hatGroup.add(cap);

    for (let i = 0; i < 7; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), makeMat(0xffffff));
      const ang = -0.9 + i * 0.3;
      tooth.position.set(Math.sin(ang) * 0.36, -0.12, Math.cos(ang) * 0.36);
      tooth.rotation.x = Math.PI;
      tooth.rotation.y = ang;
      hatGroup.add(tooth);
    }

    [-1, 1].forEach((side) => {
      const ant = new THREE.Group();
      ant.position.set(side * 0.18, 0.22, 0.05);

      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.20, 6), goldMat);
      spring.position.y = 0.10;
      ant.add(spring);

      const googly = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      googly.position.set(side * 0.03, 0.24, 0);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0x111827 }));
      p.position.set(0, 0, 0.1);
      googly.add(p);
      ant.add(googly);

      hatGroup.add(ant);
    });

  } else if (capeType === 'randall') {
    // 【藍道變色龍高科技隱形戰冠】
    const randMat = makeMat(0x4338ca); // Indigo metallic
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.34, 0.16, 24), randMat);
    crown.castShadow = true;
    hatGroup.add(crown);

    const visorLine = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 8, 24, Math.PI * 0.8), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
    visorLine.rotation.y = -Math.PI * 0.4;
    visorLine.position.y = -0.02;
    hatGroup.add(visorLine);

    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16 - i * 0.02, 0.22), makeMat(accentColor));
      fin.position.set(0, 0.16 - i * 0.04, -0.06 - i * 0.12);
      fin.rotation.x = -0.35;
      hatGroup.add(fin);
    }
  }

  capeRoot.add(hatGroup);
  const LEADER_SCALE = 1.3;
  capeRoot.scale.set(LEADER_SCALE, LEADER_SCALE, LEADER_SCALE);
  return capeRoot;
}
