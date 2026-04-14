// GameState.js — player state (M2 skeleton, extended in M5)

import EventBus from './EventBus.js';

const INITIAL_STATE = {
  credits: 1500,
  currentSystem: 'crossroads',
  lastPort: 'crossroads',
  transponderActive: true,
  ship: {
    class: 'courier',
    hp: 100,
    maxHp: 100,
    shields: 0,
    maxShields: 0,
    modules: { engines: 1, weapons: 1, cargoHold: 1, shields: 0, ecm: 0 },
  },
  cargo: [],
  cargoCapacity: 10,
  unlockedSystems: ['crossroads', 'sol', 'nova_prime', 'the_den', 'drift', 'the_margin'],
};

const LEGAL_CARGO_TYPES = ['Raw Materials', 'Technology', 'Food'];

const GameState = { ...structuredClone(INITIAL_STATE) };

GameState.reset = function () {
  Object.assign(GameState, structuredClone(INITIAL_STATE));
};

GameState.save = function () {
  const data = {};
  for (const key of Object.keys(INITIAL_STATE)) {
    data[key] = GameState[key];
  }
  localStorage.setItem('voidrunner_save', JSON.stringify(data));
};

GameState.load = function () {
  const saved = localStorage.getItem('voidrunner_save');
  if (!saved) return false;
  try {
    const data = JSON.parse(saved);
    Object.assign(GameState, data);
    return true;
  } catch {
    console.warn('Corrupt save file');
    return false;
  }
};

GameState.hasSave = function () {
  return !!localStorage.getItem('voidrunner_save');
};

GameState.addCargo = function (type, qty = 1) {
  const currentTotal = GameState.cargo.reduce((s, c) => s + c.qty, 0);
  const canAdd = Math.min(qty, GameState.cargoCapacity - currentTotal);
  if (canAdd <= 0) return 0;

  const existing = GameState.cargo.find(c => c.type === type);
  if (existing) {
    existing.qty += canAdd;
  } else {
    GameState.cargo.push({ type, qty: canAdd, illegal: !LEGAL_CARGO_TYPES.includes(type) });
  }
  return canAdd;
};

GameState.cargoTotal = function () {
  return GameState.cargo.reduce((s, c) => s + c.qty, 0);
};

GameState.takeDamage = function (amount) {
  // Shields first
  if (GameState.ship.shields > 0) {
    const absorbed = Math.min(amount, GameState.ship.shields);
    GameState.ship.shields -= absorbed;
    amount -= absorbed;
  }
  GameState.ship.hp = Math.max(0, GameState.ship.hp - amount);
  EventBus.emit('player:damaged', { hp: GameState.ship.hp, shields: GameState.ship.shields });
  return GameState.ship.hp <= 0;
};

GameState.randomLegalCargo = function () {
  return LEGAL_CARGO_TYPES[Math.floor(Math.random() * LEGAL_CARGO_TYPES.length)];
};

export default GameState;
