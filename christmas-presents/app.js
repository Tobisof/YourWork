/* Christmas Presents
 * Data: data/people.csv + data/gifts.csv (seed, committed in repo).
 * Changes made in the browser are stored in localStorage.
 */
(() => {
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
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(gifts)); } catch (e) { /* private mode */ }
  }
  function loadLocal() {
    try { const v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  async function load() {
    const [p, g] = await Promise.all([
      fetch('data/people.csv', { cache: 'no-store' }).then((r) => r.text()),
      fetch('data/gifts.csv', { cache: 'no-store' }).then((r) => r.ok ? r.text() : 'id,personId,title,link,note\n'),
    ]);
    people = parseCSV(p);
    gifts = loadLocal() ?? parseCSV(g);
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

  function renderPerson(person) {
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
    resetForm();
  }

  function currentPerson() {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    return people.find((p) => p.id === id);
  }

  function route() {
    const p = currentPerson();
    if (p) renderPerson(p);
    else { document.title = 'Christmas Presents'; renderList(); }
    window.scrollTo(0, 0);
  }

  /* ---------- form ---------- */
  function resetForm() {
    $('gift-form').reset();
    $('f-id').value = '';
    $('form-title').textContent = 'Dodaj pomysł na prezent';
    $('f-submit').textContent = '🎁 Dodaj';
    $('f-cancel').hidden = true;
  }

  $('gift-form').addEventListener('submit', (e) => {
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
    if (id) {
      Object.assign(gifts.find((g) => g.id === id), data);
    } else {
      gifts.push({ id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), personId: person.id, ...data });
    }
    save();
    renderPerson(person);
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
        gifts = gifts.filter((x) => x.id !== id);
        save();
        renderPerson(currentPerson());
      } else {
        li.dataset.confirm = '1';
        btn.textContent = '✔️';
        btn.title = 'Kliknij ponownie, aby usunąć';
        setTimeout(() => { if (li.isConnected) { delete li.dataset.confirm; btn.textContent = '🗑️'; } }, 2500);
      }
    }
  });

  $('home-link').addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; });
  window.addEventListener('hashchange', route);

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
