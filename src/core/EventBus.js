// EventBus.js — global pub/sub

const listeners = {};

const EventBus = {
  on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  },

  off(event, handler) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(h => h !== handler);
  },

  emit(event, data) {
    if (!listeners[event]) return;
    for (const handler of listeners[event]) {
      handler(data);
    }
  },

  clear(event) {
    if (event) {
      delete listeners[event];
    } else {
      for (const key of Object.keys(listeners)) {
        delete listeners[key];
      }
    }
  },
};

export default EventBus;
