# VOID RUNNER — Tech Spec: Moduł 5
## Planeta — Lądowanie i Handel

*Dokumentacja PL. Kod EN.*
*Referencja: Pirates! (Sid Meier, 1987/2004)*

---

## 1. KONTEKST

Gracz ląduje na planecie pokojowo. Dostępne gdy system ma `hasPlanet: true` i gracz nie jest wrogi wobec frakcji kontrolującej system (lub jest neutralny).

Lądowanie = menu wyboru lokacji. Brak chodzenia, brak widoku 3D — czysty interfejs, wireframe estetyka.

Wejście: `StateManager.transition(STATES.PLANET_LAND, { systemId })`
Wyjście: gracz wybiera "Depart" → `STATES.GALAXY`

---

## 2. EKRAN LĄDOWANIA — GŁÓWNE MENU

Fullscreen overlay (HTML). Styl: wireframe/terminal. Tło: animowana siatka planety (CSS lub canvas).

Layout:
```
╔══════════════════════════════════════════════╗
║  [NAZWA PLANETY]          [FRAKCJA] [TIER]   ║
║  [DESCRIPTION]                               ║
╠══════════════════════════════════════════════╣
║                                              ║
║   [🏪] TRADING POST         [⚙] SHIPYARD    ║
║                                              ║
║   [🍺] TAVERN               [🏛] ADMIN       ║
║                                              ║
║   [💀] BLACK MARKET *       [🚀] DEPART      ║
║        *if syndicate rep ≥ 40                ║
╚══════════════════════════════════════════════╝

[CREDITS: 1,250]  [CARGO: 3/10]  [SHIP HP: 85%]
```

Każda lokacja to przycisk → otwiera pod-panel (nie nowa scena).

---

## 3. TRADING POST

Panel: lista towarów dostępnych na tej planecie.

### 3.1 Towary

7 kategorii z GDD. Każda planeta ma losową (seed = systemId) dostępność i ceny bazowe modyfikowane przez:
- Frakcja kontrolująca (+/- % dla niektórych kategorii)
- Tier planety (Tier 3 = więcej różnorodności)
- Stan galaktyki (system w konflikcie = droższe towary militarne)

Ceny bazowe (w kredytach, per jednostka):

| Kategoria | Min | Max | Legalność |
|---|---|---|---|
| Raw Materials | 50 | 150 | Legal |
| Technology | 200 | 600 | Legal |
| Food | 30 | 80 | Legal |
| Weapons | 300 | 800 | Gray |
| Narcotics | 500 | 1500 | Illegal |
| Data | 400 | 1200 | Illegal |
| People | — | — | Nie w Trading Post — tylko cele misji |

### 3.2 UI Trading Post

```
╔══ TRADING POST — SOL ══════════════════════╗
║ Item              Buy      Sell    Qty      ║
║ ─────────────────────────────────────────  ║
║ Raw Materials     85 cr    70 cr   [+ -]   ║
║ Technology       420 cr   380 cr   [+ -]   ║
║ Food              45 cr    35 cr   [+ -]   ║
║ Weapons          550 cr      —     [+ -]   ║ ← brak skupu na planecie Hegemony
║                                            ║
║ CARGO: [████░░░░░░] 3/10                   ║
║ CREDITS: 1,250 cr                          ║
║                            [CONFIRM TRADE] ║
╚════════════════════════════════════════════╝
```

- `+` / `-` = zmień ilość (kliknięcie lub scroll)
- Szara strefa i nielegalne: widoczne tylko jeśli planeta ma czarny rynek lub odpowiednia reputacja
- Ceny nielegalne: wyższe, brak podatku Hegemony

### 3.3 Nielegalny cargo i kontrola

Jeśli gracz kupuje nielegalne towary na planecie bez czarnego rynku: ryzyko kontroli przy wylocie (50% — losowanie przy Depart, modyfikowane reputacją Syndicate).

---

## 4. SHIPYARD

Trzy sekcje: naprawa, upgrade, nowy statek.

### 4.1 Naprawa

```
REPAIR HULL
Current HP: 65%  →  Full HP: 100%
Cost: 425 cr
[REPAIR FULL]  [REPAIR 50%: 210 cr]
```

### 4.2 Upgrade modułów

Dostępne moduły (per slot):

| Slot | Poziomy | Efekt |
|---|---|---|
| Engines | Mk1 / Mk2 / Mk3 | +prędkość, +przyspieszenie |
| Weapons | Mk1 / Mk2 / Mk3 | +damage, +fire rate |
| Cargo Hold | Mk1 / Mk2 / Mk3 | +pojemność (5/10/15/20) |
| Shields | Mk1 / Mk2 / Mk3 | +max HP, +regeneracja |
| ECM | None / Basic / Advanced | -szansa wykrycia przy przemycie |

Nie każdy upgrade dostępny na każdej planecie (zależy od tier).

```
╔══ SHIPYARD — UPGRADES ══════════════════════╗
║ ENGINES      [Mk1] → Mk2    Cost: 800 cr   ║
║ WEAPONS      [Mk2] → Mk3    Cost: 1500 cr  ║
║ CARGO HOLD   [Mk1] → Mk2    Cost: 600 cr   ║
║ SHIELDS      [None] → Mk1   Cost: 400 cr   ║
║ ECM          [None]         NOT AVAILABLE  ║
╚═════════════════════════════════════════════╝
```

### 4.3 Nowy statek

Dostępne klasy (zależne od tier planety i zasobów gracza):

| Klasa | Cena bazowa | Dostępność |
|---|---|---|
| Courier | 2,000 cr | Wszędzie |
| Trader | 8,000 cr | Tier 2+ |
| Corvette | 25,000 cr | Tier 2+ |
| Cruiser | 80,000 cr | Tier 3 |
| Flagship | 250,000 cr | Tier 3, rzadko |

Zakup nowego statku: stary statek sprzedawany automatycznie za 60% ceny zakupu.
Gracz traci zainstalowane moduły (zostają w starym statku).
  Cena skupu = wartość_statku × 60% + suma_wartości_modułów × 40%
  Przykład: Corvette (25,000cr) + Engines Mk3 (1,500cr) = 15,000 + 600 = 15,600 cr

---

## 5. TAVERN

Centrum misji i informacji.

### 5.1 Układ

```
╔══ TAVERN ══════════════════════════════════╗
║  [MISSIONS]   [RUMORS]   [AGENTS]          ║
╠════════════════════════════════════════════╣
║ [treść aktywnej zakładki]                  ║
╚════════════════════════════════════════════╝
```

### 5.2 Missions

Lista dostępnych misji (3–5 na planetę, generowane w Module 8).
W tym module: 3 hardcoded misje startowe (patrz GDD Sekcja 9).

Format misji:
```
[BOUNTY HUNTER] WANTED: DEAD OR ALIVE
Target: Pirate "Razor" Vex — last seen in Arcturus
Reward: 1,200 cr + reputation +10 (Hegemony)
───────────────────────────────────────
[ACCEPT]
```

### 5.3 Rumors

Losowe plotki (seed = systemId + game_tick):
- Stan konfliktów: "Hegemony forces spotted massing near Nova Prime"
- Ceny: "Raw materials shortage on Pax — prices up 40%"
- Tajne bazy: "Smugglers talk about a hidden base in the asteroid field"
- Bounties: "Large bounty posted for Coalition officer in Arcturus"

W tym module: 5 hardcoded plotek per frakcja (pool 20 tekstów).

### 5.4 Agents

Agenci Syndicate (widoczni tylko jeśli reputacja Syndicate ≥ 20):
- Oferują misje przemytnicze
- Sprzedają informacje (ujawniają ukryte bazy, cynki o checkpointach)
- Cena info: 200–500 cr

---


### 5.5 Pleasure Quarter

Dostępny w każdej tawernie niezależnie od frakcji. Ikona w menu tawerny zawsze widoczna.

Gracz płaci za usługę. Przy okazji — jeśli ma szczęście — dowiaduje się czegoś cennego.

**Ekran interakcji:**
```
╔══ PLEASURE QUARTER ════════════════════════════════╗
║ The night is long and the stars are far away...    ║
║                                                    ║
║ [ PAY & SKIP   ] — standard rate: 120 cr           ║
║ [ PAY & TIP    ] — generous: 350 cr                ║
║ [ CHEAT & FLEE ] — no payment                      ║
╚════════════════════════════════════════════════════╝
```

**Wyniki losowania:**

| Wybór | Koszt | Szansa na info | Typ info | Efekt uboczny |
|---|---|---|---|---|
| PAY & SKIP | 120 cr | 15% | Lokalizacja bazy lub wraku | Brak |
| PAY & TIP | 350 cr | 70% | Dokładna lokalizacja + siła ochrony/wartość | Underworld +3 |
| CHEAT & FLEE | 0 cr | 0% | Brak | Bounty hunter za graczem (60–180s) |

**Typy informacji (losowane przy sukcesie):**

| Info | Opis | Marker na mapie |
|---|---|---|
| Pirate Base | Lokalizacja tajnej bazy Pirates | ☠ czaszka |
| Derelict Wreck | Dryfujący wrak — zagęszczenie cargo w tunelu | ⊕ krzyżyk |

**Statystyka ukryta: UNDERWORLD CONNECTIONS** (w GameState):
- Rośnie tylko przy PAY & TIP (+3 per wizyta)
- Próg 10 pkt: rzadziej fałszywe lokalizacje
- Próg 25 pkt: info o bazach tier 3 i wrakach z rzadkimi modułami
- Widoczna w panelu reputacji: `[UNDERWORLD: ██░░░░]`


## 6. ADMINISTRATION

Kontakt z frakcją kontrolującą system.

```
╔══ ADMINISTRATION — HEGEMONY ══════════════╗
║ Your standing: NEUTRAL (12)               ║
║                                           ║
║ [REQUEST LICENSE]   Cost: 500 cr          ║
║ Allows: legal weapons trade in Hegemony   ║
║                                           ║
║ [PAY BOUNTY]        You owe: 0 cr         ║
║                                           ║
║ [OFFICIAL CONTRACTS] → redirects to misje ║
╚═══════════════════════════════════════════╝
```

Licencje otwierają szarą strefę handlu dla danej frakcji.
Mandaty za nielegalne cargo można spłacić tu (zamiast przy kontroli celnej).

---

## 7. BLACK MARKET

Dostępny tylko gdy reputacja Syndicate ≥ 40.

Jak Trading Post ale:
- Tylko kategorie: Weapons, Narcotics, Data, People
- Ceny +30% względem rynkowych (ale brak ryzyka kontroli)
- Specjalne moduły niedostępne w stoczni (np. ECM Advanced, ukryta ładownia)
- Brak podatków Hegemony

```
╔══ BLACK MARKET ════════════════════════════╗
║ ⚠ WHAT HAPPENS HERE STAYS HERE            ║
║                                           ║
║ Narcotics     950 cr / unit   [+ -]       ║
║ Data          780 cr / unit   [+ -]       ║
║ [People appear only as mission targets]    ║
║                                           ║
║ [SPECIAL: Hidden Cargo Bay Mk1 — 3200 cr] ║
╚═══════════════════════════════════════════╝
```

---

## 8. GAME STATE — CO ZAPISUJEMY

Po tym module `GameState` musi zawierać:

```javascript
const GameState = {
  credits: 1500,          // startowe (Crossroads, nowa gra)
  cargo: [],              // [{ type, qty, illegal }]
  cargoCapacity: 10,      // bazowo, Courier
  ship: {
    class: 'courier',
    hp: 100,
    maxHp: 100,
    modules: {
      engines: 1,
      weapons: 1,
      cargoHold: 1,
      shields: 0,
      ecm: 0
    }
  },
  reputation: {
    hegemony: 0,
    coalition: 0,
    syndicate: 0,
    pirates: 0
  },
  transponderActive: true,
  currentSystem: 'crossroads',
  activeMissions: [],
  completedMissions: [],
  hegemonyBlacklist: false,     // czy gracz jest na czarnej liście
  hegemonyMissionsForClear: 0,  // licznik zleceń do zdjęcia z listy (cel: 10)
  underworldConnections: 0    // statystyka Pleasure Quarter
}
```

---

## 9. KOLEJNOŚĆ IMPLEMENTACJI

1. Scena PLANET_LAND + główne menu lądowania (HTML)
2. `GameState.js` — inicjalizacja, gettery, settery
3. Trading Post: generowanie cen (seed), UI buy/sell, aktualizacja GameState
4. Shipyard: naprawa (UI + GameState), lista upgradów
5. Zakup nowego statku
6. Tavern: zakładki, 3 hardcoded misje, 20 plotek w pool
7. Administration: wyświetlanie reputacji, licencje (placeholder)
8. Black Market: warunkowy dostęp, UI jak Trading Post
9. Depart: sprawdzenie nielegalnego cargo → losowanie kontroli

---

## 10. DEFINICJA "GOTOWE"

- [ ] Główne menu lądowania z ikonami lokacji
- [ ] Trading Post: kupno i sprzedaż, ceny z seed, aktualizacja kredytów i cargo
- [ ] Shipyard: naprawa HP, lista upgradów (zakup działa), zakup nowego statku
- [ ] Tavern: 3 hardcoded misje widoczne, Rumors z pool 20 tekstów
- [ ] Administration: wyświetla reputację, licencje (nawet placeholder)
- [ ] Black Market: pojawia się przy reputacja Syndicate ≥ 40
- [ ] GameState persystuje między lokacjami w ramach jednej sesji
- [ ] Depart wraca do GALAXY

---

*Tech Spec v1.0 — Void Runner Moduł 5*
