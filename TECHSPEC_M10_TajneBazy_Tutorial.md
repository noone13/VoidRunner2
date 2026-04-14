# VOID RUNNER — Tech Spec: Moduł 10
## Tajne Bazy Pirates + Tutorial

*Dokumentacja PL. Kod EN.*

---

## CZĘŚĆ A: TAJNE BAZY PIRATES

### A.1 Lokalizacja i odkrywanie

Tajne bazy Pirates ukryte w systemach Pirates lub Neutral (nigdy w systemach głównych frakcji).

Sposoby odkrycia:
- **Pleasure Quarter w tawernie** (główna metoda — patrz M5 sekcja 5.5): PAY & TIP → 70% szansy na lokalizację bazy
- Misja z Syndicate ("deliver to hidden coordinates")
- Śledzenie uciekającego pirata po dogfight (jeśli pirat ucieknie z bańki → marker "last known heading" na mapie)

**Wraki (Derelict Wrecks):**
Drugi typ informacji z Pleasure Quarter. Nie są bazami — to jednorazowe zdarzenia w tunelu:
- Przy wejściu w tunel z markerem wraku ⊕: zagęszczenie cargo na odcinku ~20% długości tunelu
- Cargo: mix Raw Materials, Technology, rzadko Data lub unikalne moduły
- Po zebraniu: marker znika z mapy
- Underworld ≥ 25: wraki zawierają rzadkie moduły niedostępne w stoczniach

Marker na mapie: ikona czaszki `☠` przy systemie, kolor `COLORS.PIRATES`.
Czas życia markera: 3 ticki galaktyki (15 minut real time) — po tym czasie baza mogła się ruszyć.

### A.2 Generowanie bazy

Każda baza generowana z seed = systemId + random_seed (przypisany przy utworzeniu):

```javascript
const PirateBase = {
  systemId: 'deadrock',
  seed: 4821,
  tier: 1 | 2 | 3,           // losowany, wyższy = silniejsza ochrona
  hasCapitalShip: bool,       // tier 3: zawsze, tier 2: 30%, tier 1: nigdy
  reward: {
    credits: 0,               // obliczane na podstawie tier
    reputationPirates: 0,     // obliczane na podstawie tier
    loot: []                  // losowy cargo
  }
}
```

Tier bazy determinuje siłę ochrony i nagrodę:

| Tier | Myśliwce | Większy statek | Nagroda kredyty | Rep Pirates |
|---|---|---|---|---|
| 1 | 3–4 skrzydło | Brak | 800–1500 cr | +8 |
| 2 | 6–8 dwa skrzydła | Korweta (30% szans) | 2000–4000 cr | +15 |
| 3 | 10–12 trzy skrzydła | Liniowiec (zawsze) | 5000–10000 cr | +25 |

### A.3 Scena: Atak na bazę

Podobna do ataku na planetę (M4) ale uproszczona — brak terenu, baza w przestrzeni otwartej (asteroid field lub opuszczona stacja).

**Fazy:**

**FAZA 1: Ochrona myśliwców**
- Spawn skrzydeł zgodnie z tier
- AI identyczna jak dogfight (M3)
- Pirates: hit-and-run, uciekają przy >50% stratach skrzydła

**FAZA 2: Większy statek (jeśli wylosowany)**
- Korweta (tier 2): HP 300, 2 wieżyczki, agresywna
- Liniowiec (tier 3): HP 800, 4 wieżyczki, spawuje dodatkowe drony co 20s

**FAZA 3: Sama baza**
- Mesh: asteroid z dobudowanymi modułami wireframe (hangary, anteny, generatory)
- HP: 200 (tier 1) / 400 (tier 2) / 700 (tier 3)
- Strzela tylko gdy gracz w zasięgu 40 jednostek
- Zniszczenie = baza znika z mapy, nagroda wypłacona, reputacja Pirates zaktualizowana

### A.4 Kontakt z bazą (alternatywa do ataku)

Dostępne gdy reputacja Pirates ≥ +30:

Zamiast atakować → opcja lądowania (jak planeta):
```
╔══ PIRATE BASE — DEADROCK ══════════════╗
║ They recognize your reputation.        ║
║                                        ║
║ [ TRADING POST ] — black market prices ║
║ [ TAVERN       ] — pirate contracts    ║
║ [ DEPART       ]                       ║
╚════════════════════════════════════════╝
```

- Trading Post: jak Black Market Syndicate (Weapons, Narcotics, Data) + unikalne pirackie moduły
- Tavern: misje pirackie (napad na konwój, sabotaż stacji Hegemony)
- Lądowanie tu: +2 reputacja Pirates, -5 reputacja Hegemony

### A.5 Regeneracja baz

Po zniszczeniu bazy przez gracza:
- System wraca do "brak bazy" przez 2 ticki
- Po 2 tickach: 40% szansy że Pirates odbudują bazę (nowy seed, nowy tier)
- Gracze z Underworld Connections ≥ 25 dostają automatyczne powiadomienie gdy baza odbudowana

---

## CZĘŚĆ B: TUTORIAL

### B.1 Filozofia

Nie przerywamy gameplayu. Tutorial to pierwsze 5 minut gry — gracz uczy się przez działanie, nie przez czytanie. Overlay hints zamiast osobnego ekranu.

### B.2 Trigger: tylko przy pierwszym uruchomieniu

```javascript
if (GameState.playtime === 0 && !settings.skipTutorial) → startTutorial()
```

Opcja "SKIP TUTORIAL" dostępna w każdym momencie (klawisz F1 → "Skip remaining hints").

### B.3 Sekwencja tutorialu

**Krok 1 — Mapa galaktyki (30s)**

Gracz startuje na mapie. Hint overlay pojawia się w centrum ekranu:
```
╔══ GALAXY MAP ══════════════════════════════════╗
║ Drag to rotate. Scroll to zoom.                ║
║ Click a system to see details.                 ║
║                           [ GOT IT ]          ║
╚════════════════════════════════════════════════╝
```
Po kliknięciu GOT IT lub kliknięciu systemu → hint znika.

Drugi hint po kliknięciu systemu:
```
╔══════════════════════════════════════════════╗
║ Connected systems are reachable.             ║
║ Select CROSSROADS and click TRAVEL HERE.     ║
╚══════════════════════════════════════════════╝
```
(Crossroads jest już aktywny — gracz jest w tym systemie, więc hint kieruje do Sol lub Drift)

**Krok 2 — Tunel (podczas lotu)**

Po wejściu w tunel → hint w górnej części ekranu:
```
[ WASD or ARROW KEYS to steer — collect cargo, avoid obstacles ]
```
Hint znika po 8 sekundach lub przy pierwszym ruchu gracza.

**Krok 3 — Dogfight (pierwsza walka)**

Tutorial gwarantuje napaść piratów przy pierwszym locie (jeden piracki myśliwiec, tier 1, zredukowane HP do 40).

Przy wejściu do dogfight → hint sekwencyjny:
```
[1/3] W — thrust forward. S — brake. A/D — turn.
[2/3] SPACE — fire. TAB — lock target.
[3/3] Destroy the enemy or press H to flee.
```
Każdy hint: 5 sekund lub do wykonania akcji.

Po zniszczeniu wroga → mini komunikat:
```
✓ FIRST KILL — bounty hunters remember their first.
```

**Krok 4 — Lądowanie (po dotarciu do systemu)**

Hint przy pierwszym lądowaniu:
```
╔══════════════════════════════════════════════╗
║ TRADING POST — buy low, sell high.           ║
║ TAVERN — find missions and information.      ║
║ SHIPYARD — repair and upgrade your ship.     ║
║                           [ GOT IT ]        ║
╚══════════════════════════════════════════════╝
```

**Krok 5 — Koniec tutorialu**
```
✓ TUTORIAL COMPLETE
You're on your own now, pilot.
The galaxy won't wait.
```
Toast przez 5 sekund. Tutorial flag = true, hinty wyłączone.

### B.4 Persistent hints (po tutorialu)

Niektóre hinty pojawiają się raz przy pierwszym zetknięciu z mechaniką (nie tylko w tutorialu):
- Pierwszy checkpoint Hegemony → hint o transponderze
- Pierwszy nielegalny cargo → hint o ryzyku kontroli
- Pierwsza zmiana terytorium na mapie → hint o dzienniku wydarzeń (J)
- Pierwsza reputacja Pirates > 30 → hint o skalowaniu piratów w Coalition

Każdy hint jednorazowy, zapisywany w `settings.json` jako `shownHints: []`.

---

## KOLEJNOŚĆ IMPLEMENTACJI

**Tajne bazy:**
1. `PirateBase.js`: struktura danych, generowanie z seed
2. Marker ☠ na mapie galaktyki (spawn po info od informatora)
3. Scena PIRATE_BASE_ATTACK w StateManager
4. Fazy: myśliwce → większy statek → baza
5. Lądowanie na bazie (warunkowe, reputacja ≥ 30)
6. Regeneracja baz po zniszczeniu (GalaxyTick)

**Tutorial:**
1. Tutorial flag w GameState
2. Overlay hint system (CSS, kolejkowane)
3. Gwarantowana napaść piratów przy pierwszym locie (1 myśliwiec, HP 40)
4. Sekwencja 5 kroków
5. Persistent hints (lista w settings.json)

---

## DEFINICJA "GOTOWE"

**Tajne bazy:**
- [ ] Informator w tawernie działa (3 opcje, losowanie, statystyka Underworld)
- [ ] Marker ☠ pojawia się na mapie po uzyskaniu info
- [ ] Scena ataku na bazę: myśliwce + opcjonalny większy statek + sama baza
- [ ] Zniszczenie bazy → nagroda + reputacja Pirates
- [ ] Lądowanie na bazie dostępne przy reputacji ≥ 30
- [ ] Baza regeneruje się po 2 tickach (40% szans)

**Tutorial:**
- [ ] Hint overlay na mapie galaktyki (krok 1)
- [ ] Hint w tunelu (krok 2)
- [ ] Gwarantowana walka z 1 pirackim myśliwcem (HP 40) przy pierwszym locie
- [ ] Hinty dogfight sekwencyjne (krok 3)
- [ ] Hint przy lądowaniu (krok 4)
- [ ] Komunikat końca tutorialu
- [ ] SKIP TUTORIAL (F1) działa w każdym momencie
- [ ] Persistent hints po tutorialu (5 typów)

---

*Tech Spec v1.0 — Void Runner Moduł 10*
