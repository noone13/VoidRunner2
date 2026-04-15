// main.js — entry point, init all core modules

import GameLoop from './core/GameLoop.js';
import StateManager, { STATES } from './core/StateManager.js';
import EventBus from './core/EventBus.js';
import InputMap from './core/InputMap.js';
import FactionState from './core/FactionState.js';
import GameState from './core/GameState.js';
import createMenuScene from './scenes/MenuScene.js';
import createGalaxyScene from './scenes/GalaxyScene.js';
import createTunnelScene from './scenes/TunnelScene.js';
import createDogfightScene from './scenes/DogfightScene.js';
import createPlanetAttackScene from './scenes/PlanetAttackScene.js';

// ---- DOM refs ----
const canvas = document.getElementById('game-canvas');
const uiOverlay = document.getElementById('ui-overlay');

// ---- Init core ----
FactionState.init();
InputMap.init();

// ---- Register scene factories ----
StateManager.register(STATES.MENU, () => {
  return createMenuScene(canvas, uiOverlay);
});

StateManager.register(STATES.GALAXY, (payload) => {
  return createGalaxyScene(canvas, uiOverlay, {
    currentSystem: GameState.currentSystem,
    unlockedSystems: GameState.unlockedSystems,
    ...payload,
  });
});

StateManager.register(STATES.TUNNEL, (payload) => {
  return createTunnelScene(canvas, uiOverlay, payload);
});

StateManager.register(STATES.DOGFIGHT, (payload) => {
  return createDogfightScene(canvas, uiOverlay, payload);
});

StateManager.register(STATES.PLANET_ATTACK, (payload) => {
  return createPlanetAttackScene(canvas, uiOverlay, payload);
});

// ---- Event handlers ----
EventBus.on('menu:action', ({ action }) => {
  if (action === 'new_game') {
    GameState.reset();
    StateManager.transition(STATES.GALAXY);
  } else if (action === 'load_game') {
    if (GameState.load()) {
      StateManager.transition(STATES.GALAXY);
    }
  }
});

EventBus.on('planet_attack:requested', ({ systemId, faction }) => {
  console.log(`attacking planet in ${systemId} (${faction})`);
  StateManager.transition(STATES.PLANET_ATTACK, { systemId, faction });
});

EventBus.on('travel:requested', ({ from, to }) => {
  console.log(`travel: ${from} → ${to}`);

  // Black route confirmation
  if (!GameState.transponderActive) {
    // Show confirmation dialog
    showBlackRouteConfirm(from, to);
  } else {
    startTunnel(from, to);
  }
});

function startTunnel(from, to) {
  StateManager.transition(STATES.TUNNEL, { from, to });
}

function showBlackRouteConfirm(from, to) {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    padding:24px;border:1px solid #ff4400;background:rgba(0,0,0,0.95);
    font-family:'Courier New',monospace;color:#ff4400;font-size:13px;
    text-align:center;z-index:100;pointer-events:auto;
  `;
  dialog.innerHTML = `
    <div style="font-size:16px;margin-bottom:12px">⚠ BLACK ROUTE ACTIVE</div>
    <div style="color:#aaa;margin-bottom:16px">
      Pirate activity increased. No Hegemony checkpoints.<br>
      Route will take 30% longer.
    </div>
    <div style="display:flex;gap:12px;justify-content:center">
      <button id="br-confirm" style="background:none;border:1px solid #ff4400;color:#ff4400;padding:6px 20px;cursor:pointer;font-family:inherit">CONFIRM</button>
      <button id="br-cancel" style="background:none;border:1px solid #888;color:#888;padding:6px 20px;cursor:pointer;font-family:inherit">CANCEL</button>
    </div>
  `;
  uiOverlay.appendChild(dialog);

  dialog.querySelector('#br-confirm').onclick = () => {
    dialog.remove();
    startTunnel(from, to);
  };
  dialog.querySelector('#br-cancel').onclick = () => {
    dialog.remove();
  };
}

// Tunnel → Galaxy (arrived safely)
EventBus.on('tunnel:arrived', ({ from, to }) => {
  console.log(`arrived: ${from} → ${to}`);
  // Unlock neighbors of destination
  const scene = StateManager.scene;
  GameState.currentSystem = to;
  GameState.lastPort = to;
  GameState.save();
  StateManager.transition(STATES.GALAXY);
});

// Tunnel → Dogfight (pirate ambush)
EventBus.on('tunnel:ambush', ({ enemies: enemyFaction, count, from, to }) => {
  console.log(`pirate ambush → DOGFIGHT (${count} ${enemyFaction})`);
  StateManager.transition(STATES.DOGFIGHT, {
    faction: enemyFaction,
    count,
    location: 'tunnel',
    returnTo: to,
    returnFrom: from,
  });
});

// Dogfight → Galaxy (victory)
EventBus.on('dogfight:victory', ({ faction }) => {
  console.log(`dogfight victory vs ${faction}`);
  EventBus.emit('enemy:faction_defeated', { faction });
  GameState.save();
  StateManager.transition(STATES.GALAXY);
});

// Dogfight → Galaxy (escaped)
EventBus.on('dogfight:escaped', ({ faction }) => {
  console.log(`escaped from ${faction}`);
  GameState.save();
  StateManager.transition(STATES.GALAXY);
});

// Planet Attack → Galaxy (victory)
EventBus.on('planet_attack:victory', ({ systemId, faction, tier }) => {
  console.log(`planet captured: ${systemId} (was ${faction})`);
  FactionState.setFaction(systemId, 'player');
  const reward = [500, 1200, 3000][tier - 1] + Math.floor(Math.random() * 500);
  GameState.credits += reward;
  GameState.save();
  StateManager.transition(STATES.GALAXY);
});

// Planet Attack → Galaxy (retreat)
EventBus.on('planet_attack:retreat', ({ systemId, tier }) => {
  console.log(`retreat from ${systemId} — defense reinforced`);
  // Defense reinforcement tracked per system (simplified: just log)
  GameState.save();
  StateManager.transition(STATES.GALAXY);
});

// Player destroyed
EventBus.on('player:destroyed', ({ location }) => {
  console.log(`player destroyed in ${location} — respawning at ${GameState.lastPort}`);
  // Respawn logic: -30% credits, cargo lost, HP restored
  GameState.credits = Math.max(100, Math.floor(GameState.credits * 0.7));
  GameState.cargo = [];
  GameState.ship.hp = GameState.ship.maxHp;
  GameState.ship.shields = GameState.ship.maxShields;
  GameState.currentSystem = GameState.lastPort;
  GameState.save();
  StateManager.transition(STATES.GALAXY);
});

// ---- Start ----
GameLoop.start();
StateManager.transition(STATES.MENU);
