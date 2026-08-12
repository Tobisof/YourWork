document.addEventListener('DOMContentLoaded', () => {

    // --- 0. Smooth Scroll (Lenis) & Nav Marker ---
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        direction: 'vertical',
    });
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Integrate anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) lenis.scrollTo(target);
        });
    });

    // Sliding Marker Logic
    const marker = document.getElementById('navMarker');
    // Only target the center links for the marker animation
    const navLinks = document.querySelectorAll('.nav-center .nav-link');
    const navList = document.querySelector('.nav-list');

    function moveMarker(el) {
        if (!marker || !el) return;
        // Ensure we calculate width/left correctly even if just loaded
        const rect = el.getBoundingClientRect();
        const parentRect = el.closest('.nav-center').getBoundingClientRect();

        // Relative calculations (safer than offsetLeft sometimes due to flex gaps)
        marker.style.width = el.offsetWidth + 'px';
        marker.style.left = el.offsetLeft + 'px'; // offsetLeft is relative to offsetParent (nav-center or nav-list)
        marker.style.opacity = '1';
    }

    navLinks.forEach(link => {
        link.addEventListener('mouseenter', (e) => moveMarker(e.target));
    });

    if (navList) {
        navList.addEventListener('mouseleave', () => {
            const active = document.querySelector('.nav-link.active');
            if (active) {
                moveMarker(active);
            } else {
                if (marker) marker.style.opacity = '0';
            }
        });
    }

    // Active state on scroll & Init
    function setActiveLink() {
        // Find if any section is currently active manually first
        let currentId = '';
        ['hero', 'projects', 'contact'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const rect = el.getBoundingClientRect();
                // Simple check if section is effectively in view (near top)
                if (rect.top <= window.innerHeight * 0.4 && rect.bottom >= window.innerHeight * 0.1) {
                    currentId = id;
                }
            }
        });

        if (currentId) {
            navLinks.forEach(link => link.classList.remove('active'));
            const activeLink = document.querySelector(`.nav-link[href="#${currentId}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
                moveMarker(activeLink);
            }
        }
    }

    // Initial call to set marker position immediately
    // Use setTimeout to skip one frame ensuring layout is painted
    setTimeout(setActiveLink, 100);
    window.addEventListener('resize', setActiveLink);

    const navObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => link.classList.remove('active'));
                const id = entry.target.id;
                const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                    moveMarker(activeLink);
                }
            }
        });
    }, { threshold: 0.15, rootMargin: "-10% 0px -40% 0px" });

    ['hero', 'projects', 'contact'].forEach(id => {
        const el = document.getElementById(id);
        if (el) navObserver.observe(el);
    });

    /* --- Useless Toggle Logic (GAMIFIED) --- */
    const toggle = document.getElementById('useless-toggle');
    const links = document.getElementById('contact-links');
    const toggleMsg = document.getElementById('toggle-msg');
    let toggleDelay = 400; // Starting delay

    if (toggle && links) {
        const label = toggle.nextElementSibling;

        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                // 1. Briefly show links
                links.style.opacity = '1';
                links.style.pointerEvents = 'auto';

                // 2. Trigger Red Glow
                if (label) label.classList.add('error-glow');

                // 3. Show Challenge Message
                if (toggleMsg) {
                    toggleMsg.style.opacity = '1';
                    toggleMsg.textContent = `You have to be faster! 😈 (${toggleDelay / 1000}s)`;
                }

                // 4. Turn it off automatically (Increasing delay)
                setTimeout(() => {
                    toggle.checked = false;
                    links.style.opacity = '0.3';
                    links.style.pointerEvents = 'none';

                    // Cleanup Glow
                    if (label) label.classList.remove('error-glow');
                    if (toggleMsg) toggleMsg.style.opacity = '0'; // Hide msg

                    // Increase Difficulty
                    toggleDelay += 500;
                }, toggleDelay);
            }
        });
    }

    /* --- Phone Dialing Logic --- */
    const callBtn = document.getElementById('call-btn');
    const callingScreen = document.getElementById('calling-screen');
    const callingNumberDisp = document.getElementById('calling-number-disp');
    const typedDisplay = document.getElementById('typed-display'); // Secondary display below phone
    const endCallBtn = document.getElementById('end-call-btn');
    const targetNumber = "666372754";

    if (callBtn && callingScreen) {
        callBtn.addEventListener('click', () => {
            // 1. Show Calling Screen
            callingScreen.classList.add('active');

            // 2. Start Typing Animation (on both displays)
            if (callingNumberDisp) callingNumberDisp.textContent = "+48 ";
            if (typedDisplay) typedDisplay.textContent = "+48 ";

            let i = 0;
            const typeInterval = setInterval(() => {
                if (i < targetNumber.length) {
                    const digit = targetNumber.charAt(i) + " ";
                    if (callingNumberDisp) callingNumberDisp.textContent += digit;
                    if (typedDisplay) typedDisplay.textContent += digit;
                    i++;
                } else {
                    clearInterval(typeInterval);
                }
            }, 300); // 300ms delay per digit

            // Allow hiding it to reset
            endCallBtn.addEventListener('click', () => {
                callingScreen.classList.remove('active');
                clearInterval(typeInterval);
            }, { once: true });
        });
    }


    // --- 1. Animacja Karty Holograficznej (Parallax 3D) ---
    const card = document.getElementById('holo-card');
    const hero = document.getElementById('hero');

    if (card && hero) {
        // Używamy window, aby ruch był płynniejszy na całym ekranie
        window.addEventListener('mousemove', (e) => {
            const x = e.clientX;
            const y = e.clientY;

            const midX = window.innerWidth / 2;
            const midY = window.innerHeight / 2;

            // Obliczamy rotację w obu osiach
            const rotateY = (x - midX) / 20; // Ruch lewo/prawo
            const rotateX = -(y - midY) / 20; // Ruch góra/dół (odwrócony dla naturalnego efektu)

            requestAnimationFrame(() => {
                card.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
            });
        });

        // Reset po wyjechaniu myszką
        hero.addEventListener('mouseleave', () => {
            card.style.transform = `rotateY(0deg) rotateX(0deg)`;
        });
    }

    // Mobile menu toggle removed (NavBar redesigned)

    // --- 2. Obsługa Drukarki CV ---
    const cvBtn = document.getElementById('cv-btn');
    const paper = document.getElementById('cv-paper');
    const printerBase = document.querySelector('.printer-base');
    const btnText = cvBtn ? cvBtn.querySelector('.btn-text') : null;
    const cvPath = 'assets/cv.pdf';

    if (cvBtn && btnText) {
        // Initial Text
        btnText.textContent = "Print CV";

        cvBtn.addEventListener('click', () => {
            if (!paper.classList.contains('printed')) {
                // Start drukowania
                btnText.textContent = "Printing...";
                if (printerBase) printerBase.classList.add('printing');

                // Animacja wysuwania papieru
                setTimeout(() => {
                    paper.classList.add('printed');
                }, 500);

                // Zakończenie drukowania (po 2.5s)
                setTimeout(() => {
                    if (printerBase) printerBase.classList.remove('printing');
                    btnText.textContent = "Download CV";
                    // Change to green or accent color
                    cvBtn.style.background = "#22c55e";
                    cvBtn.style.borderColor = "#22c55e";
                    cvBtn.style.color = "#fff";
                    cvBtn.style.boxShadow = "0 0 30px rgba(34, 197, 94, 0.6)";
                }, 2500);
            } else {
                // Pobieranie pliku
                const link = document.createElement('a');
                link.href = cvPath;
                link.download = 'Tobiasz_Lubowski_CV.pdf';
                link.click();
            }
        });
    }

    // --- 3. Zmiana Motywu (Dark/Light) ---
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('light-theme');

        // Zmiana ikony
        if (body.classList.contains('light-theme')) {
            themeToggle.textContent = "☀️";
        } else {
            themeToggle.textContent = "🌗";
        }
    });

    // --- 4. Animacje Scrolla (Reveal) ---
    const observerOptions = {
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => observer.observe(el));

    // --- 5. "Hacker" Binary Shuffle Effect ---
    const letters = "0101010101010101"; // The characters to shuffle through (binaries)

    document.querySelectorAll(".hacker-text").forEach(header => {
        header.addEventListener("mouseover", event => {
            let iteration = 0;
            const originalText = event.target.dataset.value;

            clearInterval(event.target.interval); // Clear any running animation

            event.target.interval = setInterval(() => {
                event.target.innerText = originalText
                    .split("")
                    .map((letter, index) => {
                        if (index < iteration) {
                            return originalText[index];
                        }
                        return letters[Math.floor(Math.random() * letters.length)];
                    })
                    .join("");

                if (iteration >= originalText.length) {
                    clearInterval(event.target.interval);
                }

                iteration += 1 / 3; // Controls speed (lower = slower)
            }, 30);
        });
    });
});