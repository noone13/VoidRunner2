// EnemyShip.js — enemy with AI state machine (X-Wing style)

import * as THREE from 'three';
import WireframeFactory, { COLORS } from '../core/WireframeFactory.js';
import { buildShipMesh } from '../data/ShipBlueprints.js';

// AI States
const AI = {
  PURSUE: 'pursue',
  ATTACK: 'attack',
  EVADE: 'evade',
  SUPPORT: 'support',
  RETREAT: 'retreat',
};

// Faction behavior profiles
const FACTION_PROFILES = {
  pirates: { aggressiveness: 0.8, retreatThreshold: 0.2, wingLossRetreat: 0.5, evadeChance: 0.4, discipline: 0.3 },
  hegemony: { aggressiveness: 0.5, retreatThreshold: 0.05, wingLossRetreat: 0.9, evadeChance: 0.3, discipline: 0.9 },
  coalition: { aggressiveness: 0.95, retreatThreshold: 0, wingLossRetreat: 1.0, evadeChance: 0.15, discipline: 0.6 },
  syndicate: { aggressiveness: 0.3, retreatThreshold: 0.3, wingLossRetreat: 0.3, evadeChance: 0.6, discipline: 0.7 },
};

// Spread angles based on distance (degrees → radians)
function getSpreadAngle(distance) {
  if (distance < 15) return 8 * Math.PI / 180;
  if (distance < 40) return 15 * Math.PI / 180;
  return 25 * Math.PI / 180;
}

export function createEnemyShip(options = {}) {
  const {
    faction = 'pirates',
    position = new THREE.Vector3(0, 0, -30),
    isLeader = false,
    leader = null,        // reference to leader's enemy object
    wingIndex = 0,
    shipClass = 'courier',
    name = 'Raider',
  } = options;

  const profile = FACTION_PROFILES[faction] || FACTION_PROFILES.pirates;
  const color = WireframeFactory.factionColor(faction);
  const mesh = buildShipMesh(shipClass, color);
  mesh.scale.setScalar(0.5);
  mesh.position.copy(position);

  const maxHp = 60;
  const maxSpeed = 8 + Math.random() * 2;

  const enemy = {
    mesh,
    hp: maxHp,
    maxHp,
    faction,
    name,
    isLeader,
    leader,
    wingIndex,
    originalColor: color,
    flashTimer: undefined,

    // AI state
    ai: {
      state: AI.PURSUE,
      stateTimer: 0,
      evadeDir: new THREE.Vector3(),
      supportTarget: null,
      leaderDelay: isLeader ? 0 : 0.5 + Math.random(),   // wingmen copy with delay
      leaderDelayTimer: 0,
      pendingState: null,
      fireCooldown: 0.8 + Math.random() * 0.5,
      fireTimer: 0,
    },

    // Movement
    velocity: new THREE.Vector3(),
    speed: maxSpeed * (0.7 + Math.random() * 0.2),

    update(delta, playerObj, allEnemies, dogfightScene) {
      if (enemy.hp <= 0) return;

      const toPlayer = new THREE.Vector3().subVectors(playerObj.position, mesh.position);
      const distToPlayer = toPlayer.length();
      const dirToPlayer = toPlayer.clone().normalize();

      // Wing logic: wingmen copy leader state with delay
      if (!isLeader && leader && leader.hp > 0) {
        enemy.ai.leaderDelayTimer += delta;
        if (enemy.ai.leaderDelayTimer >= enemy.ai.leaderDelay) {
          if (leader.ai && leader.ai.state !== enemy.ai.state) {
            enemy.ai.state = leader.ai.state;
          }
          enemy.ai.leaderDelayTimer = 0;
        }
      }

      // If leader is dead and not leader, switch to independent
      if (!isLeader && leader && leader.hp <= 0) {
        enemy.leader = null;
      }

      // Faction: pirates retreat when wing losses > 50%
      if (faction === 'pirates') {
        const wingAlive = allEnemies.filter(e => e.hp > 0).length;
        const wingTotal = allEnemies.length;
        if (wingAlive / wingTotal < profile.wingLossRetreat && enemy.hp < enemy.maxHp * 0.5) {
          enemy.ai.state = AI.RETREAT;
        }
      }

      // Syndicate: retreat at 30% HP
      if (faction === 'syndicate' && enemy.hp < enemy.maxHp * profile.retreatThreshold) {
        enemy.ai.state = AI.RETREAT;
      }

      // State machine
      enemy.ai.stateTimer += delta;

      switch (enemy.ai.state) {
        case AI.PURSUE:
          pursue(delta, dirToPlayer, distToPlayer);
          break;
        case AI.ATTACK:
          attack(delta, dirToPlayer, distToPlayer, playerObj, dogfightScene);
          break;
        case AI.EVADE:
          evade(delta, dirToPlayer, distToPlayer);
          break;
        case AI.SUPPORT:
          support(delta, playerObj, allEnemies);
          break;
        case AI.RETREAT:
          retreat(delta, dirToPlayer);
          break;
      }

      // Apply velocity
      mesh.position.add(enemy.velocity.clone().multiplyScalar(delta));

      // Face movement direction
      if (enemy.velocity.lengthSq() > 0.1) {
        const lookTarget = mesh.position.clone().add(enemy.velocity.clone().normalize());
        mesh.lookAt(lookTarget);
      }

      // Combat bubble: clamp enemies inside
      if (mesh.position.length() > 100 && enemy.ai.state !== AI.RETREAT) {
        const toCenter = mesh.position.clone().negate().normalize();
        enemy.velocity.add(toCenter.multiplyScalar(5 * delta));
      }

      // Firing
      enemy.ai.fireTimer -= delta;
    },
  };

  // ---- AI State implementations ----

  function pursue(delta, dirToPlayer, distToPlayer) {
    // Fly toward player
    const targetVel = dirToPlayer.clone().multiplyScalar(enemy.speed);

    // Wingman position offset
    if (!isLeader && leader && leader.hp > 0) {
      const offset = new THREE.Vector3(
        (wingIndex % 2 === 0 ? -1 : 1) * 5,
        (wingIndex > 1 ? 3 : -3),
        5,
      );
      offset.applyQuaternion(leader.mesh.quaternion);
      const leaderTargetPos = leader.mesh.position.clone().add(offset);
      const toFormation = leaderTargetPos.clone().sub(mesh.position).normalize();
      targetVel.lerp(toFormation.multiplyScalar(enemy.speed), 0.3 * profile.discipline);
    }

    enemy.velocity.lerp(targetVel, 3 * delta);

    // Transition: close enough → ATTACK
    if (distToPlayer < 30) {
      enemy.ai.state = AI.ATTACK;
      enemy.ai.stateTimer = 0;
    }
  }

  function attack(delta, dirToPlayer, distToPlayer, playerObj, dogfightScene) {
    // Maintain 15–25 unit distance
    let desiredSpeed = enemy.speed;
    if (distToPlayer < 15) {
      // Too close — back off
      const away = dirToPlayer.clone().negate();
      enemy.velocity.lerp(away.multiplyScalar(desiredSpeed), 2 * delta);
    } else if (distToPlayer > 25) {
      // Too far — close in
      enemy.velocity.lerp(dirToPlayer.clone().multiplyScalar(desiredSpeed), 2 * delta);
    } else {
      // Good range — strafe
      const strafe = new THREE.Vector3().crossVectors(dirToPlayer, new THREE.Vector3(0, 1, 0)).normalize();
      const strafeDir = Math.sin(enemy.ai.stateTimer * 0.8 + enemy.wingIndex) > 0 ? 1 : -1;
      enemy.velocity.lerp(strafe.multiplyScalar(desiredSpeed * 0.5 * strafeDir), 2 * delta);
    }

    // Fire at player
    if (enemy.ai.fireTimer <= 0) {
      const angle = dirToPlayer.angleTo(enemy.velocity.clone().normalize().negate());
      const spread = getSpreadAngle(distToPlayer);
      if (angle < Math.PI * 0.5) {  // roughly facing player
        fireAtPlayer(dirToPlayer, distToPlayer, spread, dogfightScene);
        enemy.ai.fireTimer = enemy.ai.fireCooldown;
      }
    }

    // Transition: low HP → EVADE
    if (enemy.hp < enemy.maxHp * 0.3 && Math.random() < profile.evadeChance) {
      enemy.ai.state = AI.EVADE;
      enemy.ai.stateTimer = 0;
      enemy.ai.evadeDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize();
    }

    // Transition: check if wingman needs help
    if (isLeader) {
      const wingmen = allWingmen(enemy, dogfightScene.enemies);
      for (const wm of wingmen) {
        if (wm.hp > 0 && wm.hp < wm.maxHp * 0.5) {
          enemy.ai.state = AI.SUPPORT;
          enemy.ai.supportTarget = wm;
          enemy.ai.stateTimer = 0;
          break;
        }
      }
    }

    // Transition: player too far → PURSUE
    if (distToPlayer > 40) {
      enemy.ai.state = AI.PURSUE;
      enemy.ai.stateTimer = 0;
    }
  }

  function evade(delta, dirToPlayer, distToPlayer) {
    // Fly in random perpendicular direction
    enemy.velocity.lerp(enemy.ai.evadeDir.clone().multiplyScalar(enemy.speed * 1.2), 3 * delta);

    // Return to PURSUE after 2-4 sec
    if (enemy.ai.stateTimer > 2 + Math.random() * 2) {
      enemy.ai.state = AI.PURSUE;
      enemy.ai.stateTimer = 0;
    }
  }

  function support(delta, playerObj, allEnemies) {
    const target = enemy.ai.supportTarget;
    if (!target || target.hp <= 0) {
      enemy.ai.state = AI.PURSUE;
      enemy.ai.stateTimer = 0;
      return;
    }

    // Fly toward wingman under attack
    const toWingman = target.mesh.position.clone().sub(mesh.position).normalize();
    enemy.velocity.lerp(toWingman.multiplyScalar(enemy.speed), 3 * delta);

    // If close, switch to attack
    const distToPlayer = playerObj.position.distanceTo(mesh.position);
    if (distToPlayer < 30) {
      enemy.ai.state = AI.ATTACK;
      enemy.ai.stateTimer = 0;
    }

    // Timeout
    if (enemy.ai.stateTimer > 6) {
      enemy.ai.state = AI.PURSUE;
      enemy.ai.stateTimer = 0;
    }
  }

  function retreat(delta, dirToPlayer) {
    // Fly away from player at max speed
    const away = dirToPlayer.clone().negate();
    enemy.velocity.lerp(away.multiplyScalar(enemy.speed * 1.5), 3 * delta);

    // Despawn when far enough
    if (mesh.position.length() > 120) {
      enemy.hp = 0;
      mesh.visible = false;
    }
  }

  function fireAtPlayer(dirToPlayer, distance, spread, dogfightScene) {
    // Add spread
    const spreadDir = dirToPlayer.clone();
    spreadDir.x += (Math.random() - 0.5) * spread * 2;
    spreadDir.y += (Math.random() - 0.5) * spread * 2;
    spreadDir.z += (Math.random() - 0.5) * spread * 2;
    spreadDir.normalize();

    const startPos = mesh.position.clone().add(spreadDir.clone().multiplyScalar(1));
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1.5),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: COLORS.ENEMY });
    const laserMesh = new THREE.Line(lineGeo, lineMat);
    laserMesh.position.copy(startPos);
    laserMesh.lookAt(startPos.clone().add(spreadDir));

    dogfightScene.scene.add(laserMesh);
    dogfightScene.projectiles.push({
      mesh: laserMesh,
      velocity: spreadDir.multiplyScalar(40),
      life: 2,
      damage: 10,
      owner: 'enemy',
    });
  }

  function allWingmen(leaderEnemy, allEnemies) {
    return allEnemies.filter(e => e.leader === leaderEnemy && e.hp > 0);
  }

  return enemy;
}

// ---- Spawn wing of enemies ----
export function spawnWing(scene, enemies, options = {}) {
  const {
    faction = 'pirates',
    count = 3,
    centerPos = new THREE.Vector3(0, 0, -50),
    shipClass = 'courier',
  } = options;

  const adjectives = ['Razor', 'Iron', 'Black', 'Ghost', 'Crimson', 'Silent', 'Dead'];
  const nouns = ['Vex', 'Kane', 'Mira', 'Thorn', 'Cross', 'Shade', 'Wolf'];

  const wing = [];
  let leader = null;

  for (let i = 0; i < count; i++) {
    const offset = new THREE.Vector3(
      (i % 2 === 0 ? -1 : 1) * (5 + Math.random() * 3),
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 6,
    );
    const pos = centerPos.clone().add(offset);
    const isLeader = i === 0;
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const name = `${faction.charAt(0).toUpperCase() + faction.slice(1)} ${isLeader ? adj + ' ' + noun : 'Pilot'}`;

    const enemy = createEnemyShip({
      faction,
      position: pos,
      isLeader,
      leader: isLeader ? null : leader,
      wingIndex: i,
      shipClass,
      name,
    });

    if (isLeader) leader = enemy;
    scene.add(enemy.mesh);
    enemies.push(enemy);
    wing.push(enemy);
  }

  // Set leader reference for wingmen
  for (const e of wing) {
    if (!e.isLeader) e.leader = leader;
  }

  return wing;
}
