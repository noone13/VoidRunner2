// PlanetAttackScene.js — terrain-skimming attack on planet surface
// 4 sequential phases: fighters → towers → garrison → capital ship

import * as THREE from 'three';
import WireframeFactory, { COLORS } from '../core/WireframeFactory.js';
import FactionState from '../core/FactionState.js';
import GameState from '../core/GameState.js';
import EventBus from '../core/EventBus.js';
import InputMap from '../core/InputMap.js';
import { buildShipMesh } from '../data/ShipBlueprints.js';
import galaxyData from '../data/galaxy.json';

// ---- Seeded RNG ----
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

// ---- Constants ----
const TERRAIN_SIZE = 200;
const TERRAIN_SEGMENTS = 60;
const PLAYER_MIN_ALT = 2;
const PLAYER_MAX_ALT = 15;
const FORWARD_SPEED = 12;
const YAW_SPEED = 2.0;
const ALT_SPEED = 6;
const LASER_COOLDOWN = 0.25;
const LASER_SPEED = 60;
const LASER_DAMAGE = 25;
const LASER_RANGE = 80;

export default function createPlanetAttackScene(canvas, uiOverlay, payload = {}) {
  const systemId = payload.systemId || 'sol';
  const faction = payload.faction || FactionState.getFaction(systemId);
  const systemData = galaxyData.find(s => s.id === systemId);
  const tier = systemData?.tier || 1;
  const factionColor = WireframeFactory.factionColor(faction);

  const rng = seededRandom(hashString(systemId));

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

  // ---- Procedural terrain ----
  const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.getAttribute('position');
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const height = (rng() - 0.5) * 3 + Math.sin(x * 0.05) * 1.5 + Math.cos(z * 0.07) * 1.2;
    posAttr.setY(i, height);
  }
  terrainGeo.computeVertexNormals();
  const terrain = WireframeFactory.wireframe(terrainGeo, factionColor);
  terrain.position.set(0, 0, 0);
  scene.add(terrain);

  // Second terrain chunk ahead for seamless scrolling
  const terrain2 = terrain.clone();
  terrain2.position.z = -TERRAIN_SIZE;
  scene.add(terrain2);

  // ---- Player ship ----
  const playerShip = buildShipMesh(GameState.ship.class, COLORS.PLAYER);
  playerShip.scale.setScalar(0.5);
  scene.add(playerShip);

  let playerX = 0;
  let playerAlt = 8;
  let playerYaw = 0;   // radians, 0 = forward (-Z)
  let terrainOffset = 0;
  let fireCooldown = 0;

  // Camera: third-person follow
  function updatePlayerAndCamera() {
    playerShip.position.set(playerX, playerAlt, 0);
    playerShip.rotation.set(0, playerYaw + Math.PI, 0);

    camera.position.set(
      playerX - Math.sin(playerYaw) * 4,
      playerAlt + 2,
      3,
    );
    camera.lookAt(playerX, playerAlt, -10);
  }

  // ---- Projectiles ----
  const projectiles = [];

  function firePlayerLaser() {
    if (fireCooldown > 0) return;
    fireCooldown = LASER_COOLDOWN;

    const dir = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw)).normalize();
    const startPos = new THREE.Vector3(playerX, playerAlt, 0).add(dir.clone().multiplyScalar(1.5));

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      dir.clone().multiplyScalar(2),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: COLORS.PLAYER });
    const mesh = new THREE.Line(geo, mat);
    mesh.position.copy(startPos);
    scene.add(mesh);

    projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(LASER_SPEED),
      life: LASER_RANGE / LASER_SPEED,
      damage: LASER_DAMAGE,
      owner: 'player',
    });
  }

  // ---- Explosions ----
  const explosions = [];

  function createExplosion(position, color = COLORS.ENEMY, scale = 1) {
    const count = Math.floor((6 + Math.random() * 6) * scale);
    const group = new THREE.Group();
    group.position.copy(position);
    const frags = [];
    for (let i = 0; i < count; i++) {
      const geo = new THREE.TetrahedronGeometry(0.15 * scale + Math.random() * 0.15 * scale);
      const frag = WireframeFactory.edges(geo, color);
      frag.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6 * scale,
        Math.random() * 4 * scale,
        (Math.random() - 0.5) * 6 * scale,
      );
      frag.userData.rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
      );
      group.add(frag);
      frags.push(frag);
    }
    scene.add(group);
    explosions.push({ group, frags, life: 1.5, maxLife: 1.5 });
  }

  // Camera shake
  let shakeIntensity = 0;
  let shakeTimer = 0;

  function triggerShake(intensity = 0.3, duration = 0.5) {
    shakeIntensity = intensity;
    shakeTimer = duration;
  }

  // ---- Phase system ----
  const PHASES = { FIGHTERS: 1, TOWERS: 2, GARRISON: 3, CAPITAL: 4, COMPLETE: 5 };
  let currentPhase = PHASES.FIGHTERS;
  let phaseInitialized = false;

  // Phase entities
  const fighters = [];    // Phase 1 + Phase 3 fighters
  const towers = [];      // Phase 2
  const drones = [];      // Phase 3
  let capitalShip = null; // Phase 4
  let capitalShipSpawnTimer = 0;
  let hasCapitalShip = tier === 3 || rng() < 0.3;

  // Fighter counts per tier
  const fighterCountP1 = [4, 6, 8][tier - 1];
  const towerCount = [3, 4, 6][tier - 1];
  const droneCount = [4, 6, 8][tier - 1];
  const fighterCountP3 = [2, 3, 4][tier - 1];
  const towerHp = [60, 100, 150][tier - 1];
  const capitalHp = [400, 600, 1000][tier - 1];

  // ---- Phase 1: Fighters ----
  function initPhase1() {
    for (let i = 0; i < fighterCountP1; i++) {
      const x = (rng() - 0.5) * 40;
      const z = -30 - rng() * 30;
      const y = 5 + rng() * 8;
      const mesh = buildShipMesh('courier', factionColor);
      mesh.scale.setScalar(0.4);
      mesh.position.set(x, y, z);
      scene.add(mesh);

      fighters.push({
        mesh,
        hp: 50,
        maxHp: 50,
        phase: 1,
        speed: 7 + rng() * 3,
        ai: { fireTimer: 1 + rng(), fireCooldown: 0.8 + rng() * 0.4 },
        flashTimer: 0,
      });
    }
  }

  // ---- Phase 2: Defense Towers ----
  function initPhase2() {
    for (let i = 0; i < towerCount; i++) {
      const x = (rng() - 0.5) * 80;
      const z = -20 - rng() * 60;
      const baseGeo = new THREE.CylinderGeometry(0.4, 0.6, 2, 6);
      const base = WireframeFactory.edges(baseGeo, factionColor);
      const headGeo = new THREE.SphereGeometry(0.35, 4, 3);
      const head = WireframeFactory.edges(headGeo, factionColor);
      head.position.y = 1.3;

      const group = new THREE.Group();
      group.add(base);
      group.add(head);
      group.position.set(x, 1, z);
      scene.add(group);

      towers.push({
        mesh: group,
        head,
        hp: towerHp,
        maxHp: towerHp,
        fireTimer: 1.5 + rng() * 2,
        fireCooldown: 1.5,
        flashTimer: 0,
      });
    }
  }

  // ---- Phase 3: Drones + fighters ----
  function initPhase3() {
    // Drones
    for (let i = 0; i < droneCount; i++) {
      const x = (rng() - 0.5) * 50;
      const z = -40 - rng() * 20;
      const geo = new THREE.TetrahedronGeometry(0.25);
      const mesh = WireframeFactory.edges(geo, factionColor);
      mesh.position.set(x, 4 + rng() * 5, z);
      scene.add(mesh);

      drones.push({
        mesh,
        hp: 20,
        maxHp: 20,
        speed: 10 + rng() * 4,
        flashTimer: 0,
      });
    }

    // Additional fighters
    for (let i = 0; i < fighterCountP3; i++) {
      const x = (rng() - 0.5) * 40;
      const z = -50 - rng() * 20;
      const mesh = buildShipMesh('courier', factionColor);
      mesh.scale.setScalar(0.4);
      mesh.position.set(x, 6 + rng() * 6, z);
      scene.add(mesh);

      fighters.push({
        mesh,
        hp: 60,
        maxHp: 60,
        phase: 3,
        speed: 8 + rng() * 3,
        ai: { fireTimer: 1 + rng(), fireCooldown: 0.7 + rng() * 0.3 },
        flashTimer: 0,
      });
    }
  }

  // ---- Phase 4: Capital Ship ----
  function initPhase4() {
    if (!hasCapitalShip) {
      currentPhase = PHASES.COMPLETE;
      return;
    }

    // Capital ship mesh — elongated hull + turrets
    const hullGeo = new THREE.BoxGeometry(3, 1.5, 8);
    const hull = WireframeFactory.edges(hullGeo, factionColor);
    const group = new THREE.Group();
    group.add(hull);

    const turrets = [];
    const turretPositions = [
      new THREE.Vector3(-1.2, 1, -2),
      new THREE.Vector3(1.2, 1, -2),
      new THREE.Vector3(-1.2, 1, 2),
      new THREE.Vector3(1.2, 1, 2),
    ];
    for (const tp of turretPositions) {
      const tGeo = new THREE.SphereGeometry(0.3, 4, 3);
      const tMesh = WireframeFactory.edges(tGeo, factionColor);
      tMesh.position.copy(tp);
      group.add(tMesh);
      turrets.push({ mesh: tMesh, hp: 80, maxHp: 80, alive: true, fireTimer: 2 + rng() * 2, fireCooldown: 1.5 });
    }

    group.position.set(0, 15, -60);
    scene.add(group);

    capitalShip = {
      mesh: group,
      hull,
      hp: capitalHp,
      maxHp: capitalHp,
      turrets,
      speed: 2,
      fighterSpawnTimer: 30,
      flashTimer: 0,
    };
  }

  // ---- Generic enemy update (fighters chase player) ----
  function updateFighter(f, delta) {
    if (f.hp <= 0) return;
    const playerPos = new THREE.Vector3(playerX, playerAlt, 0);
    const toPlayer = playerPos.clone().sub(f.mesh.position);
    const dist = toPlayer.length();
    const dir = toPlayer.normalize();

    // Move toward player
    const vel = dir.multiplyScalar(f.speed * delta);
    f.mesh.position.add(vel);
    f.mesh.lookAt(playerPos);

    // Keep above terrain
    if (f.mesh.position.y < 2) f.mesh.position.y = 2;

    // Fire
    f.ai.fireTimer -= delta;
    if (f.ai.fireTimer <= 0 && dist < 50) {
      fireEnemyProjectile(f.mesh.position.clone(), dir.clone(), dist);
      f.ai.fireTimer = f.ai.fireCooldown;
    }

    // Flash
    if (f.flashTimer > 0) f.flashTimer -= delta;
  }

  // ---- Drone swarm AI ----
  function updateDrone(d, delta) {
    if (d.hp <= 0) return;
    const playerPos = new THREE.Vector3(playerX, playerAlt, 0);
    const toPlayer = playerPos.clone().sub(d.mesh.position);
    const dist = toPlayer.length();
    const dir = toPlayer.normalize();

    // Swarm: move toward player with jitter
    const jitter = new THREE.Vector3((rng() - 0.5) * 2, (rng() - 0.5) * 1, (rng() - 0.5) * 2);
    const vel = dir.add(jitter.multiplyScalar(0.3)).normalize().multiplyScalar(d.speed * delta);
    d.mesh.position.add(vel);
    d.mesh.rotation.x += delta * 3;
    d.mesh.rotation.y += delta * 2;

    if (d.mesh.position.y < 2) d.mesh.position.y = 2;

    // Drones don't shoot — they ram (collision damage at close range)
    if (dist < 2) {
      GameState.takeDamage(5);
      d.hp = 0;
      d.mesh.visible = false;
      createExplosion(d.mesh.position.clone(), factionColor, 0.5);
    }

    if (d.flashTimer > 0) d.flashTimer -= delta;
  }

  // ---- Tower update ----
  function updateTower(t, delta) {
    if (t.hp <= 0) return;
    const playerPos = new THREE.Vector3(playerX, playerAlt, 0);
    const toPlayer = playerPos.clone().sub(t.mesh.position);
    const dist = toPlayer.length();

    // Rotate head toward player
    t.head.lookAt(playerPos);

    // Fire
    t.fireTimer -= delta;
    if (t.fireTimer <= 0 && dist < 80) {
      const dir = toPlayer.normalize();
      const angle = Math.acos(new THREE.Vector3(0, 0, -1).dot(dir));
      if (angle < 30 * Math.PI / 180 || dist < 30) {
        fireEnemyProjectile(t.mesh.position.clone().add(new THREE.Vector3(0, 1.3, 0)), dir, dist);
        t.fireTimer = t.fireCooldown;
      }
    }

    if (t.flashTimer > 0) t.flashTimer -= delta;
  }

  // ---- Capital ship update ----
  function updateCapitalShip(delta) {
    if (!capitalShip || capitalShip.hp <= 0) return;

    const playerPos = new THREE.Vector3(playerX, playerAlt, 0);

    // Slow movement toward player
    const toPlayer = playerPos.clone().sub(capitalShip.mesh.position).normalize();
    capitalShip.mesh.position.add(toPlayer.multiplyScalar(capitalShip.speed * delta));
    capitalShip.mesh.lookAt(playerPos);

    // Keep altitude
    if (capitalShip.mesh.position.y < 10) capitalShip.mesh.position.y = 10;

    // Turret firing
    for (const t of capitalShip.turrets) {
      if (!t.alive) continue;
      t.fireTimer -= delta;
      if (t.fireTimer <= 0) {
        const tWorldPos = new THREE.Vector3();
        t.mesh.getWorldPosition(tWorldPos);
        const dir = playerPos.clone().sub(tWorldPos).normalize();
        fireEnemyProjectile(tWorldPos, dir, playerPos.distanceTo(tWorldPos));
        t.fireTimer = t.fireCooldown;
      }
    }

    // Spawn fighters every 30s
    capitalShip.fighterSpawnTimer -= delta;
    if (capitalShip.fighterSpawnTimer <= 0) {
      capitalShip.fighterSpawnTimer = 30;
      for (let i = 0; i < 2; i++) {
        const pos = capitalShip.mesh.position.clone().add(
          new THREE.Vector3((rng() - 0.5) * 8, -2, (rng() - 0.5) * 8)
        );
        const mesh = buildShipMesh('courier', factionColor);
        mesh.scale.setScalar(0.4);
        mesh.position.copy(pos);
        scene.add(mesh);
        fighters.push({
          mesh, hp: 50, maxHp: 50, phase: 4,
          speed: 8, ai: { fireTimer: 1, fireCooldown: 0.8 }, flashTimer: 0,
        });
      }
    }

    if (capitalShip.flashTimer > 0) capitalShip.flashTimer -= delta;
  }

  // ---- Enemy projectile ----
  function fireEnemyProjectile(startPos, direction, distance) {
    const spread = distance < 15 ? 0.08 : distance < 40 ? 0.15 : 0.25;
    const dir = direction.clone();
    dir.x += (rng() - 0.5) * spread * 2;
    dir.y += (rng() - 0.5) * spread * 2;
    dir.z += (rng() - 0.5) * spread * 2;
    dir.normalize();

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      dir.clone().multiplyScalar(1.5),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: COLORS.ENEMY });
    const mesh = new THREE.Line(geo, mat);
    mesh.position.copy(startPos);
    scene.add(mesh);

    projectiles.push({ mesh, velocity: dir.multiplyScalar(40), life: 2, damage: 8, owner: 'enemy' });
  }

  // ---- Hit test helpers ----
  function hitTestEntity(entity, projPos, radius = 1.5) {
    return entity.hp > 0 && projPos.distanceTo(entity.mesh.position) < radius;
  }

  function damageEntity(entity, damage, color) {
    entity.hp -= damage;
    entity.flashTimer = 0.1;
    if (entity.hp <= 0) {
      entity.mesh.visible = false;
      createExplosion(entity.mesh.position.clone(), color);
    }
  }

  // ---- HUD ----
  const hud = document.createElement('div');
  hud.id = 'planet-attack-hud';
  hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:"Courier New",monospace;font-size:12px;color:#00ccff;';
  uiOverlay.appendChild(hud);

  const damageFlash = document.createElement('div');
  damageFlash.style.cssText = 'position:absolute;inset:0;background:rgba(255,68,0,0);transition:background 0.1s;pointer-events:none;';
  hud.appendChild(damageFlash);

  function flashDamage() {
    damageFlash.style.background = 'rgba(255,68,0,0.25)';
    setTimeout(() => { damageFlash.style.background = 'rgba(255,68,0,0)'; }, 120);
  }

  function renderHUD() {
    const hpPct = GameState.ship.hp / GameState.ship.maxHp;
    const hpBar = '█'.repeat(Math.round(hpPct * 10)) + '░'.repeat(10 - Math.round(hpPct * 10));

    const p1Alive = fighters.filter(f => f.phase === 1 && f.hp > 0).length;
    const p2Alive = towers.filter(t => t.hp > 0).length;
    const p3Alive = drones.filter(d => d.hp > 0).length + fighters.filter(f => f.phase === 3 && f.hp > 0).length;
    const p4Alive = capitalShip && capitalShip.hp > 0;

    const phaseStatus = (phase, alive, total, label) => {
      if (currentPhase > phase) return `<div style="color:#00ff88">PHASE ${phase}: ${label} [✓ CLEAR]</div>`;
      if (currentPhase === phase) return `<div style="color:#ff4400">PHASE ${phase}: ${label} [${alive} REMAINING]</div>`;
      return `<div style="color:#444">PHASE ${phase}: ${label} [LOCKED]</div>`;
    };

    let capLabel = hasCapitalShip ? 'CAPITAL SHIP' : 'N/A';
    let capStatus;
    if (!hasCapitalShip) {
      capStatus = `<div style="color:#444">PHASE 4: ${capLabel} [N/A]</div>`;
    } else {
      capStatus = phaseStatus(4, p4Alive ? 1 : 0, 1, capLabel);
    }

    hud.innerHTML = `
      <div style="position:absolute;top:12px;left:20px">
        ${phaseStatus(1, p1Alive, fighterCountP1, 'FIGHTERS')}
        ${phaseStatus(2, p2Alive, towerCount, 'TOWERS')}
        ${phaseStatus(3, p3Alive, droneCount + fighterCountP3, 'GARRISON')}
        ${capStatus}
      </div>
      <div style="position:absolute;top:12px;right:20px">HP: ${hpBar}</div>
      <div style="position:absolute;top:32px;right:20px">SYSTEM: ${systemData?.name || systemId}</div>
      <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:#888;font-size:10px">ESC — RETREAT</div>
    `;
    hud.appendChild(damageFlash);
  }

  // ---- Resize ----
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // ---- State ----
  let finished = false;
  let retreatPending = false;

  function onKeyDown(e) {
    if (e.code === 'Escape' && !finished) {
      retreatPending = true;
    }
  }
  window.addEventListener('keydown', onKeyDown);

  // ---- Scene interface ----
  return {
    update(delta) {
      if (finished) return;

      // Retreat check
      if (retreatPending) {
        finished = true;
        EventBus.emit('planet_attack:retreat', { systemId, tier });
        return;
      }

      // ---- Player movement ----
      if (InputMap.isDown('attack_left')) playerYaw += YAW_SPEED * delta;
      if (InputMap.isDown('attack_right')) playerYaw -= YAW_SPEED * delta;
      if (InputMap.isDown('attack_up')) playerAlt = Math.min(PLAYER_MAX_ALT, playerAlt + ALT_SPEED * delta);
      if (InputMap.isDown('attack_down')) playerAlt = Math.max(PLAYER_MIN_ALT, playerAlt - ALT_SPEED * delta);

      // Auto-forward: scroll terrain
      terrainOffset += FORWARD_SPEED * delta;
      terrain.position.z = terrainOffset % TERRAIN_SIZE;
      terrain2.position.z = terrain.position.z - TERRAIN_SIZE;

      // Lateral movement via yaw
      playerX += Math.sin(playerYaw) * FORWARD_SPEED * delta * 0.5;
      playerX = Math.max(-TERRAIN_SIZE / 2 + 5, Math.min(TERRAIN_SIZE / 2 - 5, playerX));

      fireCooldown = Math.max(0, fireCooldown - delta);
      if (InputMap.isDown('attack_fire')) firePlayerLaser();

      updatePlayerAndCamera();

      // Camera shake
      if (shakeTimer > 0) {
        shakeTimer -= delta;
        camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        camera.position.y += (Math.random() - 0.5) * shakeIntensity;
      }

      // ---- Phase logic ----
      if (!phaseInitialized) {
        phaseInitialized = true;
        initPhase1();
      }

      // Phase transitions
      if (currentPhase === PHASES.FIGHTERS) {
        const alive = fighters.filter(f => f.phase === 1 && f.hp > 0).length;
        if (alive === 0) {
          currentPhase = PHASES.TOWERS;
          initPhase2();
        }
      } else if (currentPhase === PHASES.TOWERS) {
        const alive = towers.filter(t => t.hp > 0).length;
        if (alive === 0) {
          currentPhase = PHASES.GARRISON;
          initPhase3();
        }
      } else if (currentPhase === PHASES.GARRISON) {
        const dronesAlive = drones.filter(d => d.hp > 0).length;
        const fghtersAlive = fighters.filter(f => f.phase === 3 && f.hp > 0).length;
        if (dronesAlive === 0 && fghtersAlive === 0) {
          currentPhase = PHASES.CAPITAL;
          initPhase4();
        }
      } else if (currentPhase === PHASES.CAPITAL) {
        if (!hasCapitalShip || (capitalShip && capitalShip.hp <= 0)) {
          currentPhase = PHASES.COMPLETE;
          finished = true;
          EventBus.emit('planet_attack:victory', { systemId, faction, tier });
          return;
        }
      }

      // ---- Update entities ----
      for (const f of fighters) {
        if (f.hp > 0) updateFighter(f, delta);
        // Scroll with terrain
        f.mesh.position.z += FORWARD_SPEED * delta;
        if (f.mesh.position.z > 30 && f.hp > 0) f.mesh.position.z = -40;
      }
      for (const t of towers) {
        if (t.hp > 0) updateTower(t, delta);
        t.mesh.position.z += FORWARD_SPEED * delta;
        if (t.mesh.position.z > 30 && t.hp > 0) t.mesh.position.z = -60;
      }
      for (const d of drones) {
        if (d.hp > 0) updateDrone(d, delta);
        d.mesh.position.z += FORWARD_SPEED * delta;
        if (d.mesh.position.z > 30 && d.hp > 0) d.mesh.position.z = -40;
      }
      if (capitalShip && capitalShip.hp > 0) {
        updateCapitalShip(delta);
        capitalShip.mesh.position.z += FORWARD_SPEED * delta * 0.3;
      }

      // ---- Projectiles ----
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        p.life -= delta;

        if (p.owner === 'player') {
          // Hit fighters
          for (const f of fighters) {
            if (hitTestEntity(f, p.mesh.position)) {
              damageEntity(f, p.damage, factionColor);
              triggerShake(0.15, 0.2);
              p.life = 0; break;
            }
          }
          // Hit towers
          if (p.life > 0) {
            for (const t of towers) {
              if (hitTestEntity(t, p.mesh.position, 2)) {
                damageEntity(t, p.damage, factionColor);
                triggerShake(0.2, 0.3);
                p.life = 0; break;
              }
            }
          }
          // Hit drones
          if (p.life > 0) {
            for (const d of drones) {
              if (hitTestEntity(d, p.mesh.position, 1)) {
                damageEntity(d, p.damage, factionColor);
                p.life = 0; break;
              }
            }
          }
          // Hit capital ship turrets + hull
          if (p.life > 0 && capitalShip && capitalShip.hp > 0) {
            for (const t of capitalShip.turrets) {
              if (!t.alive) continue;
              const tWorld = new THREE.Vector3();
              t.mesh.getWorldPosition(tWorld);
              if (p.mesh.position.distanceTo(tWorld) < 1.5) {
                t.hp -= p.damage;
                if (t.hp <= 0) {
                  t.alive = false;
                  t.mesh.visible = false;
                  createExplosion(tWorld, factionColor);
                  triggerShake(0.3, 0.5);
                }
                p.life = 0; break;
              }
            }
            // Hull damage (only when turrets nearby are dead)
            if (p.life > 0 && p.mesh.position.distanceTo(capitalShip.mesh.position) < 5) {
              capitalShip.hp -= p.damage;
              capitalShip.flashTimer = 0.1;
              triggerShake(0.2, 0.3);
              if (capitalShip.hp <= 0) {
                // Sequential explosion
                createExplosion(capitalShip.mesh.position.clone(), factionColor, 3);
                triggerShake(0.5, 1.0);
                capitalShip.mesh.visible = false;
              }
              p.life = 0;
            }
          }
        }

        // Enemy projectiles hit player
        if (p.owner === 'enemy') {
          const playerPos3 = new THREE.Vector3(playerX, playerAlt, 0);
          if (p.mesh.position.distanceTo(playerPos3) < 1.5) {
            const dead = GameState.takeDamage(p.damage);
            flashDamage();
            p.life = 0;
            if (dead) {
              finished = true;
              EventBus.emit('player:destroyed', { location: 'planet_attack' });
              return;
            }
          }
        }

        // Cleanup dead projectiles
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          projectiles.splice(i, 1);
        }
      }

      // ---- Explosions ----
      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.life -= delta;
        const t = 1 - ex.life / ex.maxLife;
        for (const frag of ex.frags) {
          frag.position.add(frag.userData.vel.clone().multiplyScalar(delta));
          frag.rotation.x += frag.userData.rotVel.x * delta;
          frag.rotation.y += frag.userData.rotVel.y * delta;
          if (frag.material) { frag.material.transparent = true; frag.material.opacity = 1 - t; }
        }
        if (ex.life <= 0) {
          scene.remove(ex.group);
          ex.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          explosions.splice(i, 1);
        }
      }

      renderHUD();
    },

    render() {
      renderer.render(scene, camera);
    },

    destroy() {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      if (hud.parentNode) hud.parentNode.removeChild(hud);
      scene.traverse(obj => {
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
