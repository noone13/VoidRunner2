// MenuScene.js — Main menu with auto-rotating galaxy background

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import galaxyData from '../data/galaxy.json';
import FactionState from '../core/FactionState.js';
import WireframeFactory, { COLORS } from '../core/WireframeFactory.js';
import EventBus from '../core/EventBus.js';

export default function createMenuScene(canvas, uiOverlay) {
  let elapsedTime = 0;

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);

  // ---- Scene + Camera ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(20, 12, 20);
  camera.lookAt(0, 0, 0);

  // ---- Background galaxy (non-interactive) ----
  const systemMap = {};
  for (const sys of galaxyData) {
    systemMap[sys.id] = sys;
  }

  const drawnRoutes = new Set();
  for (const sys of galaxyData) {
    const p1 = new THREE.Vector3(sys.position.x, sys.position.y, sys.position.z);

    // Node
    const faction = FactionState.getFaction(sys.id);
    const color = WireframeFactory.factionColor(faction);
    const geo = new THREE.IcosahedronGeometry(0.25, 0);
    const mesh = WireframeFactory.edges(geo, color);
    mesh.position.copy(p1);
    scene.add(mesh);

    // Routes
    for (const connId of sys.connections) {
      const routeKey = [sys.id, connId].sort().join('-');
      if (drawnRoutes.has(routeKey)) continue;
      drawnRoutes.add(routeKey);
      const conn = systemMap[connId];
      if (!conn) continue;
      const p2 = new THREE.Vector3(conn.position.x, conn.position.y, conn.position.z);
      scene.add(WireframeFactory.line(p1, p2, COLORS.NEUTRAL));
    }
  }

  // ---- Menu UI ----
  const menuDiv = document.createElement('div');
  menuDiv.id = 'main-menu';
  menuDiv.style.cssText = `
    position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; pointer-events:auto;
    background: linear-gradient(transparent 40%, rgba(0,0,0,0.7) 100%);
  `;
  menuDiv.innerHTML = `
    <div style="font-family:'Courier New',monospace;color:#00ccff;font-size:48px;letter-spacing:8px;margin-bottom:60px;text-shadow:0 0 20px rgba(0,204,255,0.5)">
      VOID RUNNER
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;width:240px">
      <button class="menu-btn" data-action="new">NEW GAME</button>
      <button class="menu-btn" data-action="load" id="btn-load">LOAD GAME</button>
      <button class="menu-btn" data-action="settings">SETTINGS</button>
    </div>
    <div style="position:absolute;bottom:20px;left:20px;font-family:'Courier New',monospace;color:#444;font-size:11px">v0.1.0</div>
    <style>
      .menu-btn {
        background: none; border: 1px solid #00ccff44; color: #00ccff;
        padding: 10px 0; font-family: 'Courier New', monospace; font-size: 14px;
        letter-spacing: 3px; cursor: pointer; transition: all 0.2s;
      }
      .menu-btn:hover { border-color: #00ccff; background: rgba(0,204,255,0.08); text-shadow: 0 0 8px #00ccff; }
      .menu-btn:disabled { color: #333; border-color: #333; cursor: default; }
      .menu-btn:disabled:hover { background: none; text-shadow: none; }
    </style>
  `;
  uiOverlay.appendChild(menuDiv);

  // Disable LOAD if no save
  const hasSave = !!localStorage.getItem('voidrunner_save');
  const loadBtn = menuDiv.querySelector('#btn-load');
  if (!hasSave) loadBtn.disabled = true;

  // Button handlers
  menuDiv.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-btn');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    if (action === 'new') {
      EventBus.emit('menu:action', { action: 'new_game' });
    } else if (action === 'load') {
      EventBus.emit('menu:action', { action: 'load_game' });
    } else if (action === 'settings') {
      EventBus.emit('menu:action', { action: 'settings' });
    }
  });

  // ---- Resize ----
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    update(delta) {
      elapsedTime += delta;
      // Auto-rotate camera around center
      const angle = elapsedTime * 0.08;
      const dist = 35;
      camera.position.set(Math.cos(angle) * dist, 12 + Math.sin(elapsedTime * 0.05) * 3, Math.sin(angle) * dist);
      camera.lookAt(0, 0, 0);
    },

    render() {
      renderer.render(scene, camera);
    },

    destroy() {
      window.removeEventListener('resize', onResize);
      if (menuDiv.parentNode) menuDiv.parentNode.removeChild(menuDiv);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
    },

    renderer,
  };
}
