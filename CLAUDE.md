# VOID RUNNER — Claude Code Reference

Read this first. Tech specs per module are in `TECHSPEC_M[N]_*.md`.

## Stack
- Three.js r169+ (rendering), Vite 5+ (bundler), JavaScript ES6+ (no TS)
- Tauri 2+ added ONLY in M9 (final build). Until then: browser only (`vite dev`)

## Architecture
```
src/main.js              — entry point
src/core/GameLoop.js     — rAF, delta (seconds), limit 0.1s
src/core/StateManager.js — scene FSM, transition(STATE, payload)
src/core/EventBus.js     — pub/sub
src/core/GameState.js    — player state (credits, ship, cargo, rep...)
src/core/FactionState.js — galaxy state (who owns what)
src/core/InputMap.js     — ONLY source of keybindings
src/core/WireframeFactory.js — ONLY place to create wireframe meshes
src/data/galaxy.json     — 40 systems
src/data/ShipBlueprints.js — 5 ship classes, procedural meshes
```

## Rules — NEVER break these
1. **InputMap.js** — never hardcode keys in scenes
2. **WireframeFactory** — never create LineBasicMaterial directly in scenes
3. **Delta time** — all per-frame multipliers: `value *= Math.pow(multiplier, delta * 60)`
4. **Parsecs in UI** — player sees parsecs, code uses Three.js units (1 parsec = 100 units)
5. **Tauri** — do NOT install until M9
6. **FactionState** — system colors from `FactionState.systems[id]`, never from galaxy.json directly

## Colors (WireframeFactory.COLORS)
```
PLAYER:    0x00ff88   HEGEMONY:  0x4488ff   COALITION: 0xffcc00
SYNDICATE: 0xcc44ff   PIRATES:   0xff6600   NEUTRAL:   0x888888
LOCKED:    0x333333   UI:        0x00ccff   WARNING:   0xff4400
ENEMY:     0xff2222
```

## Factions (canonical code names)
hegemony, coalition, syndicate, pirates

## New Game State
```
credits: 1500, ship: courier (modules Mk1, no ECM/shields)
currentSystem: 'crossroads', transponder: true
reputation: { hegemony: 0, coalition: 0, syndicate: 0, pirates: 0 }
```

## Unlocked systems at start
crossroads, sol, nova_prime, the_den, drift, the_margin

## Scene Transitions
```
MENU → GALAXY (new/load)
GALAXY → TUNNEL / DOGFIGHT / PLANET_LAND / PLANET_ATTACK / STATION_ATTACK / MENU
TUNNEL → GALAXY / DOGFIGHT
DOGFIGHT → GALAXY / TUNNEL
PLANET_LAND → GALAXY
PLANET_ATTACK → GALAXY
STATION_ATTACK → GALAXY
PIRATE_BASE_ATTACK → GALAXY
```

## Current Production Status
- [x] M1: Fundament + Galaxy Map
- [x] M2: Tunnel Hyperspace
- [x] M3: Dogfight
- [x] M4: Planet Attack
- [ ] M5: Planet Landing & Trade
- [ ] M6: Factions, Reputation, Territory
- [ ] M7: Missions
- [ ] M8: Space Stations
- [ ] M9: Polish + Steam
- [ ] M10: Pirate Bases + Tutorial
