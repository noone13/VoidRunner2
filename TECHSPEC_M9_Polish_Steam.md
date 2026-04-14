# VOID RUNNER — Tech Spec: Moduł 9
## Polish, Audio i Steam Deploy

*Dokumentacja PL. Kod EN.*

---

## 1. KONTEKST

Ostatni moduł — szlif wizualny, audio, optymalizacja i build na Steam. Gra jest już grywalna — tu staje się produktem.

---

## 2. SHADERS I EFEKTY WIZUALNE

### 2.1 Glow na wireframe

Additive blending na wszystkich wireframe meshach:
```javascript
material = new THREE.LineBasicMaterial({
  color: COLORS.X,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false
})
```

Intensywność glow zależna od "ważności" obiektu:
- Gracz/sojusznik: pełny glow
- Wrogowie: słabszy
- Teren/budynki: minimalny

### 2.2 Scanline effect (UI)

CSS overlay na wszystkich panelach HTML:
```css
.ui-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.08) 2px,
    rgba(0,0,0,0.08) 4px
  );
  pointer-events: none;
}
```

### 2.3 Bloom (opcjonalnie)

Three.js `UnrealBloomPass` (EffectComposer):
- Threshold: 0.8 (tylko najjaśniejsze elementy)
- Strength: 0.4
- Radius: 0.3
- Można wyłączyć w ustawieniach (performance)

### 2.4 Camera shake

Przy eksplozjach i trafieniach:
```javascript
function cameraShake(intensity, duration) {
  // additive offset do pozycji kamery, lerp do 0
}
```

---

## 3. AUDIO

### 3.1 Stack

`Tone.js` — synteza audio w przeglądarce / Electron. Brak plików audio — generowane proceduralnie. Waga: 0.

### 3.2 Muzyka — Synthwave procedural

Dwie warstwy:
- **Pad**: powolne akordy (Tone.PolySynth, filtr lowpass, reverb)
- **Arpeggio**: szybka sekwencja (Tone.Synth, delay)

Warianty per scena:
- Galaxy map: spokojny, długie akordy
- Tunnel: szybszy BPM, narastające arpeggio
- Dogfight: perkusja (Tone.MembraneSynth), wysoki BPM, tense
- Planet landing: ambient, brak perkusji

Płynne przejścia między wariantami (crossfade 2s).

### 3.3 SFX

Wszystkie generowane Tone.js:

| Dźwięk | Synteza |
|---|---|
| Strzał laserowy | Tone.Synth, szybki attack, krótki decay, wysoka częstotliwość |
| Trafienie | Noise burst, filtr bandpass |
| Eksplozja | Tone.MembraneSynth + noise, długi decay |
| Pickup cargo | Krótki arpeggio w górę (2 nuty) |
| UI click | Krótki click, 800Hz |
| Warp / tunel start | Narastający sweep (800Hz → 4000Hz, 1s) |
| Alert / damage gracza | Pulsujący ton 440Hz |
| Mission complete | Krótki fanfar (3 nuty) |

### 3.4 Ustawienia audio

```
MASTER VOLUME: [████████░░]  80%
MUSIC:         [██████░░░░]  60%
SFX:           [████████░░]  80%
[MUTE ALL]
```

---

## 4. SAVE / LOAD
*(Pełna specyfikacja w sekcji 4b poniżej)*

`GameState` zapisywany do pliku JSON przez Tauri API.

```javascript
// Zapis
await invoke('save_game', { data: JSON.stringify(GameState) })

// Load
const saved = await invoke('load_game')
if (saved) GameState = JSON.parse(saved)
```

Lokalizacja pliku: `%APPDATA%/void-runner/save.json` (Windows) / `~/Library/Application Support/void-runner/save.json` (macOS).

Autosave: przy każdym lądowaniu na planecie/stacji.
Manual save: klawisz F5.
Load: menu główne.

---


---

## 5b. CENTRALNY INPUT MAP

Jeden plik `src/core/InputMap.js` — jedyne źródło prawdy dla wszystkich klawiszy. Każda scena czyta stąd, nigdy nie hardcoduje klawiszy bezpośrednio.

```javascript
const InputMap = {
  // GLOBALNE (wszystkie sceny)
  pause:        'Escape',
  map:          'Tab',        // otwiera mapę galaktyki
  missions:     'M',          // tracker misji
  reputation:   'R',          // panel reputacji
  save:         'F5',

  // MAPA GALAKTYKI
  galaxy_zoom_in:  'Equal',   // =
  galaxy_zoom_out: 'Minus',   // -

  // TUNEL
  tunnel_up:    'ArrowUp',
  tunnel_down:  'ArrowDown',
  tunnel_left:  'ArrowLeft',
  tunnel_right: 'ArrowRight',
  tunnel_up2:   'KeyW',
  tunnel_down2: 'KeyS',
  tunnel_left2: 'KeyA',
  tunnel_right2:'KeyD',
  transponder:  'KeyT',       // toggle transponder

  // DOGFIGHT
  thrust:       'KeyW',
  brake:        'KeyS',
  yaw_left:     'KeyA',
  yaw_right:    'KeyD',
  pitch_up:     'KeyQ',
  pitch_down:   'KeyE',
  afterburner:  'ShiftLeft',
  fire:         'Space',
  target_next:  'Tab',
  escape_flee:  'KeyH',

  // PLANET ATTACK
  attack_left:  'KeyA',
  attack_right: 'KeyD',
  attack_up:    'KeyW',
  attack_down:  'KeyS',
  attack_fire:  'Space',
  attack_retreat:'Escape',
}
```

**Remapping klawiszy (v1.0 — uproszczony):**
- Brak pełnego remappera w UI w MVP
- Gracz może edytować `keybinds.json` (generowany przy pierwszym uruchomieniu obok save.json)
- Format identyczny jak InputMap — CC nadpisuje defaults wartościami z pliku
- Pełny UI remapper: post-MVP

---

## 4b. SAVE — PEŁNA SPECYFIKACJA

**Jeden slot save** w MVP. Plik: `save.json`.

Pełna zawartość pliku save:

```javascript
{
  "version": "0.1.0",           // wersja gry przy zapisie (do migracji)
  "timestamp": 1234567890,      // Unix timestamp
  "playtime": 3600,             // sekundy łącznego czasu gry

  "gameState": {
    "credits": 1500,
    "currentSystem": "crossroads",
    "transponderActive": true,
    "ship": { "class": "courier", "hp": 100, "maxHp": 100, "modules": {} },
    "cargo": [],
    "cargoCapacity": 10,
    "reputation": { "hegemony": 0, "coalition": 0, "syndicate": 0, "pirates": 0 },
    "activeMissions": [],
    "completedMissions": [],
    "lastPort": "crossroads"
  },

  "factionState": {
    "systems": {},              // { systemId: factionId } — stan terytoriów
    "stations": {},             // { systemId: { tier, hasStation } }
    "influence": {}
  },

  "exploredSystems": [],        // lista odblokowanych systemów
  "galaxyTick": 0              // ile ticków minęło
}
```

**Obsługa błędów:**
- Zepsuty save (JSON parse error) → komunikat "SAVE FILE CORRUPTED" + opcja "START NEW GAME"
- Save z inną wersją gry → próba migracji, jeśli niemożliwa → komunikat ostrzeżenia
- Brak miejsca na dysku → silent fail z komunikatem w UI (nie crash)

**Autosave:** przy każdym lądowaniu na planecie/stacji. Mały wskaźnik w rogu: `[SAVING...]` przez 1s.

---

## 5c. SETTINGS — ROZSZERZONE

Pełny panel ustawień:

```
╔══ SETTINGS ══════════════════════════════════╗
║ DISPLAY                                      ║
║   Fullscreen:      [ON]  [OFF]               ║
║   Resolution:      [1920x1080 ▼]             ║
║   FPS Limit:       [60]  [120]  [Unlimited]  ║
║   Bloom Effect:    [ON]  [OFF]               ║
║   Starfield:       [ON]  [OFF]               ║
║                                              ║
║ AUDIO                                        ║
║   Master Volume:   [████████░░]  80%         ║
║   Music:           [██████░░░░]  60%         ║
║   SFX:             [████████░░]  80%         ║
║   Mute All:        [ON]  [OFF]               ║
║                                              ║
║ CONTROLS                                     ║
║   Mouse Aim:       [ON]  [OFF]               ║
║   Invert Y:        [ON]  [OFF]               ║
║   [EDIT KEYBINDS → keybinds.json]            ║
║                                              ║
║ GAME                                         ║
║   Autosave:        [ON]  [OFF]               ║
║   HUD Opacity:     [████████░░]  80%         ║
║                                              ║
║              [APPLY]  [CANCEL]               ║
╚══════════════════════════════════════════════╝
```

Fullscreen: `document.documentElement.requestFullscreen()` (Tauri obsługuje).
Resolution: lista dostępnych rozdzielczości z `window.screen` + resize canvas/renderer.
Settings zapisywane do osobnego pliku `settings.json` (nie w save.json).

---

## 3b. AUDIO — MUZYKA LOOP I SEGMENTY

**Długość segmentów muzycznych:**

| Scena | BPM | Długość segmentu | Loop |
|---|---|---|---|
| Galaxy Map | 75 | 32 takty (~25s) | tak, seamless |
| Tunnel | 110 | 16 takty (~8s) | tak, seamless |
| Dogfight | 140 | 8 taktów (~3.5s) | tak, seamless |
| Planet Landing | 60 | 64 takty (~64s) | tak, seamless |

**Seamless loop:** Tone.js Transport — każdy segment schedulowany jako pattern, nie jako jednorazowy dźwięk. Brak "kliknięcia" przy przejściu.

**Crossfade między scenami:**
```javascript
// Stary track: fade out 2s
// Nowy track: fade in 2s, startuje po 1s (overlap)
```

**Dynamiczna intensywność w dogfight:**
- Liczba wrogów > 3 → dodaj warstwę perkusji (+MembraneSynth)
- HP gracza < 30% → podnieś BPM o 10, dodaj warstwę napięcia
- Ostatni wróg → drop do cichszej wersji (victory stinger)


## 5. USTAWIENIA GRY

Panel dostępny z menu głównego i z mapy (klawisz Esc):

```
╔══ SETTINGS ══════════════════════════════╗
║ GRAPHICS                                 ║
║   Bloom Effect:    [ON]  [OFF]           ║
║   Starfield:       [ON]  [OFF]           ║
║                                          ║
║ AUDIO                                    ║
║   Master Volume:   [████████░░]          ║
║   Music:           [██████░░░░]          ║
║   SFX:             [████████░░]          ║
║                                          ║
║ CONTROLS                                 ║
║   Mouse Aim:       [ON]  [OFF]           ║
║   Invert Y:        [ON]  [OFF]           ║
║                                          ║
║              [SAVE]  [CANCEL]            ║
╚══════════════════════════════════════════╝
```

---

## 6. TAURI — BUILD PIPELINE

### 6.1 Konfiguracja src-tauri/tauri.conf.json

```json
{
  "productName": "VOID RUNNER",
  "version": "0.1.0",
  "bundle": {
    "identifier": "com.voidrunner.game",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"],
    "windows": { "wix": {} }
  },
  "build": {
    "distDir": "../dist",
    "devPath": "http://localhost:5173"
  }
}
```

### 6.2 Build commands

```bash
# Dev
npm run tauri dev

# Build Windows
npm run tauri build

# Build macOS
npm run tauri build --target universal-apple-darwin
```

Output: `src-tauri/target/release/bundle/`
- Windows: `.msi` + `.exe`
- macOS: `.dmg` + `.app`

### 6.3 Ikona

SVG wireframe — statek koszmiczny, styl lineartu. Render do PNG w wymaganych rozdzielczościach (32, 128, 256, 512).

---

## 7. STEAM DEPLOY

### 7.1 Wymagania

- Konto Steam Partner + Steam Direct ($100 fee)
- App ID z Steamworks
- Steamworks SDK (opcjonalne w MVP — osiągnięcia i overlay można dodać post-launch)

### 7.2 Steamworks integracja (post-MVP opcja)

Jeśli zdecydujemy się przed launchem:
- `greenworks` lub `steamworks.js` (Node.js binding do Steamworks SDK)
- Osiągnięcia: 10 podstawowych (pierwsze przejęcie planety, pierwsze 10k kredytów, etc.)
- Steam Overlay: F12 (domyślne Tauri działa z overlay)

### 7.3 Upload

```bash
# Steamworks CLI
steamcmd +login [user] +run_app_build [app_build.vdf]
```

`app_build.vdf` definiuje depot (pliki do uploadu) i branch (default/beta).

---

## 8. OPTYMALIZACJA

- **Object pooling**: projektyle, eksplozje, segmenty tunelu (już w Module 2)
- **LOD**: systemy na mapie daleko od kamery = prostsze meshe
- **Frustum culling**: Three.js domyślnie — upewnić się że jest włączone
- **Limit FPS**: opcja 60/120/unlimited w ustawieniach
- **Garbage collection**: unikać alokacji w game loop (pre-alloc wektorów)

Uwaga: drag i wszystkie mnożniki per-klatka muszą być delta-time dependent: `value *= Math.pow(multiplier, delta * 60)`. Target: 60 FPS na GTX 1060 / RX 580. Dogfight z 10 jednostkami < 8ms frame time.

---

## 9. KOLEJNOŚĆ IMPLEMENTACJI

1. Glow / additive blending na wszystkich istniejących meshach
2. Scanline CSS na panelach UI
3. Tone.js setup + muzyka proceduralna (4 warianty)
4. SFX: strzał, trafienie, eksplozja, pickup, UI
5. Bloom pass (EffectComposer) + toggle w settings
6. Camera shake utility
7. Save/load przez Tauri API
8. Panel ustawień (audio + grafika + sterowanie)
9. Tauri config + ikona
10. Build Windows → test .exe
11. Build macOS → test .app
12. Playtesting: balans cen, reputacji, trudności walki
13. Steam upload (gdy gotowe)

---

## 10. DEFINICJA "GOTOWE"

- [ ] Glow additive blending na wszystkich wireframe meshach
- [ ] Scanline effect na wszystkich panelach UI
- [ ] Muzyka proceduralna w 4 wariantach, crossfade między scenami
- [ ] SFX: strzał, eksplozja, pickup, UI, warp działają
- [ ] Bloom toggle w ustawieniach
- [ ] Save/load działa (autosave + F5 + wczytanie z menu)
- [ ] Panel ustawień działa
- [ ] `npm run tauri build` produkuje działający .exe (Windows)
- [ ] Gra odpala się bez konsoli deweloperskiej
- [ ] 60 FPS w dogfight z 8 jednostkami

---

*Tech Spec v1.0 — Void Runner Moduł 9 (Polish + Steam)*
*Koniec dokumentacji projektowej v1.0*
