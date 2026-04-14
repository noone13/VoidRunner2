// ShipBlueprints.js — 5 ship classes, procedural meshes from Three.js primitives

import * as THREE from 'three';
import WireframeFactory, { COLORS } from '../core/WireframeFactory.js';

const ShipBlueprints = {
  courier: {
    body: { type: 'cone', radius: 0.3, height: 1.2, segments: 4 },
    wings: { type: 'box', w: 1.2, h: 0.05, d: 0.4, offsetY: -0.1 },
    engine: { type: 'cylinder', radius: 0.1, height: 0.3, count: 1 },
    scale: 1.0,
  },
  trader: {
    body: { type: 'box', w: 0.6, h: 0.4, d: 1.8 },
    wings: { type: 'box', w: 1.8, h: 0.05, d: 0.6, offsetY: 0 },
    engine: { type: 'cylinder', radius: 0.12, height: 0.3, count: 2 },
    cargo: { type: 'box', w: 0.4, h: 0.4, d: 0.8, offsetZ: 0.5 },
    scale: 1.3,
  },
  corvette: {
    body: { type: 'box', w: 0.7, h: 0.35, d: 2.2 },
    wings: { type: 'box', w: 2.2, h: 0.06, d: 0.7, offsetY: -0.05 },
    engine: { type: 'cylinder', radius: 0.13, height: 0.35, count: 2 },
    nose: { type: 'cone', radius: 0.2, height: 0.5 },
    scale: 1.6,
  },
  cruiser: {
    body: { type: 'box', w: 1.0, h: 0.6, d: 3.5 },
    wings: { type: 'box', w: 3.0, h: 0.08, d: 1.0, offsetY: -0.1 },
    engine: { type: 'cylinder', radius: 0.18, height: 0.45, count: 4 },
    turrets: { type: 'sphere', radius: 0.15, count: 2 },
    scale: 2.2,
  },
  flagship: {
    body: { type: 'box', w: 1.4, h: 0.8, d: 5.0 },
    wings: { type: 'box', w: 4.0, h: 0.1, d: 1.4, offsetY: -0.15 },
    engine: { type: 'cylinder', radius: 0.22, height: 0.55, count: 6 },
    turrets: { type: 'sphere', radius: 0.2, count: 4 },
    bridge: { type: 'box', w: 0.6, h: 0.4, d: 0.8, offsetZ: -1.5 },
    scale: 3.5,
  },
};

function createGeometry(part) {
  switch (part.type) {
    case 'cone':
      return new THREE.ConeGeometry(part.radius, part.height, part.segments || 8);
    case 'box':
      return new THREE.BoxGeometry(part.w, part.h, part.d);
    case 'cylinder':
      return new THREE.CylinderGeometry(part.radius, part.radius, part.height, 8);
    case 'sphere':
      return new THREE.SphereGeometry(part.radius, 6, 4);
    default:
      return new THREE.BoxGeometry(0.5, 0.5, 0.5);
  }
}

function buildShipMesh(className, color = COLORS.PLAYER) {
  const bp = ShipBlueprints[className];
  if (!bp) {
    console.warn(`ShipBlueprints: unknown class "${className}"`);
    return new THREE.Group();
  }

  const group = new THREE.Group();

  // Body — rotated so cone points forward (-Z)
  const bodyGeo = createGeometry(bp.body);
  const body = WireframeFactory.edges(bodyGeo, color);
  if (bp.body.type === 'cone') {
    body.rotation.x = -Math.PI / 2;
  }
  group.add(body);

  // Wings
  if (bp.wings) {
    const wingGeo = createGeometry(bp.wings);
    const wings = WireframeFactory.edges(wingGeo, color);
    wings.position.y = bp.wings.offsetY || 0;
    group.add(wings);
  }

  // Engines — positioned at the back
  if (bp.engine) {
    const spacing = 0.3;
    const count = bp.engine.count;
    const startX = -(count - 1) * spacing / 2;
    for (let i = 0; i < count; i++) {
      const engGeo = createGeometry(bp.engine);
      const eng = WireframeFactory.edges(engGeo, color);
      eng.position.set(startX + i * spacing, 0, bp.body.height ? bp.body.height / 2 : (bp.body.d || 1) / 2);
      eng.rotation.x = Math.PI / 2;
      group.add(eng);
    }
  }

  // Nose (corvette)
  if (bp.nose) {
    const noseGeo = createGeometry(bp.nose);
    const nose = WireframeFactory.edges(noseGeo, color);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -(bp.body.d || bp.body.height || 1) / 2 - bp.nose.height / 2;
    group.add(nose);
  }

  // Cargo module (trader)
  if (bp.cargo) {
    const cargoGeo = createGeometry(bp.cargo);
    const cargo = WireframeFactory.edges(cargoGeo, color);
    cargo.position.z = bp.cargo.offsetZ || 0;
    group.add(cargo);
  }

  // Turrets (cruiser, flagship)
  if (bp.turrets) {
    const turretSpacing = (bp.body.d || 2) / (bp.turrets.count + 1);
    for (let i = 0; i < bp.turrets.count; i++) {
      const tGeo = createGeometry(bp.turrets);
      const turret = WireframeFactory.edges(tGeo, color);
      const zPos = -(bp.body.d || 2) / 2 + turretSpacing * (i + 1);
      turret.position.set(0, (bp.body.h || 0.5) / 2 + bp.turrets.radius, zPos);
      group.add(turret);
    }
  }

  // Bridge (flagship)
  if (bp.bridge) {
    const bridgeGeo = createGeometry(bp.bridge);
    const bridge = WireframeFactory.edges(bridgeGeo, color);
    bridge.position.set(0, (bp.body.h || 0.5) / 2 + bp.bridge.h / 2, bp.bridge.offsetZ || 0);
    group.add(bridge);
  }

  group.scale.setScalar(bp.scale);
  return group;
}

export { ShipBlueprints, buildShipMesh };
export default ShipBlueprints;
