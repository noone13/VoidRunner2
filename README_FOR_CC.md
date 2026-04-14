# VOID RUNNER — Briefing dla Claude Code

Czytasz to jako pierwsze. Reszta dokumentacji to referencja — wracasz do niej przy konkretnym module.

---

## CO BUDUJEMY

Gra kosmiczna sandbox (PC, Steam). Mix: Privateer × X-Wing × Pirates! × The Last Starfighter.
Estetyka: wireframe linearty, zero tekstur, wszystko krawędziowa geometria.

**Stack:**
```
Three.js    — rendering 3D (wireframe)
Vite        — bundler / dev server
Tauri       — wrapper desktop + Steam deploy (dodajemy NA KOŃCU projektu)
JavaScript  — ES6+, bez TypeScript
```

**Zasada:** budujemy i testujemy w przeglądarce (`vite dev`). Tauri tylko przy finalnym buildzie.

---

## MAPA SCEN I PRZEJŚCIA

Wszystkie możliwe przejścia między scenami w grze:

```
MENU
 ├─► GALAXY (new game / load)
 └─► SETTINGS (overlay)

GALAXY
 ├─► TUNNEL (gracz wybiera destynację)
 ├─► DOGFIGHT (gracz atakuje jednostkę w systemie)
 ├─► PLANET_LAND (gracz ląduje pokojowo)
 ├─► PLANET_ATTACK (gracz atakuje planetę)
 ├─► STATION_ATTACK (gracz atakuje stację)
 └─► MENU (Escape → pauza → Main Menu)

TUNNEL
 ├─► GALAXY (dotarcie do celu LUB zmiana destynacji po walce)
 └─► DOGFIGHT (napaść piratów w tunelu)

DOGFIGHT
 ├─► GALAXY (ucieczka LUB wszyscy wrogowie zniszczeni)
 └─► TUNNEL (kontynuacja lotu po wygranej — opcja gracza)

PLANET_LAND
 └─► GALAXY (Depart)

PLANET_ATTACK
 └─► GALAXY (sukces lub odwrót)

STATION_ATTACK
 └─► GALAXY (sukces lub odwrót)

PIRATE_BASE_ATTACK
 └─► GALAXY (sukces lub odwrót)

RESPAWN (nie scena — logika)
 └─► PLANET_LAND (ostatni odwiedzony port)
```

StateManager: `StateManager.transition(STATE, payload)` — niszczy aktywną scenę, tworzy nową.

---

## KOLEJNOŚĆ IMPLEMENTACJI I ZALEŻNOŚCI

Buduj w tej kolejności. Każdy moduł zależy od poprzednich.

```
M1 → Fundament + Mapa Galaktyki
      Tworzy: GameLoop, StateManager, EventBus, WireframeFactory,
              GalaxyScene, FactionState, ShipBlueprints, Menu główne
      Referencja: TECHSPEC_M1_Fundament_Mapa.md

M2 → Tunel Hyperspace
      Wymaga: M1 (StateManager, WireframeFactory, GameState szkielet)
      Tworzy: TunnelScene, GameState (pełny), transponder toggle
      Referencja: TECHSPEC_M2_Tunel.md

M3 → Dogfight
      Wymaga: M1, M2 (GameState.ship, StateManager)
      Tworzy: DogfightScene, EnemyShip, AI (stany + wing logic), FPP cockpit
      Referencja: TECHSPEC_M3_Dogfight.md

M4 → Planeta — Atak
      Wymaga: M1, M3 (EnemyShip AI, DogfightScene jako baza)
      Tworzy: PlanetAttackScene, fazy ataku, zmiana FactionState
      Referencja: TECHSPEC_M4_Planeta_Atak.md

M5 → Planeta — Lądowanie i Handel
      Wymaga: M1, M2 (GameState pełny)
      Tworzy: PlanetLandScene, Trading, Shipyard, Tavern, BlackMarket,
              Quartermaster, Brothel/informatorzy
      Referencja: TECHSPEC_M5_Planeta_Ladowanie.md

M6 → Frakcje, Reputacja, Dynamika Terytoriów
      Wymaga: M1 (FactionState), M2 (GameState.reputation), M5 (handel)
      Tworzy: ReputationSystem, FactionAtmosphere, GalaxyTick,
              EventLog (dziennik J), toast notifications, briefing przy wejściu
      Referencja: TECHSPEC_M6_Frakcje_Reputacja.md

M7 → Misje
      Wymaga: M3 (dogfight — cele), M5 (tawerna), M6 (reputacja)
      Tworzy: MissionSystem, generator misji, tracker (M), escort NPC
      Referencja: TECHSPEC_M7_Misje.md

M8 → Stacje Kosmiczne
      Wymaga: M1 (FactionState), M3 (dogfight — atak na stację), M6 (GalaxyTick)
      Tworzy: StationAttackScene, logika budowania stacji, lądowanie na stacji
      Referencja: TECHSPEC_M8_StacjeKosmiczne.md

M9 → Polish + Steam
      Wymaga: wszystkich poprzednich
      Tworzy: audio (Tone.js), glow/bloom, save/load (Tauri), settings,
              InputMap centralny, Tauri build
      Referencja: TECHSPEC_M9_Polish_Steam.md

M10 → Tajne Bazy Pirates + Tutorial
       Wymaga: M3 (dogfight), M5 (tawerna/brothel), M6 (GalaxyTick), M7 (misje)
       Tworzy: PirateBaseAttack, wraki w tunelu, tutorial overlay, persistent hints
       Referencja: TECHSPEC_M10_TajneBazy_Tutorial.md
```

---

## KLUCZOWE PLIKI I ICH ROLA

```
src/core/GameLoop.js          — requestAnimationFrame, delta time
src/core/StateManager.js      — maszyna stanów scen
src/core/EventBus.js          — pub/sub między modułami
src/core/GameState.js         — stan gracza (kredyty, statek, reputacja, misje...)
src/core/FactionState.js      — stan galaktyki (kto ma co, stacje, influence)
src/core/ReputationSystem.js  — logika reputacji per frakcja
src/core/InputMap.js          — JEDYNE źródło prawdy dla klawiszy (nie hardcoduj!)
src/core/WireframeFactory.js  — JEDYNE miejsce tworzenia wireframe meshów

src/data/galaxy.json          — 40 systemów, pozycje, połączenia, frakcje
src/data/ShipBlueprints.js    — parametry generatywne 5 klas statków

src/scenes/GalaxyScene.js     — mapa 3D
src/scenes/TunnelScene.js     — hyperspace
src/scenes/DogfightScene.js   — walka FPP
src/scenes/PlanetAttackScene.js
src/scenes/PlanetLandScene.js
src/scenes/StationAttackScene.js
src/scenes/PirateBaseAttackScene.js
```

---

## STAŁE KOLORÓW

Używaj wyłącznie z `WireframeFactory.COLORS`:

```javascript
PLAYER:    0x00ff88  // zielony — gracz, sojusznicy
HEGEMONY:  0x4488ff  // niebieski
COALITION: 0xffcc00  // żółty
SYNDICATE: 0xcc44ff  // fioletowy
PIRATES:   0xff6600  // pomarańczowy
NEUTRAL:   0x888888  // szary — trasy, systemy neutralne
LOCKED:    0x333333  // ciemny — systemy nieodblokowane
UI:        0x00ccff  // błękit — interfejs, hover, zaznaczenie
WARNING:   0xff4400  // pomarańczowo-czerwony — zagrożenie
ENEMY:     0xff2222  // czerwony — aktywny wróg
```

---

## JEDNOSTKI

```
1 parsek (lore/UI) = 100 jednostek Three.js (kod)
Przelicznik w UI:  display = value / 100
```

---

## STAN STARTOWY NOWEJ GRY

```javascript
credits:         1500
ship:            Courier (wszystkie moduły Mk1, brak ECM, brak shields)
currentSystem:   'crossroads'
reputation:      { hegemony: 0, coalition: 0, syndicate: 0, pirates: 0 }
transponder:     true
hegemonyBlacklist: false
cargo:           []
```

---

## ZASADY KTÓRYCH NIE ŁAMAĆ

1. **InputMap.js** — nigdy nie hardcoduj klawiszy w scenach. Zawsze `InputMap.fire`, `InputMap.thrust` etc.
2. **WireframeFactory** — nigdy nie twórz `LineBasicMaterial` bezpośrednio w scenach. Używaj factory.
3. **Delta time** — wszystkie mnożniki per-klatka muszą być: `value *= Math.pow(multiplier, delta * 60)`
4. **Parseki w UI** — gracz widzi parseki, kod operuje jednostkami Three.js
5. **Tauri** — nie instaluj ani nie konfiguruj Tauri dopóki M9. Wcześniej wszystko w przeglądarce.
6. **FactionState** — kolory systemów na mapie zawsze z `FactionState.systems[id]`, nigdy z `galaxy.json` bezpośrednio

---

## GDY MASZ WĄTPLIWOŚCI

Dokumenty referencyjne w kolejności ważności:
1. Ten plik (architektura i flow)
2. `TECHSPEC_M[N]_*.md` (szczegóły aktualnego modułu)
3. `GDD_VOID_RUNNER.md` (vision i design decisions)

Jeśli coś nie jest opisane — zapytaj zanim zaimplementujesz. Lepiej 30 sekund pytania niż godzina przepisywania.

---

*VOID RUNNER — README for Claude Code v1.0*
