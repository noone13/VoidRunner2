# VOID RUNNER — Production Plan

Compact reference for implementation. Full details in TECHSPEC_M[N]_*.md files.

---

## M1: Fundament + Galaxy Map
**Ref:** TECHSPEC_M1_Fundament_Mapa.md

### Steps
1. `npm create vite` + `npm i three` — NO Tauri
2. Directory structure: `src/{core,scenes,data,ui}/`
3. Core: GameLoop.js, StateManager.js, EventBus.js, InputMap.js
4. WireframeFactory.js + COLORS constants
5. ShipBlueprints.js — 5 classes, procedural mesh from primitives (Group)
6. galaxy.json — all 40 systems (copy from techspec)
7. FactionState.js — init from galaxy.json
8. GalaxyScene.js — render nodes (icosahedron wireframe) + routes (lines)
   - Color from FactionState, locked = COLORS.LOCKED, dashed routes
   - Pulse animation (sin wave scale 0.95↔1.05)
   - Stations: small orbiting cube if hasStation
9. OrbitControls + Viewport Cube (6 faces + ISO corner, 600ms eased transition)
10. Hover (color→UI) + Click → EventBus `system:selected`
11. InfoPanel.js — HTML overlay, Travel Here / Region Unexplored
12. System unlock: visit system → unlock locked neighbors, fade LOCKED→faction color
13. Menu (STATES.MENU) — auto-rotate galaxy bg, NEW GAME/LOAD/SETTINGS/QUIT
14. main.js — wire everything, start GameLoop

### Done when
- 40 systems in 3D, correct faction colors, locked=dark
- Dashed routes to locked, solid to unlocked
- Click → info panel, Travel → console log "travel: A → B"
- Viewport cube works, orbit controls work
- Stations visible as orbiting cubes
- Pulse animation on unlocked nodes
- Menu screen with auto-rotate background
- Runs in browser via `vite dev`

---

## M2: Tunnel Hyperspace
**Ref:** TECHSPEC_M2_Tunel.md

### Steps
1. TUNNEL state in StateManager, transition from GALAXY
2. Cylinder wireframe geometry, camera inside (third-person behind ship)
3. Object pool: ring segments + decorations, seed = from+to
4. Player ship mesh (from ShipBlueprints) + WASD movement + inertia (lerp 0.15)
5. Boundary: radius 3.2, bounce on wall hit
6. Obstacles (WARNING color, sphere collision r0.5) → hull damage
7. Cargo pickups (UI color + pulse, sphere r0.4) → add to inventory
8. Wall collision: shields absorb first, then hull, HP=0 → respawn
9. GameState skeleton (credits, ship, cargo, transponder)
10. Progress bar HUD (HTML overlay, system names on ends)
11. Random events every ~20% (pirate ambush 20%, anomaly bonus 10%, etc.)
12. Transponder toggle UI on galaxy map + black route confirmation dialog
13. Black route: NEUTRAL color, +15% pirate chance, +30% length, no checkpoint
14. Hegemony checkpoint (simplified 50/50 roll)
15. localStorage save/load (temporary until M9)

### Done when
- Tunnel renders as wireframe cylinder
- WASD with inertia, boundary enforced
- Obstacles/cargo procedural, same seed = same layout
- Collision → damage log / pickup log
- Progress bar works
- End of tunnel → GALAXY
- Pirate ambush → log "pirate ambush → DOGFIGHT"

---

## M3: Dogfight
**Ref:** TECHSPEC_M3_Dogfight.md

### Steps
1. DOGFIGHT state, starfield background (Points geometry)
2. Player ship FPP: wireframe cockpit frame, movement (W/S/A/D/Q/E), afterburner (Shift)
3. Shooting: projectiles (Line, 2 units), cooldown 0.25s, range 80, damage 25
4. EnemyShip.js: spawn from payload, mesh from ShipBlueprints, faction color
5. AI state machine: PURSUE → ATTACK → EVADE → SUPPORT → RETREAT
6. Wing logic: leader decides, wingmen copy with 0.5-1.5s delay + position offset
7. Faction AI differences (pirates chaotic/flee, hegemony disciplined, etc.)
8. Enemy accuracy: spread cone based on distance (<15: ±8°, 15-40: ±15°, >40: ±25°)
9. Targeting: Tab lock, wireframe reticle, cycle through enemies
10. Combat bubble 100u + escape mechanic (>100u from nearest → H to flee)
11. Effects: wireframe explosion fragments, engine trails, hit flashes
12. HUD: enemies, speed, afterburner, HP, shields, target info, escape prompt
13. Respawn: last port, ship repaired, cargo lost, -30% credits (min 100)

### Done when
- Player flies and shoots in 3D FPP
- Enemies spawn in wings (2-4 ships)
- All 5 AI states work, wing logic works
- Pirates retreat at >50% losses
- Tab targeting with reticle
- Wireframe explosions on destroy
- Escape mechanic: message + confirm + exit
- HUD complete

---

## M4: Planet Attack
**Ref:** TECHSPEC_M4_Planeta_Atak.md

### Steps
1. PLANET_ATTACK state, procedural wireframe terrain (PlaneGeometry, random height, seed=systemId)
2. Player: auto-forward, A/D yaw, W/S altitude (2-15 above terrain), camera follow
3. Phase 1: scramble fighters (4-8 per tier), AI from M3
4. Phase 2: defense towers (3-6), rotating turret head, fire in cone, destroyable
5. Phase 3: drones (swarm AI, small tetrahedron, HP 20) + defensive fighters
6. Phase 4: capital ship (30% chance, always at T3) — HP 400-1000, 4 turrets, spawns fighters
7. Phase tracker HUD (left side)
8. Victory: FactionState.systems[id] = "player", color change on map
9. Retreat (ESC): defense +1 tier next attempt

### Done when
- 4 sequential phases, terrain procedural
- All enemy types work per phase
- Phase tracker HUD updates live
- Victory → system captured, map color changes
- Retreat → defense reinforced

---

## M5: Planet Landing & Trade
**Ref:** TECHSPEC_M5_Planeta_Ladowanie.md

### Steps
1. PLANET_LAND state, fullscreen HTML menu (wireframe terminal style)
2. GameState.js full version (all fields from techspec section 8)
3. Trading Post: seeded prices, buy/sell UI, cargo/credits update
4. Shipyard: repair (full/50%), module upgrades (Mk1-3), new ship purchase
5. Tavern: Missions tab (3 hardcoded), Rumors (pool of 20), Agents (Syndicate rep ≥ 20)
6. Pleasure Quarter: 3 options (pay/tip/cheat), info roll, Underworld stat
7. Administration: standing display, licenses, bounty payment
8. Black Market: Syndicate rep ≥ 40, illegal goods, special modules
9. Depart: illegal cargo check (50/50 modified by rep), return to GALAXY
10. Empty systems (no planet): brief stopover scene, collectible debris

### Done when
- All locations functional with wireframe UI
- Trading updates credits and cargo correctly
- Shipyard repair/upgrade/buy works
- Tavern shows missions and rumors
- Black Market conditional on rep
- Depart returns to GALAXY

---

## M6: Factions, Reputation, Territory Dynamics
**Ref:** TECHSPEC_M6_Frakcje_Reputacja.md

### Steps
1. ReputationSystem.js: get/set, clamp -100/+100, paradox effect (high at one → -3 at enemy per +10)
2. Wire reputation changes to actions (destroy ship, complete mission, trade, smuggle)
3. Reputation thresholds → effects (NPC hostility, port access, prices)
4. FactionAtmosphere.js: economic modifiers per faction (Hegemony tax, Coalition pirates, etc.)
5. Pirate scaling with rep in Coalition systems (4 tiers)
6. GalaxyTick(): 300s timer, NPC vs NPC attack logic, territory changes
7. Live map color refresh on territory change
8. Toast notifications (queue, max 3 simultaneous, 4s each)
9. Event journal (J key): last 50 events
10. System entry briefing (3s overlay: faction, pirate activity, tax)
11. Player faction: ≥3 systems → COLORS.PLAYER on map
12. Reputation panel (R key)

### Done when
- Rep changes after every player action
- Thresholds affect NPC behavior (test: rep < -50 → attacked)
- Galaxy ticks every 300s, systems change hands
- Map colors update live
- Toast + journal + briefing work
- Player faction unlocks at ≥3 systems

---

## M7: Missions
**Ref:** TECHSPEC_M7_Misje.md

### Steps
1. MissionSystem.js: Mission structure, CRUD, status tracking
2. Mission tracker UI (M key)
3. 3 hardcoded starter missions in Crossroads tavern
4. Wire DESTROY → target check in dogfight
5. Wire DELIVER → cargo check in destination tavern
6. Wire ESCORT → NPC ship in dogfight (invisible in tunnel, HUD HP bar)
7. Procedural mission generator: type selection, rep filter, reward scaling
8. Named NPC bounty targets (adjective+noun pool, +50% HP, migrate after 2 ticks)
9. Max 3 active missions enforcement

### Done when
- 3 starter missions visible and completable
- DESTROY/DELIVER/ESCORT mechanics work
- Generator creates 3-5 missions per planet
- Rep filtering works
- Rewards (credits + rep) paid on completion
- Max 3 active enforced

---

## M8: Space Stations
**Ref:** TECHSPEC_M8_StacjeKosmiczne.md

### Steps
1. Station meshes per tier (T1: cube, T2: cube+antennae, T3: complex structure)
2. Station building in GalaxyTick (3 ticks uncontested → build, 3 more → tier up)
3. InfoPanel: block "Attack Planet" when station exists
4. STATION_ATTACK state: station as central target (HP 300-1200, turrets, shield gen at T3)
5. Defender waves every 45s (tier × 2 fighters)
6. T3 shield generator: destroy 2 guard turrets → generator → shield drops
7. Destruction → FactionState update, planet attackable
8. Station landing (rep ≥ 20): simplified menu (Trading Post + Shipyard + Depart)

### Done when
- 3 tier visual variants on map
- Station blocks planet attack
- Attack scene: turrets, escort fighters, T3 shield
- Destruction updates FactionState
- Landing with trade/repair available

---

## M9: Polish + Steam
**Ref:** TECHSPEC_M9_Polish_Steam.md

### Steps
1. Additive blending glow on all wireframe meshes
2. Scanline CSS overlay on all UI panels
3. Tone.js: 4 music variants (galaxy/tunnel/dogfight/planet), crossfade 2s
4. SFX: laser, hit, explosion, pickup, UI click, warp, alert, mission complete
5. Bloom pass (UnrealBloomPass, threshold 0.8, toggle in settings)
6. Camera shake utility
7. Full InputMap + keybinds.json support
8. Tauri 2 setup + save/load via Tauri API (replace localStorage)
9. Extended settings panel (display, audio, controls, game)
10. Tauri build: Windows .exe, macOS .app
11. Playtesting: balance prices, reputation, combat difficulty
12. Steam upload preparation

### Done when
- Glow + scanline + bloom on all visuals
- Procedural music in 4 variants with crossfade
- All SFX working
- Save/load via Tauri
- Settings panel functional
- `npm run tauri build` → working .exe
- 60 FPS in dogfight with 8 units

---

## M10: Pirate Bases + Tutorial
**Ref:** TECHSPEC_M10_TajneBazy_Tutorial.md

### Steps
1. PirateBase.js: seed generation, tier (1-3), reward calc
2. Skull marker ☠ on map (from Pleasure Quarter info)
3. PIRATE_BASE_ATTACK state: 3 phases (fighters → capital ship → base itself)
4. Base landing (pirates rep ≥ 30): Trading Post + Tavern
5. Derelict wrecks in tunnel (dense cargo at ⊕ marker)
6. Base regeneration in GalaxyTick (40% chance after 2 ticks)
7. Tutorial overlay system (CSS, queued hints)
8. 5-step tutorial sequence (map → tunnel → dogfight → landing → done)
9. Guaranteed 1 pirate (HP 40) on first flight
10. Persistent hints (5 types, one-time, saved in settings.json)
11. Skip Tutorial (F1)

### Done when
- Pleasure Quarter → info → skull marker on map
- Base attack: 3 phases work
- Base landing at rep ≥ 30
- Wrecks increase cargo in marked tunnels
- Tutorial: 5 steps, skippable, persistent hints after

---

## Design Clarifications (from discussion)
- **Faction names in code:** hegemony, coalition, syndicate, pirates
- **Empty systems (no planet):** player can enter, brief stopover, collectible debris possible
- **Escort in tunnel:** NPC invisible, only HUD HP bar; materializes in dogfight on ambush
- **System unlock:** visit a system → its locked neighbors become visible
- **Tauri:** browser-only development until M9, then Tauri for final Steam build
