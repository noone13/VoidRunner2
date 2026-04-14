// TunnelScene.js — hyperspace tunnel from system A to B

import * as THREE from 'three';
import WireframeFactory, { COLORS } from '../core/WireframeFactory.js';
import FactionState from '../core/FactionState.js';
import GameState from '../core/GameState.js';
import EventBus from '../core/EventBus.js';
import InputMap from '../core/InputMap.js';
import { buildShipMesh } from '../data/ShipBlueprints.js';
import galaxyData from '../data/galaxy.json';

// --- Seeded RNG ---
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// --- Constants ---
const TUNNEL_RADIUS = 4;
const PLAYER_BOUNDARY = 3.2;
const PLAYER_COLLISION_R = 0.3;
const OBSTACLE_COLLISION_R = 0.5;
const CARGO_COLLISION_R = 0.4;
const SEGMENT_DEPTH = 8;
const SEGMENTS_AHEAD = 12;
const TRAVEL_SPEED = 15; // units/sec base
const INERTIA_LERP = 0.15;
const MOVE_SPEED = 6;
const OBSTACLE_TYPES = ['box', 'tetra', 'ring'];
const WALL_DAMAGE = 10;

export default function createTunnelScene(canvas, uiOverlay, payload = {}) {
  const fromId = payload.from || 'crossroads';
  const toId = payload.to || 'sol';
  const isBlackRoute = !GameState.transponderActive;

  // Calculate tunnel length from system positions
  const systemMap = {};
  for (const s of galaxyData) systemMap[s.id] = s;
  const fromSys = systemMap[fromId];
  const toSys = systemMap[toId];
  const dx = (toSys?.position.x || 0) - (fromSys?.position.x || 0);
  const dy = (toSys?.position.y || 0) - (fromSys?.position.y || 0);
  const dz = (toSys?.position.z || 0) - (fromSys?.position.z || 0);
  let tunnelLength = Math.sqrt(dx * dx + dy * dy + dz * dz) * 8; // scale up for gameplay
  tunnelLength = Math.max(100, Math.min(400, tunnelLength));
  if (isBlackRoute) tunnelLength *= 1.3;

  // Seeded RNG
  const seed = hashString(fromId + toId);
  const rng = seededRandom(seed);

  // Tunnel color
  const toFaction = FactionState.getFaction(toId);
  const tunnelColor = isBlackRoute ? COLORS.NEUTRAL : (WireframeFactory.factionColor(toFaction) || COLORS.UI);

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

  // ---- Player ----
  const playerShip = buildShipMesh(GameState.ship.class, COLORS.PLAYER);
  playerShip.scale.setScalar(0.4);
  playerShip.rotation.x = Math.PI; // face forward (-Z becomes +Z in tunnel)
  scene.add(playerShip);

  const playerPos = { x: 0, y: 0 }; // 2D position in tunnel cross-section
  const playerVel = { x: 0, y: 0 };
  let wallHitCooldown = 0;

  // Camera offset: behind and above player
  function updateCamera() {
    camera.position.set(playerPos.x * 0.3, playerPos.y * 0.3 + 1.5, 3);
    camera.lookAt(playerPos.x * 0.5, playerPos.y * 0.5, -10);
    playerShip.position.set(playerPos.x, playerPos.y, 0);
  }
  updateCamera();

  // ---- Tunnel segments (object pool) ----
  const segmentPool = [];
  const activeSegments = [];
  let nextSegmentZ = -SEGMENT_DEPTH;

  function createSegmentMesh(z) {
    const group = new THREE.Group();

    // Ring
    const ringGeo = new THREE.RingGeometry(TUNNEL_RADIUS - 0.1, TUNNEL_RADIUS + 0.1, 16);
    const ring = WireframeFactory.wireframe(ringGeo, tunnelColor);
    ring.rotation.x = 0; // face the camera
    group.add(ring);

    // Decorative struts (2-4 random)
    const strutCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < strutCount; i++) {
      const angle = rng() * Math.PI * 2;
      const r = TUNNEL_RADIUS * 0.85;
      const len = 0.5 + rng() * 1.5;
      const strutGeo = new THREE.BoxGeometry(0.08, 0.08, len);
      const strut = WireframeFactory.edges(strutGeo, tunnelColor);
      strut.position.set(Math.cos(angle) * r, Math.sin(angle) * r, -len / 2);
      strut.lookAt(0, 0, strut.position.z);
      group.add(strut);
    }

    group.position.z = z;
    return group;
  }

  // Pre-generate segments ahead
  for (let i = 0; i < SEGMENTS_AHEAD; i++) {
    const seg = createSegmentMesh(nextSegmentZ);
    scene.add(seg);
    activeSegments.push(seg);
    nextSegmentZ -= SEGMENT_DEPTH;
  }

  // ---- Obstacles & Cargo ----
  const obstacles = [];
  const cargos = [];
  let totalDistanceTraveled = 0;
  let nextSpawnZ = -20;
  const SPAWN_INTERVAL = 12;

  function createObstacle(z) {
    const typeIdx = Math.floor(rng() * OBSTACLE_TYPES.length);
    let geo;
    switch (OBSTACLE_TYPES[typeIdx]) {
      case 'box': geo = new THREE.BoxGeometry(0.8, 0.8, 0.8); break;
      case 'tetra': geo = new THREE.TetrahedronGeometry(0.6); break;
      case 'ring': geo = new THREE.TorusGeometry(0.5, 0.12, 4, 6); break;
      default: geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    }
    const mesh = WireframeFactory.edges(geo, COLORS.WARNING);
    const angle = rng() * Math.PI * 2;
    const dist = rng() * (PLAYER_BOUNDARY - 0.5);
    mesh.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, z);
    mesh.userData = { type: 'obstacle', radius: OBSTACLE_COLLISION_R, rotSpeed: (rng() - 0.5) * 2 };
    scene.add(mesh);
    obstacles.push(mesh);
  }

  function createCargo(z) {
    const geo = new THREE.IcosahedronGeometry(0.3, 0);
    const mesh = WireframeFactory.edges(geo, COLORS.UI);
    const angle = rng() * Math.PI * 2;
    const dist = rng() * (PLAYER_BOUNDARY - 0.8);
    mesh.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, z);
    mesh.userData = { type: 'cargo', radius: CARGO_COLLISION_R, cargoType: GameState.randomLegalCargo(), collected: false };
    scene.add(mesh);
    cargos.push(mesh);
  }

  // Initial spawn
  for (let z = -20; z > -SEGMENTS_AHEAD * SEGMENT_DEPTH; z -= SPAWN_INTERVAL) {
    if (rng() < 0.5) createObstacle(z);
    if (rng() < 0.3) createCargo(z);
    nextSpawnZ = z - SPAWN_INTERVAL;
  }

  // ---- Random events ----
  const EVENT_CHECK_INTERVAL = tunnelLength / 5; // check every 20%
  let nextEventCheck = EVENT_CHECK_INTERVAL;
  let pirateAmbush = false;
  let eventMessages = [];
  const pirateBaseChance = isBlackRoute ? 0.35 : 0.20;

  function checkRandomEvent() {
    const roll = rng();
    if (roll < pirateBaseChance) {
      // Pirate ambush
      pirateAmbush = true;
      eventMessages.push({ text: '⚠ PIRATE AMBUSH DETECTED', color: '#ff4400', timer: 3 });
      console.log('pirate ambush → DOGFIGHT');
    } else if (roll < pirateBaseChance + 0.10) {
      // Anomaly bonus
      const bonus = Math.floor(50 + rng() * 150);
      GameState.credits += bonus;
      eventMessages.push({ text: `ANOMALY: +${bonus} CREDITS`, color: '#00ccff', timer: 3 });
    } else if (roll < pirateBaseChance + 0.18) {
      // Anomaly damage
      const dmg = Math.floor(5 + rng() * 10);
      GameState.takeDamage(dmg);
      eventMessages.push({ text: `ANOMALY: HULL DAMAGE -${dmg}`, color: '#ff4400', timer: 3 });
    } else if (roll < pirateBaseChance + 0.25) {
      // Distress signal (placeholder)
      eventMessages.push({ text: 'DISTRESS SIGNAL DETECTED — IGNORED', color: '#888888', timer: 3 });
    }
  }

  // ---- Hegemony Checkpoint ----
  let checkpointTriggered = false;
  const checkpointZ = -(tunnelLength * 0.5); // midpoint
  const hasIllegalCargo = GameState.cargo.some(c => c.illegal);
  const routeThroughHegemony = fromSys?.faction === 'hegemony' || toSys?.faction === 'hegemony';
  const showCheckpoint = !isBlackRoute && routeThroughHegemony && hasIllegalCargo;

  // ---- HUD ----
  const hud = document.createElement('div');
  hud.id = 'tunnel-hud';
  hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:"Courier New",monospace;font-size:12px;color:#00ccff;';
  uiOverlay.appendChild(hud);

  // Damage flash overlay
  const flashOverlay = document.createElement('div');
  flashOverlay.style.cssText = 'position:absolute;inset:0;background:rgba(255,68,0,0);transition:background 0.1s;pointer-events:none;';
  hud.appendChild(flashOverlay);

  function renderHUD() {
    const progress = Math.min(totalDistanceTraveled / tunnelLength, 1);
    const pctInt = Math.floor(progress * 100);
    const barLen = 50;
    const filled = Math.floor(progress * barLen);
    const bar = '='.repeat(filled) + '>' + ' '.repeat(Math.max(0, barLen - filled - 1));
    const hpPct = GameState.ship.hp / GameState.ship.maxHp;
    const hpBarLen = 10;
    const hpFilled = Math.round(hpPct * hpBarLen);
    const hpBar = '█'.repeat(hpFilled) + '░'.repeat(hpBarLen - hpFilled);

    let msgHtml = '';
    for (const msg of eventMessages) {
      msgHtml += `<div style="color:${msg.color};text-align:center;font-size:16px;margin-top:4px">${msg.text}</div>`;
    }

    hud.innerHTML = `
      <div style="position:absolute;top:12px;left:20px">SYSTEM: ${fromSys?.name || fromId} → ${toSys?.name || toId}</div>
      <div style="position:absolute;top:12px;right:20px">CREDITS: ${GameState.credits.toLocaleString()}</div>
      <div style="position:absolute;top:32px;left:20px">HP: ${hpBar}</div>
      <div style="position:absolute;top:32px;right:20px">CARGO: ${GameState.cargoTotal()}/${GameState.cargoCapacity}</div>
      <div style="position:absolute;top:56px;left:20px;right:20px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#888">
          <span>${fromSys?.name || fromId}</span><span>${toSys?.name || toId}</span>
        </div>
        <div>[${bar}] ${pctInt}%</div>
      </div>
      ${isBlackRoute ? '<div style="position:absolute;top:80px;left:20px;color:#ff4400">⚠ BLACK ROUTE</div>' : ''}
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">${msgHtml}</div>
    `;
    hud.appendChild(flashOverlay);
  }

  function flashDamage() {
    flashOverlay.style.background = 'rgba(255,68,0,0.3)';
    setTimeout(() => { flashOverlay.style.background = 'rgba(255,68,0,0)'; }, 150);
  }

  function flashPickup() {
    flashOverlay.style.background = 'rgba(0,204,255,0.2)';
    setTimeout(() => { flashOverlay.style.background = 'rgba(0,204,255,0)'; }, 150);
  }

  // ---- Resize ----
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // ---- Scene interface ----
  let finished = false;

  return {
    update(delta) {
      if (finished) return;

      // --- Input ---
      let inputX = 0, inputY = 0;
      if (InputMap.isDown('tunnel_left') || InputMap.isDown('tunnel_left2')) inputX = -1;
      if (InputMap.isDown('tunnel_right') || InputMap.isDown('tunnel_right2')) inputX = 1;
      if (InputMap.isDown('tunnel_up') || InputMap.isDown('tunnel_up2')) inputY = 1;
      if (InputMap.isDown('tunnel_down') || InputMap.isDown('tunnel_down2')) inputY = -1;

      // Velocity with inertia
      const targetVX = inputX * MOVE_SPEED;
      const targetVY = inputY * MOVE_SPEED;
      playerVel.x += (targetVX - playerVel.x) * INERTIA_LERP;
      playerVel.y += (targetVY - playerVel.y) * INERTIA_LERP;

      playerPos.x += playerVel.x * delta;
      playerPos.y += playerVel.y * delta;

      // Wall collision / boundary
      const distFromCenter = Math.sqrt(playerPos.x * playerPos.x + playerPos.y * playerPos.y);
      if (distFromCenter > PLAYER_BOUNDARY) {
        wallHitCooldown -= delta;
        if (wallHitCooldown <= 0) {
          const dead = GameState.takeDamage(WALL_DAMAGE);
          flashDamage();
          console.log(`wall hit: -${WALL_DAMAGE} HP`);
          wallHitCooldown = 0.5;
          if (dead) {
            finished = true;
            EventBus.emit('player:destroyed', { location: 'tunnel' });
            return;
          }
        }
        // Bounce
        const norm = distFromCenter;
        playerPos.x = (playerPos.x / norm) * PLAYER_BOUNDARY;
        playerPos.y = (playerPos.y / norm) * PLAYER_BOUNDARY;
        playerVel.x *= -0.5;
        playerVel.y *= -0.5;
      }

      // --- Travel progress ---
      const speed = TRAVEL_SPEED;
      const moveZ = speed * delta;
      totalDistanceTraveled += moveZ;

      // Move segments toward player (simulate forward motion)
      for (const seg of activeSegments) {
        seg.position.z += moveZ;
      }
      for (const ob of obstacles) {
        ob.position.z += moveZ;
        ob.rotation.x += ob.userData.rotSpeed * delta;
        ob.rotation.y += ob.userData.rotSpeed * delta * 0.7;
      }
      for (const c of cargos) {
        c.position.z += moveZ;
        // Pulse
        if (!c.userData.collected) {
          const pulse = 1 + 0.15 * Math.sin(totalDistanceTraveled * 3 + c.position.x);
          c.scale.setScalar(pulse);
        }
      }

      // Recycle segments behind camera
      for (let i = activeSegments.length - 1; i >= 0; i--) {
        if (activeSegments[i].position.z > 10) {
          const seg = activeSegments.splice(i, 1)[0];
          scene.remove(seg);
          seg.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
      }

      // Generate new segments ahead
      while (activeSegments.length < SEGMENTS_AHEAD) {
        const lastZ = activeSegments.length > 0 ? activeSegments[activeSegments.length - 1].position.z : 0;
        const newZ = lastZ - SEGMENT_DEPTH;
        const seg = createSegmentMesh(newZ);
        scene.add(seg);
        activeSegments.push(seg);
      }

      // Spawn new obstacles/cargo ahead
      const frontZ = activeSegments.length > 0 ? activeSegments[activeSegments.length - 1].position.z : -50;
      while (nextSpawnZ > frontZ) {
        nextSpawnZ -= SPAWN_INTERVAL;
      }
      // Keep spawning
      if (frontZ < nextSpawnZ + SPAWN_INTERVAL) {
        // already handled
      }
      // Simpler: spawn when we've traveled enough
      const spawnThreshold = -SEGMENTS_AHEAD * SEGMENT_DEPTH + 10;
      for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].position.z > 10) {
          scene.remove(obstacles[i]);
          obstacles[i].traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          obstacles.splice(i, 1);
        }
      }
      for (let i = cargos.length - 1; i >= 0; i--) {
        if (cargos[i].position.z > 10 || cargos[i].userData.collected) {
          scene.remove(cargos[i]);
          cargos[i].traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          cargos.splice(i, 1);
        }
      }

      // Spawn new objects at the far end
      if (activeSegments.length > 0) {
        const farZ = activeSegments[activeSegments.length - 1].position.z;
        if (rng() < 0.03) createObstacle(farZ - rng() * SEGMENT_DEPTH);
        if (rng() < 0.015) createCargo(farZ - rng() * SEGMENT_DEPTH);
      }

      // --- Collisions ---
      const pPos3 = new THREE.Vector3(playerPos.x, playerPos.y, 0);

      for (const ob of obstacles) {
        if (ob.position.z < -5 || ob.position.z > 5) continue;
        const obPos = new THREE.Vector2(ob.position.x, ob.position.y);
        const pPos2 = new THREE.Vector2(playerPos.x, playerPos.y);
        const dist = obPos.distanceTo(pPos2);
        if (dist < PLAYER_COLLISION_R + ob.userData.radius) {
          const dead = GameState.takeDamage(15);
          flashDamage();
          console.log('obstacle hit: -15 HP');
          // Push obstacle away
          ob.position.z = -10;
          if (dead) {
            finished = true;
            EventBus.emit('player:destroyed', { location: 'tunnel' });
            return;
          }
        }
      }

      for (const c of cargos) {
        if (c.userData.collected || c.position.z < -5 || c.position.z > 5) continue;
        const cPos2 = new THREE.Vector2(c.position.x, c.position.y);
        const pPos2 = new THREE.Vector2(playerPos.x, playerPos.y);
        const dist = cPos2.distanceTo(pPos2);
        if (dist < PLAYER_COLLISION_R + c.userData.radius) {
          c.userData.collected = true;
          c.visible = false;
          const cargoType = c.userData.cargoType;
          const added = GameState.addCargo(cargoType);
          if (added > 0) {
            flashPickup();
            console.log(`pickup: ${cargoType}`);
          } else {
            console.log('cargo hold full');
          }
        }
      }

      // --- Random events ---
      if (totalDistanceTraveled >= nextEventCheck && !pirateAmbush) {
        nextEventCheck += EVENT_CHECK_INTERVAL;
        checkRandomEvent();
      }

      // Handle pirate ambush — end tunnel
      if (pirateAmbush && eventMessages.length > 0 && eventMessages[0].timer !== undefined) {
        eventMessages[0].timer -= delta;
        if (eventMessages[0].timer <= 0) {
          finished = true;
          const count = 2 + Math.floor(rng() * 4);
          EventBus.emit('tunnel:ambush', { enemies: 'pirates', count, from: fromId, to: toId });
          return;
        }
      }

      // --- Hegemony checkpoint ---
      if (showCheckpoint && !checkpointTriggered) {
        const checkpointProgress = -checkpointZ;
        if (totalDistanceTraveled >= tunnelLength * 0.5) {
          checkpointTriggered = true;
          // Simple 50/50 roll
          const caught = rng() < 0.5;
          if (caught) {
            const fine = Math.floor(100 + rng() * 200);
            GameState.credits = Math.max(0, GameState.credits - fine);
            eventMessages.push({ text: `HEGEMONY INSPECTION — FINE: ${fine} CR`, color: '#4488ff', timer: 3 });
            console.log(`Hegemony checkpoint: fined ${fine} credits`);
          } else {
            eventMessages.push({ text: 'HEGEMONY INSPECTION — CLEARED', color: '#4488ff', timer: 3 });
            console.log('Hegemony checkpoint: cleared');
          }
        }
      }

      // --- Event message timers ---
      for (let i = eventMessages.length - 1; i >= 0; i--) {
        if (eventMessages[i].timer !== undefined) {
          eventMessages[i].timer -= delta;
          if (eventMessages[i].timer <= 0 && !pirateAmbush) {
            eventMessages.splice(i, 1);
          }
        }
      }

      // --- End of tunnel ---
      if (totalDistanceTraveled >= tunnelLength && !pirateAmbush) {
        finished = true;
        GameState.currentSystem = toId;
        GameState.lastPort = toId;
        GameState.save();
        EventBus.emit('tunnel:arrived', { from: fromId, to: toId });
        return;
      }

      // Ship tilt based on velocity
      playerShip.rotation.z = -playerVel.x * 0.05;
      playerShip.rotation.x = Math.PI + playerVel.y * 0.03;

      updateCamera();
      renderHUD();
    },

    render() {
      renderer.render(scene, camera);
    },

    destroy() {
      window.removeEventListener('resize', onResize);
      if (hud.parentNode) hud.parentNode.removeChild(hud);
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
