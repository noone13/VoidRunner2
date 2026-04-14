// InputMap.js — ONLY source of truth for keybindings

const InputMap = {
  // GLOBAL
  pause: 'Escape',
  missions: 'KeyM',
  reputation: 'KeyR',
  journal: 'KeyJ',
  save: 'F5',

  // GALAXY MAP
  galaxy_zoom_in: 'Equal',
  galaxy_zoom_out: 'Minus',

  // TUNNEL
  tunnel_up: 'ArrowUp',
  tunnel_down: 'ArrowDown',
  tunnel_left: 'ArrowLeft',
  tunnel_right: 'ArrowRight',
  tunnel_up2: 'KeyW',
  tunnel_down2: 'KeyS',
  tunnel_left2: 'KeyA',
  tunnel_right2: 'KeyD',
  transponder: 'KeyT',

  // DOGFIGHT
  thrust: 'KeyW',
  brake: 'KeyS',
  yaw_left: 'KeyA',
  yaw_right: 'KeyD',
  pitch_up: 'KeyQ',
  pitch_down: 'KeyE',
  afterburner: 'ShiftLeft',
  fire: 'Space',
  target_next: 'Tab',
  escape_flee: 'KeyH',

  // PLANET ATTACK
  attack_left: 'KeyA',
  attack_right: 'KeyD',
  attack_up: 'KeyW',
  attack_down: 'KeyS',
  attack_fire: 'Space',
  attack_retreat: 'Escape',
};

// Active keys state — scenes read from here
const keysDown = {};

function onKeyDown(e) {
  keysDown[e.code] = true;
}

function onKeyUp(e) {
  keysDown[e.code] = false;
}

InputMap.init = function () {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
};

InputMap.destroy = function () {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
};

InputMap.isDown = function (action) {
  const code = InputMap[action];
  return !!keysDown[code];
};

InputMap.isKeyDown = function (code) {
  return !!keysDown[code];
};

InputMap.clearAll = function () {
  for (const key of Object.keys(keysDown)) {
    keysDown[key] = false;
  }
};

export default InputMap;
