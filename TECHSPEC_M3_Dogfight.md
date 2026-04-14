# VOID RUNNER — Tech Spec: Moduł 3
## Dogfight — Walka w Przestrzeni Otwartej

*Dokumentacja PL. Kod EN.*
*Referencja AI: X-Wing (LucasArts, 1993)*

---

## 1. KONTEKST

### Widok kamery
- **Tunel:** third-person — kamera za statkiem gracza, statek widoczny
- **Dogfight:** FPP (first person) — uproszczony cockpit wireframe, HUD w polu widzenia

Cockpit FPP:
- Ramka kokpitu: prosty wireframe (dwa boczne słupki + górna belka + deska rozdzielcza)
- Brak tekstur — czysta geometria krawędziowa w kolorze `COLORS.UI`
- HUD elementy renderowane jako część sceny 3D (nie HTML overlay) — prędkościomierz, celownik, HP, radar

Radar (FPP):
- Mały okrąg w prawym dolnym rogu kokpitu
- Kropki wrogów: `COLORS.ENEMY`, sojusznicy: `COLORS.PLAYER`
- Zasięg radaru: 150 jednostek (1.5 parseka)

Dogfight aktywuje się gdy:
- Gracz zostaje zaatakowany w tunelu (napaść piratów)
- Gracz atakuje jednostkę w systemie
- Gracz wpadnie w zasadzkę przy wejściu do systemu

Wejście: `StateManager.transition(STATES.DOGFIGHT, { enemies, count, faction, location })`
Wyjście:
- Wszyscy wrogowie zniszczeni → `STATES.GALAXY` (lub kontynuacja misji)
- Gracz ucieka → `STATES.GALAXY`
- Gracz zniszczony → `STATES.RESPAWN`:
  - Respawn w ostatnim odwiedzonym porcie (planeta lub stacja)
  - Statek zachowany, naprawiony do 100% HP
  - Cargo utracone (całkowita utrata ładowni)
  - Kredyty: -30% aktualnego stanu (minimum 100cr — nigdy bankrut)
  - Komunikat: "SHIP DESTROYED — RESCUED BY [nazwa portu]"
  - `STATES.RESPAWN` → fade in → `STATES.PLANET_LAND` lub `STATES.GALAXY` (zależnie od ostatniego portu)

---

## 2. PRZESTRZEŃ WALKI

- Otwarta przestrzeń 3D, brak granic wizualnych
- "Bańka walki" = sfera logiczna o promieniu 1 parseka (100 jednostek) od centrum starcia
- Wrogowie nie wychodzą poza bańkę (zawracają). UI wyświetla dystans w parsekach.
- Gracz może wyjść — po przekroczeniu 1 parseka (100 jednostek) od najbliższego wroga → komunikat "YOU CAN ESCAPE"

Tło: gwiazdy jako punkty (`Points` geometry, losowy rozkład na sferze), statyczne.

---

## 3. FIZYKA RUCHU

**Arcade newtonian** — nie symulator, nie pełna fizyka. Bliżej X-Wing niż Elite.

Parametry statku gracza (bazowe, modyfikowane upgradami):
```javascript
const playerShip = {
  maxSpeed: 12,
  acceleration: 8,
  rotationSpeed: 2.5,  // rad/s
  drag: 0.92           // mnożnik prędkości per klatka — ZAWSZE stosować jako: velocity *= Math.pow(0.92, delta * 60)  // delta w sekundach
}
```

Sterowanie:
- **W / strzałka góra** — przyspieszenie do przodu
- **S / strzałka dół** — hamowanie / cofanie (max 30% maxSpeed)
- **A / D** — obrót lewo/prawo (yaw)
- **Q / E** — obrót góra/dół (pitch)
- **Shift** — afterburner (×1.8 prędkości, ograniczony czas)
- **Spacja** — strzał główny
- **Tab** — lock na najbliższego wroga (targeting reticle)

Mysz (opcjonalnie, drugi tryb):
- Ruch myszy = pitch + yaw
- LPM = strzał

---

## 4. UZBROJENIE GRACZA

**Lasery (domyślne)**:
- Projectile: szybki (`Line` w Three.js, długość 2 jednostki), kolor `COLORS.PLAYER`
- Cooldown: 0.25s
- Zasięg: 80 jednostek
- Damage: 25 HP

**Rakiety (jeśli zainstalowane)**:
- Homing: lerp w stronę locked target
- Cooldown: 3s, ograniczona liczba
- Damage: 80 HP

---

## 5. AI WROGÓW — X-WING STYLE

Każdy wróg to `EnemyShip` z maszyną stanów:

### 5.1 Stany AI

```
PURSUE → ATTACK → EVADE → SUPPORT → RETREAT
```

**PURSUE** (domyślny):
- Leć w stronę gracza z prędkością 0.7–0.9 maxSpeed
- Jeśli dystans < 30 → przejdź do ATTACK

**ATTACK**:
- Utrzymuj dystans 15–25 jednostek od gracza
- Strzelaj gdy gracz jest w stożku celowania (±15°)
- Jeśli HP < 30% → EVADE
- Jeśli wingman potrzebuje pomocy → SUPPORT
    - Warunek "potrzebuje pomocy": wingman HP < 50% LUB dystans gracza do wingmana < 30 jednostek (0.3 parseka)

**EVADE**:
- Losowy wektor ucieczki prostopadły do kierunku gracza
- Czas: 2–4 sekundy
- Po czasie: PURSUE

**SUPPORT**:
- Leć w stronę wingmana pod ostrzałem
- Strzelaj w gracza jeśli w zasięgu
- Jeśli wingman zniszczony → PURSUE

**RETREAT** (tylko piraci przy HP < 20% lub strata >50% skrzydła):
- Leć od gracza z max prędkością
- Po wyjściu z bańki → despawn

### 5.2 Wing Logic

Wrogowie spawnują w skrzydłach (wings):
- Wing 2: leader + 1 wingman
- Wing 3: leader + 2 wingmen
- Wing 4: 2 pary (każda para działa niezależnie)

Leader podejmuje decyzje taktyczne, wingmani kopiują z opóźnieniem (0.5–1.5s) i losowym offsetem pozycji.

### 5.3 Różnice per frakcja

| Frakcja | Styl | Agresja | Odwrót |
|---|---|---|---|
| Pirates | Chaotyczny, hit-and-run | Wysoka | Tak (>50% strat) |
| Hegemony | Zdyscyplinowany, formacje | Średnia | Rzadko |
| Coalition | Desperacki, kamikaze tendencje | Bardzo wysoka | Nigdy |
| Syndicate | Taktyczny, unika bezpośredniego starcia | Niska | Tak (>30% HP) |

### 5.4 Targeting i celowanie wrogów

Wrogowie nie strzelają idealnie — spread stożka celowania zależny od dystansu:
- Dystans < 15: ±8° (celne)
- Dystans 15–40: ±15° (średnie)
- Dystans > 40: ±25° (słabe)

---

## 6. TARGETING SYSTEM GRACZA

Po wciśnięciu Tab:
- Lock na najbliższego wroga
- Na ekranie: reticle wireframe wokół locked target (`COLORS.WARNING`)
- Dystans do celu wyświetlony w HUD
- Rakiety lecą do locked target
- Można cyklować Tab przez kolejnych wrogów

---

## 7. MECHANIKA UCIECZKI

- Gdy dystans gracza od najbliższego wroga > 100 jednostek:
  - HUD: "[ ESCAPE VECTOR CLEAR ]" migający przez 3 sekundy
  - Przycisk **H** lub przycisk HUD: potwierdź ucieczkę
  - Fade out → `STATES.GALAXY`
  - Konsekwencja: misja (jeśli była) nieukończona, cargo zachowane

---

## 8. HUD DOGFIGHT

HTML overlay:
```
[ENEMIES: 4]    [SPEED: ████░░]    [AFTERBURNER: ██████████]
[HP:  ████████░░░]                 [SHIELDS: ████░░░░░░]
[TARGET: PIRATE RAIDER | DST: 34u | HP: ██████░░]

                    [+] reticle na środku ekranu

[ ESCAPE VECTOR CLEAR — PRESS H TO FLEE ]  ← gdy dostępne
```

---

## 9. EFEKTY WIZUALNE

- **Trafienie wroga**: czerwony flash na jego meshu (kolor `COLORS.ENEMY` na 0.1s)
- **Trafienie gracza**: biały flash na krawędzi ekranu (CSS vignette)
- **Eksplozja**: rozlatujące się krawędziowe trójkąty (`EdgesGeometry` fragmenty) + zanik opacity
- **Ślady silników**: krótka linia za statkiem (`THREE.Line`, zanik w czasie)
- **Strzały**: cienkie linie (`THREE.Line`), żyją 0.5s lub do trafienia

---

## 10. KOLEJNOŚĆ IMPLEMENTACJI

1. Scena DOGFIGHT w StateManager, przestrzeń z gwiazdami
2. Statek gracza: mesh + ruch + sterowanie klawiaturą
3. Strzelanie gracza: spawn projektylów, kolizja z wrogiem
4. Spawn wrogów z payload (liczba, frakcja)
5. AI Tier 1: PURSUE + ATTACK (prosty chase)
6. AI Tier 2: stany EVADE + RETREAT
7. AI Tier 3: wing logic (leader + wingmani)
8. Targeting system (Tab lock + reticle)
9. Mechanika ucieczki (bańka + komunikat + wyjście)
10. Eksplozje i efekty
11. HUD kompletny
12. Różnice AI per frakcja

---

## 11. DEFINICJA "GOTOWE"

- [ ] Gracz lata i strzela w przestrzeni 3D
- [ ] Wrogowie spawnują w skrzydłach (2–4 statki)
- [ ] AI: pursue, attack, evade, support, retreat działają
- [ ] Wing logic: wingmani reagują na lidera z opóźnieniem
- [ ] Pirates uciekają przy >50% stratach
- [ ] Targeting Tab działa, reticle widoczny
- [ ] Eksplozja wireframe przy zniszczeniu
- [ ] Mechanika ucieczki: komunikat + potwierdzenie + wyjście
- [ ] HUD: HP, wrogowie, prędkość, target

---

*Tech Spec v1.0 — Void Runner Moduł 3*
