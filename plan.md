# Morphing Blob Head — Landing Page Demo

> **Update 2:** the "3 cards on a home screen" pivot (previous update) was wrong — it dropped
> scrolling entirely, which was never supposed to go away. Reverted to the original single
> scrolling head (scroll = shape/color morph across 3 sections), and re-added click-to-expand
> correctly this time: the head grows from its *exact current on-screen position* (a FLIP
> animation — capture the real rect, seed an overlay at that rect with the head's current
> shape/color/eye state, then transition the overlay to a near-fullscreen size) instead of
> jumping to a pre-defined card layout. Sections are now real: **About** (bio + CV download),
> **Projects** (image + description + link list), **Certificates** (thumbnail grid → click to
> zoom in a lightbox with image + info). Everything in English. See bottom of file for details.
>
> **Update 1 (superseded):** an earlier version replaced scrolling with 3 static head-cards on a
> home screen. That broke the requirement to keep scrolling and is no longer how this works.

## Cel
Statyczna strona demo (3 sekcje, scroll) z jedną dużą "głową"-blobem (SVG) jako hero:
- oczy śledzą kursor myszy (na mobile: automatyczne "rozglądanie się" co jakiś czas, bo nie ma myszki)
- mruganie co ~2s
- przy scrollu kształt blobu i kolor głowy/tła płynnie morfuje między 3 stanami (koniec sekcji 1 → 2 → 3)
- hover na głowie: oczy "krążą" w kółko + lekkie podbicie skali (potwierdzenie klikalności ruchem, nie kolorem)
- idle "come-hither" animacja zachęcająca do kliknięcia: pulsująca poświata (halo) za głową + delikatny oddech (bardzo subtelny, bez migającego banneru — restraint > krzykliwość, zgodnie z best practices mikrointerakcji)

## Stack (bez serwera, gotowe pod FTP)
Czysty HTML + CSS + vanilla JS, zero zależności/build stepu:
- `index.html`
- `style.css`
- `script.js`

Wgrywasz 3 pliki na FTP i działa. Żadnego npm/build/CDN wymaganego (jeśli kiedyś zechcesz cieassociate WebFont, to jedyny ewentualny external request).

## Struktura strony
- Zewnętrzny `.scroll-track` wysokości `300vh` (3 sekcje × 100vh) — daje długość scrolla.
- W środku `position: sticky; top: 0; height: 100vh` `.stage` z wycentrowanym SVG blobem (oczy + źrenice + halo).
- 3 bloki tekstowe (`.copy-0/1/2`, placeholder: Hero / Features / Kontakt) nałożone na stage, cross-fade opacity zależnie od progresu scrolla (każdy widoczny ok. 1/3 drogi).

## Animacja kształtu (blob morph)
- SVG `<path>` generowany proceduralnie: N punktów (8) rozstawionych po okręgu, każdy z promieniem + lekkim "wobble", połączone gładkimi krzywymi Béziera (Catmull-Rom → bezier) — klasyczna technika organicznego blobu.
- 3 zestawy promieni (keyframe shape na sekcję 1/2/3), każdy inny "nastrój" kształtu.
- Na każdej klatce (rAF, throttled scroll) liczony `progress ∈ [0,2]`, segment + local t, promienie lerpowane między sąsiednimi keyframe'ami → płynna, ciągła zmiennokształtność (nie cięcia/przeskoki).
- Idle: bardzo subtelny "oddech" (sinusoidalna modulacja promieni ±1-2%) niezależnie od scrolla, żeby blob nigdy nie był całkiem statyczny.

## Kolory (ustalone z Tobą)
Progresja pastelowa → ciemna:
1. Sekcja 1: tło pastelowy żółty, głowa cieplejszy stonowany żółty/amber (tonalnie, subtelny kontrast)
2. Sekcja 2: tło pastelowy szary, głowa stonowany niebiesko-szary
3. Sekcja 3: tło ciemna zieleń, głowa kremowa/off-white (mocniejszy kontrast na ciemnym tle — czytelność + "pop")

Kolory (bg i głowa) lerpowane w RGB tym samym `progress` co kształt, więc wszystko zmienia się równocześnie i płynnie.

## Oczy
- Dwie białe elipsy (twarde obrys czarny jak na referencji) + czarne źrenice.
- Desktop: `pointermove` → wektor od środka oka (świeży `getBoundingClientRect` po scrollu/resize) do kursora, znormalizowany i clampowany do promienia wewnątrz białka oka, `transform: translate()` na źrenicy.
- Touch/mobile (brak pointera): wykrycie przez `matchMedia('(hover: none)')`/brak `pointermove` w N sekund → tryb auto: co 3-5s losowe spojrzenie w bok + powrót na wprost, przez CSS/JS easing.
- Mruganie: co 2s `scaleY` oka do ~0.05 na ~120ms (w widełkach 100-300ms z badań UX) i z powrotem, przez `setInterval` + klasa `.blink`.

## Hover / zachęta do kliknięcia
- `:hover`/`pointerenter` na głowie: źrenice zaczynają krążyć po okręgu (CSS `@keyframes` po torze kołowym) zamiast śledzić mysz, głowa lekko rośnie (`scale(1.03)`), `cursor: pointer`.
- Idle "call to action": miękka pulsująca poświata (radial-gradient halo) za blobem, bardzo wolna (3-4s cykl), niska amplituda — sygnalizuje klikalność bez krzykliwego migania (zgodnie z research: subtelność > agresywna animacja).

## Aktualna architektura (scroll + FLIP-expand)
- `.scroll-track` (300vh) + `.stage` (sticky) z JEDNĄ głową — dokładnie jak w oryginale: `KEYFRAMES[0..2]` (about/projects/certificates) niosą `bg`, `head`, `eye`, `radii`; scroll progress → lerp koloru/kształtu/rozmiaru oczu co klatkę.
- Klik na głowę: `getCurrentSectionIndex()` zaokrągla aktualny scroll-progress do najbliższej sekcji (0/1/2).
- `openSection(idx)`:
  1. `headSvg.getBoundingClientRect()` → `seedRect` (dokładna pozycja/rozmiar głowy TERAZ, na ekranie).
  2. `freezeScroll()` — klasyczny trik `body{position:fixed; top:-scrollY}`, żeby tło się nie ruszało.
  3. `#expand-overlay` ustawiany (bez transition) na `seedRect`, z aktualnym kształtem/rozmiarem oczu głowy (`headInst.lastRadii/lastEyeSize`) — zero widocznego skoku.
  4. Realna głowa chowana (`opacity:0`), reflow, transition włączone z powrotem, overlay animowany (CSS transition 0.7s, sprężysty cubic-bezier) do `computeExpandedRect()` (≈92vw×88vh, max 900×900, wyśrodkowane, liczone w JS w pikselach — bez mieszania % i transform, żeby przejście było czyste).
  5. Oczy overlaya jadą (lerp `spread` 0→1) z pozycji domowej do `EXPANDED_EYE` (rozstawione, w górze); kształt blobu leci (`seedRadii → section.expandedRadii`) tą samą techniką.
  6. Treść sekcji (`contentFor(id)`) i `×` fadują in z opóźnieniem.
- `closeSection()`: overlay wraca (transition) do `seedRect`, po `EXPAND_MS` chowany, głowa odkryta, `unfreezeScroll()`.
- Zamykanie też przez klik w tło (poza `#expand-overlay`) i Escape.
- Certificates: siatka placeholderów-przycisków → klik otwiera `.lightbox` (ciemne tło, większy placeholder + opis, zamykane × / Escape / klik w tło).
- Idle-look (2s bezruchu → oczy same patrzą gdzieś) i krążenie źrenic po hover działają jak wcześniej, teraz współdzielone między `headInst` i `overlayInst`.

## Update 3: naprawione po realnym headless-testowaniu
Zainstalowałem lokalnie Playwright (headless Chromium, w sandboxie, nic na pulpicie użytkownika) i faktycznie
zweryfikowałem otwieranie/zamykanie zamiast zgadywać. Znalazłem i naprawiłem 3 błędy:
- `.copy`/`.scroll-hint` mają inline `style.opacity` ustawiane co klatkę przez scroll-loop, co zawsze wygrywało
  z regułą CSS `body.section-open .copy{opacity:0}` — tekst tła przebijał się pod otwartą sekcją. Fix: pętla
  pomija te elementy gdy `openIdx !== null`, a `openSection()` czyści inline `opacity` przy starcie.
- Blob w stanie rozwiniętym: kontener rósł poprawnie, ale `<svg>` domyślnie zachowywał proporcje (`viewBox`
  400×400 = kwadrat) i wpasowywał się w środek prostokątnego kontenera, zostawiając puste marginesy — stąd
  wrażenie "dalej małe". Fix: `preserveAspectRatio="none"` na `#expand-svg` (rozciąga się 1:1 do kontenera) +
  zwiększone `expandedRadii` (bliżej granicy viewBox, ~185-192 zamiast ~140-190).
- Animacja zamykania: `.expand-overlay` nie miało transition na `opacity`, więc `classList.remove("active")`
  chowało całą nakładkę NATYCHMIAST (skok do niewidzialności), a kurczenie się top/left/width/height leciało
  bez żadnego widocznego efektu w tle. Fix: rozdzielone na `.visible` (opacity, trzymane przez cały czas
  kurczenia, zdejmowane dopiero po zakończeniu transition) i `.active` (treść/×, znika szybko od razu).

## Update 4: prawdziwa treść wciągnięta ze starej strony (`Strona/`)
Użytkownik wrzucił katalog ze swoją starą stroną (`Strona/index.html` + `assets/`). Wyciągnięte i wpięte:
- **About**: bio + stack (z sekcji hero/book-page starej strony) + timeline karier (6 stanowisk, z sekcji
  "Experience") + prawdziwe CV (`assets/Tobiasz_Lubowski_CV.pdf`, skopiowane z `Strona/assets/cv/`).
- **Certificates**: 10 prawdziwych certyfikatów skopiowanych z `Strona/assets/certs/`, przeskalowanych przez
  `sips` do dwóch rozmiarów (`assets/certs-thumb/` ~480px do siatki, `assets/certs/` ~1600px do lightboxa —
  oryginały miały 2400px/1-1.5MB, za ciężkie na siatkę miniatur). Tytuły/wystawcy odczytane bezpośrednio
  z obrazków certyfikatów (nie było tej informacji w starym HTML, tylko generyczne "Cert N").
- **Projects**: bez zmian — zostaje placeholder (`PROJECTS` w script.js), user dopowie treść później.

**Do sprzątnięcia (nie ruszałem, decyzja użytkownika):** w katalogu projektu zostały `Strona/` (źródło, cała
stara strona ze wszystkimi podprojektami) i `15 55 10082026/` (duplikat plików projektu + zagnieżdżone
`Strona/` — wygląda na przypadkowy artefakt przeciągnięcia folderu). Żadne z nich nie powinny trafić na FTP.

## Update 5: pełny ekran po rozwinięciu + drobne poprawki
- `computeExpandedRect()` uproszczone do dosłownie całego viewportu (`0,0,innerWidth,innerHeight`) — koniec
  kombinowania z procentami/marginesami, głowa po kliknięciu wypełnia cały ekran.
- Kształt (`expandedRadii`) domknięty bliżej krawędzi viewBox (cardinal ~186-190, corner ~196-197) — bardziej
  kwadratowy, mniej "owalny", więcej realnej przestrzeni na treść bez nachodzenia na timeline w About.
- `EXPANDED_EYE.cy` przesunięte z 78 → 62 i skala oczu przy rozwinięciu zmniejszona (1.12→1.04) — poprzednia
  wersja przycinała oczy u góry viewBox przy dużym rozmiarze.
- Nowy nagłówek `.brand-header` (DevOps / Tobiasz L.) w lewym górnym rogu, ta sama typografia co `.eyebrow`/nav,
  chowany razem z resztą UI gdy sekcja jest otwarta.
- Odświeżona paleta kolorów (bardziej nasycone: about #e6a431/#fbe7a0, projects #6c7a99/#e4e1f0, certificates
  #f2e8ce/#0f2a1c).
- Lightbox certyfikatów: strzałki prev/next (`#lightbox-prev`/`#lightbox-next`) do przeklikiwania bez zamykania.
- Dodany 11. certyfikat `cert_jutra.png` (Google Umiejętności Jutra AI × SGH) do `CERT_INFO`.
- Siatka certów na mobile: z drobnych kafelków (minmax 84px) na wygodne 2 kolumny; desktop też ma teraz
  większe miniatury (minmax 180px zamiast 100px).
- Naprawiony domyślny niebieski outline przeglądarki po programistycznym `headSvg.focus()` (po zamknięciu
  sekcji) — teraz stylowany przez `:focus-visible`, niewidoczny przy zwykłym kliku myszką.

## Update 6: pełne, jednolite wypełnienie kolorem (bez zaokrąglonych rogów)
`expandedRadii` podniesione do 340/400 (znacznie ponad promień potrzebny do dotarcia do rogu viewBoxa ~283) —
blob celowo wychodzi poza `viewBox` w każdym kierunku i zostaje ucięty równo przez granicę SVG, więc kolor
głowy wypełnia dosłownie cały ekran, bez prześwitującego tła w rogach. Efekt uboczny: sam narysowany kontur
(czarna "szkicowa" linia) nie jest już widoczny w stanie rozwiniętym, bo cała krawędź kształtu leży poza
widocznym obszarem — kontur zostaje tylko na małej głowie w widoku scrollowanym. `EXPANDED_EYE.cx` zwężone
z [90,310] do [115,285].

## Update 7: Projects wypełnione realnymi projektami z `Strona/`
9 projektów skopiowanych z `Strona/` do katalogu głównego (dostępne pod `/<nazwa>/`, każdy self-contained,
sprawdzone że żaden nie odwołuje się do plików spoza swojego katalogu):
- `blog/` — blog.html→index.html + 6 blog-*.html + styles.css + tylko potrzebne obrazki z assets/vlogs i
  assets/projects (nie cały 202MB katalog assets/passions). Linki nav "index.html"→"../index.html" poprawione
  (wcześniej wskazywały na starą stronę).
- `english/`, `faderoom/`, `kartka/`, `minecraftai/` (link do `/3` — najnowsza wersja gry), `promptjutra/`,
  `thermodom/`, `wizytowka/`, `ai_car_game/` — skopiowane 1:1.
- Duże zdjęcia skompresowane przez `sips` (faderoom/uploads 24MB→3.8MB, promptjutra/Strona* 38MB→5.1MB).
- Zrzuty ekranu każdego projektu (headless Chromium) → miniatury w `assets/projects/*.jpg` (~1MB łącznie).
- `PROJECTS` w script.js: 9 wpisów z prawdziwym tytułem/opisem/linkiem/miniaturą (opisy pisane na podstawie
  faktycznego oglądu każdej strony, nie zgadywane).
- `contentFor("projects")` + CSS: cała karta projektu to teraz `<a>` (klikalna całość, nie tylko link tekstowy),
  prawdziwy `<img>` zamiast `.img-placeholder`.
- **Łączny rozmiar deployowalnej treści: ~33MB** (bez `Strona/` i duplikatu `15 55 10082026/`, które WCIĄŻ
  siedzą w katalogu — patrz sekcja "Do sprzątnięcia" niżej, użytkownik jeszcze nie potwierdził usunięcia).

## Do uzupełnienia realną treścią (placeholdery są jawnie oznaczone w kodzie)
- About: bio + plik `cv.pdf` (obecnie link do nieistniejącego pliku — wrzucić prawdziwe CV pod tą nazwą obok index.html)
- Projects: `PROJECTS` w script.js (tytuł/opis/link) + prawdziwe zdjęcia zamiast `.img-placeholder`
- Certificates: `CERTS` w script.js (tytuł/opis) + prawdziwe skany zamiast `.cert-thumb`/`.lightbox-media` placeholderów

## Otwarte kwestie / założenia
- Treść sekcji: placeholder copy (Hero / Features / Kontakt), nacisk na efekt — potwierdzone.
- Head na kliknięcie: na razie brak zdefiniowanej akcji (demo) — mogę dodać np. scroll-to-next-section albo prosty "wow" efekt (confetti/particle burst) jeśli chcesz.
- Dostępność: `prefers-reduced-motion` — jeśli użytkownik ma to ustawione, wyłączam/redukuję animacje idle i blink zostaje jednorazowy zamiast pętli.
