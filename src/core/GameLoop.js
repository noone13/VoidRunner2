// GameLoop.js — requestAnimationFrame with delta time in seconds

let activeScene = null;
let running = false;
let lastTime = 0;

const MAX_DELTA = 0.1; // 100ms cap — prevents huge jumps on tab-switch

function tick(timestamp) {
  if (!running) return;

  const deltaMs = lastTime ? timestamp - lastTime : 16.67;
  lastTime = timestamp;
  const delta = Math.min(deltaMs / 1000, MAX_DELTA);

  if (activeScene) {
    activeScene.update(delta);
    activeScene.render();
  }

  requestAnimationFrame(tick);
}

const GameLoop = {
  start() {
    if (running) return;
    running = true;
    lastTime = 0;
    requestAnimationFrame(tick);
  },

  stop() {
    running = false;
  },

  setScene(scene) {
    activeScene = scene;
  },

  get isRunning() {
    return running;
  },
};

export default GameLoop;
