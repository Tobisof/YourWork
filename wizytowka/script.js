const form = document.getElementById('briefForm');
const statusEl = document.querySelector('.form-status');

const TODO_HEADER = `Jesteś super doświadczonym web deweloperem z umiłowaniem do ładnego interfejsu.
Stwórz kompletną, w pełni działającą stronę HTML + CSS + JavaScript na podstawie poniższego briefu projektu.

Strona musi:
  • Działać od razu po otwarciu pliku HTML (bez instalacji czegokolwiek, bez narzędzi build, npm ani frameworków).
  • Być responsywna (dobrze wyglądać na komputerach i urządzeniach mobilnych).
  • Zawierać cały kod (HTML, CSS, JS) w wygenerowanym folderze.
  • Zostać zapisana w folderze	 nazwanym tak jak firma.
  • Mieć główny plik o nazwie index.html.
  • Mieć czysty, nowoczesny design pasujący do stylu i kolorów opisanych w briefie.
  • Używać wyłącznie lokalnych zasobów (bez zewnętrznych zależności z CDN).
  • Zawierać obrazy dopasowane do profilu firmy (na podstawie branży lub działalności opisanej w briefie).
  • Zapewnić, aby wszystkie obrazy miały odpowiednie rozmiary, były wyśrodkowane oraz zachowywały responsywność i poprawne wyrównanie na wszystkich rozmiarach ekranów.
  • Nie zawierać formularza kontaktowego na stronie.
  • Jeśli użytkownik podał adres firmy, pamiętaj, że znajduje się on w Polsce podczas dodawania lub wyświetlania mapy.
Jeżeli dodam jakieś linki do stron to zrób je jaki przyciski z nazwą social Media i odnośnikiem.
ZADBAJ O TO, ŻEBY WSZYSTKIE GRAFIKI KTÓRE DODASZ BYŁY LINKAMI Z INTERNETU DZIAŁAJĄCYMY TKA BY NIE BYŁO PUSTYCH ZDJĘĆ. ZWRÓĆ SZCZEGÓLNĄ UWAGĘ NA TO, BY NIE NACHODZIŁY NA SIEBIE ELEMENTY STRONY.


Bardzo ważne - całość strony zapisz w jednym pliku html gdzie będzie i html,css oraz Json.Na końcu Twojej odpowiedzi napisz mi instrukcje, że mam stworzyć plik o nazwie index.html i jak mogę go włączyć przez naciśnięcie prawym przyciskiem myszy. Potraktuj mnie jako osobę dopiero poznającą niuansy techniczne i uczącą się.
Strona ma być rozbudowana, mieć ładne zdjęcia, mieć wyśrodkowaną treść. Minimum 500 linijek kodu.

Poniżej znajdziesz brief projektu (pytania i odpowiedzi).
Na jego podstawie wygeneruj kompletną stronę.

────────────────────────────`;

const FIELD_LABELS = [
  { name: 'brandName', label: 'Jak nazywa się Twoja firma / marka?' },
  { name: 'businessDescription', label: 'Czym się zajmujesz? (krótki opis działalności)' },
  { name: 'primaryGoal', label: 'Jaki jest główny cel strony?' },
  { name: 'contactPerson', label: 'Jeżeli chcesz zostawić kontakt na stronie to podaj' },
  { name: 'colors', label: 'Jakie kolory mają dominować na stronie?' },
  { name: 'stylePreference', label: 'Preferowany styl (minimalistyczny czy rozbudowany)' },
  { name: 'animations', label: 'Czy chcesz animacje na stronie?' },
  { name: 'references', label: 'Czy są strony referencyjne?' },
  { name: 'sections', label: 'Jakie sekcje mają znaleźć się na stronie?' },
  { name: 'mapNeed', label: 'Czy potrzebna jest mapa Google z lokalizacją firmy?' },
  { name: 'pricing', label: 'Czy chcesz dodać cennik lub sekcję z ofertami?' },
  { name: 'socialMedia', label: 'Czy chcesz integrację z mediami społecznościowymi? (podaj link)' },
  { name: 'emotions', label: 'Jakie emocje ma wzbudzać strona?' },
  { name: 'finalEffect', label: 'Jaki efekt końcowy oczekujesz?' },
  { name: 'instagram', label: 'Instagram lub inny link' },
];

const setStatus = (message) => {
  if (statusEl) {
    statusEl.textContent = message;
  }
};

const safeFileName = (rawName) => {
  const fallback = 'projekt';
  if (!rawName) return fallback;
  return rawName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '') || fallback;
};

const buildTodoContent = (payload) => {
  const qaLines = FIELD_LABELS.map(({ name, label }) => {
    const answer = payload.data[name] || '-';
    return `${label}\n${answer}`;
  }).join('\n\n');

  return `${TODO_HEADER}\n\n${qaLines}\n`;
};

const triggerDownload = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    setStatus('Przetwarzanie odpowiedzi...');

    const formData = new FormData(form);
    const payload = {
      submittedAt: new Date().toISOString(),
      source: 'mozartperformance-brief',
      data: Object.fromEntries(formData.entries()),
    };

    const todoContent = buildTodoContent(payload);
    const filename = `${safeFileName(payload.data.brandName)}_todo.txt`;

    triggerDownload(filename, todoContent);
    form.reset();
    setStatus('Gotowe! Znajdziesz plik todo w pobranych.');
  });
}
