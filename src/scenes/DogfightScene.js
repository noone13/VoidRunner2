// DogfightScene.js — FPP space combat
// M3.1: Scene setup, starfield, player flight

import * as THREE from 'three';
import WireframeFactory, { COLORS } from '../core/WireframeFactory.js';
import GameState from '../core/GameState.js';
import EventBus from '../core/EventBus.js';
import InputMap from '../core/InputMap.js';

// ---- Constants ----
const COMBAT_BUBBLE = 100;       // 1 parsec
const STAR_COUNT = 800;
const STAR_SPHERE_RADIUS = 300;

// Player flight params (base, modified by ship modules)
function getPlayerParams() {
  const eng = GameState.ship.modules.engines || 1;
  return {
    maxSpeed: 10 + eng * 2,
    acceleration: 6 + eng * 2,
    rotationSpeed: 2.5,
    drag: 0.92,
    afterburnerMult: 1.8,
    afterburnerMax: 5,    // seconds
    afterburnerRegen: 2,  // seconds to full recharge
  };
}

export default function createDogfightScene(canvas, uiOverlay, payload = {}) {
  const faction = payload.faction || 'pirates';
  const enemyCount = payload.count || 3;
  const location = payload.location || 'system';

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

  // ---- Starfield background ----
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Random point on sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = STAR_SPHERE_RADIUS;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---- Player state ----
  const params = getPlayerParams();
  const playerObj = new THREE.Object3D(); // invisible pivot — camera is attached
  scene.add(playerObj);
  camera.position.set(0, 0, 0); // FPP — camera IS the player
  playerObj.add(camera);

  const velocity = new THREE.Vector3(0, 0, 0);
  let speed = 0;
  let afterburnerFuel = params.afterburnerMax;
  let afterburnerActive = false;
  let fireCooldown = 0;

  // ---- Cockpit wireframe (FPP) ----
  const cockpitGroup = new THREE.Group();

  // Left strut
  const leftStrut = WireframeFactory.edges(new THREE.BoxGeometry(0.02, 0.6, 0.02), COLORS.UI);
  leftStrut.position.set(-0.55, -0.1, -1);
  cockpitGroup.add(leftStrut);

  // Right strut
  const rightStrut = WireframeFactory.edges(new THREE.BoxGeometry(0.02, 0.6, 0.02), COLORS.UI);
  rightStrut.position.set(0.55, -0.1, -1);
  cockpitGroup.add(rightStrut);

  // Top bar
  const topBar = WireframeFactory.edges(new THREE.BoxGeometry(1.12, 0.02, 0.02), COLORS.UI);
  topBar.position.set(0, 0.2, -1);
  cockpitGroup.add(topBar);

  // Dashboard
  const dashboard = WireframeFactory.edges(new THREE.BoxGeometry(1.12, 0.02, 0.3), COLORS.UI);
  dashboard.position.set(0, -0.4, -1);
  dashboard.rotation.x = -0.3;
  cockpitGroup.add(dashboard);

  // Crosshair
  const chSize = 0.02;
  const chLen = 0.06;
  const chMat = COLORS.PLAYER;
  const chGroup = new THREE.Group();
  chGroup.add(WireframeFactory.edges(new THREE.BoxGeometry(chLen, chSize, chSize), chMat));
  chGroup.add(WireframeFactory.edges(new THREE.BoxGeometry(chSize, chLen, chSize), chMat));
  chGroup.position.set(0, 0, -2);
  cockpitGroup.add(chGroup);

  camera.add(cockpitGroup);

  // ---- Projectiles ----
  const projectiles = [];       // { mesh, velocity, life, damage, owner }
  const enemies = [];           // EnemyShip objects (added in M3.3)

  const LASER_SPEED = 60;
  const LASER_RANGE = 80;
  const LASER_DAMAGE = 25;
  const LASER_COOLDOWN = 0.25;

  function firePlayerLaser() {
    if (fireCooldown > 0) return;
    fireCooldown = LASER_COOLDOWN;

    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(playerObj.quaternion);

    const startPos = playerObj.position.clone().add(dir.clone().multiplyScalar(1));

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -2),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: COLORS.PLAYER });
    const laserMesh = new THREE.Line(lineGeo, lineMat);
    laserMesh.position.copy(startPos);
    laserMesh.quaternion.copy(playerObj.quaternion);
    scene.add(laserMesh);

    projectiles.push({
      mesh: laserMesh,
      velocity: dir.multiplyScalar(LASER_SPEED),
      life: LASER_RANGE / LASER_SPEED,
      damage: LASER_DAMAGE,
      owner: 'player',
    });
  }

  // ---- Explosions ----
  const explosions = [];

  function createExplosion(position, color = COLORS.ENEMY) {
    const fragCount = 8 + Math.floor(Math.random() * 8);
    const group = new THREE.Group();
    group.position.copy(position);
    const frags = [];
    for (let i = 0; i < fragCount; i++) {
      const geo = new THREE.TetrahedronGeometry(0.15 + Math.random() * 0.2);
      const frag = WireframeFactory.edges(geo, color);
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(3 + Math.random() * 5);
      frag.userData.vel = dir;
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

  // ---- Enemy management (stubs for M3.3 — filled in later) ----
  // enemies array is populated by spawnEnemies()
  // Each enemy: { mesh, hp, maxHp, faction, ai: {...}, ... }

  function spawnEnemies() {
    // Will be implemented in M3.3
  }

  function getAliveEnemies() {
    return enemies.filter(e => e.hp > 0);
  }

  function getNearestEnemy() {
    let nearest = null;
    let minDist = Infinity;
    for (const e of getAliveEnemies()) {
      const d = playerObj.position.distanceTo(e.mesh.position);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest ? { enemy: nearest, distance: minDist } : null;
  }

  // ---- Targeting ----
  let targetIndex = -1;
  let lockedTarget = null;
  let targetReticle = null;

  // Target reticle mesh
  const reticleGeo = new THREE.RingGeometry(0.8, 1.0, 8);
  targetReticle = WireframeFactory.edges(reticleGeo, COLORS.WARNING);
  targetReticle.visible = false;
  scene.add(targetReticle);

  let tabPressed = false;
  function handleTargeting() {
    const isTab = InputMap.isDown('target_next');
    if (isTab && !tabPressed) {
      tabPressed = true;
      const alive = getAliveEnemies();
      if (alive.length === 0) {
        lockedTarget = null;
        targetReticle.visible = false;
        return;
      }
      targetIndex = (targetIndex + 1) % alive.length;
      lockedTarget = alive[targetIndex];
      targetReticle.visible = true;
    }
    if (!isTab) tabPressed = false;

    // Validate lock
    if (lockedTarget && lockedTarget.hp <= 0) {
      lockedTarget = null;
      targetReticle.visible = false;
      targetIndex = -1;
    }

    // Position reticle on target
    if (lockedTarget && targetReticle.visible) {
      targetReticle.position.copy(lockedTarget.mesh.position);
      targetReticle.lookAt(camera.getWorldPosition(new THREE.Vector3()));
      targetReticle.scale.setScalar(1 + 0.1 * Math.sin(Date.now() * 0.005));
    }
  }

  // ---- Escape mechanic ----
  let canEscape = false;
  let escapeTimer = 0;

  // ---- HUD ----
  const hud = document.createElement('div');
  hud.id = 'dogfight-hud';
  hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:"Courier New",monospace;font-size:12px;color:#00ccff;';
  uiOverlay.appendChild(hud);

  const damageFlash = document.createElement('div');
  damageFlash.style.cssText = 'position:absolute;inset:0;background:rgba(255,255,255,0);transition:background 0.1s;pointer-events:none;';
  hud.appendChild(damageFlash);

  function flashPlayerHit() {
    damageFlash.style.background = 'rgba(255,255,255,0.2)';
    setTimeout(() => { damageFlash.style.background = 'rgba(255,255,255,0)'; }, 120);
  }

  function renderHUD() {
    const alive = getAliveEnemies();
    const hpPct = GameState.ship.hp / GameState.ship.maxHp;
    const hpBar = '█'.repeat(Math.round(hpPct * 10)) + '░'.repeat(10 - Math.round(hpPct * 10));
    const spdPct = speed / (params.maxSpeed * params.afterburnerMult);
    const spdBar = '█'.repeat(Math.round(spdPct * 6)) + '░'.repeat(6 - Math.round(spdPct * 6));
    const abPct = afterburnerFuel / params.afterburnerMax;
    const abBar = '█'.repeat(Math.round(abPct * 10)) + '░'.repeat(10 - Math.round(abPct * 10));

    let targetInfo = '';
    if (lockedTarget) {
      const dist = playerObj.position.distanceTo(lockedTarget.mesh.position);
      const tHpPct = lockedTarget.hp / lockedTarget.maxHp;
      const tHpBar = '█'.repeat(Math.round(tHpPct * 8)) + '░'.repeat(8 - Math.round(tHpPct * 8));
      targetInfo = `TARGET: ${lockedTarget.name} | DST: ${dist.toFixed(0)}u | HP: ${tHpBar}`;
    }

    let escapeHtml = '';
    if (canEscape) {
      escapeHtml = '<div style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);color:#00ff88;font-size:14px;animation:blink 0.5s infinite">[ ESCAPE VECTOR CLEAR — PRESS H TO FLEE ]</div>';
    }

    hud.innerHTML = `
      <style>@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}</style>
      <div style="position:absolute;top:12px;left:20px">ENEMIES: ${alive.length}</div>
      <div style="position:absolute;top:12px;left:50%;transform:translateX(-50%)">SPEED: ${spdBar}</div>
      <div style="position:absolute;top:12px;right:20px">AFTERBURNER: ${abBar}</div>
      <div style="position:absolute;top:32px;left:20px">HP: ${hpBar}</div>
      <div style="position:absolute;top:32px;right:20px">SHIELDS: ${GameState.ship.shields}/${GameState.ship.maxShields}</div>
      <div style="position:absolute;top:52px;left:20px;color:#ff4400">${targetInfo}</div>
      ${escapeHtml}
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

  // ---- Track finished state ----
  let finished = false;

  // ---- Scene interface ----
  return {
    // Expose for adding enemies from outside
    scene,
    playerObj,
    enemies,
    projectiles,
    explosions,
    createExplosion,
    flashPlayerHit,

    update(delta) {
      if (finished) return;

      // ---- Player rotation ----
      if (InputMap.isDown('yaw_left')) {
        playerObj.rotateY(params.rotationSpeed * delta);
      }
      if (InputMap.isDown('yaw_right')) {
        playerObj.rotateY(-params.rotationSpeed * delta);
      }
      if (InputMap.isDown('pitch_up')) {
        playerObj.rotateX(params.rotationSpeed * delta);
      }
      if (InputMap.isDown('pitch_down')) {
        playerObj.rotateX(-params.rotationSpeed * delta);
      }

      // ---- Thrust ----
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(playerObj.quaternion);

      afterburnerActive = InputMap.isDown('afterburner') && afterburnerFuel > 0;
      const currentMaxSpeed = afterburnerActive ? params.maxSpeed * params.afterburnerMult : params.maxSpeed;

      if (InputMap.isDown('thrust')) {
        velocity.add(forward.clone().multiplyScalar(params.acceleration * delta));
      }
      if (InputMap.isDown('brake')) {
        velocity.add(forward.clone().multiplyScalar(-params.acceleration * 0.5 * delta));
      }

      // Drag: velocity *= Math.pow(drag, delta * 60)
      const dragFactor = Math.pow(params.drag, delta * 60);
      velocity.multiplyScalar(dragFactor);

      // Clamp speed
      speed = velocity.length();
      if (speed > currentMaxSpeed) {
        velocity.multiplyScalar(currentMaxSpeed / speed);
        speed = currentMaxSpeed;
      }
      // Reverse clamp
      const backwardSpeed = -velocity.dot(forward);
      if (backwardSpeed > params.maxSpeed * 0.3) {
        velocity.add(forward.clone().multiplyScalar(backwardSpeed - params.maxSpeed * 0.3));
      }

      playerObj.position.add(velocity.clone().multiplyScalar(delta));

      // Afterburner fuel
      if (afterburnerActive) {
        afterburnerFuel = Math.max(0, afterburnerFuel - delta);
      } else {
        afterburnerFuel = Math.min(params.afterburnerMax, afterburnerFuel + delta * (params.afterburnerMax / params.afterburnerRegen));
      }

      // ---- Shooting ----
      fireCooldown = Math.max(0, fireCooldown - delta);
      if (InputMap.isDown('fire')) {
        firePlayerLaser();
      }

      // ---- Update projectiles ----
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        p.life -= delta;

        // Hit detection against enemies (player projectiles)
        if (p.owner === 'player') {
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            const dist = p.mesh.position.distanceTo(e.mesh.position);
            if (dist < 1.5) {
              e.hp -= p.damage;
              // Flash enemy red
              e.flashTimer = 0.1;
              if (e.hp <= 0) {
                createExplosion(e.mesh.position.clone(), WireframeFactory.factionColor(e.faction));
                e.mesh.visible = false;
                EventBus.emit('enemy:destroyed', { faction: e.faction, name: e.name });
              }
              p.life = 0;
              break;
            }
          }
        }

        // Hit detection against player (enemy projectiles)
        if (p.owner === 'enemy') {
          const dist = p.mesh.position.distanceTo(playerObj.position);
          if (dist < 1.5) {
            const dead = GameState.takeDamage(p.damage);
            flashPlayerHit();
            p.life = 0;
            if (dead) {
              finished = true;
              EventBus.emit('player:destroyed', { location: 'dogfight' });
              return;
            }
          }
        }

        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          projectiles.splice(i, 1);
        }
      }

      // ---- Update enemies (AI — filled in M3.3) ----
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (e.update) e.update(delta, playerObj, enemies, this);

        // Flash timer
        if (e.flashTimer > 0) {
          e.flashTimer -= delta;
          e.mesh.traverse(child => {
            if (child.material) child.material.color.setHex(COLORS.ENEMY);
          });
        } else if (e.flashTimer !== undefined && e.flashTimer <= 0 && e.originalColor) {
          e.mesh.traverse(child => {
            if (child.material) child.material.color.setHex(e.originalColor);
          });
          e.flashTimer = undefined;
        }
      }

      // ---- Update explosions ----
      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.life -= delta;
        const t = 1 - ex.life / ex.maxLife;
        for (const frag of ex.frags) {
          frag.position.add(frag.userData.vel.clone().multiplyScalar(delta));
          frag.rotation.x += frag.userData.rotVel.x * delta;
          frag.rotation.y += frag.userData.rotVel.y * delta;
          // Fade
          if (frag.material) frag.material.opacity = 1 - t;
          if (frag.material && !frag.material.transparent) {
            frag.material.transparent = true;
          }
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

      // ---- Targeting ----
      handleTargeting();

      // ---- Escape mechanic ----
      const nearestInfo = getNearestEnemy();
      const alive = getAliveEnemies();
      if (alive.length === 0 && !finished) {
        // Victory!
        finished = true;
        EventBus.emit('dogfight:victory', { faction });
        return;
      }

      if (nearestInfo && nearestInfo.distance > COMBAT_BUBBLE) {
        canEscape = true;
        if (InputMap.isDown('escape_flee')) {
          finished = true;
          EventBus.emit('dogfight:escaped', { faction });
          return;
        }
      } else {
        canEscape = false;
      }

      // Keep stars centered on player
      stars.position.copy(playerObj.position);

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
