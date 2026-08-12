# Master Prompt — Generator Strony WWW z AI | v2.0

## Zmiany względem v0.1

- Nowy porządek etapów: SCAMPER → Kwiat Lotosu → Persona → SPICE → automatyczne generowanie
- AI przechodzi przez wszystkie etapy samodzielnie bez zatrzymywania i bez pytania o akceptację
- Dodana zmienna `[NAZWA_FIRMY]`
- Dodana zmienna `[KOLORYSTYKA]` z presetami i opcją własną
- Dodana zmienna `[KONTAKT]` — telefon i/lub e-mail jako klikalne linki, bez formularza
- Etap 5 — generowanie kompletnego kodu HTML/CSS/JS uruchamia się automatycznie po Etapie 4
- Kod generowany w trybie Canvas
- Brak dekoratorów (linie ════, długie myślniki), format czysty dla AI

---

## Zmienne formularza

| Zmienna | Opis |
|---|---|
| `[NAZWA_FIRMY]` | Nazwa firmy lub projektu |
| `[BRANŻA]` | Czym zajmuje się firma |
| `[PROJEKT_USŁUGA]` | Co konkretnie sprzedaje lub oferuje |
| `[MISJA_WARTOŚCI]` | Misja firmy, na czym najbardziej zależy |
| `[CEL_BIZNESOWY]` | Co ma osiągnąć strona |
| `[WSTĘPNA_PERSONA]` | Kto jest klientem — surowy opis |
| `[STRUKTURA_STRONY]` | Lista sekcji strony |
| `[KONTAKT]` | Dane kontaktowe — telefon i/lub e-mail jako klikalne linki |
| `[KOLORYSTYKA]` | Paleta kolorów z generatora |

### Presets kolorystyki

- **Google (domyślny):** `#4285F4` niebieski, `#EA4335` czerwony, `#FBBC05` żółty, `#34A853` zielony
- **Fioletowy:** gradient `#7C3AED` do `#4F46E5`, tło `#F5F3FF`
- **Ciemny/Premium:** tło `#111827`, akcent `#F59E0B`, tekst `#F9FAFB`
- **Zielony/Eco:** `#059669`, akcent `#10B981`, tło `#F0FDF4`
- **Granatowy/B2B:** `#1E3A5F`, akcent `#2563EB`, tło `#EFF6FF`
- **Własna:** hex primary + accent + background

---

## Prompt do wklejenia w AI

```
# MASTER PROMPT — Generator Strony WWW z AI

## Twoja rola

Jestes ekspertem laczacym cztery role: Strateg Biznesowy, Badacz UX, Copywriter Premium, Full-Stack Developer.

## Dane wejsciowe

Firma: [NAZWA_FIRMY]
Branza: [BRANŻA]
Produkt lub usluga: [PROJEKT_USŁUGA]
Misja i wartosci: [MISJA_WARTOŚCI]
Cel biznesowy: [CEL_BIZNESOWY]
Wstepna persona: [WSTĘPNA_PERSONA]
Struktura strony: [STRUKTURA_STRONY]
Kontakt: [KONTAKT]
Kolorystyka: [KOLORYSTYKA]

## Instrukcja glowna

Przeprowadz samodzielnie wszystkie etapy 1-4 bez przerwy i bez pytania o akceptacje. Wyswietl wyniki kazdego etapu jako czytelne sekcje. Po zakonczeniu etapu 4 automatycznie i bez zatrzymywania przejdz do etapu 5 i wygeneruj kompletna strone.

## Etap 1: Innowacja oferty (SCAMPER)

Cel: wyroznic oferte "[PROJEKT_USŁUGA]" na rynku tak, aby realizowala cel biznesowy: [CEL_BIZNESOWY].

Dla kazdego kroku SCAMPER wygeneruj jeden konkretny pomysl modyfikacji oferty lub sposobu jej dostarczania:
- Substitute: co zastapic w ofercie lub procesie?
- Combine: co polaczyc z czyms innym, by stworzyc nowa wartosc?
- Adapt: co zaadaptowac z innej branzy?
- Modify lub Magnify: co wzmocnic, rozbudowac lub zredukowac?
- Put to other use: inne zastosowanie tej samej oferty?
- Eliminate: co usunac, by oferta byla czystsza i bardziej skupiona?
- Reverse lub Rearrange: co odwrocic lub przeorganizowac w sposobie dzialania?

Wybierz jeden najsilniejszy pomysl i oznacz go jako "Glowna Innowacja". Bedzie to os calej komunikacji strony.

## Etap 2: Mapa argumentow (Kwiat Lotosu)

Centrum: "[PROJEKT_USŁUGA]" wzbogacone o Glowna Innowacje z Etapu 1.

Wygeneruj 8 obszarow komunikacji. Dla kazdego obszaru podaj 3 konkretne argumenty lub punkty sprzedazowe. Przykladowe obszary: unikalne cechy, pokonywanie obiekcji, korzysci funkcjonalne, korzysci tozsamosciowe, dowody spoleczne, pilnosc lub ograniczenia, wartosci marki, sciezka klienta.

## Etap 3: Gleboka persona (5 Whys + 5W+H)

Krok 1 - Technika 5 Whys:
Zacznij od wstepnej potrzeby klienta. Zadaj 5 poziomow pytania "dlaczego?". Wyswietl jako lancuch: Potrzeba bazowa > Dlaczego 1 > Dlaczego 2 > Dlaczego 3 > Dlaczego 4 > Gleba potrzeba tozsamosciowa.

Krok 2 - Profil 5W+H oparty na wynikach 5 Whys:
- Who: kim jest i jak siebie okresla?
- What: czego konkretnie chce, w swoim wlasnym jezyku?
- When: jaki moment lub impuls uruchamia decyzje zakupu?
- Where: w jakim kontekscie zyciowym korzysta z oferty?
- Why: gleba motywacja odkryta przez 5 Whys
- How: jakiego doswiadczenia od [NAZWA_FIRMY] oczekuje?

Krok 3 - Slownik jezyka klienta:
Lista 10-12 zdan lub zwrotow, ktorych sam klient by uzyl opisujac swoj problem lub potrzebe. Ta lista bedzie podstawa copywritingu w Etapie 4.

## Etap 4: Teksty na strone (Framework SPICE)

Materialy wejsciowe: Glowna Innowacja (Etap 1), 8 obszarow argumentow (Etap 2), profil persony i Slownik jezyka klienta (Etap 3).

Napisz teksty dla kazdej z tych sekcji: [STRUKTURA_STRONY]

Dla kazdej sekcji zastosuj framework SPICE:
- Situation: wprowadz kontekst nawiazujac do momentu "When" klienta z Etapu 3
- Problem lub Purpose: pokaz ze rozumiesz gleboki bol odkryty przez 5 Whys
- Information: przedstaw oferte ulepszona przez Glowna Innowacje i argumenty z Etapu 2
- Constraints: pisz zwiezle, uzywaj Slownika jezyka klienta, zero lania wody
- Examples lub CTA: wezwanie do dzialania nakierowane bezposrednio na cel: [CEL_BIZNESOWY]

Format kazdej sekcji: nazwa sekcji, naglowek H1 lub H2, podtytul, tresc, CTA.
Zakaz: "profesjonalne uslugi", "wysoka jakosc", "doswiadczony zespol", "kompleksowe podejscie".

## Etap 5: Generowanie kompletnej strony (bezposrednio po Etapie 4)

Napisz "Otwieram Canvas" i wygeneruj caly kod w trybie Canvas.

Wymagania techniczne:
- Jeden plik HTML z wbudowanym CSS i JS, bez zewnetrznych frameworkow JS
- Google Fonts przez CDN, maksymalnie dwie rodziny fontow
- Mobile-first, w pelni responsywna strona oparta na CSS Grid i Flexbox
- Gotowa do wdrozenia przez FTP bez potrzeby serwera aplikacji

Design i kolorystyka:
[KOLORYSTYKA]
Kontrast zgodny z WCAG AA, minimum 4.5:1 dla tekstu. Gradient na elementach CTA i w sekcji hero. Zaokraglone rogi 8-20px i cienie box-shadow na kartach. Czytelne odstepy white-space miedzy sekcjami.

Wymagania UX (standard 2024):
- Sticky header z efektem blur po scrollu
- Sekcja hero minimum 80vh z mocnym H1, podtytul, przycisk CTA
- Hamburger menu na urzadzeniach mobilnych (CSS i JS bez bibliotek)
- Animacje przy scrollowaniu przez Intersection Observer API: fade-in i slide-up
- Smooth scroll na kotwice #hash
- Hover effects na kartach, przyciskach i linkach nawigacyjnych

Sekcje do wygenerowania: [STRUKTURA_STRONY]

Tresc i SEO:
- Wstaw wszystkie teksty z Etapu 4 do odpowiednich sekcji HTML
- Placeholder obrazow jako gradient CSS z opisowym tekstem zamiast img
- W testimonialach i portfolio wygeneruj wiarygodne, realistyczne dane (imiona, opinie, projekty) pasujace do branzy [BRANŻA] — bez zadnych etykiet placeholder ani komentarzy "przyklad do zastapienia"
- Sekcja Kontakt: [KONTAKT]. Bez zadnego formularza HTML.
- Tytul strony: [NAZWA_FIRMY] plus slowo kluczowe z branzy
- Meta description: 150-160 znakow zawierajacych Glowna Innowacje z Etapu 1
- Open Graph tags: og:title, og:description, og:type
- Semantyczne HTML5: header, main, section, article, footer

Wynik: jeden kompletny blok kodu HTML w Canvas, gotowy do zapisania jako index.html i wgrania na serwer FTP.
```
