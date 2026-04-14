// FactionState.js — galaxy state (who owns what)
// Colors always from here, NEVER from galaxy.json directly

import galaxyData from '../data/galaxy.json';

const FactionState = {
  systems: {},    // { systemId: factionId }
  stations: {},   // { systemId: { tier, hasStation } }
  influence: {},  // { systemId: 0-100 } — used in M6+

  init() {
    for (const system of galaxyData) {
      FactionState.systems[system.id] = system.faction;
      FactionState.stations[system.id] = {
        hasStation: system.hasStation,
        tier: system.hasStation ? system.tier : 0,
      };
      FactionState.influence[system.id] = system.isCore ? 100 : 50;
    }
  },

  getFaction(systemId) {
    return FactionState.systems[systemId] || 'neutral';
  },

  setFaction(systemId, faction) {
    FactionState.systems[systemId] = faction;
  },

  hasStation(systemId) {
    const s = FactionState.stations[systemId];
    return s ? s.hasStation : false;
  },

  getStationTier(systemId) {
    const s = FactionState.stations[systemId];
    return s && s.hasStation ? s.tier : 0;
  },
};

export default FactionState;
