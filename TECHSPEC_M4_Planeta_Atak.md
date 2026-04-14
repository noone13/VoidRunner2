# VOID RUNNER — Tech Spec: Moduł 4
## Planeta — Atak

*Dokumentacja PL. Kod EN.*
*Referencja: The Last Starfighter (1984)*

---

## 1. KONTEKST

Gracz atakuje planetę aby przejąć kontrolę nad systemem. Dostępne tylko gdy system ma `hasPlanet: true`. Stacja kosmiczna (jeśli istnieje) musi być zniszczona PRZED atakiem na planetę (obsługiwane w Module 9).

Wejście: `StateManager.transition(STATES.PLANET_ATTACK, { systemId: 'sol', faction: 'hegemony' })`
Wyjście (sukces): system zmienia frakcję → `STATES.GALAXY`
Wyjście (odwrót): system bez zmian, obrona wzmocniona → `STATES.GALAXY`

---

## 2. SCENA: LOT NAD POWIERZCHNIĄ

### 2.1 Teren

- Statek gracza leci nisko nad powierzchnią planety
- Powierzchnia: proceduralna siatka wireframe (`PlaneGeometry` z losową wysokością wierzchołków, seed = systemId)
- Kamera: za statkiem, lekko z góry (third-person, follow camera)
- Ruch: statek leci automatycznie do przodu (stałe przyspieszenie), gracz steruje kierunkiem

### 2.2 Sterowanie

- **A / D** — obrót lewo/prawo (yaw)
- **W / S** — wysokość lotu (pitch, zakres: 2–15 jednostek nad terenem)
- **Spacja** — strzał
- **ESC** — odwrót (trigger retreat sequence)

---

## 3. FAZY ATAKU

Atak podzielony na 4 fazy sekwencyjne. Każda faza musi być ukończona żeby przejść do następnej.

### FAZA 1: Myśliwce

- Spawn: 4–8 myśliwców obronnych (liczba zależna od tier systemu)
- AI identyczna jak dogfight, ale w przestrzeni nad terenem
- Wrogowie pojawiają się z bazy na planecie (animacja startu)
- Ukończenie: wszyscy myśliwcy zniszczeni
- Tier 1: 4 myśliwce / Tier 2: 6 myśliwce / Tier 3: 8 myśliwców

### FAZA 2: Wieże Obronne

- 3–6 wież rozstawionych na terenie (stacjonarne)
- Wieża: geometria wireframe (cylinder + obracająca się głowica)
- Mechanika wieży:
  - Obraca głowicę w stronę gracza
  - Strzela wiązką (`COLORS.ENEMY`) gdy gracz w zasięgu (80 jednostek) i w stożku (±30°)
  - HP: 60 (Tier 1) / 100 (Tier 2) / 150 (Tier 3)
- Gracz musi zniszczyć WSZYSTKIE wieże aby przejść dalej
- Zasięg duży — faza precyzji z dystansu. Wieże nie gonią gracza.

### FAZA 3: Drony i Myśliwce Obronne

- Scramble z bazy naziemnej: mieszanka dronów i myśliwców
  - **Drony** (4–8): małe, szybkie, niskie HP (20), krótki zasięg (20 jednostek), latają w rojach
    - AI: swarm logic — lecą w stronę gracza jako grupa, rozpraszają się przy trafieniu
    - Mesh: mały tetraedr wireframe
  - **Myśliwce obronne** (2–4): jak faza 1 ale agresywniejsze, wyższe HP (60)
    - AI: identyczna jak dogfight (z Modułu 3)
- Faza chaosu z bliska — dużo celów, szybkie, blisko terenu
- Ukończenie: wszystkie drony i myśliwce zniszczone

### FAZA 4: Liniowiec (Boss)

- Losowanie przy starcie misji: 30% szansa na liniowiec (zawsze przy Tier 3)
- Jeśli wylosowany: pojawia się po ukończeniu Fazy 3 (wlatuje z góry atmosfery)
- Liniowiec (`CapitalShip`):
  - Duży mesh wireframe (elongowany kadłub + wieżyczki)
  - HP: 400 (Tier 1) / 600 (Tier 2) / 1000 (Tier 3)
  - 4 wieżyczki obronne na kadłubie (każda ma własne HP: 80)
  - Strategia: najpierw zniszcz wieżyczki, potem kadłub
  - Porusza się powoli nad terenem, strzela we wszystkich kierunkach
  - Spawn dodatkowych myśliwców co 30 sekund (2 sztuki)

---

## 4. WSKAŹNIK POSTĘPU MISJI

HUD: lista faz po lewej stronie:
```
PHASE 1: FIGHTERS     [✓ CLEAR]
PHASE 2: TOWERS       [3/6 REMAINING]
PHASE 3: GARRISON     [LOCKED]
PHASE 4: CAPITAL SHIP [LOCKED / N/A]
```

---

## 5. UKOŃCZENIE ATAKU

**Sukces** (wszystkie fazy ukończone):
- Animacja: planeta zmienia kolor na mapie
- Komunikat: "SYSTEM [NAZWA] CAPTURED"
- Nagroda: kredyty (zależne od tier) + losowy łup z garnizonu
- `FactionState.systems[systemId]` = frakcja gracza lub "player"
- Powrót do GALAXY

**Odwrót** (ESC podczas misji):
- Komunikat: "RETREAT — MISSION FAILED"
- Konsekwencja: obrona systemu wzmocniona o +1 tier na kolejną próbę (max tier 3)
- Powrót do GALAXY bez zmian na mapie

**Zniszczenie gracza**:
- Respawn w ostatnim odwiedzonym porcie (TBD w Module 7)
- System bez zmian

---

## 6. EFEKTY WIZUALNE

- Trafienie wieży/pojazdu: wireframe flash
- Eksplozja: jak dogfight (fragmenty + zanik)
- Liniowiec eksploduje sekwencyjnie: najpierw wieżyczki, potem kadłub (opóźnienie 2s) → wielka eksplozja z większymi fragmentami
- Teren: przy dużych eksplozjach lekkie "trzęsienie" (camera shake, amplituda 0.3, czas 0.5s)

---

## 7. KOLEJNOŚĆ IMPLEMENTACJI

1. Scena PLANET_ATTACK w StateManager
2. Proceduralny teren wireframe (seed = systemId)
3. Statek gracza: ruch nad terenem + kamera follow
4. Faza 1: spawn myśliwców, AI z Module 3, clear condition
5. Faza 2: wieże — spawn, obrót głowicy, strzelanie, kolizja
6. Faza 3: drony i myśliwce obronne — spawn z bazy, swarm AI dronów
7. Phase tracker HUD
8. Faza 4: liniowiec — mesh, wieżyczki, fazy zniszczenia
9. Sukces: zmiana frakcji w FactionState, powrót do GALAXY
10. Odwrót: wzmocnienie obrony, powrót
11. Efekty: eksplozje, camera shake

---

## 8. DEFINICJA "GOTOWE"

- [ ] Teren proceduralny wireframe widoczny, kamera follow działa
- [ ] Gracz steruje statkiem nad terenem
- [ ] Faza 1: myśliwce spawnują i walczą (AI z Module 3)
- [ ] Faza 2: wieże strzelają, można je zniszczyć
- [ ] Faza 3: pojazdy poruszają się i strzelają
- [ ] Faza 4: liniowiec spawuje, ma wieżyczki, wybucha sekwencyjnie
- [ ] Phase tracker HUD aktualizuje się na bieżąco
- [ ] Sukces → FactionState zaktualizowany → system zmienia kolor na mapie
- [ ] Odwrót → system bez zmian, obrona wzmocniona

---

*Tech Spec v1.0 — Void Runner Moduł 4*
