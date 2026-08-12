/**
 * KARTMA - APP.JS
 * Handles application logic, state via URL hash, and animations.
 */

/* --- CONFIGURATION --- */
const APP_CONFIG = {
    assetsPath: 'assets/', // Not strictly needed for styles but good to keep if we add textures later
    styles: [
        { id: 'style-classic', name: 'Klasyk', color: '#b91c1c' }, // Red
        { id: 'style-frost', name: 'Mróz', color: '#0ea5e9' },   // Blue
        { id: 'style-modern', name: 'Modern', color: '#16a34a' }, // Green
        { id: 'style-gold', name: 'Złoto', color: '#d97706' }, // Gold
        { id: 'style-magic', name: 'Magia', color: '#9333ea' },  // Purple
        { id: 'style-candy', name: 'Cukierek', color: '#ef4444' }, // Red/White
        { id: 'style-forest', name: 'Las', color: '#14532d' }, // Deep Green
        { id: 'style-ginger', name: 'Ciacho', color: '#92400e' } // Brown
    ],
    defaults: {
        to: '',
        sender: '',
        message: 'Wesołych Świąt!\nSpełnienia marzeń i dużo radości.',
        style: 'style-classic',
        style: 'style-classic'
    },
    suggestions: [
        "Wesołych Świąt! Niech ten czas będzie pełen magii, radości i ciepła w gronie najbliższych.",
        "Zdrowia, szczęścia, pomyślności w Nowym Roku oraz spełnienia wszystkich, nawet tych najskrytszych marzeń.",
        "Niech pierwsza gwiazdka na niebie przyniesie Ci spokój i radość, a nadchodzący rok same sukcesy!",
        "Dużo prezentów pod choinką, smacznego karpia i niezapomnianych chwil w rodzinnym gronie.",
        "Renifera z czerwonym nosem, góry prezentów, szalonego Sylwestra i worka pieniędzy w Nowym Roku!",
        "Spokojnych i radosnych Świąt Bożego Narodzenia oraz wszelkiej pomyślności w nadchodzącym Roku."
    ]
};

/* --- STATE MANAGEMENT --- */
const state = { ...APP_CONFIG.defaults }; // Current active state

/**
 * Decodes URL Hash into a state object
 */
async function loadStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    // 1. Short Link Strategy (?id=xyz)
    if (params.has('id')) {
        const id = params.get('id');
        try {
            const response = await fetch(`cards/${id}.json`);
            if (!response.ok) throw new Error('Card not found');
            const data = await response.json();

            // Map JSON keys back to state
            return {
                to: data.to || '',
                sender: data.s || '',
                message: data.m || '',
                style: data.st || APP_CONFIG.defaults.style
            };
        } catch (e) {
            console.error("Failed to load short link", e);
            alert("Nie znaleziono kartki lub wygasła. Przekierowanie do kreatora.");
            window.location.search = ''; // clear bad id
            return null;
        }
    }

    // 2. Hash Strategy (Legacy/Fallback)
    if (window.location.hash && window.location.hash.length > 2) {
        try {
            const hash = window.location.hash.substring(1);
            const p = new URLSearchParams(hash);
            if (!p.has('m')) return null;

            return {
                to: p.get('to') || '',
                sender: p.get('s') || '',
                message: p.get('m') || '',
                style: p.get('st') || APP_CONFIG.defaults.style
            };
        } catch (e) {
            console.error("Error parsing hash", e);
            return null;
        }
    }

    return null;
}

/**
 * Generates regular Hash Link (Fallback)
 */
function getHashUrl() {
    const params = new URLSearchParams();
    params.set('to', state.to);
    params.set('s', state.sender);
    params.set('m', state.message);
    params.set('st', state.style);
    return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/**
 * Generates Short Link via PHP, falls back to Hash
 */
async function generateLink() {
    const btn = document.getElementById('btn-generate');
    const originalText = btn.textContent;
    btn.textContent = 'Generowanie...';
    btn.disabled = true;

    let fullUrl = '';

    try {
        // Prepare Payload
        const payload = {
            to: state.to,
            sender: state.sender,
            message: state.message,
            style: state.style
        };

        const response = await fetch('save.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            if (data.id) {
                // SUCCESS: Short Link
                fullUrl = `${window.location.origin}${window.location.pathname}?id=${data.id}`;
            } else {
                throw new Error('No ID returned');
            }
        } else {
            throw new Error('Server error');
        }
    } catch (e) {
        console.warn('Short link generation failed, falling back to Hash URL.', e);
        // FALLBACK
        fullUrl = getHashUrl();
    }

    // Display Result
    const linkInput = document.getElementById('share-link');
    linkInput.value = fullUrl;
    document.getElementById('link-result').classList.remove('hidden');

    btn.textContent = originalText;
    btn.disabled = false;
}

/* --- UI RENDERING --- */



/**
 * Updates the Live Preview in Creator Mode
 */
function updatePreview() {
    // Content
    // Use sensible defaults if empty for preview
    document.getElementById('prev-to').textContent = state.to || 'Grażynki';
    document.getElementById('prev-sender').textContent = state.sender || 'Tomek';
    document.getElementById('prev-message').textContent = state.message || 'Wesołych Świąt...';

    // Style
    const cardObj = document.getElementById('preview-card');
    // Remove old styles
    APP_CONFIG.styles.forEach(s => cardObj.classList.remove(s.id));
    // Add new style
    cardObj.classList.add(state.style);


}

/**
 * Renders the Viewer Mode (The received card)
 */
function renderViewer() {
    // 1. Set Content
    document.getElementById('card-to').textContent = state.to;
    document.getElementById('card-sender').textContent = state.sender;
    document.getElementById('card-message').textContent = state.message;

    // If 'to' is empty, hide label
    if (!state.to) {
        const labelTo = document.querySelector('.label-to');
        if (labelTo) labelTo.style.display = 'none';
        document.getElementById('card-to').style.display = 'none';
    }

    // 2. Set Style
    const cardObj = document.getElementById('gift-card');
    APP_CONFIG.styles.forEach(s => cardObj.classList.remove(s.id));
    cardObj.classList.add(state.style);



    // 4. Show Viewer / Hide Creator
    document.getElementById('creator-app').classList.add('hidden');
    const viewerApp = document.getElementById('viewer-app');
    viewerApp.classList.remove('hidden');

    // Force layout recalc
    void viewerApp.offsetWidth;

    // 5. Trigger Animation Sequence
    const card = document.getElementById('gift-card');

    // Prevent FOUC (Flash of Unstyled Content) - hide initially
    card.style.opacity = '0';

    // Force reflow/paint before starting animation
    void card.offsetWidth;

    // Small delay to ensure browser acknowledges the initial state before animating
    setTimeout(() => {
        // Start with Intro Animation
        card.classList.add('intro');
        // Remove inline hide - animation handles opacity from 0 now
        card.style.opacity = '';
    }, 50);

    // After intro finishes, switch to waiting (shake)
    const onIntroEnd = () => {
        card.classList.remove('intro');
        // Only add waiting if user hasn't opened it yet (rare edge case but good safety)
        if (!card.classList.contains('is-open')) {
            card.classList.add('waiting');
        }
        card.removeEventListener('animationend', onIntroEnd);
    };

    card.addEventListener('animationend', onIntroEnd);
}

/* --- INITIALIZATION --- */
/* --- INITIALIZATION --- */
async function init() {
    initSnow();

    const loadedState = await loadStateFromUrl();

    if (loadedState) {
        // VIEWER MODE
        Object.assign(state, loadedState);
        renderViewer();
    } else {
        // CREATOR MODE
        initCreator();
    }

    // Global Listeners
    // Global Listeners
    document.getElementById('btn-create-own').addEventListener('click', () => {
        // Force redirect to clean URL (remove ?id= and #)
        window.location.href = window.location.origin + window.location.pathname;
    });

    // Flip card on click in VIEWER
    document.getElementById('gift-card').addEventListener('click', function () {
        const viewerActions = document.querySelector('.viewer-actions');

        if (this.classList.contains('is-open')) {
            this.classList.remove('is-open');
        } else {
            // Remove waiting/intro to ensure clean state
            this.classList.remove('waiting');
            this.classList.remove('intro');

            // Force reflow to ensuring transition triggers cleanly after animation removal
            void this.offsetWidth;

            this.classList.add('is-open');

            // Show button after delay
            setTimeout(() => {
                if (viewerActions) viewerActions.classList.add('visible');
            }, 800);
        }
    });

    // Flip card on click in CREATE PREVIEW
    document.getElementById('preview-card').addEventListener('click', function () {
        this.classList.toggle('is-open');
    });
}

function initCreator() {
    document.getElementById('creator-app').classList.remove('hidden');

    // Build Style Selector
    const styleSelector = document.getElementById('style-selector');
    styleSelector.innerHTML = '';

    APP_CONFIG.styles.forEach(style => {
        const div = document.createElement('div');
        div.className = 'style-option';
        div.textContent = style.name;
        // visual hint
        div.style.borderLeft = `5px solid ${style.color} `;

        if (style.id === state.style) div.classList.add('selected');

        div.addEventListener('click', () => {
            document.querySelectorAll('.style-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            state.style = style.id;
            updatePreview();
        });
        styleSelector.appendChild(div);
    });



    // Build Suggestions
    const suggestionsList = document.getElementById('suggestions-list');
    APP_CONFIG.suggestions.forEach(text => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';

        // Structure: Text paragraph + Button
        item.innerHTML = `
            <p class="suggestion-text">"${text}"</p>
            <button class="btn-paste">Użyj tych życzeń</button>
    `;

        item.querySelector('.btn-paste').addEventListener('click', (e) => {
            e.stopPropagation();
            if (text.length > 280) text = text.substring(0, 277) + "...";
            document.getElementById('input-message').value = text;
            state.message = text;
            updatePreview();
            document.getElementById('char-current').textContent = text.length;

            // Visual feedback
            const btn = e.target;
            const original = btn.textContent;
            btn.textContent = 'Wklejono!';
            setTimeout(() => btn.textContent = original, 1000);
        });
        suggestionsList.appendChild(item);
    });

    // Listeners for Inputs
    const bindInput = (id, key) => {
        const el = document.getElementById(id);
        el.addEventListener('input', (e) => {
            state[key] = e.target.value;
            updatePreview();
            if (id === 'input-message') {
                document.getElementById('char-current').textContent = e.target.value.length;
            }
        });
    };

    bindInput('input-to', 'to');
    bindInput('input-sender', 'sender');
    bindInput('input-message', 'message');

    // Toggle Suggestions
    document.getElementById('toggle-suggestions').addEventListener('click', () => {
        document.getElementById('suggestions-list').classList.toggle('hidden');
    });

    // Generate Link
    document.getElementById('btn-generate').addEventListener('click', generateLink);

    // Copy Link
    document.getElementById('btn-copy').addEventListener('click', () => {
        const input = document.getElementById('share-link');
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value).then(() => {
            const btn = document.getElementById('btn-copy');
            const originalText = btn.textContent;
            btn.textContent = 'Skopiowano!';
            setTimeout(() => btn.textContent = originalText, 2000);
        });
    });

    // Initial Preview
    updatePreview();
}

/* --- SNOW ANIMATION --- */
function initSnow() {
    const canvas = document.getElementById('snow-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height;
    const particles = [];
    const maxParticles = 100;

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }
    window.addEventListener('resize', resize);
    resize();

    class Snowflake {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = Math.random() * 1 - 0.5;
            this.vy = Math.random() * 2 + 1;
            this.size = Math.random() * 3 + 1;
            this.alpha = Math.random() * 0.5 + 0.3;
        }

        update() {
            this.y += this.vy;
            this.x += this.vx;

            // Reset if out of bounds
            if (this.y > height) this.y = -10;
            if (this.x > width) this.x = width * Math.random();
            if (this.x < 0) this.x = width;
        }

        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Init particles
    for (let i = 0; i < maxParticles; i++) {
        particles.push(new Snowflake());
    }

    function loop() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(loop);
    }
    loop();
}

// Start
document.addEventListener('DOMContentLoaded', init);
