// StateManager.js — scene FSM, transition(STATE, payload)

import GameLoop from './GameLoop.js';
import EventBus from './EventBus.js';

export const STATES = {
  MENU: 'menu',
  GALAXY: 'galaxy',
  TUNNEL: 'tunnel',
  DOGFIGHT: 'dogfight',
  PLANET_LAND: 'planet_land',
  PLANET_ATTACK: 'planet_attack',
  STATION_ATTACK: 'station_attack',
  PIRATE_BASE_ATTACK: 'pirate_base_attack',
};

const sceneFactories = {};
let currentState = null;
let currentScene = null;

const StateManager = {
  register(state, factory) {
    sceneFactories[state] = factory;
  },

  transition(state, payload = {}) {
    if (!sceneFactories[state]) {
      console.warn(`StateManager: no factory registered for "${state}"`);
      return;
    }

    // Destroy current scene
    if (currentScene && currentScene.destroy) {
      currentScene.destroy();
    }

    const prevState = currentState;
    currentState = state;

    // Create new scene
    currentScene = sceneFactories[state](payload);
    GameLoop.setScene(currentScene);

    EventBus.emit('state:changed', { from: prevState, to: state, payload });
  },

  get current() {
    return currentState;
  },

  get scene() {
    return currentScene;
  },
};

export default StateManager;
