// GalaxyScene.js — 3D galaxy map with 40 systems

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import galaxyData from '../data/galaxy.json';
import FactionState from '../core/FactionState.js';
import WireframeFactory, { COLORS, FACTION_COLORS } from '../core/WireframeFactory.js';
import EventBus from '../core/EventBus.js';
import InputMap from '../core/InputMap.js';

// Unlocked systems — start with these 6
const INITIAL_UNLOCKED = ['crossroads', 'sol', 'nova_prime', 'the_den', 'drift', 'the_margin'];

export default function createGalaxyScene(canvas, uiOverlay, payload = {}) {
  // ---- State ----
  const unlockedSystems = new Set(payload.unlockedSystems || INITIAL_UNLOCKED);
  const systemMap = {};       // id → galaxy.json entry
  const nodeMeshes = {};      // id → THREE.Mesh (icosahedron)
  const stationMeshes = {};   // id → THREE.Mesh (orbiting cube)
  const labelObjects = {};    // id → CSS2DObject
  let selectedSystem = null;
  let hoveredSystem = null;
  let playerSystem = payload.currentSystem || 'crossroads';
  let elapsedTime = 0;

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);

  // CSS2D for labels
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  uiOverlay.appendChild(labelRenderer.domElement);

  // ---- Scene + Camera ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  // ISO start position — looking at center from (1,1,1) direction
  const isoDist = 35;
  const isoNorm = 1 / Math.sqrt(3);
  camera.position.set(isoDist * isoNorm, isoDist * isoNorm, isoDist * isoNorm);
  camera.lookAt(0, 0, 0);

  // ---- OrbitControls ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 5;
  controls.maxDistance = 80;

  // ---- Raycaster for hover/click ----
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);

  // ---- Build galaxy ----
  // Index systems
  for (const sys of galaxyData) {
    systemMap[sys.id] = sys;
  }

  // Routes (drawn once, stored for potential updates)
  const routeGroup = new THREE.Group();
  scene.add(routeGroup);
  const drawnRoutes = new Set();

  for (const sys of galaxyData) {
    const p1 = new THREE.Vector3(sys.position.x, sys.position.y, sys.position.z);
    for (const connId of sys.connections) {
      const routeKey = [sys.id, connId].sort().join('-');
      if (drawnRoutes.has(routeKey)) continue;
      drawnRoutes.add(routeKey);

      const conn = systemMap[connId];
      if (!conn) continue;
      const p2 = new THREE.Vector3(conn.position.x, conn.position.y, conn.position.z);

      const bothUnlocked = unlockedSystems.has(sys.id) && unlockedSystems.has(connId);
      if (bothUnlocked) {
        routeGroup.add(WireframeFactory.line(p1, p2, COLORS.NEUTRAL));
      } else {
        routeGroup.add(WireframeFactory.dashedLine(p1, p2, COLORS.LOCKED));
      }
    }
  }

  // System nodes
  for (const sys of galaxyData) {
    const isUnlocked = unlockedSystems.has(sys.id);
    const faction = FactionState.getFaction(sys.id);
    const color = isUnlocked ? WireframeFactory.factionColor(faction) : COLORS.LOCKED;

    // Node — icosahedron wireframe
    const geo = new THREE.IcosahedronGeometry(0.3, 0);
    const mesh = WireframeFactory.edges(geo, color);
    mesh.position.set(sys.position.x, sys.position.y, sys.position.z);
    mesh.userData = { systemId: sys.id, isUnlocked };
    nodeGroup.add(mesh);
    nodeMeshes[sys.id] = mesh;

    // Label — CSS2D
    const labelDiv = document.createElement('div');
    labelDiv.textContent = sys.name;
    labelDiv.style.fontSize = '10px';
    labelDiv.style.fontFamily = "'Courier New', monospace";
    labelDiv.style.color = isUnlocked ? '#' + color.toString(16).padStart(6, '0') : '#333333';
    labelDiv.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.userSelect = 'none';
    const label = new CSS2DObject(labelDiv);
    label.position.set(sys.position.x, sys.position.y + 0.6, sys.position.z);
    scene.add(label);
    labelObjects[sys.id] = { obj: label, div: labelDiv };

    // Station — small orbiting cube
    if (FactionState.hasStation(sys.id) && isUnlocked) {
      const stGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const stMesh = WireframeFactory.edges(stGeo, color);
      stMesh.position.copy(mesh.position);
      scene.add(stMesh);
      stationMeshes[sys.id] = stMesh;
    }
  }

  // Player marker — slightly larger ring at current system
  const playerMarkerGeo = new THREE.RingGeometry(0.45, 0.55, 16);
  const playerMarker = WireframeFactory.edges(playerMarkerGeo, COLORS.PLAYER);
  const pSys = systemMap[playerSystem];
  if (pSys) {
    playerMarker.position.set(pSys.position.x, pSys.position.y, pSys.position.z);
  }
  scene.add(playerMarker);

  // ---- Viewport Cube ----
  const viewCubeContainer = document.createElement('div');
  viewCubeContainer.id = 'viewport-cube';
  viewCubeContainer.style.cssText = 'position:absolute;top:10px;right:10px;width:80px;height:80px;pointer-events:auto;';
  uiOverlay.appendChild(viewCubeContainer);

  const vcScene = new THREE.Scene();
  const vcCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  vcCamera.position.set(0, 0, 3);
  const vcRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  vcRenderer.setSize(80, 80);
  vcRenderer.setClearColor(0x000000, 0);
  viewCubeContainer.appendChild(vcRenderer.domElement);

  // Cube faces
  const vcGeo = new THREE.BoxGeometry(1, 1, 1);
  const vcMesh = WireframeFactory.edges(vcGeo, COLORS.UI);
  vcScene.add(vcMesh);

  // Face labels for viewport cube
  const facePositions = {
    'TOP': { pos: [0, 1.8, 0], cam: [0, 1, 0.001] },
    'FRONT': { pos: [0, 0, 1.8], cam: [0, 0, 1] },
    'RIGHT': { pos: [1.8, 0, 0], cam: [1, 0, 0] },
    'ISO': { pos: [1.8, 1.8, 1.8], cam: [1, 1, 1] },
  };

  // Click on viewport cube → animate camera
  let cameraAnimating = false;
  let cameraAnimStart = 0;
  let cameraAnimFrom = new THREE.Vector3();
  let cameraAnimTo = new THREE.Vector3();
  const CAMERA_ANIM_DURATION = 0.6;

  viewCubeContainer.addEventListener('click', (e) => {
    const rect = viewCubeContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Simple quadrant detection
    let target;
    if (y < 0.33) {
      target = facePositions['TOP'];
    } else if (x > 0.66) {
      target = facePositions['RIGHT'];
    } else if (y > 0.66) {
      target = facePositions['ISO'];
    } else {
      target = facePositions['FRONT'];
    }

    const dir = new THREE.Vector3(...target.cam).normalize();
    const dist = camera.position.length();
    cameraAnimFrom.copy(camera.position);
    cameraAnimTo.copy(dir.multiplyScalar(dist));
    cameraAnimating = true;
    cameraAnimStart = elapsedTime;
  });

  // ---- InfoPanel ----
  const infoPanel = document.createElement('div');
  infoPanel.id = 'info-panel';
  infoPanel.style.cssText = `
    position:absolute; right:20px; top:50%; transform:translateY(-50%);
    width:280px; padding:16px; display:none;
    border:1px solid #00ccff; background:rgba(0,0,0,0.85);
    font-family:'Courier New',monospace; font-size:12px; color:#00ccff;
  `;
  uiOverlay.appendChild(infoPanel);

  function showInfoPanel(sys) {
    const isUnlocked = unlockedSystems.has(sys.id);
    const faction = FactionState.getFaction(sys.id);
    const station = FactionState.hasStation(sys.id);
    const stationTier = FactionState.getStationTier(sys.id);
    const isCurrentSystem = sys.id === playerSystem;

    if (!isUnlocked) {
      infoPanel.innerHTML = `
        <div style="font-size:14px;margin-bottom:8px;color:#888">${sys.name}</div>
        <div style="color:#ff4400">⚠ REGION UNEXPLORED</div>
        <div style="margin-top:8px;color:#666">Expand your influence to unlock this system.</div>
        <button id="info-close" style="margin-top:12px;background:none;border:1px solid #888;color:#888;padding:4px 16px;cursor:pointer;font-family:inherit;">CLOSE</button>
      `;
    } else {
      const tierStars = '★'.repeat(sys.tier) + '☆'.repeat(3 - sys.tier);
      const canTravel = !isCurrentSystem && isUnlocked;
      const isConnected = sys.connections.includes(playerSystem) || systemMap[playerSystem]?.connections.includes(sys.id);

      infoPanel.innerHTML = `
        <div style="font-size:14px;margin-bottom:4px">${sys.name}</div>
        <div style="color:#888;margin-bottom:8px">${faction.toUpperCase()}</div>
        <div>Tier: ${tierStars}  Station: ${station ? 'Yes (T' + stationTier + ')' : 'No'}  Planet: ${sys.hasPlanet ? 'Yes' : 'No'}</div>
        <div style="margin-top:8px;color:#aaa">${sys.description}</div>
        ${isCurrentSystem ? '<div style="margin-top:8px;color:#00ff88">YOU ARE HERE</div>' : ''}
        <div style="margin-top:12px;display:flex;gap:8px">
          ${canTravel && isConnected ? `<button id="info-travel" style="background:none;border:1px solid #00ccff;color:#00ccff;padding:4px 16px;cursor:pointer;font-family:inherit;">TRAVEL HERE</button>` : ''}
          ${canTravel && !isConnected ? `<div style="color:#666;font-size:10px">No direct route from ${systemMap[playerSystem]?.name || playerSystem}</div>` : ''}
          <button id="info-close" style="background:none;border:1px solid #888;color:#888;padding:4px 16px;cursor:pointer;font-family:inherit;">CLOSE</button>
        </div>
      `;
    }

    infoPanel.style.display = 'block';

    // Wire buttons
    const travelBtn = infoPanel.querySelector('#info-travel');
    if (travelBtn) {
      travelBtn.onclick = () => {
        EventBus.emit('travel:requested', { from: playerSystem, to: sys.id });
        infoPanel.style.display = 'none';
        selectedSystem = null;
      };
    }
    const closeBtn = infoPanel.querySelector('#info-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        infoPanel.style.display = 'none';
        selectedSystem = null;
      };
    }
  }

  // ---- Mouse interaction ----
  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function onClick(e) {
    // Ignore clicks on UI elements
    if (e.target.closest('#info-panel') || e.target.closest('#viewport-cube')) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeGroup.children, false);

    if (intersects.length > 0) {
      const sysId = intersects[0].object.userData.systemId;
      const sys = systemMap[sysId];
      if (sys) {
        selectedSystem = sysId;
        showInfoPanel(sys);
        EventBus.emit('system:selected', { id: sysId, ...sys });
      }
    } else {
      infoPanel.style.display = 'none';
      selectedSystem = null;
    }
  }

  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onClick);

  // ---- HUD: current system + credits ----
  const hudBar = document.createElement('div');
  hudBar.id = 'galaxy-hud';
  hudBar.style.cssText = `
    position:absolute; bottom:20px; left:50%; transform:translateX(-50%);
    font-family:'Courier New',monospace; font-size:12px; color:#00ccff;
    display:flex; gap:30px;
  `;
  hudBar.innerHTML = `
    <span>SYSTEM: ${systemMap[playerSystem]?.name || playerSystem}</span>
    <span>CREDITS: 1,500</span>
  `;
  uiOverlay.appendChild(hudBar);

  // ---- Resize ----
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // ---- Easing ----
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ---- Scene interface ----
  return {
    update(delta) {
      elapsedTime += delta;
      controls.update();

      // Pulse animation on unlocked nodes
      for (const sys of galaxyData) {
        const mesh = nodeMeshes[sys.id];
        if (!mesh) continue;
        if (unlockedSystems.has(sys.id)) {
          const pulse = 1.0 + 0.05 * Math.sin(elapsedTime * 2 + sys.position.x);
          mesh.scale.setScalar(pulse);
        }
      }

      // Station orbiting
      for (const [sysId, stMesh] of Object.entries(stationMeshes)) {
        const sys = systemMap[sysId];
        if (!sys) continue;
        const angle = elapsedTime * 0.5 + sys.position.x;
        const orbitR = 0.6;
        stMesh.position.set(
          sys.position.x + Math.cos(angle) * orbitR,
          sys.position.y + 0.1,
          sys.position.z + Math.sin(angle) * orbitR,
        );
        stMesh.rotation.y = elapsedTime;
      }

      // Hover detection
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeGroup.children, false);
      const newHovered = intersects.length > 0 ? intersects[0].object.userData.systemId : null;

      if (newHovered !== hoveredSystem) {
        // Reset old hover
        if (hoveredSystem && nodeMeshes[hoveredSystem] && hoveredSystem !== selectedSystem) {
          const oldSys = systemMap[hoveredSystem];
          const isUnlocked = unlockedSystems.has(hoveredSystem);
          const color = isUnlocked ? WireframeFactory.factionColor(FactionState.getFaction(hoveredSystem)) : COLORS.LOCKED;
          nodeMeshes[hoveredSystem].material.color.setHex(color);
        }
        // Set new hover
        if (newHovered && nodeMeshes[newHovered]) {
          nodeMeshes[newHovered].material.color.setHex(COLORS.UI);
          renderer.domElement.style.cursor = 'pointer';
        } else {
          renderer.domElement.style.cursor = 'default';
        }
        hoveredSystem = newHovered;
      }

      // Camera animation
      if (cameraAnimating) {
        const t = Math.min((elapsedTime - cameraAnimStart) / CAMERA_ANIM_DURATION, 1);
        const eased = easeInOutCubic(t);
        camera.position.lerpVectors(cameraAnimFrom, cameraAnimTo, eased);
        camera.lookAt(0, 0, 0);
        if (t >= 1) cameraAnimating = false;
      }

      // Sync viewport cube rotation with main camera
      vcMesh.quaternion.copy(camera.quaternion).invert();

      // Player marker rotation
      playerMarker.lookAt(camera.position);
    },

    render() {
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      vcRenderer.render(vcScene, vcCamera);
    },

    destroy() {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();

      // Clean up UI
      if (infoPanel.parentNode) infoPanel.parentNode.removeChild(infoPanel);
      if (hudBar.parentNode) hudBar.parentNode.removeChild(hudBar);
      if (viewCubeContainer.parentNode) viewCubeContainer.parentNode.removeChild(viewCubeContainer);
      if (labelRenderer.domElement.parentNode) labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
      vcRenderer.dispose();

      // Dispose Three.js
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
    },

    // Expose for StateManager / external access
    get unlockedSystems() { return unlockedSystems; },
    get playerSystem() { return playerSystem; },

    unlockSystem(sysId) {
      if (unlockedSystems.has(sysId)) return;
      unlockedSystems.add(sysId);
      // Update node color
      const mesh = nodeMeshes[sysId];
      if (mesh) {
        const faction = FactionState.getFaction(sysId);
        const color = WireframeFactory.factionColor(faction);
        mesh.material.color.setHex(color);
        mesh.userData.isUnlocked = true;
      }
      // Update label color
      const label = labelObjects[sysId];
      if (label) {
        const faction = FactionState.getFaction(sysId);
        const color = WireframeFactory.factionColor(faction);
        label.div.style.color = '#' + color.toString(16).padStart(6, '0');
      }
      EventBus.emit('system:unlocked', { id: sysId });
    },

    setPlayerSystem(sysId) {
      playerSystem = sysId;
      const sys = systemMap[sysId];
      if (sys) {
        playerMarker.position.set(sys.position.x, sys.position.y, sys.position.z);
      }
      // Unlock neighbors
      if (sys) {
        for (const connId of sys.connections) {
          if (!unlockedSystems.has(connId)) {
            this.unlockSystem(connId);
          }
        }
      }
    },

    renderer,
  };
}
