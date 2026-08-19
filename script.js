(() => {
  "use strict";

  // Each keyframe is one section (About / Projects / Certificates), each now
  // themed as a DevOps tool mascot (Docker whale / GitLab fox / Kubernetes
  // wheel). The single head morphs shape + color between these as you scroll.
  // `expandedRadii` is the shape it grows into when clicked open — intentionally
  // larger than the viewBox itself (half-size 200, corner distance ~283) so it
  // overflows and gets clipped clean by the viewport edge, full-bleed color with
  // no rounded corners peeking through. That wash hides any silhouette anyway,
  // so it stays the same oversized values across all three — only the small
  // scrolling head's `radii` need to read as whale / fox / wheel.
  // `eyeMix` is the opacity weight (0-1) of each eye slot for this mascot:
  // Docker = one eye (left slot), GitLab = two eyes, Kubernetes = one eye
  // centered in the wheel hub (center slot). Weights cross-fade with the rest
  // of the keyframe as you scroll between sections.
  const KEYFRAMES = [
    {
      id: "about",
      bg: "#4fa3e8", // livelier, more saturated blue behind the whale
      head: "#2496ed",
      text: "#0b2a4a",
      pupil: "#000000",
      eye: [26, 29], // only feeds the expanded overlay now — shrunk per request
      eyeMix: { left: 1, right: 0, center: 0 },
      browMix: { left: 0, right: 0 }, // real Docker mascot has no eyebrow, just a round eye
      radii: [110, 160, 175, 145, 115, 145, 175, 160], // docker whale: wide, low body
      expandedRadii: [340, 400, 340, 400, 340, 400, 340, 400],
    },
    {
      id: "projects",
      bg: "#f4a750", // livelier, more saturated warm tone behind the fox
      head: "#fc6d26",
      text: "#3a1505",
      pupil: "#8b4a1f",
      eye: [22, 25],
      eyeMix: { left: 1, right: 1, center: 0 },
      browMix: { left: 1, right: 1 },
      radii: [75, 175, 135, 110, 165, 110, 135, 175], // gitlab fox: two peaks, pointed chin
      expandedRadii: [340, 400, 340, 400, 340, 400, 340, 400],
    },
    {
      id: "certificates",
      bg: "#1c4fa0", // richer, more saturated royal blue instead of muted navy
      head: "#eef3fc",
      text: "#eef3fc",
      pupil: "#0b2a4a",
      eye: [27, 27],
      eyeMix: { left: 0, right: 0, center: 1 },
      browMix: { left: 0, right: 0 },
      radii: [138, 132, 138, 132, 138, 132, 138, 132], // kubernetes wheel: near-circular
      expandedRadii: [340, 400, 340, 400, 340, 400, 340, 400],
    },
  ];

  // `category` groups the projects list into three subsections (see
  // contentFor's "projects" branch): projects (just the blog), websites
  // (client-style landing pages), experiments (everything else — games,
  // tools, generators).
  const PROJECTS = [
    {
      title: "Blog",
      description: "DevOps write-ups on CI/CD, Docker, Kubernetes, OIDC and more, explained in plain language.",
      link: "blog/index.html",
      thumb: "assets/projects/blog.jpg",
      category: "projects",
    },
    {
      title: "Old Website",
      description: "The previous version of this portfolio - a holographic-card, dark-neon design.",
      link: "old-website/index.html",
      thumb: "assets/projects/old-website.jpg",
      category: "websites",
    },
    {
      title: "Fade Room",
      description: "Client site for a barber studio - an elegant one-page booking landing page.",
      link: "faderoom/index.html",
      thumb: "assets/projects/faderoom.jpg",
      category: "websites",
    },
    {
      title: "English Flashcards",
      description: "A bilingual EN/PL vocabulary trainer with spaced flashcards and progress tracking.",
      link: "english/index.html",
      thumb: "assets/projects/english.jpg",
      category: "experiments",
    },
    {
      title: "MineJS",
      description: "A Minecraft-style voxel survival game built from scratch in the browser with Three.js.",
      link: "minecraftai/3/index.html",
      thumb: "assets/projects/minecraftai.jpg",
      category: "experiments",
    },
    {
      title: "Christmas Card Generator",
      description: "Design and preview a personalized Christmas card with custom messages and themes.",
      link: "kartka/index.html",
      thumb: "assets/projects/kartka.jpg",
      category: "experiments",
    },
    {
      title: "PromptJutra",
      description: "An AI-powered tool that generates a full website from a text prompt.",
      link: "promptjutra/index.html",
      thumb: "assets/projects/promptjutra.jpg",
      category: "experiments",
    },
    {
      title: "TwojaWizytówka",
      description: "A guided intake form that turns a business's answers into a ready website brief.",
      link: "wizytowka/index.html",
      thumb: "assets/projects/wizytowka.jpg",
      category: "experiments",
    },
    {
      title: "Stunt Racing",
      description: "A low-poly 3D browser racing game with nitro boosts, stunts, and multiple maps.",
      link: "ai_car_game/index.html",
      thumb: "assets/projects/ai_car_game.jpg",
      category: "experiments",
    },
  ];

  const PROJECT_CATEGORIES = [
    { key: "projects", label: "Projects" },
    { key: "websites", label: "Websites" },
    { key: "experiments", label: "Experiments" },
  ];

  const ABOUT = {
    role: "DevOps Engineer",
    bio: "DevOps engineer with over 5 years of IT experience, understanding both business and technical needs. Experienced in cloud infrastructure, Kubernetes, and IaC (primarily Terraform). Background in AWS, Go/Python deployment, and AI automation deployment. Experienced in CCaaS, SaaS, WaaS, and DaaS.",
    stack: "Ansible · Docker · NGINX · HAProxy · Patroni · Keepalived · etcd · PostgreSQL · JasperReports (Tomcat, Jetty) · Linux · Windows Server (AD/GPO administration, FSLogix, NICE DCV) · GitLab CI/CD · Terraform (incl. Terragrunt) · AWS (EKS, EC2, S3, EFS, RDS, IAM, Secrets Manager) · ITIL 4 Foundation · Flask · ZeroTier · Kubernetes · Kubescape · JasperServer · Helm · GitOps (Argo CD / Flux) · Azure (VMs, AKS, Blob Storage, Functions) · Python · Go (learning) · Microservices Architecture · MongoDB / DocumentDB · Grafana Stack / Prometheus / Mimir / Alloy (push-based observability) · PowerShell (VM provisioning via custom_data/UserData) · AutoHotkey (AHK) / UI Automation · Claude Code (agent orchestration, custom Skill authoring) · Knowledge Graph / AI-assisted codebase analysis and automations",
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
  // #head-svg's viewBox height stays fixed at 400 (matching its CSS height,
  // which doesn't change with window width); its viewBox WIDTH is recomputed
  // on load/resize to match the element's actual (now full-window) aspect
  // ratio — see updateHeadViewBox(). expand-svg is unaffected: it's a
  // separate, still-fixed 400x400 canvas.
  const VIEWBOX_HEIGHT = 400;
  const IDLE_LOOK_DELAY = 2000; // ms without pointer movement before eyes wander on their own
  const SPREAD_LERP = 0.09;
  const EXPAND_MS = 700;

  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const track = document.querySelector(".scroll-track");
  const headWrap = document.querySelector(".head-wrap");
  const headSvg = document.getElementById("head-svg");

  // #head-svg now spans the full browser width (see style.css) so the
  // mascot filmstrip can travel edge to edge instead of just sliding within
  // a small centered box. Its viewBox height stays fixed at VIEWBOX_HEIGHT
  // (matching the element's own fixed CSS height), but the viewBox WIDTH is
  // recomputed here to match the element's actual current aspect ratio —
  // keeping 1 viewBox unit worth the same number of real pixels in both
  // directions (no distortion) while giving the filmstrip exactly as much
  // horizontal room as the window currently has.
  let headViewBoxWidth = VIEWBOX_HEIGHT;
  function updateHeadViewBox() {
    const rect = headSvg.getBoundingClientRect();
    if (!rect.height) return;
    headViewBoxWidth = VIEWBOX_HEIGHT * (rect.width / rect.height);
    headSvg.setAttribute("viewBox", `0 0 ${headViewBoxWidth.toFixed(1)} ${VIEWBOX_HEIGHT}`);
  }
  updateHeadViewBox();
  window.addEventListener("resize", updateHeadViewBox);

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
          <a class="cv-btn cv-btn-compact" href="${ABOUT.cv}" download>Download CV</a>
          <p class="about-role">${ABOUT.role}</p>
          <p>${ABOUT.bio}</p>
          <p class="about-stack"><strong>Stack:</strong> ${ABOUT.stack}</p>
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
        ${PROJECT_CATEGORIES.map((cat) => {
          const items = PROJECTS.filter((p) => p.category === cat.key);
          if (!items.length) return "";
          return `
            <h2 class="project-category">${cat.label}</h2>
            <div class="project-list">
              ${items.map(
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
        }).join("")}
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
  // the small scrolling head, and the overlay it grows into when clicked.
  // A third "center" slot (the Kubernetes wheel-hub eye) follows the same
  // shape — each instance now carries three eye slots, only some of which
  // are opaque at any given scroll position (see eyeMix in KEYFRAMES).
  function makeEye(svgEl, side) {
    return {
      group: svgEl.querySelector(`.eye-${side}`),
      white: svgEl.querySelector(`.eye-${side} .eye-white`),
      pupil: svgEl.querySelector(`.eye-${side} .pupil`),
      cur: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
    };
  }

  // per-mascot layout: native width of its own local coordinate space (used
  // to center it horizontally within its filmstrip slot), fixed vertical
  // offset (unaffected by window width, so it stays a plain constant), and
  // render scale — same values previously baked into each mascot's static
  // HTML transform, now applied dynamically every frame in frame() since
  // centering depends on the current (window-width-driven) viewBox width.
  const MASCOT_NATIVE_W = [300, 200, 200]; // docker, gitlab, k8s
  const MASCOT_CENTER_Y = [55, 1, -15];
  const MASCOT_SCALE = [1.45, 2.15, 2.15];

  // the small scrolling head no longer has its own generic eye system — each
  // mascot's eyes are baked directly into its logo-accurate markup (see
  // index.html) with a fixed brand-appropriate color, so headInst only needs
  // to track each mascot's slide layer for the scroll-driven filmstrip pan
  const headInst = {
    svg: headSvg,
    mascotSlides: [
      headSvg.querySelector(".mascot-docker .mascot-slide"),
      headSvg.querySelector(".mascot-gitlab .mascot-slide"),
      headSvg.querySelector(".mascot-k8s .mascot-slide"),
    ],
  };

  const overlayInst = {
    svg: expandSvg,
    blobPath: document.getElementById("expand-blob"),
    eyes: { left: makeEye(expandSvg, "left"), right: makeEye(expandSvg, "right"), center: makeEye(expandSvg, "center") },
    brows: { left: expandSvg.querySelector(".brow-left"), right: expandSvg.querySelector(".brow-right") },
    spread: 0,
    spreadTarget: 0,
    seedRadii: KEYFRAMES[0].radii.slice(),
    seedEyeSize: KEYFRAMES[0].eye.slice(),
    section: null,
  };

  // the small head's mascot eyes track the cursor too, same as the overlay's
  // — each pupil sits inside its mascot's own scaled wrapper group (see
  // index.html, scale 1.2 for the whale / 1.8 for the fox and wheel), so the
  // on-screen pixel delta has to be divided by that group's own scale before
  // being applied as the pupil's local translate, or it would overshoot
  // proportionally to how zoomed-in that particular mascot is drawn.
  function makeLogoEye(whiteId, pupilId, groupScale, maxOffset) {
    return {
      white: document.getElementById(whiteId),
      pupil: document.getElementById(pupilId),
      groupScale,
      maxOffset,
      cur: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
    };
  }

  const logoEyes = [
    makeLogoEye("docker-eye-white", "docker-pupil", 1.45, 6),
    makeLogoEye("gitlab-eye-white-l", "gitlab-pupil-l", 2.15, 5),
    makeLogoEye("gitlab-eye-white-r", "gitlab-pupil-r", 2.15, 5),
    makeLogoEye("k8s-eye-white", "k8s-pupil", 2.15, 9),
  ];

  function setLogoEyeTargets(clientX, clientY) {
    const svgRect = headSvg.getBoundingClientRect();
    if (!svgRect.height) return;
    // height is the fixed reference dimension now (width is dynamic/full-page)
    const viewboxScale = VIEWBOX_HEIGHT / svgRect.height;
    for (const eye of logoEyes) {
      const r = eye.white.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = ((clientX - cx) * viewboxScale) / eye.groupScale;
      let dy = ((clientY - cy) * viewboxScale) / eye.groupScale;
      const dist = Math.hypot(dx, dy);
      if (dist > eye.maxOffset) {
        dx = (dx / dist) * eye.maxOffset;
        dy = (dy / dist) * eye.maxOffset;
      }
      eye.target.x = dx;
      eye.target.y = dy;
    }
  }

  function updateLogoEyePupils() {
    for (const eye of logoEyes) {
      eye.cur.x = lerp(eye.cur.x, eye.target.x, 0.14);
      eye.cur.y = lerp(eye.cur.y, eye.target.y, 0.14);
      eye.pupil.setAttribute("transform", `translate(${eye.cur.x.toFixed(2)},${eye.cur.y.toFixed(2)})`);
    }
  }

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
    // only ever called with overlayInst (expand-svg), which stays a fixed
    // square 400x400 canvas, so width and height are equivalent here
    const svgRect = inst.svg.getBoundingClientRect();
    if (!svgRect.width) return;
    const scale = VIEWBOX_HEIGHT / svgRect.width;
    for (const key of ["left", "right", "center"]) {
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
    setLogoEyeTargets(e.clientX, e.clientY);
    if (openIdx !== null) setEyeTargetFromPointer(overlayInst, e.clientX, e.clientY);
  });

  function autoLookStep() {
    if (!idleLookActive) return;
    const lookForward = Math.random() < 0.35;
    const angle = Math.random() * Math.PI * 2;
    // a shared random direction + magnitude fraction, scaled per-eye by each
    // eye's own comfortable offset radius (the logo eyes are much smaller
    // than the overlay's, so they can't share one absolute magnitude)
    const magFrac = lookForward ? 0 : 0.5 + Math.random() * 0.5;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const ox = dirX * MAX_PUPIL_OFFSET * magFrac;
    const oy = dirY * MAX_PUPIL_OFFSET * magFrac;
    overlayInst.eyes.left.target.x = ox;
    overlayInst.eyes.left.target.y = oy;
    overlayInst.eyes.right.target.x = ox;
    overlayInst.eyes.right.target.y = oy;
    overlayInst.eyes.center.target.x = ox;
    overlayInst.eyes.center.target.y = oy;
    for (const eye of logoEyes) {
      eye.target.x = dirX * eye.maxOffset * magFrac;
      eye.target.y = dirY * eye.maxOffset * magFrac;
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

    // seed from the currently-visible MASCOT's own box, not headSvg's — the
    // SVG itself now spans the full window width (see style.css), so its own
    // bounding rect would seed the FLIP animation from a giant sliver
    // instead of growing out of the actual clicked icon
    seedRect = headInst.mascotSlides[idx].getBoundingClientRect();
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
    // the head no longer has one continuously-morphing shape to seed from
    // (see the mascot cross-fade comment in frame()) — its own keyframe's
    // radii make an equally good starting point for the FLIP-zoom seed,
    // since that shape is only ever visible for an instant before the
    // overlay overflows into a full-bleed color wash anyway
    overlayInst.seedRadii = section.radii.slice();
    // same idea as seedRadii above: the head has no tracked eye size/position
    // to seed from anymore, so start the overlay's pupils centered and let
    // them settle from there — a small, one-time detail compared to the
    // overlay's own FLIP-zoom animation, which is the real focus of opening
    overlayInst.seedEyeSize = section.eye.slice();
    overlayInst.spread = 0;
    overlayInst.spreadTarget = 0;
    for (const key of ["left", "right", "center"]) {
      overlayInst.eyes[key].cur = { x: 0, y: 0 };
      overlayInst.eyes[key].target = { x: 0, y: 0 };
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
    // deliberately NOT resetting spreadTarget back to 0 here — the overlay's
    // internal shape stays fully expanded (still hugely overflowing the
    // viewBox) the whole time the box shrinks via CSS, so it always renders
    // as a clean full-bleed color fill with no visible silhouette. Letting
    // it shrink back toward the small seed shape (the old, pre-accurate-logo
    // abstract blob radii, still used only to seed the FLIP animation) made
    // that old shape briefly flash back into view right as a section closed.
    // openSection() already resets spread/spreadTarget to 0 fresh on the
    // next open, so nothing needs resetting here.

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

    // the three mascot logos are static shapes (see index.html) laid out as
    // one continuous horizontal filmstrip spanning the full window width:
    // mascot i's "world" position is i * headViewBoxWidth (one full screen
    // width per icon), the "camera" position is segF * headViewBoxWidth, and
    // its on-screen offset is just the difference between the two — a
    // direct, continuous 1:1 mapping of scroll position to horizontal
    // position, same as physically dragging a filmstrip sideways. No
    // opacity fading at all (an earlier cross-fade version read as a
    // flicker, not real motion): each mascot stays fully opaque and simply
    // slides out of the (now full-width) SVG viewBox once it's off to the
    // side. Each mascot's own centering + scale is folded into this same
    // transform (recomputed every frame, since it depends on the current
    // viewBox width) rather than being a separate static attribute.
    headInst.mascotSlides.forEach((el, i) => {
      const scale = MASCOT_SCALE[i];
      const slotX = (i - segF) * headViewBoxWidth;
      const centerX = (headViewBoxWidth - MASCOT_NATIVE_W[i] * scale) / 2;
      const x = (slotX + centerX).toFixed(1);
      el.setAttribute("transform", `translate(${x},${MASCOT_CENTER_Y[i]}) scale(${scale})`);
    });

    updateLogoEyePupils();

    if (now - lastMoveTime > IDLE_LOOK_DELAY) {
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
      // the center (wheel-hub) eye sits at the blob's true center while small,
      // same as on the scrolling head, but slides up to the same row as the
      // other two once expanded — otherwise it'd sit behind the panel text
      const centerCy = lerp(200, EXPANDED_EYE.cy, overlayInst.spread);
      const leftCx = lerp(CARD_EYE.cx[0], EXPANDED_EYE.cx[0], overlayInst.spread);
      const rightCx = lerp(CARD_EYE.cx[1], EXPANDED_EYE.cx[1], overlayInst.spread);
      const eyeScale = lerp(1, 1.04, overlayInst.spread);
      const rx = overlayInst.seedEyeSize[0] * eyeScale;
      const ry = overlayInst.seedEyeSize[1] * eyeScale;

      for (const [key, cx, cy2] of [["left", leftCx, cy], ["right", rightCx, cy], ["center", 200, centerCy]]) {
        const eye = overlayInst.eyes[key];
        eye.white.setAttribute("cx", cx.toFixed(2));
        eye.white.setAttribute("cy", cy2.toFixed(2));
        eye.white.setAttribute("rx", rx.toFixed(2));
        eye.white.setAttribute("ry", ry.toFixed(2));
        eye.pupil.setAttribute("cx", cx.toFixed(2));
        eye.pupil.setAttribute("cy", cy2.toFixed(2));
        updatePupil(eye);
        eye.group.style.opacity = overlayInst.section.eyeMix[key];
        if (key !== "center") {
          overlayInst.brows[key].setAttribute("d", browPath(cx, cy2, rx, ry));
          overlayInst.brows[key].style.opacity = overlayInst.section.browMix[key];
        }
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
