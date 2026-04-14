# VOID RUNNER — Game Design Document v0.1
*Dokumentacja w języku polskim. Gra (UI, dialogi, nazwy) w języku angielskim.*
*Working title. Mix: Privateer × X-Wing × Pirates! × The Last Starfighter*
*Stack: Three.js + Tauri | Target: Steam (PC primary, tablet port secondary)*

---

## 1. WIZJA

Gra akcji / sandbox w otwartym kosmosie. Gracz jest niczyim — przemytnikiem, najemnikiem lub łowcą nagród — w galaktyce rozdzieranej wojną czterech frakcji. Zarabia, rozbudowuje statek, wybiera strony lub gra wszystkich przeciw wszystkim. Może zbudować własne imperium, może zostać legendą czarnego rynku. Wszystko w estetyce lineartu — wireframe, krawędziowa geometria, zero tekstur. Świat wygląda jak blueprint ożywiony prądem.

**Jedna zdanie elevator pitch:**
*Privateer z polityką Pirates!, walką X-Wing i wizualem HyperTube.*

**Win condition:** brak — czyste sandbox. Gracz sam definiuje swoje cele.

---

## 2. ŚWIAT I FRAKCJE

### Galaktyka
Otwarta mapa 3D. Systemy gwiazdowe jako węzły połączone trasami hyperprzestrzennymi. Systemy należą do frakcji — kolor na mapie zmienia się w czasie rzeczywistym w zależności od stanu konfliktu.

### Cztery Frakcje

| Frakcja | Charakter | Strefa wpływów | Styl misji |
|---|---|---|---|
| **Hegemony** | Porządek, podatki, korupcja | Core systemów, stacje tier 3 | Eskorty, stłumienie rebelii, patrol |
| **Coalition** | Idealizm, sabotaż, desperacja | Peryferia, ukryte bazy | Sabotaż, przemyt broni, odbicie jeńców |
| **Syndicate** | Czarny rynek, informacja, kontrakty | Wszędzie — nieoficjalnie | Przemyt, likwidacje, handel danymi |
| **Pirates** | Chaos, napad, znikanie | Niczyje systemy, pasy asteroid | Brak misji — tylko zagrożenie losowe |

### Dynamika konfliktu (na wzór Pirates!)
- Terytoria frakcji zmieniają się w czasie — Coalition atakuje, Hegemony odpowiada
- Gracz może aktywnie przesuwać front wykonując misje lub atakując systemy
- Pirates nie mają terytorium — pojawiają się losowo w każdym systemie
- Syndicate nie walczy otwarcie — działa przez proxy, ma agentów u wszystkich

---

## 3. GRACZ I PROGRESJA

### Role (nie wybór na starcie — specjalizacja przez reputację)
- **Przemytnik** — reputacja rośnie przez zlecenia Syndicateu i Coalition, dostęp do czarnego rynku, ukrytych tras, specjalnych ładowni
- **Najemnik** — reputacja przez misje Hegemony i Coalition, dostęp do lepszych kontraktów bojowych, eskorty konwojów
- **Łowca nagród** — reputacja przez polowania (wszyscy płacą, nawet za swoich), dostęp do list gończych, więzień, licencji

Role nie wykluczają się — gracz może robić wszystko, ale specjalizacja otwiera wyższe tiery zleceń.

### Własna Frakcja (late game)
- Gracz podbija systemy → rośnie jego terytorium i reputacja
- Brak własnej floty NPC — gracz dowodzi sam
- Wpływ na galaktykę: posiadane systemy mogą być atakowane przez inne frakcje
- Fundament: wystarczająca reputacja + kontrola co najmniej 3 systemów

### Statek i progresja (na wzór Pirates!)
Pięć klas statków:

| Klasa | Charakter | Bias |
|---|---|---|
| **Courier** | Mały, zwrotny, ubogi | Combat |
| **Trader** | Średni, duża ładownia | Trade |
| **Corvette** | Wszechstronny, drogi | Balanced |
| **Cruiser** | Ciężki, wolny, groźny | Combat/Trade |
| **Flagship** | Late game, rzadki | Prestige |

- Upgrade modułów: engines, weapons, cargo hold, shields, ECM
- Nowy statek = zakup, stary można sprzedać lub zostawić
- Brak floty — gracz zawsze lata sam

---

## 4. LOKACJE I MECHANIKI

### 4.1 Mapa Galaktyki
- Widok 3D w Three.js: węzły (systemy) + krawędzie (trasy)
- Systemy kolorowane kolorem frakcji, gradient przy strefach spornych
- Dostępna w każdej chwili poza walką
- Klikalny węzeł = info o systemie (frakcja, status, znane misje, ceny towarów)
- Animacja "pulsowania" systemów w konflikcie

### 4.2 Tunel Hyperspace
*Prototyp: HyperTube*
- Czysto transportowy — lot z systemu A do B
- Gracz steruje statkiem biegnącym przez cylindryczny tunel wireframe
- Po drodze: losowo rozrzucone szczątki i zgubiony cargo (diamenty/zasoby) do zebrania
- Zdarzenia losowe: napaść piratów (przejście do trybu walki), anomalia (bonus/kara), sygnał wzywania pomocy (decyzja gracza)
- Długość tunelu zależna od odległości między systemami na mapie

### 4.3 Przestrzeń Otwarta — Dogfight
*Referencja AI: X-Wing (LucasArts)*
- Aktywuje się gdy: gracz atakuje jednostkę, wpadnie w pułapkę, lub zostanie zaatakowany w systemie
- "Bańka walki" o promieniu 1 parseka (= 100 jednostek Three.js) od centrum starcia
- Fizyka: newtońska, uproszczona — bardziej arcade niż symulator
- **AI wrogów (X-Wing style):**
  - Wrogowie latają w skrzydłach (wing logic)
  - Stany AI: atak agresywny / krycie się / wsparcie sojusznika / odwrót
  - Pirates: chaotyczni, hit-and-run, uciekają gdy stracą >50% skrzydła
  - Frakcyjni: zdyscyplinowani, trzymają formację
- **Ucieczka:** gdy odległość do najbliższego wroga > 1 parsek → komunikat "MOŻESZ UCIEC" → potwierdzenie = wyjście z trybu walki

### 4.4 Planeta — Lądowanie
*Referencja: Pirates!*
- Menu lądowania z ikonami lokacji:
  - **Port handlowy** — kup/sprzedaj towary
  - **Stocznia** — naprawa, upgrade, zakup statku
  - **Tawerna** — misje, plotki, agenci Syndicateu, łowcy nagród
  - **Administracja** — relacje z frakcją, licencje, oficjalne kontrakty
  - **Czarny rynek** (jeśli reputacja Syndicateu wystarczająca) — przemyt, nielegalne moduły

### 4.5 Planeta — Atak
*Referencja: The Last Starfighter*
- Tryb lotu nisko nad powierzchnią planety (terrain-skimming)
- Wizual: wireframe krajobraz, budynki jako geometria krawędziowa
- **Fazy ataku (kolejność):**
  1. Myśliwce scramble (dogfight nad powierzchnią)
  2. Wieże obronne (stacjonarne, do zniszczenia)
  3. Garnizon powietrzny (drony i myśliwce obronne ze scramble z bazy naziemnej)
  4. Liniowiec (losowany, pojawia się jako eskalacja — boss fazy)
- Zniszczenie wszystkich celów = planeta zdobyta (zmiana koloru na mapie)
- Niepełny atak (odwrót gracza) = alarm, wzmocnienie obrony przy następnej próbie

### 4.6 Stacja Kosmiczna
- Budowana przez frakcję która długo utrzymuje dany system
- Trzy tiery (rośnie wraz z czasem kontroli frakcji):
  - **Tier 1** — lekkie uzbrojenie, punkt handlowy
  - **Tier 2** — średnia obrona, hangar myśliwców
  - **Tier 3** — ciężka artyleria, tarcze, stała eskorta
- Stacja blokuje atak na planetę przy której stoi — najpierw stacja
- Core systemy każdej frakcji startują ze stacją Tier 3

### 4.7 Tajne Bazy Bandytów
- Ukryte w niczyich systemach, pasach asteroid
- Do odkrycia przez: misje, informatorów, śledzenie piratów po walce
- Można zaatakować (jak planeta, uproszczone fazy) lub nawiązać kontakt (jeśli reputacja piratów — edge case)

---

## 5. EKONOMIA

### Handel
- Każda planeta/stacja ma ceny towarów (surowce, technologia, żywność, broń, narkotyki)
- Ceny zależą od: frakcji kontrolującej, popytu lokalnego, stanu konfliktu
- Klasyczne buy low / sell high

### Towary handlowe

| Kategoria | Przykłady | Legalność |
|---|---|---|
| **Raw Materials** | Ore, crystals, gas | Legalne |
| **Technology** | Components, software, drones | Legalne |
| **Food** | Rations, luxury provisions | Legalne |
| **Weapons** | Small arms, ammunition | Szara strefa |
| **Narcotics** | Stimulants, banned substances | Nielegalne |
| **Data** | Intel, access codes | Nielegalne |
| **People** | Prisoners, fugitives, VIPs | Tylko jako cel misji — nie handlowy |

### Źródła zarobku
- Handel między systemami
- Misje (najemnik, łowca nagród, przemytnik)
- Cargo zbierane w tunelu
- Nagrody za ataki (łupy ze zniszczonych jednostek)
- Podbijanie systemów (podatki? TBD w następnej iteracji)

### Czarny Rynek (Syndicate)
- Niedostępny bez reputacji
- Towary nielegalne = wyższy zysk, ryzyko kontroli Hegemony
- Specjalne moduły niedostępne w oficjalnych stoczniach

### Przemyt
Dwa mechanizmy, można łączyć:
- **Ukryty ładunek** — kupujesz towar nielegalny, deklarujesz coś innego. Na checkpointach Hegemony losowa kontrola. Wysoka reputacja Syndicateu = cynk z wyprzedzeniem
- **Czarna trasa** — wyłączasz transponder, lecisz przez niczyje systemy. Brak kontroli, ale piraci częściej atakują anonimowe statki. Trasa dłuższa niż standardowa

---

## 6. STYL WIZUALNY

**Jedna zasada: wszystko jest blueprintem.**

- Zero tekstur diffuse — tylko geometria krawędziowa
- `Three.js EdgesGeometry` + `LineBasicMaterial` jako domyślny materiał
- Kolor = informacja: zielony (gracz/sojusznik), czerwony (wróg), niebieski (Hegemony), żółty (Coalition), fioletowy (Syndicate), pomarańczowy (Pirates)
- Efekty: glow na wireframe (additive blending), scanline subtelny na UI
- UI: monospace font, HUD jak panel kontrolny lat 80.
- Referencja estetyczna: HyperTube (prototyp) + Battlezone (1980) + Ghost in the Shell schematy techniczne
- Muzyka/audio: synthwave, nie orchestral — Vangelis meets John Carpenter

---

## 7. MVP SCOPE

Pierwsza grywalna wersja musi zawierać:

1. **Mapa galaktyki 3D** — 40 systemów (6 odblokowanych na start, reszta odkrywana), 4 frakcje z kolorami, trasy
2. **Tunel hyperspace** — lot, cargo do zebrania, losowa napaść piratów, transponder toggle
3. **Dogfight** — otwarta przestrzeń, AI X-Wing style, mechanika ucieczki, wybór destynacji po walce
4. **Planeta** — menu lądowania (Pirates! style) + atak (wszystkie fazy, Last Starfighter style)
5. **Handel** — Trading Post, Shipyard, Tavern, Black Market (warunkowy)
6. **5 klas statków** — Courier / Trader / Corvette / Cruiser / Flagship, upgrade modułów
7. **Wszystkie 4 frakcje aktywne** — reputacja, dynamika terytoriów, misje per frakcja
8. **Przemyt** — ukryty ładunek + czarna trasa
9. **Respawn z karą** — ostatni port, cargo utracone, -30% kredytów

---

## 8. PLAN PRODUKCJI DLA CLAUDE CODE

### Architektura techniczna
```
Three.js          — rendering (3D wireframe, sceny)
Tauri             — wrapper desktop, Steam deploy
Vite              — bundler / dev server
JavaScript (ES6+) — logika gry (brak TypeScript dla prostoty i prędkości)
```

### Struktura plików
```
/src
  /core           — game loop, state manager, event bus
  /scenes         — galaxy, tunnel, dogfight, planet, station
  /entities       — player, ship, enemy, projectile, cargo
  /ui             — hud, map, menus, dialogs
  /data           — factions, ships, items, missions (JSON)
  /audio          — synthwave, sfx
  /utils          — math, camera helpers, wireframe factory
/src-tauri        — Tauri config, Steam integration
```

### Moduły produkcyjne — kolejność implementacji
*Estymacje zakładają pracę z Claude Code — jedna sesja = kilka godzin.*

#### MODUŁ 1: Fundament (sesja 1)
- [ ] Setup projektu: Vite + Three.js + Tauri
- [ ] Game loop (requestAnimationFrame, delta time)
- [ ] State manager (sceny: GALAXY / TUNNEL / DOGFIGHT / PLANET / MENU)
- [ ] Wireframe factory (helper do tworzenia obiektów krawędziowych)
- [ ] Kamera: orbit (mapa) / follow (tunel) / free (dogfight)

#### MODUŁ 2: Mapa Galaktyki (sesja 1-2)
- [ ] Generowanie węzłów (systemy) w przestrzeni 3D
- [ ] Renderowanie krawędzi (trasy hyperspace)
- [ ] Kolory frakcji, podstawowy state systemu
- [ ] Klikanie węzła → info panel
- [ ] Wybór trasy → przejście do tunelu

#### MODUŁ 3: Tunel (sesja 2)
- [ ] Port HyperTube do Three.js (cylinder wireframe, ruch kamery)
- [ ] Gracz steruje statkiem (klawiatura WASD / strzałki)
- [ ] Generowanie przeszkód i cargo proceduralnie
- [ ] Kolizje (przeszkoda = damage, cargo = pickup)
- [ ] Trigger: napaść piratów → przejście do dogfight
- [ ] Trigger: koniec tunelu → przejście do systemu docelowego

#### MODUŁ 4: Dogfight (sesja 2-3)
- [ ] Przestrzeń otwarta, fizyka newtonowska (uproszczona)
- [ ] Model gracza: ruch, obrót, strzelanie
- [ ] Enemy ship: spawn, podstawowy ruch
- [ ] AI Tier 1: chase + strzelanie
- [ ] AI Tier 2: wing logic (skrzydłowy)
- [ ] AI Tier 3: stany (atak / krycie / wsparcie / odwrót)
- [ ] Bańka walki 1 parsek, mechanika ucieczki
- [ ] Efekty: eksplozje wireframe, trafienia

#### MODUŁ 5: Planeta — Atak (sesja 3)
- [ ] Scena: terrain-skimming, wireframe krajobraz
- [ ] Faza 1: myśliwce scramble (dogfight nad powierzchnią)
- [ ] Faza 2: wieże obronne (stacjonarne cele)
- [ ] Faza 3: garnizon naziemny
- [ ] Faza 4: spawn liniowca (boss)
- [ ] Victory condition → zmiana frakcji systemu na mapie

#### MODUŁ 6: Planeta — Lądowanie i Handel (sesja 3-4)
- [ ] Menu lądowania (ikony lokacji, wireframe UI)
- [ ] Port handlowy: lista towarów, kup/sprzedaj
- [ ] Stocznia: naprawa, podstawowe upgrade
- [ ] Tawerna: placeholder misji (hardcoded 2-3 misje)
- [ ] System kasy gracza, inventory

#### MODUŁ 7: Frakcje i Reputacja (sesja 4)
- [ ] Data layer: 4 frakcje, staty, relacje między nimi
- [ ] Reputacja gracza per frakcja (float -100 do +100)
- [ ] Reakcje świata: ceny, dostęp do misji, wrogość NPC
- [ ] Dynamika terytoriów: frakcje atakują sąsiednie systemy (timer + dice)
- [ ] Gracz wpływa na terytoria przez misje i ataki

#### MODUŁ 8: Misje (sesja 4-5)
- [ ] System misji: struktura, tracker, nagrody
- [ ] Typy misji: escort / destroy / deliver / bounty
- [ ] Generowanie misji per frakcja, per reputacja
- [ ] Misje Syndicateu (czarny rynek, ukryte)

#### MODUŁ 9: Stacje Kosmiczne (sesja 5)
- [ ] Model stacji (wireframe, 3 tiery wizualnie różne)
- [ ] Mechanika: blokada ataku na planetę
- [ ] Atak na stację (uproszczone fazy dogfight)
- [ ] Budowanie stacji przez frakcję (timer)

#### MODUŁ 10: Polish i Steam (sesja 5-6)
- [ ] Synthwave audio (proceduralne lub assets)
- [ ] SFX: strzały, eksplozje, UI
- [ ] Scanline shader na UI
- [ ] Glow na wireframe (additive blending)
- [ ] Tauri build pipeline: Windows .exe, macOS .app
- [ ] Steam Direct integration (osiągnięcia, overlay — opcjonalne w MVP)
- [ ] Playtesting i balans

---

## 9. MISJE STARTOWE (hardcoded)
Trzy misje wbudowane na start — uczą mechanik, zastępują tutorial:

**[SMUGGLER] Quiet Delivery**
Dostarcz kontener "parts" z planety A do stacji B bez otwierania ładowni. Zleceniodawca: anonimowy agent Syndicateu w tawernie. Uczy: czarna trasa, unikanie checkpointów.

**[MERCENARY] Safe Passage**
Eskortuj transportowiec kupca przez sektor z aktywnymi piratami. Zleceniodawca: kupiec siedzący w tawernie. Uczy: dogfight, ochrona jednostki sojuszniczej.

**[BOUNTY HUNTER] Wanted: Dead or Alive**
Namierz i zneutralizuj pirata z listem gończym Hegemony — ostatnio widziany w sąsiednim systemie. Zleceniodawca: oficer Hegemony incognito. Uczy: mapa galaktyki, dogfight, system nagród.

---

## 10. OTWARTE KWESTIE (do ustalenia w kolejnych sesjach)

- Ekonomia podbijania systemów — podatki od kontrolowanych systemów? Zasób strategiczny? (post-MVP)
- Tajne bazy Pirates — zdefiniowane w Tech Spec M10 ✓
- Własna frakcja — pełne mechaniki dyplomatyczne, sojusze z innymi frakcjami (post-MVP)
- Narracja / dialog — czy jest jakikolwiek story framework, named characters, lore? (do ustalenia)
- People jako towar — pełna mechanika transportu/handlu ludźmi (do ustalenia przed M5)
- Multiplayer — poza zakresem v1.0

---

*GDD v0.1 — wygenerowano na podstawie sesji projektowej*
*Następna sesja: uszczegółowienie mechaniki tunelu i dogfight dla Modułu 3 i 4*
