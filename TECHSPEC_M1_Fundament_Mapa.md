# VOID RUNNER — Tech Spec: Moduł 1
## Fundament + Mapa Galaktyki

*Dokumentacja w języku polskim. Kod, nazwy zmiennych, komentarze — angielski.*

---

## 1. STACK I SETUP

```
Three.js r169+       — rendering 3D
Vite 5+              — bundler / dev server
Tauri 2+             — wrapper desktop (build docelowy)
JavaScript ES6+      — brak TypeScript
```

### Struktura projektu
```
void-runner/
├── index.html
├── vite.config.js
├── src-tauri/          — konfiguracja Tauri
└── src/
    ├── main.js         — entry point, init
    ├── core/
    │   ├── GameLoop.js        — requestAnimationFrame, delta time
    │   ├── StateManager.js    — maszyna stanów scen
    │   ├── EventBus.js        — globalny event emitter
    │   └── WireframeFactory.js — helper do geometrii krawędziowej
    ├── scenes/
    │   ├── GalaxyScene.js     — mapa galaktyki (ten moduł)
    │   └── [kolejne sceny w następnych modułach]
    ├── data/
    │   └── galaxy.json        — definicja 40 systemów
    └── ui/
        └── InfoPanel.js       — panel info po kliknięciu systemu
```

---

## 1.5 JEDNOSTKI I SKALA

**Konwencja:** UI i dokumentacja używają **parseków** jako jednostki lore. Kod operuje na **jednostkach Three.js**.

```
1 parsek = 100 jednostek Three.js
```

| Kontekst | Wartość lore | Wartość w kodzie |
|---|---|---|
| Bańka walki | 1 parsek | 100 jednostek |
| Zasięg lasera | 0.8 parseka | 80 jednostek |
| Odległość ucieczki | 1 parsek | 100 jednostek |
| Promień tunelu | — | 4 jednostki |

Wszystkie wartości w kodzie zawsze w jednostkach Three.js. Wszystkie wartości w UI zawsze w parsekach (przelicznik: `display = value / 100`).

---

## 2. GAME LOOP

`GameLoop.js` — singleton, odpowiada za:
- `requestAnimationFrame` z delta time **w sekundach** (nie ms). GameLoop konwertuje: `delta = deltaMs / 1000`
- wywołanie `update(delta)` i `render()` aktywnej sceny
- limit delta = 0.1s / 100ms (zabezpieczenie przy tabowaniu okna)

```javascript
// Interfejs publiczny
GameLoop.start()
GameLoop.stop()
GameLoop.setScene(scene) // scene: { update(delta), render() }
```

---

## 3. STATE MANAGER

`StateManager.js` — zarządza scenami gry.

Stany (enum):
```javascript
const STATES = {
  GALAXY:   'galaxy',
  TUNNEL:   'tunnel',
  DOGFIGHT: 'dogfight',
  PLANET:   'planet',
  MENU:     'menu'
}
```

Przejście między stanami:
```javascript
StateManager.transition(STATES.TUNNEL, { from: 'sol', to: 'arcturus' })
// → niszczy aktywną scenę, tworzy nową, przekazuje payload
```

W tym module aktywna jest tylko scena `GALAXY`.

---

## 4. EVENT BUS

`EventBus.js` — prosty pub/sub, globalny.

```javascript
EventBus.on('system:selected', (systemData) => { ... })
EventBus.emit('system:selected', { id: 'sol', faction: 'hegemony' })
EventBus.off('system:selected', handler)
```

---

## 5. WIREFRAME FACTORY

`WireframeFactory.js` — centralne miejsce tworzenia obiektów w estetyce lineartu.

```javascript
WireframeFactory.edges(geometry, color)      // EdgesGeometry + LineSegments
WireframeFactory.wireframe(geometry, color)  // WireframeGeometry
WireframeFactory.glowLine(points, color, opacity) // additive blending
```

Kolory jako stałe:
```javascript
const COLORS = {
  PLAYER:    0x00ff88,  // zielony
  HEGEMONY:  0x4488ff,  // niebieski
  COALITION: 0xffcc00,  // żółty
  SYNDICATE: 0xcc44ff,  // fioletowy
  PIRATES:   0xff6600,  // pomarańczowy
  NEUTRAL:   0x888888,  // szary
  LOCKED:    0x333333,  // ciemny — systemy niedostępne w MVP
  UI:        0x00ccff,  // błękit — elementy interfejsu
  WARNING:   0xff4400,  // pomarańczowy — zagrożenie
  ENEMY:     0xff2222,  // czerwony — wróg aktywny
}
```

---

## 6. SCENA: MAPA GALAKTYKI

### 6.1 Kamera i kontrolki

**Orbit Controls** (Three.js OrbitControls):
- Obrót: lewy przycisk myszy + drag
- Zoom: scroll
- Pan: prawy przycisk myszy + drag
- Tłumienie (damping): włączone, factor 0.05

**Viewport Cube** (gizmo, prawy górny róg):
- Mały sześcian 3D synchronizowany z orientacją głównej kamery
- 6 klikalnych ścian + 8 klikalnych narożników → animowane przejście kamery (600ms, easeInOutCubic):
  - **TOP** — y+
  - **BOTTOM** — y-
  - **FRONT** — z+
  - **BACK** — z-
  - **LEFT** — x-
  - **RIGHT** — x+
  - **ISO** — narożnik (gdzie schodzą się TOP + FRONT + RIGHT) → pozycja (1,1,1) znormalizowane — widok domyślny przy starcie
  - Pozostałe 7 narożników: przejście do odpowiedniej kombinacji osi (opcjonalne, można zignorować w MVP)

### 6.2 Dane galaktyki — galaxy.json

Schemat pojedynczego systemu:
```json
{
  "id": "sol",
  "name": "Sol",
  "position": { "x": 0, "y": 0, "z": 0 },
  "faction": "hegemony",
  "tier": 3,
  "hasStation": true,
  "hasPlanet": true,
  "isCore": true,
  "locked": false,
  "connections": ["arcturus", "vega", "crossroads"],
  "description": "Hegemony capital system. Heavy patrol presence."
}
```

Pole `locked: true` — system widoczny na mapie (ciemny, kolor LOCKED), klikalny, ale bez opcji Travel. Wyświetla komunikat "Region unexplored". Wszystkie 40 systemów jest w pliku od razu — `locked` decyduje co jest grywalne w MVP.

### 6.3 Pełna lista 40 systemów

#### EMPIRE (10 systemów)
| ID | Nazwa | Tier | Core | Stacja | Locked |
|---|---|---|---|---|---|
| sol | Sol | 3 | tak | tak | nie |
| arcturus | Arcturus | 2 | nie | tak | nie |
| vega | Vega | 1 | nie | nie | nie |
| pax | Pax | 2 | nie | tak | nie |
| imperius | Imperius | 2 | nie | nie | nie |
| centurion | Centurion | 1 | nie | nie | nie |
| bastion | Bastion | 2 | nie | tak | nie |
| nova | Nova | 1 | nie | nie | nie |
| frontier | Frontier | 1 | nie | nie | nie |
| garrison | Garrison | 1 | nie | nie | nie |

#### REBELLION (8 systemów)
| ID | Nazwa | Tier | Core | Stacja | Locked |
|---|---|---|---|---|---|
| nova_prime | Nova Prime | 3 | tak | tak | nie |
| haven | Haven | 2 | nie | tak | nie |
| outpost_7 | Outpost 7 | 1 | nie | nie | nie |
| redoubt | Redoubt | 2 | nie | nie | nie |
| free_port | Free Port | 2 | nie | tak | nie |
| liberty | Liberty | 1 | nie | nie | nie |
| sanctuary | Sanctuary | 1 | nie | nie | nie |
| echo_base | Echo Base | 1 | nie | nie | nie |

#### SYNDICATE (7 systemów)
| ID | Nazwa | Tier | Core | Stacja | Locked |
|---|---|---|---|---|---|
| cartel_hub | Cartel Hub | 3 | tak | tak | nie |
| shadow_reach | Shadow Reach | 2 | nie | nie | nie |
| black_market | Black Market | 2 | nie | nie | nie |
| the_exchange | The Exchange | 2 | nie | tak | nie |
| underworld | Underworld | 1 | nie | nie | nie |
| ghost_station | Ghost Station | 1 | nie | nie | nie |
| the_den | The Den | 1 | nie | nie | nie |

#### PIRATES (5 systemów)
| ID | Nazwa | Tier | Core | Stacja | Locked |
|---|---|---|---|---|---|
| deadrock | Deadrock | 2 | nie | nie | nie |
| the_belt | The Belt | 2 | nie | nie | nie |
| razorback | Razorback | 1 | nie | nie | nie |
| scrapyard | Scrapyard | 1 | nie | nie | nie |
| cutthroat | Cutthroat | 1 | nie | nie | nie |

#### NEUTRAL (10 systemów)
| ID | Nazwa | Tier | Core | Stacja | Locked |
|---|---|---|---|---|---|
| crossroads | Crossroads | 2 | nie | nie | nie |
| drift | Drift | 1 | nie | nie | nie |
| the_margin | The Margin | 1 | nie | nie | nie |
| waypoint | Waypoint | 1 | nie | nie | nie |
| borderland | Borderland | 1 | nie | nie | nie |
| junction | Junction | 2 | nie | nie | nie |
| limbo | Limbo | 1 | nie | nie | nie |
| nomad | Nomad | 1 | nie | nie | nie |
| vagrant | Vagrant | 1 | nie | nie | nie |
| passage | Passage | 1 | nie | nie | nie |

### 6.4 Pozycje i połączenia — galaxy.json (pełny)

```json
[
  { "id": "sol", "name": "Sol", "faction": "hegemony", "tier": 3, "isCore": true, "hasStation": true, "hasPlanet": true, "locked": false,
    "position": { "x": 15, "y": 0, "z": 0 },
    "connections": ["arcturus", "vega", "pax", "crossroads"],
    "description": "Hegemony capital system. Heavy patrol presence." },

  { "id": "arcturus", "name": "Arcturus", "faction": "hegemony", "tier": 2, "isCore": false, "hasStation": true, "hasPlanet": true, "locked": true,
    "position": { "x": 12, "y": 1, "z": 5 },
    "connections": ["sol", "bastion", "drift"],
    "description": "Hegemony administrative hub. Trade and bureaucracy." },

  { "id": "vega", "name": "Vega", "faction": "hegemony", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 18, "y": -1, "z": 4 },
    "connections": ["sol", "centurion", "frontier"],
    "description": "Mining colony under Hegemony contract." },

  { "id": "pax", "name": "Pax", "faction": "hegemony", "tier": 2, "isCore": false, "hasStation": true, "hasPlanet": true, "locked": true,
    "position": { "x": 10, "y": 2, "z": -3 },
    "connections": ["sol", "garrison", "waypoint"],
    "description": "Hegemony garrison world. Military presence is high." },

  { "id": "imperius", "name": "Imperius", "faction": "hegemony", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 14, "y": -2, "z": -5 },
    "connections": ["pax", "garrison", "borderland"],
    "description": "Old Hegemony world. Declining industry, rising unrest." },

  { "id": "centurion", "name": "Centurion", "faction": "hegemony", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": 20, "y": 1, "z": -2 },
    "connections": ["vega", "frontier"],
    "description": "Deep space relay station. Few services, many eyes." },

  { "id": "bastion", "name": "Bastion", "faction": "hegemony", "tier": 2, "isCore": false, "hasStation": true, "hasPlanet": true, "locked": true,
    "position": { "x": 17, "y": 2, "z": 9 },
    "connections": ["arcturus", "vagrant"],
    "description": "Hegemony fortress world at the outer rim." },

  { "id": "nova", "name": "Nova", "faction": "hegemony", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 8, "y": -1, "z": 5 },
    "connections": ["sol", "drift", "echo_base"],
    "description": "Disputed border system. Coalition sympathizers present." },

  { "id": "frontier", "name": "Frontier", "faction": "hegemony", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 22, "y": 0, "z": 5 },
    "connections": ["vega", "centurion", "razorback"],
    "description": "Edge of Hegemony space. Pirate raids frequent." },

  { "id": "garrison", "name": "Garrison", "faction": "hegemony", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 11, "y": 1, "z": -8 },
    "connections": ["pax", "imperius", "the_margin"],
    "description": "Supply depot. Nothing glamorous, everything necessary." },

  { "id": "nova_prime", "name": "Nova Prime", "faction": "coalition", "tier": 3, "isCore": true, "hasStation": true, "hasPlanet": true, "locked": false,
    "position": { "x": -15, "y": 0, "z": 2 },
    "connections": ["haven", "outpost_7", "echo_base", "crossroads"],
    "description": "Coalition capital. Hidden, defended, alive with hope." },

  { "id": "haven", "name": "Haven", "faction": "coalition", "tier": 2, "isCore": false, "hasStation": true, "hasPlanet": true, "locked": true,
    "position": { "x": -12, "y": 1, "z": -4 },
    "connections": ["nova_prime", "sanctuary", "borderland"],
    "description": "Coalition safe harbor. Refugees and revolutionaries." },

  { "id": "outpost_7", "name": "Outpost 7", "faction": "coalition", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -18, "y": -1, "z": 5 },
    "connections": ["nova_prime", "liberty", "the_belt"],
    "description": "Forward observation post. Skeleton crew, maximum tension." },

  { "id": "redoubt", "name": "Redoubt", "faction": "coalition", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": -10, "y": 2, "z": 6 },
    "connections": ["nova_prime", "free_port", "junction"],
    "description": "Coalition stronghold. Heavily fortified, poorly supplied." },

  { "id": "free_port", "name": "Free Port", "faction": "coalition", "tier": 2, "isCore": false, "hasStation": true, "hasPlanet": true, "locked": true,
    "position": { "x": -13, "y": -2, "z": 9 },
    "connections": ["redoubt", "nomad", "the_belt"],
    "description": "Coalition-controlled trade hub. Everyone welcome, Hegemony excluded." },

  { "id": "liberty", "name": "Liberty", "faction": "coalition", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": -20, "y": 1, "z": 0 },
    "connections": ["outpost_7", "cutthroat"],
    "description": "Outer rim colony. First system to break from the Hegemony." },

  { "id": "sanctuary", "name": "Sanctuary", "faction": "coalition", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": -17, "y": 0, "z": -5 },
    "connections": ["haven", "ghost_station"],
    "description": "Medical station and refugee camp. Neutral in practice." },

  { "id": "echo_base", "name": "Echo Base", "faction": "coalition", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -8, "y": -1, "z": -3 },
    "connections": ["nova_prime", "nova", "the_margin"],
    "description": "Hidden listening post. Location classified." },

  { "id": "cartel_hub", "name": "Cartel Hub", "faction": "syndicate", "tier": 3, "isCore": true, "hasStation": true, "hasPlanet": true, "locked": true,
    "position": { "x": 0, "y": -3, "z": -14 },
    "connections": ["shadow_reach", "black_market", "the_exchange", "borderland"],
    "description": "Syndicate nerve center. Money flows in. People disappear." },

  { "id": "shadow_reach", "name": "Shadow Reach", "faction": "syndicate", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 4, "y": -2, "z": -9 },
    "connections": ["cartel_hub", "the_den", "waypoint"],
    "description": "Syndicate distribution node. Ask no questions." },

  { "id": "black_market", "name": "Black Market", "faction": "syndicate", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -4, "y": -2, "z": -10 },
    "connections": ["cartel_hub", "ghost_station", "borderland"],
    "description": "A station with no official name. Very busy." },

  { "id": "the_exchange", "name": "The Exchange", "faction": "syndicate", "tier": 2, "isCore": false, "hasStation": true, "hasPlanet": false, "locked": true,
    "position": { "x": 1, "y": -3, "z": -18 },
    "connections": ["cartel_hub", "underworld"],
    "description": "Deep space trading post. Syndicate prices, Syndicate rules." },

  { "id": "underworld", "name": "Underworld", "faction": "syndicate", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 5, "y": -2, "z": -16 },
    "connections": ["the_exchange", "scrapyard"],
    "description": "Forgotten colony planet. Syndicate owns everything underground." },

  { "id": "ghost_station", "name": "Ghost Station", "faction": "syndicate", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -6, "y": -1, "z": -13 },
    "connections": ["black_market", "sanctuary"],
    "description": "Derelict station, officially abandoned. Syndicate disagrees." },

  { "id": "the_den", "name": "The Den", "faction": "syndicate", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": false,
    "position": { "x": 3, "y": -1, "z": -7 },
    "connections": ["shadow_reach", "crossroads"],
    "description": "Small waystation. Known for information brokering." },

  { "id": "deadrock", "name": "Deadrock", "faction": "pirates", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": 6, "y": 4, "z": 16 },
    "connections": ["limbo", "razorback"],
    "description": "Pirate stronghold. Don't land unless you're one of them." },

  { "id": "the_belt", "name": "The Belt", "faction": "pirates", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -6, "y": 3, "z": 18 },
    "connections": ["outpost_7", "free_port", "cutthroat"],
    "description": "Asteroid field. Pirates camp here between raids." },

  { "id": "razorback", "name": "Razorback", "faction": "pirates", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": 11, "y": 4, "z": 13 },
    "connections": ["frontier", "deadrock"],
    "description": "Ambush point on the Hegemony trade route. Notorious." },

  { "id": "scrapyard", "name": "Scrapyard", "faction": "pirates", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -2, "y": 3, "z": 20 },
    "connections": ["cutthroat", "underworld"],
    "description": "Ship graveyard. Pirates strip what they can't fly." },

  { "id": "cutthroat", "name": "Cutthroat", "faction": "pirates", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -11, "y": 4, "z": 15 },
    "connections": ["the_belt", "liberty", "scrapyard"],
    "description": "No law. No mercy. Bring friends." },

  { "id": "crossroads", "name": "Crossroads", "faction": "neutral", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": false,
    "position": { "x": 0, "y": 0, "z": 0 },
    "connections": ["sol", "nova_prime", "the_den", "drift", "the_margin"],
    "description": "The center of everything. Everyone passes through." },

  { "id": "drift", "name": "Drift", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": false,
    "position": { "x": 5, "y": 0, "z": 5 },
    "connections": ["crossroads", "arcturus", "nova"],
    "description": "Drifting fuel depot. Cheap, reliable, no questions." },

  { "id": "the_margin", "name": "The Margin", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": false,
    "position": { "x": -5, "y": 0, "z": 3 },
    "connections": ["crossroads", "garrison", "echo_base"],
    "description": "Barely self-sufficient colony. Stubbornly independent." },

  { "id": "waypoint", "name": "Waypoint", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": 8, "y": 1, "z": -4 },
    "connections": ["pax", "shadow_reach"],
    "description": "Fuel and repairs. That's all. That's enough." },

  { "id": "borderland", "name": "Borderland", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": -8, "y": 0, "z": -5 },
    "connections": ["imperius", "haven", "cartel_hub", "black_market"],
    "description": "Four factions, one planet. Everyone hates each other politely." },

  { "id": "junction", "name": "Junction", "faction": "neutral", "tier": 2, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": -1, "y": 1, "z": 8 },
    "connections": ["redoubt", "nomad", "limbo"],
    "description": "Natural crossroads of coalition supply lines." },

  { "id": "limbo", "name": "Limbo", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": 4, "y": 2, "z": 13 },
    "connections": ["junction", "deadrock", "vagrant"],
    "description": "Between pirate space and coalition space. Nobody claims it." },

  { "id": "nomad", "name": "Nomad", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": -4, "y": 1, "z": 11 },
    "connections": ["free_port", "junction"],
    "description": "Mobile station. Coordinates change. Regulars know how to find it." },

  { "id": "vagrant", "name": "Vagrant", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": false, "locked": true,
    "position": { "x": 9, "y": 0, "z": 10 },
    "connections": ["bastion", "limbo"],
    "description": "Old mining platform. Now just a place to hide." },

  { "id": "passage", "name": "Passage", "faction": "neutral", "tier": 1, "isCore": false, "hasStation": false, "hasPlanet": true, "locked": true,
    "position": { "x": -9, "y": 0, "z": 8 },
    "connections": ["haven", "junction"],
    "description": "Quiet system on the edge of coalition territory." }
]
```


### 6.9 System odblokowywania

**Start gry:** gracz pojawia się w Crossroads. Odblokowane systemy:
- Crossroads (start)
- Sol, Nova Prime, The Den, Drift, The Margin (bezpośrednie połączenia z Crossroads)

**Odblokowanie kolejnych:** automatyczne gdy gracz odwiedzi system sąsiadujący z locked systemem.
- Mechnika: przy każdym przylocie do systemu → sprawdź połączone systemy → odblokuj `locked: true` sąsiadów
- Efekt na mapie: locked system "rozświetla się" (animacja fade z COLORS.LOCKED do koloru frakcji)
- Komunikat: "NEW SYSTEM DISCOVERED: [nazwa]"

### 6.5 Rendering systemów

Każdy system renderowany jako:
- **Node**: ikosahedron wireframe, radius ~0.3 jednostki, kolor frakcji
- Systemy `locked`: kolor `COLORS.LOCKED`, brak animacji pulse
- **Glow pulse**: animacja scale 0.95→1.05 (sin wave)
- **Label**: CSS2DRenderer, tekst nazwy nad node, face-to-camera
- **Stacja**: mały sześcian wireframe orbitujący wokół node — jeśli `hasStation: true`

### 6.6 Rendering tras

- Linia między połączonymi systemami: `COLORS.NEUTRAL`
- Trasy do systemów `locked`: przerywane (`LineDashedMaterial`)
- Hover/selected trasa: `COLORS.UI` z glow

### 6.7 Interakcja

**Hover:**
- Node zmienia kolor na `COLORS.UI`
- Tooltip z nazwą systemu

**Kliknięcie:**
- EventBus emituje `system:selected`
- InfoPanel pokazuje dane
- Połączone systemy podświetlają trasy

**Dwukliknięcie / "Travel Here":**
- Jeśli `locked` → komunikat "Region unexplored"
- Jeśli dostępny → EventBus emituje `travel:requested` → StateManager → TUNNEL

### 6.8 Info Panel

HTML overlay, prawa strona ekranu. Monospace font, border `COLORS.UI`, tło półprzezroczyste.

```
[NAZWA SYSTEMU]              [FACTION]
Tier: ★★☆   Station: Yes (Tier 2)   Planet: Yes

[DESCRIPTION]

[TRAVEL HERE]  [CANCEL]
```

Dla systemów `locked`:
```
[NAZWA SYSTEMU]
⚠ REGION UNEXPLORED

Expand your influence to unlock this system.

[CLOSE]
```

---

## 7. FACTION STATE (seed)

```javascript
// core/FactionState.js
const factionState = {
  systems: {},    // { systemId: factionId } — inicjalizowany z galaxy.json
  influence: {}   // { systemId: 0-100 } — dynamika w Module 7
}
```

Renderer czyta kolory z `factionState.systems`, nie bezpośrednio z JSON.

---

## 8. KOLEJNOŚĆ IMPLEMENTACJI

1. Setup Vite + Three.js (Tauri dodajemy dopiero przed buildem Steam)
2. `GameLoop.js` + `StateManager.js` + `EventBus.js`
3. `WireframeFactory.js` + stałe kolorów
4. `galaxy.json` — wszystkie 40 systemów
5. `FactionState.js` — init z galaxy.json
6. `GalaxyScene.js` — rendering nodów i tras
7. Orbit Controls + Viewport Cube + animacja przejścia kamery
8. Hover + kliknięcie + EventBus
9. `InfoPanel.js` — HTML overlay (z obsługą `locked`)
10. Weryfikacja: klikam Sol → widzę info → klikam Travel → log "travel: sol → arcturus"

---

## 9. DEFINICJA "GOTOWE"

- [ ] Mapa wyświetla wszystkie 40 systemów w 3D z kolorami frakcji
- [ ] Systemy `locked` wyświetlane w kolorze LOCKED z przerywanymi trasami
- [ ] Trasy między systemami widoczne
- [ ] Kamera swobodnie obraca się, zoomuje, panuje
- [ ] Viewport cube — kliknięcie ściany animuje kamerę do predefiniowanej pozycji
- [ ] Kliknięcie systemu dostępnego → InfoPanel z danymi + przycisk Travel
- [ ] Kliknięcie systemu locked → InfoPanel z komunikatem "Region unexplored"
- [ ] Przycisk "Travel Here" → log w konsoli "travel: [from] → [to]"
- [ ] Systemy z `hasStation: true` mają widoczny element orbitalny
- [ ] Pulse animacja na wszystkich odblokowanych systemach
- [ ] Działa w przeglądarce przez `vite dev`

---

*Tech Spec v1.1 — Void Runner Moduł 1 (40 systemów)*
*Następny: Tech Spec Moduł 2 — Tunel Hyperspace*

---

## 10. MENU GŁÓWNE (STATES.MENU)

### Wizual
- Tło: animowana mapa galaktyki (ta sama scena co GalaxyScene, ale kamera powoli obraca się automatycznie wokół centrum — orbit autorotate)
- Mapa nieinteraktywna w tle (brak kliknięć, brak hover)
- Overlay: ciemny gradient na dole ekranu (czytelność przycisków)

### Layout
```
                    VOID RUNNER

              [ NEW GAME    ]
              [ LOAD GAME   ]
              [ SETTINGS    ]
              [ QUIT        ]

         v0.1.0
```

- Tytuł: duży, monospace, `COLORS.UI`, lekki glow
- Przyciski: wireframe border, monospace, hover = kolor `COLORS.UI`
- LOAD GAME: wyszarzony jeśli brak pliku save

### Akcje
- **NEW GAME** → inicjalizuj GameState → `STATES.GALAXY` (gracz startuje w Crossroads)
  ```javascript
  // Stan startowy nowej gry
  credits: 1500
  ship: Courier (wszystkie moduły Mk1, brak ECM)
  cargo: []
  currentSystem: 'crossroads'
  reputation: { hegemony: 0, coalition: 0, syndicate: 0, pirates: 0 }
  transponderActive: true
  ```
- **LOAD GAME** → wczytaj save.json → `STATES.GALAXY` (ostatni system gracza)
- **SETTINGS** → panel ustawień (overlay na menu, nie nowa scena)
- **QUIT** → `window.__TAURI__.process.exit(0)`

### Powrót do menu
- Klawisz **Escape** z mapy galaktyki → menu pauzy (overlay):
  ```
  [ RESUME    ]
  [ SAVE GAME ]
  [ MAIN MENU ]
  [ QUIT      ]
  ```

---

## 11. GENERATOR STATKÓW — PROCEDURALNE MESHE

Statki generowane z prymitywów Three.js łączonych w grupy (`THREE.Group`). Brak zewnętrznych modeli.

### Parametry per klasa

```javascript
const ShipBlueprints = {
  courier: {
    body:   { type: 'cone',   radius: 0.3, height: 1.2, segments: 4 },  // czworokątny stożek
    wings:  { type: 'box',    w: 1.2, h: 0.05, d: 0.4, offsetY: -0.1 }, // płaskie skrzydła
    engine: { type: 'cylinder', radius: 0.1, height: 0.3, count: 1 },
    scale:  1.0
  },
  trader: {
    body:   { type: 'box',    w: 0.6, h: 0.4, d: 1.8 },                 // prostokątny kadłub
    wings:  { type: 'box',    w: 1.8, h: 0.05, d: 0.6, offsetY: 0 },
    engine: { type: 'cylinder', radius: 0.12, height: 0.3, count: 2 },
    cargo:  { type: 'box',    w: 0.4, h: 0.4, d: 0.8, offsetZ: 0.5 },   // moduł cargo z tyłu
    scale:  1.3
  },
  corvette: {
    body:   { type: 'box',    w: 0.7, h: 0.35, d: 2.2 },
    wings:  { type: 'box',    w: 2.2, h: 0.06, d: 0.7, offsetY: -0.05 },
    engine: { type: 'cylinder', radius: 0.13, height: 0.35, count: 2 },
    nose:   { type: 'cone',   radius: 0.2, height: 0.5 },                // nos dziobowy
    scale:  1.6
  },
  cruiser: {
    body:   { type: 'box',    w: 1.0, h: 0.6, d: 3.5 },
    wings:  { type: 'box',    w: 3.0, h: 0.08, d: 1.0, offsetY: -0.1 },
    engine: { type: 'cylinder', radius: 0.18, height: 0.45, count: 4 }, // 4 silniki
    turrets:{ type: 'sphere', radius: 0.15, count: 2 },                  // wieżyczki
    scale:  2.2
  },
  flagship: {
    body:   { type: 'box',    w: 1.4, h: 0.8, d: 5.0 },
    wings:  { type: 'box',    w: 4.0, h: 0.1,  d: 1.4, offsetY: -0.15 },
    engine: { type: 'cylinder', radius: 0.22, height: 0.55, count: 6 },
    turrets:{ type: 'sphere', radius: 0.2,  count: 4 },
    bridge: { type: 'box',    w: 0.6, h: 0.4, d: 0.8, offsetZ: -1.5 }, // mostek
    scale:  3.5
  }
}
```

Wszystkie elementy renderowane jako `WireframeFactory.edges()` w kolorze frakcji/gracza.
Statek gracza: `COLORS.PLAYER`. Wrogowie: kolor ich frakcji.

Silniki: animowane — pulsowanie glow proporcjonalne do prędkości statku.
