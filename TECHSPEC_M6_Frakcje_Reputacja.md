# VOID RUNNER — Tech Spec: Moduł 6
## Frakcje, Reputacja i Dynamika Terytoriów

*Dokumentacja PL. Kod EN.*
*Referencja: Pirates! (Sid Meier)*

---

## 1. KONTEKST

Ten moduł ożywia galaktykę — frakcje aktywnie walczą o terytorium, gracz ma mierzalny wpływ na świat. Buduje na `FactionState` z Modułu 1 i `GameState.reputation` z Modułu 5.

---

## 2. SYSTEM REPUTACJI

### 2.1 Wartości

Reputacja per frakcja: float od -100 do +100. Start: 0 (neutralny).

```javascript
reputation: {
  hegemony:  0,   // -100 wróg publiczny → +100 admirał
  coalition: 0,   // -100 zdrajca → +100 bohater rebelii
  syndicate: 0,   // -100 target → +100 partner
  pirates:   0    // -100 cel nagród → +100 jeden z nich
}
```

### 2.2 Progi reputacji i efekty

| Próg | Hegemony | Coalition | Syndicate | Pirates |
|---|---|---|---|---|
| < -50 | Shoot on sight | Shoot on sight | Kontrakt na głowę | Zawsze atakują |
| -50 do -20 | Blokada portów | Brak misji | Brak dostępu | Częste ataki |
| -20 do +20 | Neutralny | Neutralny | Neutralny | Losowe ataki |
| +20 do +50 | Licencje, misje | Baza, misje | Black market | Rzadkie ataki |
| > +50 | VIP, lepsze ceny | Elite misje | Cynki, moduły | Bezpieczny przejazd |

### 2.3 Źródła zmian reputacji

| Akcja | Hegemony | Coalition | Syndicate | Pirates |
|---|---|---|---|---|
| Ukończona misja Hegemony | +15 | -8 | 0 | -3 |
| Ukończona misja Coalition | -8 | +15 | +3 | 0 |
| Ukończona misja Syndicateu | -3 | +3 | +20 | +5 |
| Zniszczony statek Hegemony | -20 | +10 | 0 | +5 |
| Zniszczony statek Coalition | +10 | -20 | 0 | 0 |
| Zniszczony pirat | +5 | +3 | 0 | -15 |
| Atak na planetę Hegemony | -30 | +15 | 0 | +5 |
| Przejęcie planety Coalition | +15 | -30 | 0 | 0 |
| Przemyt (złapany) | -15 | 0 | +5 | 0 |
| Przemyt (udany, Syndicate wiedział) | 0 | 0 | +8 | 0 |
| Zapłata mandatu | +5 | 0 | 0 | 0 |

Reputacja nie spada poniżej -100 ani nie rośnie powyżej +100 (clamp).

### 2.4 Efekt paradoksu reputacji

Wysoka reputacja u jednej frakcji automatycznie obniża u wrogiej:
- Każde +10 u Hegemony = -3 u Coalition (i odwrotnie)
- Syndicate jest niezależny (handluje ze wszystkimi)
- Pirates: rosną gdy gracz jest wrogiem porządku

---

## 3. DYNAMIKA TERYTORIÓW

### 3.1 Tick galaktyki

Co 300 sekund (5 minut) realnego czasu (poza walką) → `GalaxyTick()`:
- Każda frakcja próbuje zaatakować sąsiedni system
- Wynik losowany z uwzględnieniem siły frakcji

### 3.2 Siła frakcji

```javascript
factionStrength = {
  systemCount: n,       // liczba kontrolowanych systemów
  coreIntact: bool,     // czy system core istnieje
  stationCount: n       // liczba stacji kosmicznych
}
```

Wzór szansy ataku:
```
attackChance = 0.15 + (attackerSystems / totalSystems) * 0.3
```

Wynik walki NPC vs NPC:
```
attackPower  = attacker.systemCount * 8 + attacker.stationCount * 15 + random(0, 20)
defendPower  = system.tier * 40 + (system.hasStation ? 30 : 0) + random(0, 20)
winner = attackPower > defendPower ? attacker : defender
```
Defender ma naturalną przewagę terenu — Tier 3 z stacją (150 baza) wymaga frakcji z ~19 systemami żeby regularnie wygrywać. Hamuje niekontrolowaną ekspansję NPC.

### 3.3 Efekty zmiany terytorium

Gdy system zmienia frakcję:
- `FactionState.systems[systemId]` = newFaction
- Mapa galaktyki aktualizuje kolor systemu (live)
- Jeśli to był system core frakcji → frakcja w kryzysie (obniżone szanse ataku przez 120s)
- Komunikat graczu: "BREAKING: [System] falls to [Faction]"

### 3.4 Pirates — specjalna logika

Pirates nie atakują terytorialnie — nie "przejmują" systemów.
Zamiast tego: gdy system jest w konflikcie lub neutralny → szansa pojawienia się piratów w tunelu +20%.

### 3.5 Gracz jako czynnik

Działania gracza wpływają na tick:
- Przejęcie planety przez gracza = system ma frakcję "player" (neutralna wobec wszystkich, ale inne frakcje mogą atakować)
- Misja sabotażu dla Coalition = -15 do siły Hegemony w danym systemie przez 2 ticki
- Zniszczenie stacji kosmicznej = -25 do siły obronnej systemu przez 3 ticki

---

## 4. WŁASNA FRAKCJA GRACZA

Warunki odblokowania:
- Gracz kontroluje ≥ 3 systemy
- Łączna reputacja (suma absolutna) ≥ 150

Po odblokowaniu:
- Systemy gracza widoczne na mapie kolorem `COLORS.PLAYER` (zielony)
- Inne frakcje mogą atakować systemy gracza (ta sama logika tick)
- Gracz nie ma własnych NPC — broni systemów tylko przez fizyczną obecność i misje
- Inne frakcje mogą zaproponować sojusz (placeholder — pełna mechanika post-MVP)

---

## 5. REPUTACJA W UI

### 5.1 Panel reputacji (dostępny z mapy galaktyki, przycisk R)

```
╔══ STANDING ════════════════════════════════╗
║ HEGEMONY   [████████░░░░░░░░] +32  ALLIED  ║
║ COALITION  [░░░░░░░░░░░░░░░░] -15  COLD    ║
║ SYNDICATE  [░░░░░░░░████░░░░]  +8  NEUTRAL ║
║ PIRATES    [░░░░░░░░░░░░░░░░] -40  HOSTILE ║
╚════════════════════════════════════════════╝
```

### 5.2 Notyfikacje

Przy zmianie progu reputacji → toast notification (3 sekundy):
```
[ HEGEMONY STANDING: ALLIED → HONORED ]
```

---


---

## 8. ATMOSFERA SYSTEMÓW PER FRAKCJA

Każda frakcja kontrolująca system nadaje mu inne warunki ekonomiczne i bezpieczeństwa.

### Hegemony — Porządek kosztuje
- **Podatek handlowy:** +15% do cen zakupu, -10% do cen sprzedaży
- **Piraci:** -50% szansy napaści w tunelu wychodzącym z systemu Hegemony
- **Checkpointy celne:** aktywne w tunelach między systemami Hegemony
- **Reputacja bonus:** Hegemony ≥ +50 → naprawy -20%, licencje -30%

### Coalition — Wolność ma cenę
- **Brak podatku handlowego**
- **Piraci:** +30% szansy napaści w tunelach Coalition
- **Brak checkpointów celnych**
- **Skalowanie piratów z reputacją Pirates:**

| Reputacja Pirates | Tier piratów | Nagroda za zniszczenie |
|---|---|---|
| < 0 | Podstawowe skrzydło (2 statki) | 200–400 cr |
| 0–30 | Wzmocnione skrzydło (3 statki, lepsze uzbrojenie) | 500–900 cr |
| 30–60 | Elita (4 statki, named leader) | 1000–2000 cr |
| > 60 | Flotylla (2 skrzydła, liniowiec eskorty) | 3000–6000 cr |

Named leader przy tier "Elita+" = bounty target — pojawia się na liście gończej automatycznie.

### Syndicate — Szara strefa
- **Podatek:** brak oficjalnego, ale "opłata za przejazd" -5% przy sprzedaży (cicha prowizja)
- **Piraci:** neutralni (bazowa szansa bez modyfikatora)
- **Black Market:** zawsze dostępny (jeśli reputacja ≥ 40)

### Pirates (kontrolowane systemy)
- **Brak podatku**
- **Piraci:** nie atakują gracza z reputacją Pirates ≥ 0
- **Brak oficjalnych usług** — tylko tajne bazy (osobna mechanika)

### Neutral
- **Brak podatku**
- **Piraci:** bazowa szansa bez modyfikatora
- **Crossroads efekt:** w Crossroads ceny zawsze 5% lepsze (centrum handlowe)

---

## 9. KOMUNIKACJA Z GRACZEM — DZIENNIK WYDARZEŃ

### Toast Notifications
Przy każdej zmianie terytorium → toast w prawym górnym rogu (4 sekundy):
```
[ ⚔ BREAKING: Arcturus falls to Coalition ]
[ ★ Nova Prime reinforced by Hegemony    ]
[ ⚠ Deadrock: Pirate activity increased  ]
```
Maksymalnie 3 toasty jednocześnie — kolejkowane, nie nakładają się.

### Dziennik Wydarzeń (klawisz J)
Fullscreen overlay — lista ostatnich 50 wydarzeń galaktycznych, od najnowszego:

```
╔══ GALACTIC NEWS FEED ══════════════════════════════╗
║ [12:34] ⚔ ARCTURUS — Coalition forces take control ║
║ [12:29] ★ SOL — Hegemony station upgraded Tier 3   ║
║ [12:15] 💀 DRIFT — Pirate raid reported            ║
║ [11:58] ⚔ NOVA — Hegemony offensive repelled       ║
║ [11:30] ★ CARTEL HUB — Syndicate expands influence ║
║ ...                                                ║
╚════════════════════════════════════════════════════╝
```

Typy wydarzeń:
- `⚔` — zmiana terytorium
- `★` — budowa/upgrade stacji
- `💀` — aktywność piratów (tylko przy wysokiej reputacji Pirates gracza)
- `📦` — zmiany cen (tylko systemy odwiedzone przez gracza)
- `!` — wydarzenie dotyczące gracza bezpośrednio

Zdarzenia dotyczące gracza wyróżnione kolorem `COLORS.UI`.

### Wejście do systemu — Stan systemu
Gdy gracz przylatuje do systemu (fade in z tunelu) → krótki overlay przez 3 sekundy:
```
ENTERING: ARCTURUS
Faction: Coalition  (previously: Hegemony)
Pirate activity: HIGH
Tax: NONE
```
"previously" pojawia się tylko gdy frakcja zmieniła się od ostatniej wizyty gracza.


## 6. KOLEJNOŚĆ IMPLEMENTACJI

1. `ReputationSystem.js`: gettery, settery, clamp, efekt paradoksu
2. Podpięcie zmian reputacji do istniejących akcji (zniszczenie statku, misja, handel)
3. Progi reputacji → efekty (wrogość NPC, dostęp do portów)
4. `FactionAtmosphere.js`: modyfikatory ekonomiczne i piratów per frakcja
5. Skalowanie piratów z reputacją Pirates (tier systemu Coalition)
6. `GalaxyTick()`: timer 300s, logika ataku NPC vs NPC
7. `FactionState` update → live refresh kolorów na mapie
8. Toast notifications: kolejka, max 3 jednocześnie
9. Dziennik wydarzeń (klawisz J): lista 50 wydarzeń
10. Briefing przy wejściu do systemu (3s overlay)
11. Własna frakcja: warunki + kolor na mapie
12. Panel reputacji (UI, klawisz R)

---

## 7. DEFINICJA "GOTOWE"

- [ ] Reputacja zmienia się po każdej akcji gracza (misja, walka, handel)
- [ ] Progi reputacji wpływają na wrogość NPC (test: reputacja < -50 → Hegemony atakuje w systemie)
- [ ] Co 300s galaktyka "tykuje" — systemy mogą zmieniać frakcję
- [ ] Zmiany terytoriów aktualizują kolory na mapie live
- [ ] Toast przy zmianie terytorium (max 3 jednocześnie, kolejkowane)
- [ ] Dziennik wydarzeń (J) — 50 ostatnich wydarzeń
- [ ] Briefing przy wejściu do systemu (3s, pokazuje zmianę frakcji)
- [ ] Modyfikatory ekonomiczne per frakcja działają (podatek Hegemony, brak podatku Coalition)
- [ ] Skalowanie piratów z reputacją w systemach Coalition
- [ ] Własna frakcja odblokowana przy ≥ 3 systemach
- [ ] Panel reputacji (R) wyświetla aktualne wartości z progami

---

*Tech Spec v1.0 — Void Runner Moduł 6*
