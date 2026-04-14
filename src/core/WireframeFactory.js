// WireframeFactory.js — ONLY place to create wireframe meshes

import * as THREE from 'three';

export const COLORS = {
  PLAYER: 0x00ff88,
  HEGEMONY: 0x4488ff,
  COALITION: 0xffcc00,
  SYNDICATE: 0xcc44ff,
  PIRATES: 0xff6600,
  NEUTRAL: 0x888888,
  LOCKED: 0x333333,
  UI: 0x00ccff,
  WARNING: 0xff4400,
  ENEMY: 0xff2222,
};

// Faction name → color lookup
export const FACTION_COLORS = {
  hegemony: COLORS.HEGEMONY,
  coalition: COLORS.COALITION,
  syndicate: COLORS.SYNDICATE,
  pirates: COLORS.PIRATES,
  neutral: COLORS.NEUTRAL,
  player: COLORS.PLAYER,
};

const WireframeFactory = {
  COLORS,
  FACTION_COLORS,

  // EdgesGeometry + LineSegments — clean wireframe edges
  edges(geometry, color = COLORS.UI) {
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.LineSegments(edges, material);
  },

  // WireframeGeometry — full wireframe (all triangles visible)
  wireframe(geometry, color = COLORS.UI) {
    const wireGeo = new THREE.WireframeGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.LineSegments(wireGeo, material);
  },

  // Glow line from points array — additive blending
  glowLine(points, color = COLORS.UI, opacity = 0.6) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  },

  // Simple line between two points
  line(from, to, color = COLORS.NEUTRAL) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geometry, material);
  },

  // Dashed line between two points
  dashedLine(from, to, color = COLORS.LOCKED, dashSize = 0.3, gapSize = 0.2) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize,
      gapSize,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  },

  // Get color for faction
  factionColor(faction) {
    return FACTION_COLORS[faction] || COLORS.NEUTRAL;
  },
};

export default WireframeFactory;
