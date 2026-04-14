# VOID RUNNER — Tech Spec: Moduł 8
## Stacje Kosmiczne

*Dokumentacja PL. Kod EN.*

---

## 1. KONTEKST

Stacje kosmiczne to fortyfikacje frakcji. Blokują dostęp do planety — najpierw stacja, potem planeta. Trzy tiery. Systemy core startują z Tier 3.

---

## 2. STACJA NA MAPIE GALAKTYKI

Systemy z `hasStation: true` mają wizualny element orbitalny (już z Modułu 1 — mały sześcian wireframe).

Po tym module: element orbitalny zróżnicowany per tier:
- **Tier 1**: mały sześcian wireframe, powolna rotacja
- **Tier 2**: sześcian + 4 anteny, szybsza rotacja
- **Tier 3**: złożona struktura (sześcian + pierścień orbitalny + anteny), kolor intensywniejszy

---

## 3. BUDOWANIE STACJI

Frakcja buduje stację gdy:
- Kontroluje system przez ≥ 3 ticki galaktyki bez ataku
- Tier rośnie co kolejne 3 ticki (Tier 1 → 2 → 3)
- Stacja zniszczona przez gracza: wraca do Tier 0 (brak stacji), frakcja może odbudować

Gracz widzi postęp budowania na mapie (animacja pulsowania mesh w trakcie budowy).

---

## 4. MECHANIKA BLOKADY

Gdy system ma stację: przycisk "Attack Planet" w InfoPanel zastąpiony przez "Station blocking — destroy it first".

Kolejność:
1. Gracz atakuje stację → scena STATION_ATTACK
2. Stacja zniszczona → `hasStation: false` w FactionState
3. Gracz może atakować planetę (Moduł 4)

---

## 5. SCENA: ATAK NA STACJĘ

Uproszczony dogfight w pobliżu stacji. Nie ma terenu — otwarta przestrzeń z dużą stacją jako centralnym obiektem.

### 5.1 Stacja jako cel

Stacja `CapitalStation`:
- Tier 1: HP 300, 2 wieżyczki
- Tier 2: HP 600, 4 wieżyczki + 4 myśliwce eskorty
- Tier 3: HP 1200, 6 wieżyczek + 8 myśliwców + tarcza (absorbuje 50% damage do czasu zniszczenia generatora)

Wieżyczki stacji:
- Obracają się w stronę gracza
- Strzelają co 1.5s wiązką (`COLORS.ENEMY`)
- HP per wieżyczka: 60 (T1) / 80 (T2) / 120 (T3)
- Zniszczenie wieżyczek = stacja strzela wolniej

Generator tarczy (tylko Tier 3):
- Osobny cel na kadłubie stacji, chroniony przez 2 dedykowane wieżyczki ochronne (HP: 80 każda)
- Generator HP: 400
- Kolejność: najpierw zniszcz 2 wieżyczki ochronne → dopiero wtedy generator jest w zasięgu
- Zniszczenie generatora = tarcza opada, stacja bierze pełny damage

### 5.2 Wsparcie obrońcy

Co 45 sekund: spawn wave myśliwców obronnych (liczba = tier × 2).
Jeśli gracz ma ≥ +30 reputacji u atakowanej frakcji → brak wsparcia (frakcja nie chce strzelać do sojusznika... ale stacja tak).

### 5.3 Zakończenie

Sukces: stacja zniszczona → wielka eksplozja sekwencyjna → `FactionState.hasStation[systemId] = false` → powrót do GALAXY.

Odwrót: ESC → powrót do GALAXY, stacja niezniszczona.

---

## 6. LĄDOWANIE NA STACJI

Jeśli gracz ma odpowiednią reputację (+20 lub wyżej u właściciela), może lądować na stacji jak na planecie.

Menu lądowania stacji (uproszczone — brak Admin i Black Market domyślnie):
- **Trading Post** — jak planeta, ale lepszy asortyment technologiczny
- **Shipyard** — pełny dostęp do upgradów (stacje mają lepszy stock niż planety Tier 1-2)
- **Depart**

Stacje Syndicateu: mają Black Market zawsze (jeśli reputacja Syndicateu ≥ 40).

---

## 7. KOLEJNOŚĆ IMPLEMENTACJI

1. Zróżnicowane meshe stacji per tier (update Modułu 1)
2. Logika budowania stacji w GalaxyTick (Moduł 6)
3. Blokada InfoPanel "Attack Planet" gdy stacja istnieje
4. Scena STATION_ATTACK w StateManager
5. Stacja jako cel: HP, wieżyczki, AI myśliwców (z Modułu 3)
6. Generator tarczy (Tier 3)
7. Wsparcie obrońcy (wave spawnów)
8. Zniszczenie stacji → update FactionState → powrót
9. Lądowanie na stacji (warunkowe menu)

---

## 8. DEFINICJA "GOTOWE"

- [ ] Stacje na mapie mają zróżnicowane meshe (3 tiery)
- [ ] InfoPanel blokuje "Attack Planet" jeśli stacja istnieje
- [ ] Scena STATION_ATTACK: stacja renderuje się, ma HP i wieżyczki
- [ ] Myśliwce obrońcy spawnują co 45s
- [ ] Tier 3: generator tarczy działa
- [ ] Zniszczenie stacji → `hasStation: false` → planeta odblokowana
- [ ] Lądowanie na stacji dostępne przy reputacji ≥ +20

---

*Tech Spec v1.0 — Void Runner Moduł 8*
