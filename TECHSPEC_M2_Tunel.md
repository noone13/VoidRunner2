# VOID RUNNER — Tech Spec: Moduł 2
## Tunel Hyperspace

*Dokumentacja PL. Kod EN.*
*Referencja wizualna: HyperTube (prototyp)*

---

## 1. KONTEKST

Tunel to scena transportowa — gracz leci z systemu A do B. Mechanicznie prosta, wizualnie charakterystyczna. Port z HyperTube do Three.js z rozszerzeniami.

Wejście do sceny: `StateManager.transition(STATES.TUNNEL, { from: 'sol', to: 'arcturus' })`
Wyjście: po dotarciu do końca → `StateManager.transition(STATES.GALAXY)` lub `STATES.DOGFIGHT` (napaść)

---

## 2. SCENA: TUNEL

### 2.0 Widok kamery

Third-person — kamera umieszczona za statkiem gracza, lekko z góry i z tyłu (offset: z=-3, y=1 względem statku). Statek gracza zawsze widoczny na ekranie.

### 2.1 Geometria tunelu

- Cylinder wireframe (`CylinderGeometry` + `WireframeFactory.wireframe`)
- Promień: 4 jednostki
- Długość: proporcjonalna do odległości euklidesowej między systemami na mapie (min 100, max 400 jednostek)
- Kamera ustawiona wewnątrz cylindra, patrzy do przodu (oś Z)
- Tunel "jedzie" w stronę gracza — ruch symulowany przez przesuwanie geometrii, nie kamery

### 2.2 Proceduralne generowanie tunelu

Tunel podzielony na segmenty (`TunnelSegment`):
- Każdy segment: pierścień (`RingGeometry`, wireframe) + losowe elementy dekoracyjne (kratownice, rury, kable — proste geometrie wireframe)
- Segmenty generowane z wyprzedzeniem (object pool — recykling segmentów które wyjechały za kamerę)
- Seed losowania = `from + to` — ten sam tunel za każdym razem na tej samej trasie

### 2.3 Sterowanie graczem

Statek gracza: mały mesh wireframe (ostrosłup lub uproszczony statek), zawsze widoczny na środku ekranu, lekko z przodu kamery.

Sterowanie:
- **WASD / strzałki** — ruch w płaszczyźnie XY (lewo/prawo/góra/dół)
- **Granica ruchu**: okrąg o promieniu 3.2 jednostki (tuż przy ściance tunelu)
- Ruch z lekką bezwładnością (lerp 0.15)
- **Mysz** — alternatywnie: pozycja myszy mapuje się na pozycję statku (opcjonalne, drugi tryb sterowania)

### 2.4 Obiekty w tunelu

Dwa typy obiektów rozrzuconych proceduralnie:

**Przeszkody** (`Obstacle`):
- Geometrie: sześcian, tetraedr, pierścień — wireframe, kolor `COLORS.WARNING`
- Kolizja z graczem = utrata HP (wartość TBD w Module 7)
- Animacja: wolna rotacja

**Cargo** (`CargoPickup`):
- Geometria: ikosahedron wireframe, kolor `COLORS.UI` z pulsem
- Kolizja z graczem = pickup → dodaje losowy towar do inventory
- Typ towaru: losowany z puli legalnych (tunel nie generuje nielegalnego cargo)
- Efekt pickup: krótki flash + dźwięk

### 2.5 Detekcja kolizji

Uproszczona — sphere-sphere:
- Gracz: sfera radius 0.3
- Przeszkoda: sfera radius 0.5
- Cargo: sfera radius 0.4

**Kolizja ze ścianą tunelu** (gdy pozycja gracza > 3.2 jednostki od osi):
- Pierwsza warstwa: **Shields** — absorbują damage (HP: Shields Mk0=0, Mk1=30, Mk2=60, Mk3=100)
- Gdy Shields = 0: **Hull** damage (−10 HP per kolizja)
- Gdy Hull = 0: zniszczenie statku → RESPAWN
- Efekt wizualny: czerwony flash na krawędzi ekranu, dźwięk uderzenia
- Gracz "odbija się" od ściany (velocity.xy *= -0.5)

### 2.6 Pasek postępu

HUD element (HTML overlay):
- Linia postępu na górze ekranu: `[===========>    ] 65%`
- Lewy koniec: nazwa systemu `from`
- Prawy koniec: nazwa systemu `to`
- Monospace font, kolor `COLORS.UI`

### 2.7 Zdarzenia losowe

Sprawdzane co ~20% długości tunelu (czyli max 5 eventów na lot):

| Zdarzenie | Prawdopodobieństwo | Efekt |
|---|---|---|
| Napaść piratów | 20% (wyższe bez transponders) | Koniec tunelu → scena DOGFIGHT |
| Anomalia — bonus | 10% | Komunikat + losowy bonus (kredyty, cargo) |
| Anomalia — kara | 8% | Komunikat + uszkodzenie statku |
| Sygnał wzywania pomocy | 7% | Decyzja gracza: ignoruj / pomóż (placeholder w tym module) |
| Nic | reszta | Spokojny lot |

Napaść piratów:
- Fade out tunelu
- Payload do DOGFIGHT: `{ enemies: 'pirates', count: random(2,5), location: 'tunnel_exit' }`

### 2.7b Transponder UI

**Toggle w HUD mapy galaktyki** (zawsze widoczny):
```
[TRANSPONDER: ON ]  ← kliknij aby wyłączyć
[TRANSPONDER: OFF]  ← kliknij aby włączyć (kolor WARNING)
```
- Status zapisany w `GameState.transponderActive` (bool)
- Gdy OFF: ikona na mapie przy statku gracza zmienia kolor na `COLORS.WARNING`

**Potwierdzenie przy starcie tunelu** (tylko gdy transponder OFF):
```
⚠ BLACK ROUTE ACTIVE
Pirate activity increased. No Hegemony checkpoints.
Route will take 30% longer.

[ CONFIRM ]  [ CANCEL ]
```

---

### 2.8 Tryb czarnej trasy

Aktywowany gdy gracz wyłączył transponder przed lotem (flaga w GameState).

Różnice:
- Tunel ma inny kolor: `COLORS.NEUTRAL` zamiast kolorów frakcji
- Brak checkpointu Hegemony
- Prawdopodobieństwo napaści piratów +15%
- Trasa dłuższa o 30% (objazd przez niczyje systemy)

### 2.9 Checkpoint Hegemony

Pojawia się gdy:
- Trasa przechodzi przez system Hegemony
- Gracz ma nielegalny cargo

Checkpoint = specjalny segment tunelu z innym kolorem (`COLORS.EMPIRE` → `COLORS.HEGEMONY`):
- Komunikat: "HEGEMONY INSPECTION — STAND BY"
- Losowanie: reputacja Syndicateu ≥ 50 → cynk = pominięcie
- Wykrycie nielegalnego cargo → mandat (utrata kredytów) lub konfiskata
- W tym module: uproszczone — losowanie 50/50 z modyfikatorem reputacji (placeholder)

---

## 2.99 GAMESTATE — UWAGA

GameState jest zdefiniowany kanonicznie w `TECHSPEC_M5_Planeta_Ladowanie.md` sekcja 8.
W M2 inicjalizuj tylko szkielet potrzebny do tunelu — pełny GameState dodajesz w M5.
Szkielet M2:
```javascript
// Tymczasowy, rozszerzany w M5
const GameState = {
  credits: 1500,
  currentSystem: 'crossroads',
  lastPort: 'crossroads',
  transponderActive: true,
  ship: { class: 'courier', hp: 100, maxHp: 100, shields: 0, maxShields: 0,
          modules: { engines: 1, weapons: 1, cargoHold: 1, shields: 0, ecm: 0 } },
  cargo: [],
  cargoCapacity: 10,
}
```

## 3. HUD TUNELU

Elementy HTML overlay:
```
[SYSTEM: SOL → ARCTURUS]     [CREDITS: 1,250]
[HP: ████████░░]              [CARGO: 3/10]
[=================================================>    ]
```

---

## 3b. PERSYSTENCJA — LOCALSTORAGE (TYMCZASOWE)

Dodaj prosty localStorage save/load gdy GameState jest gotowy (koniec M2).
Pełny Tauri save w M9 — localStorage jako pomost do testowania.

```javascript
// Zapis
localStorage.setItem('voidrunner_save', JSON.stringify(GameState))

// Load przy starcie
const saved = localStorage.getItem('voidrunner_save')
if (saved) Object.assign(GameState, JSON.parse(saved))
```

Zastąpione przez Tauri API w M9. Do tego czasu localStorage wystarczy.

## 4. KOLEJNOŚĆ IMPLEMENTACJI

1. Scena TUNNEL w StateManager
2. Geometria cylindra wireframe + kamera wewnątrz
3. Object pool segmentów (generowanie + recykling)
4. Statek gracza + sterowanie WASD + bezwładność
5. Przeszkody: spawn, ruch, kolizja
6. Cargo: spawn, pickup, dodanie do inventory (GameState)
7. Pasek postępu HUD
8. System zdarzeń losowych (5 checkpointów)
9. Napaść piratów → przejście do DOGFIGHT (log w konsoli w tym module)
10. Checkpoint Hegemony (uproszczony)
11. Czarna trasa (flaga + modyfikatory)

---

## 5. DEFINICJA "GOTOWE"

- [ ] Tunel renderuje się jako cylinder wireframe
- [ ] Gracz steruje statkiem WASD, ruch z bezwładnością
- [ ] Przeszkody i cargo generują się proceduralnie
- [ ] Kolizja z przeszkodą → log "damage"
- [ ] Kolizja z cargo → log "pickup: [typ towaru]"
- [ ] Pasek postępu działa
- [ ] Dotarcie do końca → powrót do GALAXY
- [ ] Losowa napaść piratów → log "pirate ambush → DOGFIGHT"
- [ ] Ten sam seed = taki sam układ obiektów

---

*Tech Spec v1.0 — Void Runner Moduł 2*
