# VOID RUNNER — Tech Spec: Moduł 7
## System Misji

*Dokumentacja PL. Kod EN.*

---

## 1. KONTEKST

Misje to główne źródło progresji reputacji i dochodów. Generowane proceduralnie per planeta, filtrowane przez reputację gracza. Trzy hardcoded misje startowe (z GDD) zastępowane przez generator po tym module.

---

## 2. STRUKTURA MISJI

```javascript
const Mission = {
  id: 'uuid',
  type: 'bounty',           // typ (patrz niżej)
  faction: 'hegemony',      // zleceniodawca
  title: 'Wanted: Razor Vex',
  description: '...',
  objectives: [             // lista celów
    { type: 'destroy', target: 'pirate_razor_vex', count: 1 }
  ],
  reward: {
    credits: 1200,
    reputation: { hegemony: 10, pirates: -5 }
  },
  timeLimit: null,          // null = brak limitu, liczba = sekundy
  systemId: 'sol',          // gdzie przyjęta
  targetSystemId: 'arcturus', // gdzie cel
  status: 'active'          // active / completed / failed
}
```

---

## 3. TYPY MISJI

### DESTROY
Zniszcz X jednostek określonej frakcji/targetu.
- Freelancer: wróg pojawia się w systemie docelowym przy wejściu do niego
- Bounty: konkretny named NPC z wyższym HP i unikatowym meshiem

### ESCORT
Towarzysz statkowi NPC z systemu A do B.

**W tunelu:**
- NPC leci "równolegle" — niewidoczny, symulowany w tle
- HUD tunelu pokazuje: `[ESCORT: ████████░░] 80% HP`
- Brak interakcji w tunelu — NPC pojawia się dopiero przy napaści

**Podczas dogfightu (napaść piratów):**
- NPC Escort ship pojawia się w bańce walki obok gracza
- Mesh: większy wireframe niż myśliwce (transport/freighter), kolor `COLORS.PLAYER` (sojusznik)
- NPC nie walczy — tylko manewruje i próbuje uciec z bańki
- AI wrogów: część wrogów (50%) atakuje NPC, część gracza
- HUD dogfight: dodatkowy pasek `[ESCORT HP: ████░░░░░░]`
- Gracz może aktywnie osłaniać NPC — wejście między NPC a wroga zmienia target wrogów na gracza
- NPC zniszczony → misja failed (komunikat: "ESCORT DESTROYED")
- NPC ucieka z bańki (dystans > 100 jednostek od wrogów) → NPC bezpieczny, kontynuuje lot

**Ukończenie:** NPC dociera do systemu docelowego z HP > 0 → misja complete

### DELIVER
Kup/zdobądź X towaru i dostarcz do systemu B.
- Towar dodawany do cargo (zajmuje miejsce)
- Przy dostarczeniu: zdaj cargo w Tawernie systemu docelowego

### SMUGGLE
Jak DELIVER, ale towar nielegalny.
- Wyższy reward
- Ryzyko kontroli celnej (checkpoint Hegemony w tunelu)
- Jeśli złapany: misja failed + mandat

### PATROL / CLEAR
Wejdź do systemu i zniszcz X piratów/wrogów.
- Wrogowie spawnują przy wejściu do systemu (nie trzeba atakować planety)
- Po zniszczeniu: wróć do zleceniodawcy

---

## 4. GENERATOR MISJI

Generuje pool misji przy każdym lądowaniu na planecie (seed = systemId + game_tick).

### 4.1 Filtrowanie per reputacja

| Typ misji | Min reputacja zleceniodawcy |
|---|---|
| PATROL (zwykły) | -20 |
| DELIVER (legalny) | -10 |
| ESCORT | 0 |
| DESTROY (bounty) | +10 |
| SMUGGLE | +20 (Syndicate) |
| DESTROY (named NPC) | +30 |

### 4.2 Skalowanie nagrody

```javascript
baseReward = {
  destroy: 400,
  escort: 600,
  deliver: 300,
  smuggle: 700,
  patrol: 500
}
finalReward = baseReward[type] 
  * tierMultiplier[system.tier]    // 1.0 / 1.4 / 2.0
  * difficultyMultiplier           // losowy 0.8–1.3
  * reputationBonus                // +10% per 20 pkt reputacji powyżej progu
```

### 4.3 Pula misji per planeta

- 3–5 misji na planetę
- Mix typów: zawsze przynajmniej 1 DELIVER i 1 combat (DESTROY lub PATROL)
- Regeneracja: nowe misje przy każdym lądowaniu (poprzednie przepadają jeśli nie przyjęte)
- Max aktywnych misji jednocześnie: 3

---

## 5. TRACKER MISJI

Dostępny zawsze (klawisz M lub przycisk HUD).

```
╔══ ACTIVE MISSIONS ═════════════════════════════╗
║ [1] WANTED: RAZOR VEX                          ║
║     Destroy pirate in Arcturus                 ║
║     Reward: 1,200 cr  ★★☆☆☆                   ║
║     Status: [ ] Target located                 ║
║                                                ║
║ [2] SUPPLY RUN                                 ║
║     Deliver 3x Food to Haven                   ║
║     Reward: 450 cr                             ║
║     Status: [✓] Cargo loaded  [ ] Delivered    ║
╚════════════════════════════════════════════════╝
```

---

## 6. NAMED NPC — BOUNTY TARGETS

Każdy named NPC:
- Unikatowe imię (generowane z pool przymiotnik + rzeczownik)
- Wyższy HP (+50%) i losowy bonus moduł (np. szybszy silnik)
- Pojawia się w konkretnym systemie i zostaje tam przez 2 ticki galaktyki
- Po upływie 2 ticków: ucieka do innego systemu (graczu dostaje update misji)

Pool generowania imion:
```javascript
adjectives = ['Razor', 'Iron', 'Black', 'Ghost', 'Crimson', 'Silent', 'Dead']
nouns = ['Vex', 'Kane', 'Mira', 'Thorn', 'Cross', 'Shade', 'Wolf']
// Razor Vex, Iron Kane, Ghost Thorn...
```

---

## 7. MISJE STARTOWE (HARDCODED)

Zastępują generator w pierwszej sesji (przed jakąkolwiek reputacją):

**[1] QUIET DELIVERY** (Smuggle, Syndicate)
- Dostarcz "parts" (illegal: Weapons, 2 units) z Crossroads do The Den
- Reward: 800 cr, Syndicate +15
- Czas: brak

**[2] SAFE PASSAGE** (Escort, neutral merchant)
- Eskortuj transportowiec z Crossroads do Drift
- Reward: 600 cr, reputation neutralna
- Czas: 300s

**[3] WANTED: DEAD OR ALIVE** (Bounty, Hegemony)
- Zniszcz "Iron Kane" (pirate) w Arcturus
- Reward: 1200 cr, Hegemony +10, Pirates -8
- Czas: brak

---

## 8. KOLEJNOŚĆ IMPLEMENTACJI

1. `MissionSystem.js`: struktura danych, CRUD misji
2. Tracker misji UI (klawisz M)
3. 3 hardcoded misje startowe w Tavernie
4. Podpięcie: misja DESTROY → sprawdzanie celu w dogfight
5. Podpięcie: misja DELIVER → sprawdzanie cargo w Tavernie docelowej
6. Podpięcie: misja ESCORT → NPC ship w tunelu (uproszczony)
7. Generator misji: losowanie, filtr reputacji, skalowanie nagrody
8. Named NPC: spawn w systemie, migracja po tickach
9. Max 3 aktywne misje (UI blokada)
10. Misja failed przy time limit

---

## 9. DEFINICJA "GOTOWE"

- [ ] 3 hardcoded misje startowe widoczne w Tavernie Crossroads
- [ ] Misja DESTROY: cel pojawia się w docelowym systemie, po zniszczeniu misja complete
- [ ] Misja DELIVER: cargo oceniane przy zdaniu w tawernie
- [ ] Tracker misji (M) wyświetla aktywne misje z postępem
- [ ] Generator tworzy 3–5 misji per planeta przy lądowaniu
- [ ] Filtrowanie po reputacji działa
- [ ] Nagroda (kredyty + reputacja) wypłacana po complete
- [ ] Max 3 aktywne misje jednocześnie

---

*Tech Spec v1.0 — Void Runner Moduł 7*
