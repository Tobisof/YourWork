/**
 * Christmas Presents – backend w Arkuszu Google.
 * Wklej cały ten plik w: Arkusz → Rozszerzenia → Apps Script (zastąp zawartość Code.gs).
 * Potem: Wdróż → Nowe wdrożenie → Aplikacja internetowa,
 *   "Wykonaj jako": Ja, "Kto ma dostęp": Każdy.
 * Skopiuj URL kończący się na /exec i wklej go w app.js (API_URL).
 */
const SHEET_NAME = 'gifts';
const COLS = ['id', 'personId', 'title', 'link', 'note'];
const LIMITS = { title: 120, link: 500, note: 300 };

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll_() {
  const values = sheet_().getDataRange().getValues();
  values.shift(); // header
  return values
    .filter((r) => r[0] !== '')
    .map((r) => Object.fromEntries(COLS.map((c, i) => [c, String(r[i] ?? '')])));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(g) {
  const out = {};
  for (const k of ['title', 'link', 'note']) out[k] = String(g[k] ?? '').trim().slice(0, LIMITS[k]);
  if (out.link && !/^https?:\/\//i.test(out.link)) out.link = '';
  // nie pozwól, żeby tekst zaczynający się od "=" stał się formułą w arkuszu
  for (const k of ['title', 'note']) if (/^[=+\-@]/.test(out[k])) out[k] = "'" + out[k];
  return out;
}

function doGet() {
  return json_({ ok: true, gifts: readAll_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const req = JSON.parse(e.postData.contents);
    const sh = sheet_();
    const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map((r) => String(r[0]));
    const rowOf = (id) => ids.indexOf(String(id)) + 1; // 1-based, 0 = not found

    if (req.action === 'add') {
      const g = clean_(req.gift || {});
      const personId = String(req.gift.personId || '').slice(0, 40);
      if (!g.title || !personId) return json_({ ok: false, error: 'missing title/personId' });
      const id = 'g' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
      sh.appendRow([id, personId, g.title, g.link, g.note]);
    } else if (req.action === 'update') {
      const row = rowOf(req.gift && req.gift.id);
      if (row < 2) return json_({ ok: false, error: 'not found' });
      const g = clean_(req.gift);
      if (!g.title) return json_({ ok: false, error: 'missing title' });
      sh.getRange(row, 3, 1, 3).setValues([[g.title, g.link, g.note]]);
    } else if (req.action === 'delete') {
      const row = rowOf(req.id);
      if (row >= 2) sh.deleteRow(row);
    } else {
      return json_({ ok: false, error: 'unknown action' });
    }
    return json_({ ok: true, gifts: readAll_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
