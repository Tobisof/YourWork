(() => {
  "use strict";

  // Each keyframe is one section (About / Projects / Certificates). The single
  // head morphs shape + color between these as you scroll (unchanged behavior).
  // `expandedRadii` is the shape it grows into when clicked open.
  // expandedRadii is intentionally larger than the viewBox itself (half-size 200,
  // corner distance ~283): the blob overflows the SVG in every direction and gets
  // clipped clean by the viewport edge, so the head color fills the entire screen
  // with no rounded corners peeking the page background through.
  const KEYFRAMES = [
    {
      id: "about",
      bg: "#e6a431",
      head: "#fbe7a0",
      text: "#14141a",
      pupil: "#5c3a21",
      eye: [36, 40],
      radii: [150, 120, 110, 100, 90, 100, 110, 120], // teardrop
      expandedRadii: [340, 400, 340, 400, 340, 400, 340, 400],
    },
    {
      id: "projects",
      bg: "#e4e1f0",
      head: "#6c7a99",
      text: "#14141a",
      pupil: "#2b3a67",
      eye: [33, 37],
      radii: [120, 130, 125, 115, 120, 125, 130, 118], // round
      expandedRadii: [340, 400, 340, 400, 340, 400, 340, 400],
    },
    {
      id: "certificates",
      bg: "#0f2a1c",
      head: "#f2e8ce",
      text: "#f5eede",
      pupil: "#6b1f1f",
      eye: [39, 33],
      radii: [100, 130, 150, 120, 110, 120, 150, 130], // wide dome
      expandedRadii: [340, 400, 340, 400, 340, 400, 340, 400],
    },
  ];

  const PROJECTS = [
    {
      title: "Old Website",
      description: "The previous version of this portfolio - a holographic-card, dark-neon design.",
      link: "old-website/index.html",
      thumb: "assets/projects/old-website.jpg",
    },
    {
      title: "Blog",
      description: "DevOps write-ups on CI/CD, Docker, Kubernetes, OIDC and more, explained in plain language.",
      link: "blog/index.html",
      thumb: "assets/projects/blog.jpg",
    },
    {
      title: "English Flashcards",
      description: "A bilingual EN/PL vocabulary trainer with spaced flashcards and progress tracking.",
      link: "english/index.html",
      thumb: "assets/projects/english.jpg",
    },
    {
      title: "Fade Room",
      description: "Client site for a barber studio - an elegant one-page booking landing page.",
      link: "faderoom/index.html",
      thumb: "assets/projects/faderoom.jpg",
    },
    {
      title: "MineJS",
      description: "A Minecraft-style voxel survival game built from scratch in the browser with Three.js.",
      link: "minecraftai/3/index.html",
      thumb: "assets/projects/minecraftai.jpg",
    },
    {
      title: "Christmas Card Generator",
      description: "Design and preview a personalized Christmas card with custom messages and themes.",
      link: "kartka/index.html",
      thumb: "assets/projects/kartka.jpg",
    },
    {
      title: "PromptJutra",
      description: "An AI-powered tool that generates a full website from a text prompt.",
      link: "promptjutra/index.html",
      thumb: "assets/projects/promptjutra.jpg",
    },
    {
      title: "TwojaWizytówka",
      description: "A guided intake form that turns a business's answers into a ready website brief.",
      link: "wizytowka/index.html",
      thumb: "assets/projects/wizytowka.jpg",
    },
    {
      title: "Stunt Racing",
      description: "A low-poly 3D browser racing game with nitro boosts, stunts, and multiple maps.",
      link: "ai_car_game/index.html",
      thumb: "assets/projects/ai_car_game.jpg",
    },
  ];

  const ABOUT = {
    role: "DevOps Engineer",
    bio: "I connect the worlds of technology and business - from implementations to client relationships. My career path blends business, technology, and automation.",
    stack: "Docker, Kubernetes, Terraform, Bicep, Git, CI/CD, AWS / Azure / GCP, Linux, Ansible, Python, PostgreSQL, Windows, Windows Server",
    cv: "assets/Tobiasz_Lubowski_CV.pdf",
  };

  const TIMELINE = [
    { role: "DevOps Engineer", desc: "Automating, optimizing, and delivering value through modern cloud & CI/CD solutions - hands-on daily with Kubernetes, Terraform, Docker, and GitLab CI/CD pipelines across AWS and Azure.", current: true },
    { role: "Team Leader, KAM Department", desc: "Coordinated strategic projects and led the account team." },
    { role: "Key Account Manager", desc: "Combined presales, analytics, and customer success to grow partnerships." },
    { role: "Implementation Engineer", desc: "Deployed company platforms and prepared infrastructure for go-live." },
    { role: "2nd Line Support Engineer", desc: "Resolved complex client issues across infrastructure and applications." },
    { role: "Software Tester", desc: "Ensured quality of enterprise solutions at the start of my IT journey." },
  ];

  const CERT_INFO = [
    { file: "cert1", title: "IBM DevOps and Software Engineering", issuer: "IBM · Coursera Professional Certificate" },
    { file: "cert2", title: "ITIL Foundation Certificate in IT Service Management", issuer: "ITIL" },
    { file: "cert3", title: "Introduction to DevOps", issuer: "IBM · Coursera" },
    { file: "cert4", title: "Introduction to Software Engineering", issuer: "IBM · Coursera" },
    { file: "cert5", title: "Introduction to Microsoft Azure Cloud Services", issuer: "Microsoft · Coursera" },
    { file: "cert6", title: "Introduction to Agile Development and Scrum", issuer: "IBM · Coursera" },
    { file: "cert7", title: "Getting Started with Git and GitHub", issuer: "IBM · Coursera" },
    { file: "cert8", title: "Deploy Containers by Using Azure Kubernetes Service", issuer: "Microsoft · Coursera" },
    { file: "cert9", title: "Continuous Delivery and Managing Builds with Azure DevOps", issuer: "Coursera Project Network" },
    { file: "cert10", title: "Azure CloudOps: Automating Infrastructure & Cost Control", issuer: "Coursera Instructor Network" },
    { file: "cert_jutra", title: "Wykorzystanie AI w Rozwoju Firmy", issuer: "Google Umiejętności Jutra AI · SGH" },
  ];

  const CERTS = CERT_INFO.map((c) => ({
    title: c.title,
    issuer: c.issuer,
    thumb: `assets/certs-thumb/${c.file}.png`,
    full: `assets/certs/${c.file}.png`,
  }));

  const QUIPS = [
    "Works on my machine 🤷",
    "It's not a bug, it's a feature.",
    "Deploying on Friday... bold move.",
    "kubectl apply -f hope.yaml",
    "99% uptime, 100% anxiety.",
    "Have you tried turning it off and on again?",
    "YAML: where indentation is love, indentation is life.",
    "There is no cloud, just someone else's computer.",
    "CI is green. I don't trust it.",
    "terraform plan... terraform pray.",
    "Merged to main. Fingers crossed.",
    "Docker fixed it. Somehow.",
    "Who set prod as the default context?!",
    "sudo make me a sandwich",
    "Rollback is my cardio.",
  ];

  const CARD_EYE = { cx: [160, 240], cy: 190 };
  const EXPANDED_EYE = { cx: [115, 285], cy: 62 };
  const MAX_PUPIL_OFFSET = 13; // svg user units
  const VIEWBOX_SIZE = 400;
  const IDLE_LOOK_DELAY = 2000; // ms without pointer movement before eyes wander on their own
  const SPREAD_LERP = 0.09;
  const EXPAND_MS = 700;

  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const track = document.querySelector(".scroll-track");
  const headWrap = document.querySelector(".head-wrap");
  const headSvg = document.getElementById("head-svg");
  const copy = [
    document.querySelector(".copy-0"),
    document.querySelector(".copy-1"),
    document.querySelector(".copy-2"),
  ];
  const scrollHint = document.querySelector(".scroll-hint");
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const speechBubble = document.getElementById("speech-bubble");
  const speechText = document.getElementById("speech-text");

  const overlay = document.getElementById("expand-overlay");
  const expandSvg = document.getElementById("expand-svg");
  const closeBtn = document.getElementById("close-btn");
  const panelContent = document.getElementById("panel-content");

  const lightbox = document.getElementById("lightbox");
  const lightboxMedia = document.getElementById("lightbox-media");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = Math.round(lerp(a.r, b.r, t));
    const g = Math.round(lerp(a.g, b.g, t));
    const bl = Math.round(lerp(a.b, b.b, t));
    return `rgb(${r}, ${g}, ${bl})`;
  }

  function pointsFromRadii(radii, cx, cy) {
    const n = radii.length;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push({
        x: cx + Math.cos(angle) * radii[i],
        y: cy + Math.sin(angle) * radii[i],
      });
    }
    return pts;
  }

  // closed Catmull-Rom -> cubic bezier, classic smooth organic blob outline
  function smoothClosedPath(points) {
    const n = points.length;
    let d = `M${points[0].x},${points[0].y} `;
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y} `;
    }
    return d + "Z";
  }

  function contentFor(id) {
    if (id === "about") {
      return `
        <p class="eyebrow">01 - About</p>
        <h1>About Me</h1>
        <div class="about-top">
          <div class="about-left">
            <p class="about-role">${ABOUT.role}</p>
            <p>${ABOUT.bio}</p>
            <p class="about-stack"><strong>Stack:</strong> ${ABOUT.stack}</p>
          </div>
          <div class="about-right">
            <a class="cv-btn cv-btn-compact" href="${ABOUT.cv}" download>Download CV</a>
          </div>
        </div>
        <div class="timeline">
          ${TIMELINE.map(
            (t) => `
            <div class="timeline-item${t.current ? " timeline-current" : ""}">
              <h3>${t.role}</h3>
              <p>${t.desc}</p>
            </div>
          `
          ).join("")}
        </div>
      `;
    }
    if (id === "projects") {
      return `
        <p class="eyebrow">02 - Projects</p>
        <h1>Projects</h1>
        <div class="project-list">
          ${PROJECTS.map(
            (p) => `
            <a class="project-item" href="${p.link}" target="_blank" rel="noopener">
              <img class="project-thumb" src="${p.thumb}" alt="${p.title}" loading="lazy">
              <div class="project-text">
                <h3>${p.title}</h3>
                <p>${p.description}</p>
                <span class="project-link">View project →</span>
              </div>
            </a>
          `
          ).join("")}
        </div>
      `;
    }
    return `
      <p class="eyebrow">03 - Certificates</p>
      <h1>Certificates</h1>
      <div class="cert-grid">
        ${CERTS.map(
          (c, i) => `
          <button class="cert-thumb" type="button" data-cert="${i}" aria-label="${c.title}">
            <img src="${c.thumb}" alt="${c.title}" loading="lazy">
          </button>
        `
        ).join("")}
      </div>
    `;
  }

  function wireContentInteractions(id) {
    if (id !== "certificates") return;
    panelContent.querySelectorAll(".cert-thumb").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(Number(btn.dataset.cert));
      });
    });
  }

  let lightboxIdx = null;

  function showCertAt(idx) {
    lightboxIdx = idx;
    const cert = CERTS[idx];
    lightboxMedia.innerHTML = `<img src="${cert.full}" alt="${cert.title}">`;
    lightboxCaption.innerHTML = `<h3>${cert.title}</h3><p>${cert.issuer}</p>`;
  }

  function openLightbox(idx) {
    showCertAt(idx);
    lightbox.classList.add("visible");
    lightbox.setAttribute("aria-hidden", "false");
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove("visible");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxIdx = null;
  }

  function stepLightbox(delta) {
    if (lightboxIdx === null) return;
    showCertAt((lightboxIdx + delta + CERTS.length) % CERTS.length);
  }

  lightboxClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeLightbox();
  });
  lightboxPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    stepLightbox(-1);
  });
  lightboxNext.addEventListener("click", (e) => {
    e.stopPropagation();
    stepLightbox(1);
  });
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // --- two eye "instances" share the same tracking/blink/idle-look logic:
  // the small scrolling head, and the overlay it grows into when clicked ---
  function makeEye(svgEl, side) {
    return {
      white: svgEl.querySelector(`.eye-${side} .eye-white`),
      pupil: svgEl.querySelector(`.eye-${side} .pupil`),
      cur: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
    };
  }

  const headInst = {
    svg: headSvg,
    blobPath: document.getElementById("blob-path"),
    eyes: { left: makeEye(headSvg, "left"), right: makeEye(headSvg, "right") },
    brows: { left: headSvg.querySelector(".brow-left"), right: headSvg.querySelector(".brow-right") },
    circleMode: false,
    lastRadii: KEYFRAMES[0].radii.slice(),
    lastEyeSize: KEYFRAMES[0].eye.slice(),
  };

  const overlayInst = {
    svg: expandSvg,
    blobPath: document.getElementById("expand-blob"),
    eyes: { left: makeEye(expandSvg, "left"), right: makeEye(expandSvg, "right") },
    brows: { left: expandSvg.querySelector(".brow-left"), right: expandSvg.querySelector(".brow-right") },
    spread: 0,
    spreadTarget: 0,
    seedRadii: KEYFRAMES[0].radii.slice(),
    seedEyeSize: KEYFRAMES[0].eye.slice(),
    section: null,
  };

  // gentle upward arch above an eye, e.g. "M180,140 Q200,128 220,140"
  function browPath(cx, cy, rx, ry) {
    const halfWidth = rx * 0.5;
    const browY = cy - ry - 14;
    return `M${(cx - halfWidth).toFixed(2)},${(browY + 4).toFixed(2)} Q${cx.toFixed(2)},${(browY - 4).toFixed(2)} ${(cx + halfWidth).toFixed(2)},${(browY + 4).toFixed(2)}`;
  }

  let openIdx = null;
  let seedRect = null;
  let savedScrollY = 0;
  let closeTimer = null;
  let lastMoveTime = -Infinity;
  let idleLookActive = false;
  let idleLookTimeout = null;

  function updatePupil(eye) {
    eye.cur.x = lerp(eye.cur.x, eye.target.x, 0.14);
    eye.cur.y = lerp(eye.cur.y, eye.target.y, 0.14);
    eye.pupil.setAttribute("transform", `translate(${eye.cur.x.toFixed(2)},${eye.cur.y.toFixed(2)})`);
  }

  function setEyeTargetFromPointer(inst, clientX, clientY) {
    const svgRect = inst.svg.getBoundingClientRect();
    if (!svgRect.width) return;
    const scale = VIEWBOX_SIZE / svgRect.width;
    for (const key of ["left", "right"]) {
      const eye = inst.eyes[key];
      const r = eye.white.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (clientX - cx) * scale;
      let dy = (clientY - cy) * scale;
      const dist = Math.hypot(dx, dy);
      if (dist > MAX_PUPIL_OFFSET) {
        dx = (dx / dist) * MAX_PUPIL_OFFSET;
        dy = (dy / dist) * MAX_PUPIL_OFFSET;
      }
      eye.target.x = dx;
      eye.target.y = dy;
    }
  }

  window.addEventListener("pointermove", (e) => {
    lastMoveTime = performance.now();
    if (!headInst.circleMode) setEyeTargetFromPointer(headInst, e.clientX, e.clientY);
    if (openIdx !== null) setEyeTargetFromPointer(overlayInst, e.clientX, e.clientY);
  });

  function autoLookStep() {
    if (!idleLookActive) return;
    const lookForward = Math.random() < 0.35;
    const angle = Math.random() * Math.PI * 2;
    const mag = lookForward ? 0 : MAX_PUPIL_OFFSET * (0.5 + Math.random() * 0.5);
    const x = Math.cos(angle) * mag;
    const y = Math.sin(angle) * mag;
    for (const inst of [headInst, overlayInst]) {
      inst.eyes.left.target.x = x;
      inst.eyes.left.target.y = y;
      inst.eyes.right.target.x = x;
      inst.eyes.right.target.y = y;
    }
    idleLookTimeout = setTimeout(autoLookStep, 1800 + Math.random() * 1800);
  }

  function startIdleLook() {
    if (idleLookActive) return;
    idleLookActive = true;
    autoLookStep();
  }

  function stopIdleLook() {
    idleLookActive = false;
    if (idleLookTimeout) clearTimeout(idleLookTimeout);
  }

  headSvg.addEventListener("pointerenter", () => {
    headInst.circleMode = true;
  });
  headSvg.addEventListener("pointerleave", () => {
    headInst.circleMode = false;
  });

  // --- scroll freeze while a section is expanded (classic body-fixed technique) ---
  function freezeScroll() {
    savedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
  }

  function unfreezeScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    window.scrollTo(0, savedScrollY);
  }

  function getCurrentSectionIndex() {
    const trackRect = track.getBoundingClientRect();
    const scrollable = trackRect.height - window.innerHeight;
    const progress = scrollable > 0 ? clamp(-trackRect.top / scrollable, 0, 1) : 0;
    return Math.round(progress * (KEYFRAMES.length - 1));
  }

  function scrollToSection(idx) {
    if (openIdx !== null) return;
    const trackTop = track.offsetTop;
    const scrollable = track.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const frac = idx / (KEYFRAMES.length - 1);
    window.scrollTo({ top: trackTop + frac * scrollable, behavior: "smooth" });
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => scrollToSection(Number(btn.dataset.jump)));
  });

  function computeExpandedRect() {
    // full viewport, edge to edge — no percentages to fuss over
    return { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
  }

  function openSection(idx) {
    openIdx = idx;
    const section = KEYFRAMES[idx];
    clearTimeout(closeTimer);

    seedRect = headSvg.getBoundingClientRect();
    freezeScroll();
    document.body.classList.add("section-open");

    // seed the overlay to exactly match the real head's current look, no transition,
    // so it takes over with zero visible jump
    overlay.style.transition = "none";
    overlay.style.top = `${seedRect.top}px`;
    overlay.style.left = `${seedRect.left}px`;
    overlay.style.width = `${seedRect.width}px`;
    overlay.style.height = `${seedRect.height}px`;

    overlayInst.section = section;
    overlayInst.seedRadii = headInst.lastRadii.slice();
    overlayInst.seedEyeSize = headInst.lastEyeSize.slice();
    overlayInst.spread = 0;
    overlayInst.spreadTarget = 0;
    for (const key of ["left", "right"]) {
      overlayInst.eyes[key].cur = { ...headInst.eyes[key].cur };
      overlayInst.eyes[key].target = { ...headInst.eyes[key].cur };
    }

    overlay.classList.add("visible", "active");
    overlay.setAttribute("aria-hidden", "false");
    headWrap.style.opacity = "0";
    // clear stale inline opacity so the CSS "body.section-open" hide rule can win
    copy.forEach((c) => { c.style.opacity = ""; });
    scrollHint.style.opacity = "";

    panelContent.innerHTML = contentFor(section.id);
    wireContentInteractions(section.id);

    overlay.offsetHeight; // force reflow so the seed position paints before we animate
    overlay.style.transition = "";

    const target = computeExpandedRect();
    overlay.style.top = `${target.top}px`;
    overlay.style.left = `${target.left}px`;
    overlay.style.width = `${target.width}px`;
    overlay.style.height = `${target.height}px`;
    overlayInst.spreadTarget = 1;

    closeBtn.focus();
  }

  function closeSection() {
    if (openIdx === null) return;
    openIdx = null;

    // drop content immediately, but keep the overlay itself (.visible) opaque
    // through the whole shrink — otherwise it vanishes instantly instead of animating
    overlay.classList.remove("active");
    overlay.classList.add("closing");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("section-open");

    overlay.style.top = `${seedRect.top}px`;
    overlay.style.left = `${seedRect.left}px`;
    overlay.style.width = `${seedRect.width}px`;
    overlay.style.height = `${seedRect.height}px`;
    overlayInst.spreadTarget = 0;

    closeTimer = setTimeout(() => {
      overlay.classList.remove("closing", "visible");
      overlayInst.section = null;
      headWrap.style.opacity = "";
      unfreezeScroll();
      headSvg.focus();
    }, EXPAND_MS + 30);
  }

  headSvg.addEventListener("click", (e) => {
    if (openIdx === null) {
      e.stopPropagation();
      openSection(getCurrentSectionIndex());
    }
  });
  headSvg.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && openIdx === null) {
      e.preventDefault();
      e.stopPropagation();
      openSection(getCurrentSectionIndex());
    }
  });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSection();
  });
  document.addEventListener("click", (e) => {
    if (openIdx !== null && !overlay.contains(e.target)) closeSection();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (lightbox.classList.contains("visible")) closeLightbox();
    else if (openIdx !== null) closeSection();
  });
  window.addEventListener("resize", () => {
    if (openIdx === null) return;
    const target = computeExpandedRect();
    overlay.style.top = `${target.top}px`;
    overlay.style.left = `${target.left}px`;
    overlay.style.width = `${target.width}px`;
    overlay.style.height = `${target.height}px`;
  });

  // --- main loop: scroll-driven morph for the head, spread-driven morph for the overlay ---
  function frame() {
    requestAnimationFrame(frame);
    const t = performance.now() / 1000;
    const now = performance.now();
    const wobbleAmp = prefersReducedMotion ? 0 : 3;

    const trackRect = track.getBoundingClientRect();
    const scrollable = trackRect.height - window.innerHeight;
    const progress = scrollable > 0 ? clamp(-trackRect.top / scrollable, 0, 1) : 0;
    const segF = progress * (KEYFRAMES.length - 1);
    const seg = Math.min(Math.floor(segF), KEYFRAMES.length - 2);
    const localT = segF - seg;
    const a = KEYFRAMES[seg];
    const b = KEYFRAMES[seg + 1];

    const nearestIdx = Math.round(segF);
    navItems.forEach((btn, i) => btn.classList.toggle("current", i === nearestIdx));

    // while a section is open, opening, or still closing (overlayInst.section stays
    // set for the whole close animation, not just until the click), match the page
    // background to the head color instead of the section's own bg color — otherwise
    // the area not yet covered by the growing/shrinking overlay flashes a mismatched color
    root.style.setProperty(
      "--bg",
      overlayInst.section ? overlayInst.section.head : lerpColor(a.bg, b.bg, localT)
    );
    const headColor = lerpColor(a.head, b.head, localT);
    root.style.setProperty("--head", headColor);
    root.style.setProperty("--halo", headColor);
    root.style.setProperty("--text", lerpColor(a.text, b.text, localT));
    root.style.setProperty("--pupil", lerpColor(a.pupil, b.pupil, localT));

    const headRadii = a.radii.map((r0, i) => {
      const r1 = b.radii[i];
      const base = lerp(r0, r1, localT);
      return base + Math.sin(t * 0.6 + i * 0.9) * wobbleAmp;
    });
    headInst.blobPath.setAttribute("d", smoothClosedPath(pointsFromRadii(headRadii, 200, 200)));
    headInst.lastRadii = headRadii;

    const headEyeRx = lerp(a.eye[0], b.eye[0], localT);
    const headEyeRy = lerp(a.eye[1], b.eye[1], localT);
    headInst.lastEyeSize = [headEyeRx, headEyeRy];

    for (const [key, cx] of [["left", CARD_EYE.cx[0]], ["right", CARD_EYE.cx[1]]]) {
      const eye = headInst.eyes[key];
      eye.white.setAttribute("rx", headEyeRx.toFixed(2));
      eye.white.setAttribute("ry", headEyeRy.toFixed(2));
      if (headInst.circleMode) {
        const spin = t * 4.2 + (key === "right" ? 0.4 : 0);
        eye.target.x = Math.cos(spin) * MAX_PUPIL_OFFSET * 0.8;
        eye.target.y = Math.sin(spin) * MAX_PUPIL_OFFSET * 0.8;
      }
      updatePupil(eye);
      headInst.brows[key].setAttribute("d", browPath(cx, CARD_EYE.cy, headEyeRx, headEyeRy));
    }

    if (headInst.circleMode) {
      stopIdleLook();
    } else if (now - lastMoveTime > IDLE_LOOK_DELAY) {
      startIdleLook();
    } else {
      stopIdleLook();
    }

    // skip while a section is open: the inline opacity set here would otherwise
    // fight with (and always win over) the CSS rule that hides .copy behind the overlay
    if (openIdx === null) {
      // narrow falloff so a label is fully gone before the next one appears —
      // a wide overlap left both readable at once, looking like a ghosted double-exposure
      const COPY_FADE = 0.3;
      copy.forEach((el, i) => {
        el.style.opacity = clamp(1 - Math.abs(segF - i) / COPY_FADE, 0, 1);
      });
      scrollHint.style.opacity = clamp(1 - progress * 20, 0, 1) * 0.5;
    }

    // --- expand overlay ---
    // opening needs to catch up to the box FAST: expandedRadii hugely overflow the
    // viewBox on purpose (full-bleed color, see KEYFRAMES comment), but only once
    // spread is far enough along — too slow and the box (which grows with its own
    // springy CSS overshoot) briefly outpaces the shape, showing rounded-off gaps
    // at the corners. Closing can stay gradual since the box shrinks slowly at
    // first too, so the shape naturally stays ahead of it.
    const spreadLerpRate = overlayInst.spreadTarget === 1 ? 0.4 : SPREAD_LERP;
    overlayInst.spread = lerp(overlayInst.spread, overlayInst.spreadTarget, spreadLerpRate);
    if (overlayInst.section) {
      const radiiTo = overlayInst.section.expandedRadii;
      const overlayRadii = overlayInst.seedRadii.map((r0, i) => {
        const base = lerp(r0, radiiTo[i], overlayInst.spread);
        return base + Math.sin(t * 0.6 + i * 0.9 + 5) * wobbleAmp;
      });
      overlayInst.blobPath.setAttribute("d", smoothClosedPath(pointsFromRadii(overlayRadii, 200, 200)));

      const cy = lerp(CARD_EYE.cy, EXPANDED_EYE.cy, overlayInst.spread);
      const leftCx = lerp(CARD_EYE.cx[0], EXPANDED_EYE.cx[0], overlayInst.spread);
      const rightCx = lerp(CARD_EYE.cx[1], EXPANDED_EYE.cx[1], overlayInst.spread);
      const eyeScale = lerp(1, 1.04, overlayInst.spread);
      const rx = overlayInst.seedEyeSize[0] * eyeScale;
      const ry = overlayInst.seedEyeSize[1] * eyeScale;

      for (const [key, cx] of [["left", leftCx], ["right", rightCx]]) {
        const eye = overlayInst.eyes[key];
        eye.white.setAttribute("cx", cx.toFixed(2));
        eye.white.setAttribute("cy", cy.toFixed(2));
        eye.white.setAttribute("rx", rx.toFixed(2));
        eye.white.setAttribute("ry", ry.toFixed(2));
        eye.pupil.setAttribute("cx", cx.toFixed(2));
        eye.pupil.setAttribute("cy", cy.toFixed(2));
        updatePupil(eye);
        overlayInst.brows[key].setAttribute("d", browPath(cx, cy, rx, ry));
      }
    }
  }

  requestAnimationFrame(frame);

  // --- idle speech bubble: a random short quip, first after 5s, then repeating ---
  let speechTimer = null;

  function scheduleQuip(delay) {
    clearTimeout(speechTimer);
    speechTimer = setTimeout(showQuip, delay);
  }

  const BUBBLE_SIDES = ["bubble-top", "bubble-left", "bubble-right"];

  function showQuip() {
    if (openIdx !== null) {
      scheduleQuip(2000); // a section is open, try again shortly
      return;
    }
    // left/right bubbles need more side clearance than a narrow phone screen has
    // room for (the head sits close to both edges) — stick to top-only there
    const sides = window.innerWidth < 640 ? ["bubble-top"] : BUBBLE_SIDES;
    speechText.textContent = QUIPS[Math.floor(Math.random() * QUIPS.length)];
    speechBubble.classList.remove(...BUBBLE_SIDES);
    speechBubble.classList.add(sides[Math.floor(Math.random() * sides.length)], "visible");
    setTimeout(() => {
      speechBubble.classList.remove("visible");
      scheduleQuip(8000 + Math.random() * 6000);
    }, 3500);
  }

  scheduleQuip(5000);
})();
