/* Christmas Presents
 * People: data/people.csv (in repo).
 * Gifts: shared Google Sheet via Apps Script web app (API_URL).
 * If API_URL is empty, gifts are kept only in this browser (localStorage).
 */
(() => {
  // Wklej tutaj URL wdrożenia Apps Script (kończy się na /exec):
  const API_URL = 'https://script.google.com/macros/s/AKfycbxlMmXTCjfGKX4iF0mzdx2wRdR-UHlSv5YkO30h_Q1Vgx4y3PDb7WmWbT-TM3cHQ0U/exec';
  const STORE_KEY = 'xmas-gifts-v1';
  const $ = (id) => document.getElementById(id);

  let people = [];
  let gifts = [];

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') q = false;
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((v) => v !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some((v) => v !== '')) rows.push(row);
    const [head, ...body] = rows;
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
  }

  /* ---------- storage ---------- */
  function saveLocal() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(gifts)); } catch (e) { /* private mode */ }
  }
  function loadLocal() {
    try { const v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : []; } catch (e) { return []; }
  }

  async function fetchGifts() {
    if (!API_URL) return loadLocal();
    const r = await fetch(API_URL, { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'błąd serwera');
    return d.gifts;
  }

  // action: 'add' | 'update' | 'delete'
  async function mutate(req) {
    if (!API_URL) {
      if (req.action === 'add') gifts.push({ ...req.gift, id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
      else if (req.action === 'update') Object.assign(gifts.find((g) => g.id === req.gift.id) || {}, req.gift);
      else if (req.action === 'delete') gifts = gifts.filter((g) => g.id !== req.id);
      saveLocal();
      return;
    }
    // text/plain avoids a CORS preflight, which Apps Script does not answer
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'błąd serwera');
    gifts = d.gifts;
  }

  async function load() {
    const p = await fetch('data/people.csv', { cache: 'no-store' }).then((r) => r.text());
    people = parseCSV(p);
    gifts = await fetchGifts();
  }

  // refresh gifts in the background (others may have added something)
  async function refresh() {
    try { gifts = await fetchGifts(); route(false); } catch (e) { /* keep what we have */ }
  }

  /* ---------- rendering ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const countFor = (id) => gifts.filter((g) => g.personId === id).length;
  const plural = (n) => n === 1 ? 'pomysł' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'pomysły' : 'pomysłów';

  function renderList() {
    $('view-list').hidden = false;
    $('view-person').hidden = true;
    $('subtitle').hidden = false;
    $('people').innerHTML = people.map((p) => {
      const n = countFor(p.id);
      return `<li><a class="person" href="#/${encodeURIComponent(p.id)}">
        <span class="avatar">${esc(p.emoji || '🎁')}</span>
        <span class="name">${esc(p.name)}</span>
        <span class="badge ${n ? '' : 'zero'}">${n} ${plural(n)}</span>
      </a></li>`;
    }).join('');
  }

  function renderPerson(person, keepForm = false) {
    $('view-list').hidden = true;
    $('view-person').hidden = false;
    $('subtitle').hidden = true;
    $('p-emoji').textContent = person.emoji || '🎁';
    $('p-name').textContent = person.name;
    document.title = `${person.name} – Christmas Presents`;

    const mine = gifts.filter((g) => g.personId === person.id);
    $('empty').hidden = mine.length > 0;
    $('gifts').innerHTML = mine.map((g) => {
      const safeLink = /^https?:\/\//i.test(g.link) ? g.link : '';
      return `<li class="gift" data-id="${esc(g.id)}">
        <span class="icon">🎁</span>
        <div class="body">
          <div class="title">${esc(g.title)}</div>
          ${g.note ? `<div class="note">${esc(g.note)}</div>` : ''}
          ${safeLink ? `<a class="link" href="${esc(safeLink)}" target="_blank" rel="noopener">${esc(safeLink)}</a>` : ''}
        </div>
        <div class="actions">
          <button class="icon-btn" data-act="edit" title="Edytuj" aria-label="Edytuj">✏️</button>
          <button class="icon-btn" data-act="del" title="Usuń" aria-label="Usuń">🗑️</button>
        </div>
      </li>`;
    }).join('');
    if (!keepForm) resetForm();
  }

  function currentPerson() {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    return people.find((p) => p.id === id);
  }

  function route(scroll = true) {
    const p = currentPerson();
    if (p) renderPerson(p, !scroll);
    else { document.title = 'Christmas Presents'; renderList(); }
    if (scroll) window.scrollTo(0, 0);
  }

  function setBusy(on, msg = '') {
    $('f-submit').disabled = on;
    $('gift-form').classList.toggle('busy', on);
    $('f-status').textContent = msg;
  }

  /* ---------- form ---------- */
  function resetForm() {
    $('gift-form').reset();
    $('f-id').value = '';
    $('form-title').textContent = 'Dodaj pomysł na prezent';
    $('f-submit').textContent = '🎁 Dodaj';
    $('f-cancel').hidden = true;
    $('f-status').textContent = '';
  }

  $('gift-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const person = currentPerson();
    if (!person) return;
    const data = {
      title: $('f-title').value.trim(),
      link: $('f-link').value.trim(),
      note: $('f-note').value.trim(),
    };
    if (!data.title) return;
    const id = $('f-id').value;
    setBusy(true, 'Zapisywanie…');
    try {
      await mutate(id ? { action: 'update', gift: { id, ...data } } : { action: 'add', gift: { personId: person.id, ...data } });
      setBusy(false);
      renderPerson(person);
    } catch (err) {
      setBusy(false, '⚠️ Nie udało się zapisać. Sprawdź internet i spróbuj ponownie.');
    }
  });

  $('f-cancel').addEventListener('click', resetForm);

  $('gifts').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.gift').dataset.id;
    const g = gifts.find((x) => x.id === id);
    if (!g) return;
    if (btn.dataset.act === 'edit') {
      $('f-id').value = g.id;
      $('f-title').value = g.title;
      $('f-link').value = g.link || '';
      $('f-note').value = g.note || '';
      $('form-title').textContent = 'Edytuj pomysł';
      $('f-submit').textContent = '💾 Zapisz';
      $('f-cancel').hidden = false;
      $('f-title').focus();
      $('gift-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (btn.dataset.act === 'del') {
      const li = btn.closest('.gift');
      if (li.dataset.confirm) {
        li.classList.add('removing');
        mutate({ action: 'delete', id })
          .then(() => renderPerson(currentPerson()))
          .catch(() => { li.classList.remove('removing'); $('f-status').textContent = '⚠️ Nie udało się usunąć. Spróbuj ponownie.'; });
      } else {
        li.dataset.confirm = '1';
        btn.textContent = '✔️';
        btn.title = 'Kliknij ponownie, aby usunąć';
        setTimeout(() => { if (li.isConnected) { delete li.dataset.confirm; btn.textContent = '🗑️'; } }, 2500);
      }
    }
  });

  $('home-link').addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; });
  window.addEventListener('hashchange', () => { route(); refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  /* ---------- snow ---------- */
  function snow() {
    const cv = $('snow');
    const ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w, h, flakes = [];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round((w * h) / 9000);
      while (flakes.length < target) flakes.push(make(true));
      flakes.length = Math.min(flakes.length, target);
    };
    const make = (anyY) => {
      const r = Math.random() * 2.6 + 0.8;
      return { x: Math.random() * w, y: anyY ? Math.random() * h : -10, r, vy: r * 0.35 + 0.25, phase: Math.random() * Math.PI * 2, sway: Math.random() * 0.6 + 0.2, a: Math.random() * 0.5 + 0.45 };
    };
    let t = 0;
    const frame = () => {
      t += 0.01;
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.y += f.vy;
        f.x += Math.sin(t + f.phase) * f.sway * 0.5;
        if (f.y > h + 5) Object.assign(f, make(false));
        if (f.x > w + 5) f.x = -5; else if (f.x < -5) f.x = w + 5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${f.a})`;
        ctx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    };
    addEventListener('resize', resize);
    resize();
    frame();
  }

  snow();
  load().then(route).catch((err) => {
    $('people').innerHTML = `<li style="color:#fff">Nie udało się wczytać danych (${esc(err.message)}). Otwórz stronę przez serwer HTTP.</li>`;
  });
})();
