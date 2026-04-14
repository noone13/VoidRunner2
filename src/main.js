// main.js — entry point, init all core modules

import GameLoop from './core/GameLoop.js';
import StateManager, { STATES } from './core/StateManager.js';
import EventBus from './core/EventBus.js';
import InputMap from './core/InputMap.js';
import FactionState from './core/FactionState.js';
import createMenuScene from './scenes/MenuScene.js';
import createGalaxyScene from './scenes/GalaxyScene.js';

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
  return createGalaxyScene(canvas, uiOverlay, payload);
});

// ---- Event handlers ----
EventBus.on('menu:action', ({ action }) => {
  if (action === 'new_game') {
    StateManager.transition(STATES.GALAXY, {
      currentSystem: 'crossroads',
    });
  } else if (action === 'load_game') {
    const saved = localStorage.getItem('voidrunner_save');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        StateManager.transition(STATES.GALAXY, data);
      } catch {
        console.warn('Corrupt save — starting new game');
        StateManager.transition(STATES.GALAXY, { currentSystem: 'crossroads' });
      }
    }
  }
});

EventBus.on('travel:requested', ({ from, to }) => {
  console.log(`travel: ${from} → ${to}`);
  // In M2 this will transition to TUNNEL
  // For now, just move the player marker
  const scene = StateManager.scene;
  if (scene && scene.setPlayerSystem) {
    scene.setPlayerSystem(to);
  }
});

// ---- Start ----
GameLoop.start();
StateManager.transition(STATES.MENU);
