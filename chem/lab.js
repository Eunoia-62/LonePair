function initLab() {
    const canvas = document.getElementById("labCanvas");
    console.log("[Lab] canvas rect:", canvas?.getBoundingClientRect());
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // ---- State ----
    let atoms = [];
    const MAX_ATOMS = 15;
    let currentSize = 20;
    let currentVelo = 3;
    let currentDir = 45;
    let currentMode = "sandbox";
    let animationPaused = false;

    // ---- Toast ----
    let toastTimeout = null;

    function showToast(msg) {
        let toast = document.getElementById("labToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "labToast";
            toast.className = "lab-toast";
            toast.innerHTML = `<span class="toast-msg"></span><button class="toast-close">✕</button>`;
            toast.querySelector(".toast-close").addEventListener("click", () => hideToast());
            document.querySelector(".lab-container").appendChild(toast);
        }
        toast.querySelector(".toast-msg").textContent = msg;
        toast.classList.add("visible");
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => hideToast(), 2000);
    }

    function hideToast() {
        const toast = document.getElementById("labToast");
        if (toast) toast.classList.remove("visible");
        if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
    }

    // ---- Atom Class ----
    class Atom {
        constructor(x, y, radius, speed, angleDeg) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.mass = radius; // linear mass — keeps force ratios sane
            const rad = (angleDeg * Math.PI) / 180;
            this.vx = Math.cos(rad) * speed;
            this.vy = -Math.sin(rad) * speed;
            this.visible = true;
        }

        draw() {
            if (!this.visible) return;
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            gradient.addColorStop(0, "rgba(76, 201, 240, 0.95)");
            gradient.addColorStop(1, "rgba(76, 201, 240, 0.15)");
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(76, 201, 240, 0.18)";
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        contains(px, py) {
            const dx = px - this.x;
            const dy = py - this.y;
            return dx * dx + dy * dy <= this.radius * this.radius;
        }
    }

    // ---- Physics: single pass over unique pairs ----
    function resolveCollisions() {
        for (let i = 0; i < atoms.length; i++) {
            const a = atoms[i];

            // Wall bounce
            if (a.x - a.radius < 0)               { a.x = a.radius;               a.vx =  Math.abs(a.vx); }
            if (a.x + a.radius > canvas.width)     { a.x = canvas.width - a.radius; a.vx = -Math.abs(a.vx); }
            if (a.y - a.radius < 0)               { a.y = a.radius;               a.vy =  Math.abs(a.vy); }
            if (a.y + a.radius > canvas.height)   { a.y = canvas.height - a.radius; a.vy = -Math.abs(a.vy); }

            for (let j = i + 1; j < atoms.length; j++) {
                const b = atoms[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                const minDist = a.radius + b.radius;

                // Buffer scales with both atoms' radii so all sizes get decent reach
                const repelZone = minDist + (a.radius + b.radius) * 1.5;

                if (dist < repelZone) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const totalMass = a.mass + b.mass;
                    const bufferSize = repelZone - minDist;

                    // 0 at zone edge, 1 at contact surface
                    const penetration = (repelZone - dist) / bufferSize;
                    const forceMag = penetration * 20;

                    // F=ma → a=F/m: lighter atom flung harder, heavier barely moves
                    a.vx -= nx * forceMag / a.mass;
                    a.vy -= ny * forceMag / a.mass;
                    b.vx += nx * forceMag / b.mass;
                    b.vy += ny * forceMag / b.mass;

                    // Hard positional push if actually overlapping
                    if (dist < minDist) {
                        const pen = minDist - dist;
                        a.x -= nx * pen * (b.mass / totalMass);
                        a.y -= ny * pen * (b.mass / totalMass);
                        b.x += nx * pen * (a.mass / totalMass);
                        b.y += ny * pen * (a.mass / totalMass);
                    }
                }
            }

            // Move atom
            a.x += a.vx;
            a.y += a.vy;
        }
    }

    // ---- Left click: open model modal on atom, else spawn ----
    canvas.addEventListener("click", (e) => {
        if (currentMode !== "sandbox") return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Click on existing atom → do nothing (right-click deletes)
        for (let i = atoms.length - 1; i >= 0; i--) {
            if (atoms[i].contains(mx, my)) return;
        }

        // Empty space → spawn
        if (atoms.length >= MAX_ATOMS) {
            showToast("Max limit reached (15 atoms)");
            return;
        }
        atoms.push(new Atom(mx, my, currentSize, currentVelo, currentDir));
    });


    // ---- Right click: delete atom ----
    canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (currentMode !== "sandbox") return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        for (let i = atoms.length - 1; i >= 0; i--) {
            if (atoms[i].contains(mx, my)) {
                atoms.splice(i, 1);
                return;
            }
        }
    });

    // ---- Mode switcher ----
    const modeOptions = document.querySelectorAll(".mode-option");
    const indicator   = document.getElementById("modeIndicator");
    const underWork   = document.getElementById("underWork");

    modeOptions.forEach((option, index) => {
        option.addEventListener("click", () => {
            modeOptions.forEach(o => o.classList.remove("active"));
            option.classList.add("active");

            if (index === 0) {
                indicator.style.top = "6px";
                currentMode = "sandbox";
                underWork.style.display = "none";
                atoms.forEach(a => a.visible = true);
            } else {
                indicator.style.top = "calc(50%)";
                currentMode = "subatomic";
                underWork.style.display = "block";
                atoms.forEach(a => a.visible = false);
            }
        });
    });

    // ---- Back button ----
    document.getElementById("backBtn").addEventListener("click", () => {
        loadPage("landing");
    });

    // ---- Settings panel toggle ----
    const flag  = document.getElementById("settingsFlag");
    const panel = document.getElementById("settingsPanel");
    let panelOpen = false;

    flag.addEventListener("click", () => {
        panelOpen = !panelOpen;
        panel.classList.toggle("open", panelOpen);
        flag.style.right = panelOpen ? "260px" : "0";
    });

    // ---- Generic clamped control linker ----
    function linkControl(slider, input, min, max, decimals, onUpdate) {
        function clamp(v) {
            return Math.min(max, Math.max(min, v));
        }
        slider.addEventListener("input", () => {
            const v = clamp(parseFloat(slider.value));
            input.value = v.toFixed(decimals);
            onUpdate(v);
        });
        // Clamp + sync on blur so typing out-of-range snaps to min/max
        input.addEventListener("blur", () => {
            const v = clamp(parseFloat(input.value) || min);
            input.value = v.toFixed(decimals);
            slider.value = v;
            onUpdate(v);
        });
        // Live sync while typing (only update slider if in range)
        input.addEventListener("input", () => {
            const raw = parseFloat(input.value);
            if (!isNaN(raw)) {
                const v = clamp(raw);
                slider.value = v;
                onUpdate(v);
            }
        });
    }

    linkControl(
        document.getElementById("sizeSlider"),
        document.getElementById("sizeInput"),
        5, 60, 0,
        v => { currentSize = v; }
    );

    linkControl(
        document.getElementById("veloSlider"),
        document.getElementById("veloInput"),
        0, 10, 1,
        v => { currentVelo = v; }
    );

    // ---- Direction wheel ----
    const circleSelector = document.getElementById("circleSelector");
    const circlePin      = document.getElementById("circlePin");
    const dirInput       = document.getElementById("dirInput");
    const CIRCLE_R = 30;

    function updatePinFromDeg(deg) {
        const rad = (deg * Math.PI) / 180;
        const px  = Math.cos(rad) * CIRCLE_R;
        const py  = -Math.sin(rad) * CIRCLE_R;
        circlePin.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    }
    updatePinFromDeg(currentDir);

    let draggingWheel = false;

    function wheelFromPointer(clientX, clientY) {
        const rect = circleSelector.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        let deg = Math.round(Math.atan2(-(clientY - cy), clientX - cx) * 180 / Math.PI);
        if (deg < 0) deg += 360;
        currentDir = deg;
        updatePinFromDeg(deg);
        dirInput.value = deg;
    }

    circleSelector.addEventListener("mousedown",  e => { draggingWheel = true; e.preventDefault(); });
    window.addEventListener("mousemove",  e => { if (draggingWheel) wheelFromPointer(e.clientX, e.clientY); });
    window.addEventListener("mouseup",    ()  => { draggingWheel = false; });

    circleSelector.addEventListener("touchstart", e => { draggingWheel = true; e.preventDefault(); }, { passive: false });
    window.addEventListener("touchmove",  e => { if (draggingWheel) wheelFromPointer(e.touches[0].clientX, e.touches[0].clientY); });
    window.addEventListener("touchend",   ()  => { draggingWheel = false; });

    dirInput.addEventListener("blur", () => {
        let v = ((parseInt(dirInput.value) || 0) % 360 + 360) % 360;
        currentDir = v;
        dirInput.value = v;
        updatePinFromDeg(v);
    });
    dirInput.addEventListener("input", () => {
        const raw = parseInt(dirInput.value);
        if (!isNaN(raw)) {
            let v = ((raw % 360) + 360) % 360;
            currentDir = v;
            updatePinFromDeg(v);
        }
    });

    function animate() {
        if (!animationPaused) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            resolveCollisions();
            for (let atom of atoms) atom.draw();
        }
        requestAnimationFrame(animate);
    }




    // ---- Periodic table toggle ----
    const periodicToggleBtn = document.getElementById("periodicToggleBtn");
    const ptableOverlay     = document.getElementById("ptableOverlay");
    const ptableClose       = document.getElementById("ptableClose");

    // Disable right-click on periodic table overlay
    ptableOverlay.addEventListener("contextmenu", e => e.preventDefault());

    // Category colours
    const CAT_COLORS = {
        "alkali":         "220, 60,  60",
        "alkaline":       "220, 140, 40",
        "transition":     "60,  120, 220",
        "post-transition":"80,  180, 120",
        "metalloid":      "150, 100, 220",
        "nonmetal":       "60,  190, 100",
        "halogen":        "200, 80,  180",
        "noble":          "80,  200, 220",
        "lanthanide":     "180, 130, 60",
        "actinide":       "160, 80,  80",
    };

const EXTRA = {
  1: {group:1,period:1,ie:13.6,ox:"+1",state:"gas",occ:"natural",hl:null},
  2: {group:18,period:1,ie:24.59,ox:"0",state:"gas",occ:"natural",hl:null},
  3: {group:1,period:2,ie:5.39,ox:"+1",state:"solid",occ:"natural",hl:null},
  4: {group:2,period:2,ie:9.32,ox:"+2",state:"solid",occ:"natural",hl:null},
  5: {group:13,period:2,ie:8.3,ox:"+3",state:"solid",occ:"natural",hl:null},
  6: {group:14,period:2,ie:11.26,ox:"+4, +2, -4",state:"solid",occ:"natural",hl:null},
  7: {group:15,period:2,ie:14.53,ox:"+5,+4,+3,+2,+1,-1,-2,-3",state:"gas",occ:"natural",hl:null},
  8: {group:16,period:2,ie:13.62,ox:"-2",state:"gas",occ:"natural",hl:null},
  9: {group:17,period:2,ie:17.42,ox:"-1",state:"gas",occ:"natural",hl:null},
  10: {group:18,period:2,ie:21.56,ox:"0",state:"gas",occ:"natural",hl:null},
  11: {group:1,period:3,ie:5.14,ox:"+1",state:"solid",occ:"natural",hl:null},
  12: {group:2,period:3,ie:7.65,ox:"+2",state:"solid",occ:"natural",hl:null},
  13: {group:13,period:3,ie:5.99,ox:"+3",state:"solid",occ:"natural",hl:null},
  14: {group:14,period:3,ie:8.15,ox:"+4, -4",state:"solid",occ:"natural",hl:null},
  15: {group:15,period:3,ie:10.49,ox:"+5,+3,-3",state:"solid",occ:"natural",hl:null},
  16: {group:16,period:3,ie:10.36,ox:"+6,+4,-2",state:"solid",occ:"natural",hl:null},
  17: {group:17,period:3,ie:12.97,ox:"+7,+5,+3,+1,-1",state:"gas",occ:"natural",hl:null},
  18: {group:18,period:3,ie:15.76,ox:"0",state:"gas",occ:"natural",hl:null},
  19: {group:1,period:4,ie:4.34,ox:"+1",state:"solid",occ:"natural",hl:null},
  20: {group:2,period:4,ie:6.11,ox:"+2",state:"solid",occ:"natural",hl:null},
  21: {group:3,period:4,ie:6.56,ox:"+3",state:"solid",occ:"natural",hl:null},
  22: {group:4,period:4,ie:6.83,ox:"+4,+3,+2",state:"solid",occ:"natural",hl:null},
  23: {group:5,period:4,ie:6.75,ox:"+5,+4,+3,+2",state:"solid",occ:"natural",hl:null},
  24: {group:6,period:4,ie:6.77,ox:"+6,+3,+2",state:"solid",occ:"natural",hl:null},
  25: {group:7,period:4,ie:7.43,ox:"+7,+4,+3,+2",state:"solid",occ:"natural",hl:null},
  26: {group:8,period:4,ie:7.9,ox:"+3,+2",state:"solid",occ:"natural",hl:null},
  27: {group:9,period:4,ie:7.88,ox:"+3,+2",state:"solid",occ:"natural",hl:null},
  28: {group:10,period:4,ie:7.64,ox:"+2,+3",state:"solid",occ:"natural",hl:null},
  29: {group:11,period:4,ie:7.73,ox:"+2,+1",state:"solid",occ:"natural",hl:null},
  30: {group:12,period:4,ie:9.39,ox:"+2",state:"solid",occ:"natural",hl:null},
  31: {group:13,period:4,ie:6.0,ox:"+3",state:"solid",occ:"natural",hl:null},
  32: {group:14,period:4,ie:7.9,ox:"+4,+2",state:"solid",occ:"natural",hl:null},
  33: {group:15,period:4,ie:9.79,ox:"+5,+3,-3",state:"solid",occ:"natural",hl:null},
  34: {group:16,period:4,ie:9.75,ox:"+6,+4,-2",state:"solid",occ:"natural",hl:null},
  35: {group:17,period:4,ie:11.81,ox:"+5,+3,-1",state:"liquid",occ:"natural",hl:null},
  36: {group:18,period:4,ie:14.0,ox:"0",state:"gas",occ:"natural",hl:null},
  37: {group:1,period:5,ie:4.18,ox:"+1",state:"solid",occ:"natural",hl:null},
  38: {group:2,period:5,ie:5.69,ox:"+2",state:"solid",occ:"natural",hl:null},
  39: {group:3,period:5,ie:6.22,ox:"+3",state:"solid",occ:"natural",hl:null},
  40: {group:4,period:5,ie:6.63,ox:"+4",state:"solid",occ:"natural",hl:null},
  41: {group:5,period:5,ie:6.76,ox:"+5,+3",state:"solid",occ:"natural",hl:null},
  42: {group:6,period:5,ie:7.09,ox:"+6,+4,+3",state:"solid",occ:"natural",hl:null},
  43: {group:7,period:5,ie:7.28,ox:"+7,+4",state:"solid",occ:"synthetic",hl:"4.2 million years"},
  44: {group:8,period:5,ie:7.36,ox:"+3,+4",state:"solid",occ:"natural",hl:null},
  45: {group:9,period:5,ie:7.46,ox:"+3",state:"solid",occ:"natural",hl:null},
  46: {group:10,period:5,ie:8.34,ox:"+2,+4",state:"solid",occ:"natural",hl:null},
  47: {group:11,period:5,ie:7.58,ox:"+1",state:"solid",occ:"natural",hl:null},
  48: {group:12,period:5,ie:8.99,ox:"+2",state:"solid",occ:"natural",hl:null},
  49: {group:13,period:5,ie:5.79,ox:"+3",state:"solid",occ:"natural",hl:null},
  50: {group:14,period:5,ie:7.34,ox:"+4,+2",state:"solid",occ:"natural",hl:null},
  51: {group:15,period:5,ie:8.61,ox:"+5,+3",state:"solid",occ:"natural",hl:null},
  52: {group:16,period:5,ie:9.01,ox:"+6,+4,-2",state:"solid",occ:"natural",hl:null},
  53: {group:17,period:5,ie:10.45,ox:"+7,+5,+1,-1",state:"solid",occ:"natural",hl:null},
  54: {group:18,period:5,ie:12.13,ox:"0",state:"gas",occ:"natural",hl:null},
  55: {group:1,period:6,ie:3.89,ox:"+1",state:"solid",occ:"natural",hl:null},
  56: {group:2,period:6,ie:5.21,ox:"+2",state:"solid",occ:"natural",hl:null},
  57: {group:3,period:6,ie:5.58,ox:"+3",state:"solid",occ:"natural",hl:null},
  72: {group:4,period:6,ie:6.83,ox:"+4",state:"solid",occ:"natural",hl:null},
  73: {group:5,period:6,ie:7.55,ox:"+5",state:"solid",occ:"natural",hl:null},
  74: {group:6,period:6,ie:7.86,ox:"+6,+4",state:"solid",occ:"natural",hl:null},
  75: {group:7,period:6,ie:7.83,ox:"+7,+4",state:"solid",occ:"natural",hl:null},
  76: {group:8,period:6,ie:8.44,ox:"+4,+3",state:"solid",occ:"natural",hl:null},
  77: {group:9,period:6,ie:8.97,ox:"+3,+4",state:"solid",occ:"natural",hl:null},
  78: {group:10,period:6,ie:8.96,ox:"+4,+2",state:"solid",occ:"natural",hl:null},
  79: {group:11,period:6,ie:9.23,ox:"+3,+1",state:"solid",occ:"natural",hl:null},
  80: {group:12,period:6,ie:10.44,ox:"+2,+1",state:"liquid",occ:"natural",hl:null},
  81: {group:13,period:6,ie:6.11,ox:"+3,+1",state:"solid",occ:"natural",hl:null},
  82: {group:14,period:6,ie:7.42,ox:"+4,+2",state:"solid",occ:"natural",hl:null},
  83: {group:15,period:6,ie:7.29,ox:"+3,+5",state:"solid",occ:"natural",hl:"20.1×10¹⁸ years"},
  84: {group:16,period:6,ie:8.41,ox:"+4,+2",state:"solid",occ:"natural",hl:"102 years (Po-210: 138 days)"},
  85: {group:17,period:6,ie:9.3,ox:"+1,-1",state:"solid",occ:"natural",hl:"8.1 hours"},
  86: {group:18,period:6,ie:10.75,ox:"0",state:"gas",occ:"natural",hl:"3.8 days"},
  87: {group:1,period:7,ie:4.07,ox:"+1",state:"solid",occ:"natural",hl:"22 minutes"},
  88: {group:2,period:7,ie:5.28,ox:"+2",state:"solid",occ:"natural",hl:"1600 years"},
  89: {group:3,period:7,ie:5.17,ox:"+3",state:"solid",occ:"natural",hl:"21.8 years"},
  104: {group:4,period:7,ie:6.01,ox:"+4",state:"solid",occ:"synthetic",hl:"1.3 hours"},
  105: {group:5,period:7,ie:null,ox:"+5",state:"solid",occ:"synthetic",hl:"28 hours"},
  106: {group:6,period:7,ie:null,ox:"+6",state:"solid",occ:"synthetic",hl:"2.4 minutes"},
  107: {group:7,period:7,ie:null,ox:"+7",state:"solid",occ:"synthetic",hl:"17 seconds"},
  108: {group:8,period:7,ie:null,ox:"+8",state:"solid",occ:"synthetic",hl:"9.7 seconds"},
  109: {group:9,period:7,ie:null,ox:"+3,+1",state:"solid",occ:"synthetic",hl:"7.7 seconds"},
  110: {group:10,period:7,ie:null,ox:"+6,+4,+2",state:"solid",occ:"synthetic",hl:"12.7 seconds"},
  111: {group:11,period:7,ie:null,ox:"+3,+1",state:"solid",occ:"synthetic",hl:"26 seconds"},
  112: {group:12,period:7,ie:null,ox:"+2",state:"solid",occ:"synthetic",hl:"29 seconds"},
  113: {group:13,period:7,ie:null,ox:"+3,+1",state:"solid",occ:"synthetic",hl:"20 seconds"},
  114: {group:14,period:7,ie:null,ox:"+4,+2",state:"solid",occ:"synthetic",hl:"2.7 seconds"},
  115: {group:15,period:7,ie:null,ox:"+3,+1",state:"solid",occ:"synthetic",hl:"220 ms"},
  116: {group:16,period:7,ie:null,ox:"+4,+2",state:"solid",occ:"synthetic",hl:"61 ms"},
  117: {group:17,period:7,ie:null,ox:"+1,-1",state:"solid",occ:"synthetic",hl:"51 ms"},
  118: {group:18,period:7,ie:null,ox:"0",state:"solid",occ:"synthetic",hl:"0.9 ms"},
  58: {group:4,period:6,ie:5.54,ox:"+3,+4",state:"solid",occ:"natural",hl:null},
  59: {group:5,period:6,ie:5.47,ox:"+3",state:"solid",occ:"natural",hl:null},
  60: {group:6,period:6,ie:5.53,ox:"+3",state:"solid",occ:"natural",hl:null},
  61: {group:7,period:6,ie:5.58,ox:"+3",state:"solid",occ:"synthetic",hl:"17.7 years"},
  62: {group:8,period:6,ie:5.64,ox:"+3,+2",state:"solid",occ:"natural",hl:null},
  63: {group:9,period:6,ie:5.67,ox:"+3,+2",state:"solid",occ:"natural",hl:null},
  64: {group:10,period:6,ie:6.15,ox:"+3",state:"solid",occ:"natural",hl:null},
  65: {group:11,period:6,ie:5.86,ox:"+3",state:"solid",occ:"natural",hl:null},
  66: {group:12,period:6,ie:5.94,ox:"+3",state:"solid",occ:"natural",hl:null},
  67: {group:13,period:6,ie:6.02,ox:"+3",state:"solid",occ:"natural",hl:null},
  68: {group:14,period:6,ie:6.11,ox:"+3",state:"solid",occ:"natural",hl:null},
  69: {group:15,period:6,ie:6.18,ox:"+3,+2",state:"solid",occ:"natural",hl:null},
  70: {group:16,period:6,ie:6.25,ox:"+3,+2",state:"solid",occ:"natural",hl:null},
  71: {group:17,period:6,ie:5.43,ox:"+3",state:"solid",occ:"natural",hl:null},
  90: {group:4,period:7,ie:6.31,ox:"+4",state:"solid",occ:"natural",hl:"14 billion years"},
  91: {group:5,period:7,ie:5.89,ox:"+5,+4",state:"solid",occ:"natural",hl:"32,500 years"},
  92: {group:6,period:7,ie:6.19,ox:"+6,+5,+4,+3",state:"solid",occ:"natural",hl:"4.47 billion years"},
  93: {group:7,period:7,ie:6.27,ox:"+5,+4,+3",state:"solid",occ:"synthetic",hl:"2.14 million years"},
  94: {group:8,period:7,ie:6.03,ox:"+4,+3",state:"solid",occ:"synthetic",hl:"87.7 years (Pu-238)"},
  95: {group:9,period:7,ie:5.97,ox:"+3",state:"solid",occ:"synthetic",hl:"432 years"},
  96: {group:10,period:7,ie:5.99,ox:"+3",state:"solid",occ:"synthetic",hl:"18.1 years (Cm-244)"},
  97: {group:11,period:7,ie:6.2,ox:"+3",state:"solid",occ:"synthetic",hl:"1380 years"},
  98: {group:12,period:7,ie:6.28,ox:"+3",state:"solid",occ:"synthetic",hl:"898 years"},
  99: {group:13,period:7,ie:6.42,ox:"+3",state:"solid",occ:"synthetic",hl:"472 days"},
  100: {group:14,period:7,ie:6.5,ox:"+3",state:"solid",occ:"synthetic",hl:"100.5 days"},
  101: {group:15,period:7,ie:6.58,ox:"+3",state:"solid",occ:"synthetic",hl:"51.5 days"},
  102: {group:16,period:7,ie:6.65,ox:"+2,+3",state:"solid",occ:"synthetic",hl:"58 minutes"},
  103: {group:17,period:7,ie:4.9,ox:"+3",state:"solid",occ:"synthetic",hl:"3.6 hours"},
};


    (function buildPtable() {
const ELEMENTS = [
  {num:1,sym:"H",name:"Hydrogen",cat:"nonmetal",mass:1.008,en:2.2,radius:53,octet:"1",quantum:"1s¹",period:1,group:1},
  {num:2,sym:"He",name:"Helium",cat:"noble",mass:4.003,en:null,radius:31,octet:"2",quantum:"1s²",period:1,group:18},
  {num:3,sym:"Li",name:"Lithium",cat:"alkali",mass:6.941,en:0.98,radius:167,octet:"2,1",quantum:"[He] 2s¹",period:2,group:1},
  {num:4,sym:"Be",name:"Beryllium",cat:"alkaline",mass:9.012,en:1.57,radius:112,octet:"2,2",quantum:"[He] 2s²",period:2,group:2},
  {num:5,sym:"B",name:"Boron",cat:"metalloid",mass:10.811,en:2.04,radius:87,octet:"2,3",quantum:"[He] 2s² 2p¹",period:2,group:13},
  {num:6,sym:"C",name:"Carbon",cat:"nonmetal",mass:12.011,en:2.55,radius:77,octet:"2,4",quantum:"[He] 2s² 2p²",period:2,group:14},
  {num:7,sym:"N",name:"Nitrogen",cat:"nonmetal",mass:14.007,en:3.04,radius:75,octet:"2,5",quantum:"[He] 2s² 2p³",period:2,group:15},
  {num:8,sym:"O",name:"Oxygen",cat:"nonmetal",mass:15.999,en:3.44,radius:73,octet:"2,6",quantum:"[He] 2s² 2p⁴",period:2,group:16},
  {num:9,sym:"F",name:"Fluorine",cat:"halogen",mass:18.998,en:3.98,radius:72,octet:"2,7",quantum:"[He] 2s² 2p⁵",period:2,group:17},
  {num:10,sym:"Ne",name:"Neon",cat:"noble",mass:20.18,en:null,radius:71,octet:"2,8",quantum:"[He] 2s² 2p⁶",period:2,group:18},
  {num:11,sym:"Na",name:"Sodium",cat:"alkali",mass:22.99,en:0.93,radius:186,octet:"2,8,1",quantum:"[Ne] 3s¹",period:3,group:1},
  {num:12,sym:"Mg",name:"Magnesium",cat:"alkaline",mass:24.305,en:1.31,radius:160,octet:"2,8,2",quantum:"[Ne] 3s²",period:3,group:2},
  {num:13,sym:"Al",name:"Aluminium",cat:"post-transition",mass:26.982,en:1.61,radius:143,octet:"2,8,3",quantum:"[Ne] 3s² 3p¹",period:3,group:13},
  {num:14,sym:"Si",name:"Silicon",cat:"metalloid",mass:28.086,en:1.9,radius:117,octet:"2,8,4",quantum:"[Ne] 3s² 3p²",period:3,group:14},
  {num:15,sym:"P",name:"Phosphorus",cat:"nonmetal",mass:30.974,en:2.19,radius:115,octet:"2,8,5",quantum:"[Ne] 3s² 3p³",period:3,group:15},
  {num:16,sym:"S",name:"Sulfur",cat:"nonmetal",mass:32.065,en:2.58,radius:103,octet:"2,8,6",quantum:"[Ne] 3s² 3p⁴",period:3,group:16},
  {num:17,sym:"Cl",name:"Chlorine",cat:"halogen",mass:35.453,en:3.16,radius:99,octet:"2,8,7",quantum:"[Ne] 3s² 3p⁵",period:3,group:17},
  {num:18,sym:"Ar",name:"Argon",cat:"noble",mass:39.948,en:null,radius:98,octet:"2,8,8",quantum:"[Ne] 3s² 3p⁶",period:3,group:18},
  {num:19,sym:"K",name:"Potassium",cat:"alkali",mass:39.098,en:0.82,radius:227,octet:"2,8,8,1",quantum:"[Ar] 4s¹",period:4,group:1},
  {num:20,sym:"Ca",name:"Calcium",cat:"alkaline",mass:40.078,en:1.0,radius:197,octet:"2,8,8,2",quantum:"[Ar] 4s²",period:4,group:2},
  {num:21,sym:"Sc",name:"Scandium",cat:"transition",mass:44.956,en:1.36,radius:162,octet:"2,8,9,2",quantum:"[Ar] 3d¹ 4s²",period:4,group:3},
  {num:22,sym:"Ti",name:"Titanium",cat:"transition",mass:47.867,en:1.54,radius:147,octet:"2,8,10,2",quantum:"[Ar] 3d² 4s²",period:4,group:4},
  {num:23,sym:"V",name:"Vanadium",cat:"transition",mass:50.942,en:1.63,radius:134,octet:"2,8,11,2",quantum:"[Ar] 3d³ 4s²",period:4,group:5},
  {num:24,sym:"Cr",name:"Chromium",cat:"transition",mass:51.996,en:1.66,radius:128,octet:"2,8,13,1",quantum:"[Ar] 3d⁵ 4s¹",period:4,group:6},
  {num:25,sym:"Mn",name:"Manganese",cat:"transition",mass:54.938,en:1.55,radius:127,octet:"2,8,13,2",quantum:"[Ar] 3d⁵ 4s²",period:4,group:7},
  {num:26,sym:"Fe",name:"Iron",cat:"transition",mass:55.845,en:1.83,radius:126,octet:"2,8,14,2",quantum:"[Ar] 3d⁶ 4s²",period:4,group:8},
  {num:27,sym:"Co",name:"Cobalt",cat:"transition",mass:58.933,en:1.88,radius:125,octet:"2,8,15,2",quantum:"[Ar] 3d⁷ 4s²",period:4,group:9},
  {num:28,sym:"Ni",name:"Nickel",cat:"transition",mass:58.693,en:1.91,radius:124,octet:"2,8,16,2",quantum:"[Ar] 3d⁸ 4s²",period:4,group:10},
  {num:29,sym:"Cu",name:"Copper",cat:"transition",mass:63.546,en:1.9,radius:128,octet:"2,8,18,1",quantum:"[Ar] 3d¹⁰ 4s¹",period:4,group:11},
  {num:30,sym:"Zn",name:"Zinc",cat:"transition",mass:65.38,en:1.65,radius:134,octet:"2,8,18,2",quantum:"[Ar] 3d¹⁰ 4s²",period:4,group:12},
  {num:31,sym:"Ga",name:"Gallium",cat:"post-transition",mass:69.723,en:1.81,radius:135,octet:"2,8,18,3",quantum:"[Ar] 3d¹⁰ 4s² 4p¹",period:4,group:13},
  {num:32,sym:"Ge",name:"Germanium",cat:"metalloid",mass:72.63,en:2.01,radius:122,octet:"2,8,18,4",quantum:"[Ar] 3d¹⁰ 4s² 4p²",period:4,group:14},
  {num:33,sym:"As",name:"Arsenic",cat:"metalloid",mass:74.922,en:2.18,radius:119,octet:"2,8,18,5",quantum:"[Ar] 3d¹⁰ 4s² 4p³",period:4,group:15},
  {num:34,sym:"Se",name:"Selenium",cat:"nonmetal",mass:78.971,en:2.55,radius:116,octet:"2,8,18,6",quantum:"[Ar] 3d¹⁰ 4s² 4p⁴",period:4,group:16},
  {num:35,sym:"Br",name:"Bromine",cat:"halogen",mass:79.904,en:2.96,radius:114,octet:"2,8,18,7",quantum:"[Ar] 3d¹⁰ 4s² 4p⁵",period:4,group:17},
  {num:36,sym:"Kr",name:"Krypton",cat:"noble",mass:83.798,en:3.0,radius:112,octet:"2,8,18,8",quantum:"[Ar] 3d¹⁰ 4s² 4p⁶",period:4,group:18},
  {num:37,sym:"Rb",name:"Rubidium",cat:"alkali",mass:85.468,en:0.82,radius:248,octet:"2,8,18,8,1",quantum:"[Kr] 5s¹",period:5,group:1},
  {num:38,sym:"Sr",name:"Strontium",cat:"alkaline",mass:87.62,en:0.95,radius:215,octet:"2,8,18,8,2",quantum:"[Kr] 5s²",period:5,group:2},
  {num:39,sym:"Y",name:"Yttrium",cat:"transition",mass:88.906,en:1.22,radius:180,octet:"2,8,18,9,2",quantum:"[Kr] 4d¹ 5s²",period:5,group:3},
  {num:40,sym:"Zr",name:"Zirconium",cat:"transition",mass:91.224,en:1.33,radius:160,octet:"2,8,18,10,2",quantum:"[Kr] 4d² 5s²",period:5,group:4},
  {num:41,sym:"Nb",name:"Niobium",cat:"transition",mass:92.906,en:1.6,radius:146,octet:"2,8,18,12,1",quantum:"[Kr] 4d⁴ 5s¹",period:5,group:5},
  {num:42,sym:"Mo",name:"Molybdenum",cat:"transition",mass:95.96,en:2.16,radius:139,octet:"2,8,18,13,1",quantum:"[Kr] 4d⁵ 5s¹",period:5,group:6},
  {num:43,sym:"Tc",name:"Technetium",cat:"transition",mass:98,en:1.9,radius:136,octet:"2,8,18,13,2",quantum:"[Kr] 4d⁵ 5s²",period:5,group:7},
  {num:44,sym:"Ru",name:"Ruthenium",cat:"transition",mass:101.07,en:2.2,radius:134,octet:"2,8,18,15,1",quantum:"[Kr] 4d⁷ 5s¹",period:5,group:8},
  {num:45,sym:"Rh",name:"Rhodium",cat:"transition",mass:102.906,en:2.28,radius:134,octet:"2,8,18,16,1",quantum:"[Kr] 4d⁸ 5s¹",period:5,group:9},
  {num:46,sym:"Pd",name:"Palladium",cat:"transition",mass:106.42,en:2.2,radius:137,octet:"2,8,18,18,0",quantum:"[Kr] 4d¹⁰",period:5,group:10},
  {num:47,sym:"Ag",name:"Silver",cat:"transition",mass:107.868,en:1.93,radius:144,octet:"2,8,18,18,1",quantum:"[Kr] 4d¹⁰ 5s¹",period:5,group:11},
  {num:48,sym:"Cd",name:"Cadmium",cat:"transition",mass:112.411,en:1.69,radius:151,octet:"2,8,18,18,2",quantum:"[Kr] 4d¹⁰ 5s²",period:5,group:12},
  {num:49,sym:"In",name:"Indium",cat:"post-transition",mass:114.818,en:1.78,radius:167,octet:"2,8,18,18,3",quantum:"[Kr] 4d¹⁰ 5s² 5p¹",period:5,group:13},
  {num:50,sym:"Sn",name:"Tin",cat:"post-transition",mass:118.71,en:1.96,radius:140,octet:"2,8,18,18,4",quantum:"[Kr] 4d¹⁰ 5s² 5p²",period:5,group:14},
  {num:51,sym:"Sb",name:"Antimony",cat:"metalloid",mass:121.76,en:2.05,radius:141,octet:"2,8,18,18,5",quantum:"[Kr] 4d¹⁰ 5s² 5p³",period:5,group:15},
  {num:52,sym:"Te",name:"Tellurium",cat:"metalloid",mass:127.6,en:2.1,radius:137,octet:"2,8,18,18,6",quantum:"[Kr] 4d¹⁰ 5s² 5p⁴",period:5,group:16},
  {num:53,sym:"I",name:"Iodine",cat:"halogen",mass:126.904,en:2.66,radius:133,octet:"2,8,18,18,7",quantum:"[Kr] 4d¹⁰ 5s² 5p⁵",period:5,group:17},
  {num:54,sym:"Xe",name:"Xenon",cat:"noble",mass:131.293,en:2.6,radius:130,octet:"2,8,18,18,8",quantum:"[Kr] 4d¹⁰ 5s² 5p⁶",period:5,group:18},
  {num:55,sym:"Cs",name:"Caesium",cat:"alkali",mass:132.905,en:0.79,radius:265,octet:"2,8,18,18,8,1",quantum:"[Xe] 6s¹",period:6,group:1},
  {num:56,sym:"Ba",name:"Barium",cat:"alkaline",mass:137.327,en:0.89,radius:222,octet:"2,8,18,18,8,2",quantum:"[Xe] 6s²",period:6,group:2},
  {num:57,sym:"La",name:"Lanthanum",cat:"lanthanide",mass:138.905,en:1.1,radius:187,octet:"2,8,18,18,9,2",quantum:"[Xe] 5d¹ 6s²",period:6,group:3},
  {num:72,sym:"Hf",name:"Hafnium",cat:"transition",mass:178.49,en:1.3,radius:159,octet:"2,8,18,32,10,2",quantum:"[Xe] 4f¹⁴ 5d² 6s²",period:6,group:4},
  {num:73,sym:"Ta",name:"Tantalum",cat:"transition",mass:180.948,en:1.5,radius:146,octet:"2,8,18,32,11,2",quantum:"[Xe] 4f¹⁴ 5d³ 6s²",period:6,group:5},
  {num:74,sym:"W",name:"Tungsten",cat:"transition",mass:183.84,en:2.36,radius:139,octet:"2,8,18,32,12,2",quantum:"[Xe] 4f¹⁴ 5d⁴ 6s²",period:6,group:6},
  {num:75,sym:"Re",name:"Rhenium",cat:"transition",mass:186.207,en:1.9,radius:137,octet:"2,8,18,32,13,2",quantum:"[Xe] 4f¹⁴ 5d⁵ 6s²",period:6,group:7},
  {num:76,sym:"Os",name:"Osmium",cat:"transition",mass:190.23,en:2.2,radius:135,octet:"2,8,18,32,14,2",quantum:"[Xe] 4f¹⁴ 5d⁶ 6s²",period:6,group:8},
  {num:77,sym:"Ir",name:"Iridium",cat:"transition",mass:192.217,en:2.2,radius:136,octet:"2,8,18,32,15,2",quantum:"[Xe] 4f¹⁴ 5d⁷ 6s²",period:6,group:9},
  {num:78,sym:"Pt",name:"Platinum",cat:"transition",mass:195.084,en:2.28,radius:138,octet:"2,8,18,32,17,1",quantum:"[Xe] 4f¹⁴ 5d⁹ 6s¹",period:6,group:10},
  {num:79,sym:"Au",name:"Gold",cat:"transition",mass:196.967,en:2.54,radius:144,octet:"2,8,18,32,18,1",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s¹",period:6,group:11},
  {num:80,sym:"Hg",name:"Mercury",cat:"transition",mass:200.59,en:2.0,radius:151,octet:"2,8,18,32,18,2",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s²",period:6,group:12},
  {num:81,sym:"Tl",name:"Thallium",cat:"post-transition",mass:204.383,en:1.62,radius:170,octet:"2,8,18,32,18,3",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹",period:6,group:13},
  {num:82,sym:"Pb",name:"Lead",cat:"post-transition",mass:207.2,en:2.33,radius:175,octet:"2,8,18,32,18,4",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²",period:6,group:14},
  {num:83,sym:"Bi",name:"Bismuth",cat:"post-transition",mass:208.98,en:2.02,radius:170,octet:"2,8,18,32,18,5",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³",period:6,group:15},
  {num:84,sym:"Po",name:"Polonium",cat:"post-transition",mass:209,en:2.0,radius:168,octet:"2,8,18,32,18,6",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴",period:6,group:16},
  {num:85,sym:"At",name:"Astatine",cat:"halogen",mass:210,en:2.2,radius:150,octet:"2,8,18,32,18,7",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵",period:6,group:17},
  {num:86,sym:"Rn",name:"Radon",cat:"noble",mass:222,en:null,radius:146,octet:"2,8,18,32,18,8",quantum:"[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶",period:6,group:18},
  {num:87,sym:"Fr",name:"Francium",cat:"alkali",mass:223,en:0.7,radius:null,octet:"2,8,18,32,18,8,1",quantum:"[Rn] 7s¹",period:7,group:1},
  {num:88,sym:"Ra",name:"Radium",cat:"alkaline",mass:226,en:0.9,radius:null,octet:"2,8,18,32,18,8,2",quantum:"[Rn] 7s²",period:7,group:2},
  {num:89,sym:"Ac",name:"Actinium",cat:"actinide",mass:227,en:1.1,radius:null,octet:"2,8,18,32,18,9,2",quantum:"[Rn] 6d¹ 7s²",period:7,group:3},
  {num:104,sym:"Rf",name:"Rutherfordium",cat:"transition",mass:267,en:null,radius:null,octet:"2,8,18,32,32,10,2",quantum:"[Rn] 5f¹⁴ 6d² 7s²",period:7,group:4},
  {num:105,sym:"Db",name:"Dubnium",cat:"transition",mass:268,en:null,radius:null,octet:"2,8,18,32,32,11,2",quantum:"[Rn] 5f¹⁴ 6d³ 7s²",period:7,group:5},
  {num:106,sym:"Sg",name:"Seaborgium",cat:"transition",mass:271,en:null,radius:null,octet:"2,8,18,32,32,12,2",quantum:"[Rn] 5f¹⁴ 6d⁴ 7s²",period:7,group:6},
  {num:107,sym:"Bh",name:"Bohrium",cat:"transition",mass:270,en:null,radius:null,octet:"2,8,18,32,32,13,2",quantum:"[Rn] 5f¹⁴ 6d⁵ 7s²",period:7,group:7},
  {num:108,sym:"Hs",name:"Hassium",cat:"transition",mass:277,en:null,radius:null,octet:"2,8,18,32,32,14,2",quantum:"[Rn] 5f¹⁴ 6d⁶ 7s²",period:7,group:8},
  {num:109,sym:"Mt",name:"Meitnerium",cat:"transition",mass:276,en:null,radius:null,octet:"2,8,18,32,32,15,2",quantum:"[Rn] 5f¹⁴ 6d⁷ 7s²",period:7,group:9},
  {num:110,sym:"Ds",name:"Darmstadtium",cat:"transition",mass:281,en:null,radius:null,octet:"2,8,18,32,32,17,1",quantum:"[Rn] 5f¹⁴ 6d⁹ 7s¹",period:7,group:10},
  {num:111,sym:"Rg",name:"Roentgenium",cat:"transition",mass:280,en:null,radius:null,octet:"2,8,18,32,32,18,1",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s¹",period:7,group:11},
  {num:112,sym:"Cn",name:"Copernicium",cat:"transition",mass:285,en:null,radius:null,octet:"2,8,18,32,32,18,2",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s²",period:7,group:12},
  {num:113,sym:"Nh",name:"Nihonium",cat:"post-transition",mass:284,en:null,radius:null,octet:"2,8,18,32,32,18,3",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹",period:7,group:13},
  {num:114,sym:"Fl",name:"Flerovium",cat:"post-transition",mass:289,en:null,radius:null,octet:"2,8,18,32,32,18,4",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²",period:7,group:14},
  {num:115,sym:"Mc",name:"Moscovium",cat:"post-transition",mass:288,en:null,radius:null,octet:"2,8,18,32,32,18,5",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³",period:7,group:15},
  {num:116,sym:"Lv",name:"Livermorium",cat:"post-transition",mass:293,en:null,radius:null,octet:"2,8,18,32,32,18,6",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴",period:7,group:16},
  {num:117,sym:"Ts",name:"Tennessine",cat:"halogen",mass:294,en:null,radius:null,octet:"2,8,18,32,32,18,7",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵",period:7,group:17},
  {num:118,sym:"Og",name:"Oganesson",cat:"noble",mass:294,en:null,radius:null,octet:"2,8,18,32,32,18,8",quantum:"[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶",period:7,group:18},
  {num:58,sym:"Ce",name:"Cerium",cat:"lanthanide",mass:140.116,en:1.12,radius:null,octet:"2,8,18,19,9,2",quantum:"[Xe] 4f¹ 5d¹ 6s²",period:8,group:4},
  {num:59,sym:"Pr",name:"Praseodymium",cat:"lanthanide",mass:140.908,en:1.13,radius:null,octet:"2,8,18,21,8,2",quantum:"[Xe] 4f³ 6s²",period:8,group:5},
  {num:60,sym:"Nd",name:"Neodymium",cat:"lanthanide",mass:144.242,en:1.14,radius:null,octet:"2,8,18,22,8,2",quantum:"[Xe] 4f⁴ 6s²",period:8,group:6},
  {num:61,sym:"Pm",name:"Promethium",cat:"lanthanide",mass:145,en:1.13,radius:null,octet:"2,8,18,23,8,2",quantum:"[Xe] 4f⁵ 6s²",period:8,group:7},
  {num:62,sym:"Sm",name:"Samarium",cat:"lanthanide",mass:150.36,en:1.17,radius:null,octet:"2,8,18,24,8,2",quantum:"[Xe] 4f⁶ 6s²",period:8,group:8},
  {num:63,sym:"Eu",name:"Europium",cat:"lanthanide",mass:151.964,en:1.2,radius:null,octet:"2,8,18,25,8,2",quantum:"[Xe] 4f⁷ 6s²",period:8,group:9},
  {num:64,sym:"Gd",name:"Gadolinium",cat:"lanthanide",mass:157.25,en:1.2,radius:null,octet:"2,8,18,25,9,2",quantum:"[Xe] 4f⁷ 5d¹ 6s²",period:8,group:10},
  {num:65,sym:"Tb",name:"Terbium",cat:"lanthanide",mass:158.925,en:1.1,radius:null,octet:"2,8,18,27,8,2",quantum:"[Xe] 4f⁹ 6s²",period:8,group:11},
  {num:66,sym:"Dy",name:"Dysprosium",cat:"lanthanide",mass:162.5,en:1.22,radius:null,octet:"2,8,18,28,8,2",quantum:"[Xe] 4f¹⁰ 6s²",period:8,group:12},
  {num:67,sym:"Ho",name:"Holmium",cat:"lanthanide",mass:164.93,en:1.23,radius:null,octet:"2,8,18,29,8,2",quantum:"[Xe] 4f¹¹ 6s²",period:8,group:13},
  {num:68,sym:"Er",name:"Erbium",cat:"lanthanide",mass:167.259,en:1.24,radius:null,octet:"2,8,18,30,8,2",quantum:"[Xe] 4f¹² 6s²",period:8,group:14},
  {num:69,sym:"Tm",name:"Thulium",cat:"lanthanide",mass:168.934,en:1.25,radius:null,octet:"2,8,18,31,8,2",quantum:"[Xe] 4f¹³ 6s²",period:8,group:15},
  {num:70,sym:"Yb",name:"Ytterbium",cat:"lanthanide",mass:173.045,en:1.1,radius:null,octet:"2,8,18,32,8,2",quantum:"[Xe] 4f¹⁴ 6s²",period:8,group:16},
  {num:71,sym:"Lu",name:"Lutetium",cat:"lanthanide",mass:174.967,en:1.27,radius:null,octet:"2,8,18,32,9,2",quantum:"[Xe] 4f¹⁴ 5d¹ 6s²",period:8,group:17},
  {num:90,sym:"Th",name:"Thorium",cat:"actinide",mass:232.038,en:1.3,radius:null,octet:"2,8,18,32,18,10,2",quantum:"[Rn] 6d² 7s²",period:9,group:4},
  {num:91,sym:"Pa",name:"Protactinium",cat:"actinide",mass:231.036,en:1.5,radius:null,octet:"2,8,18,32,20,9,2",quantum:"[Rn] 5f² 6d¹ 7s²",period:9,group:5},
  {num:92,sym:"U",name:"Uranium",cat:"actinide",mass:238.029,en:1.38,radius:null,octet:"2,8,18,32,21,9,2",quantum:"[Rn] 5f³ 6d¹ 7s²",period:9,group:6},
  {num:93,sym:"Np",name:"Neptunium",cat:"actinide",mass:237,en:1.36,radius:null,octet:"2,8,18,32,22,9,2",quantum:"[Rn] 5f⁴ 6d¹ 7s²",period:9,group:7},
  {num:94,sym:"Pu",name:"Plutonium",cat:"actinide",mass:244,en:1.28,radius:null,octet:"2,8,18,32,24,8,2",quantum:"[Rn] 5f⁶ 7s²",period:9,group:8},
  {num:95,sym:"Am",name:"Americium",cat:"actinide",mass:243,en:1.3,radius:null,octet:"2,8,18,32,25,8,2",quantum:"[Rn] 5f⁷ 7s²",period:9,group:9},
  {num:96,sym:"Cm",name:"Curium",cat:"actinide",mass:247,en:1.3,radius:null,octet:"2,8,18,32,25,9,2",quantum:"[Rn] 5f⁷ 6d¹ 7s²",period:9,group:10},
  {num:97,sym:"Bk",name:"Berkelium",cat:"actinide",mass:247,en:1.3,radius:null,octet:"2,8,18,32,27,8,2",quantum:"[Rn] 5f⁹ 7s²",period:9,group:11},
  {num:98,sym:"Cf",name:"Californium",cat:"actinide",mass:251,en:1.3,radius:null,octet:"2,8,18,32,28,8,2",quantum:"[Rn] 5f¹⁰ 7s²",period:9,group:12},
  {num:99,sym:"Es",name:"Einsteinium",cat:"actinide",mass:252,en:1.3,radius:null,octet:"2,8,18,32,29,8,2",quantum:"[Rn] 5f¹¹ 7s²",period:9,group:13},
  {num:100,sym:"Fm",name:"Fermium",cat:"actinide",mass:257,en:1.3,radius:null,octet:"2,8,18,32,30,8,2",quantum:"[Rn] 5f¹² 7s²",period:9,group:14},
  {num:101,sym:"Md",name:"Mendelevium",cat:"actinide",mass:258,en:1.3,radius:null,octet:"2,8,18,32,31,8,2",quantum:"[Rn] 5f¹³ 7s²",period:9,group:15},
  {num:102,sym:"No",name:"Nobelium",cat:"actinide",mass:259,en:1.3,radius:null,octet:"2,8,18,32,32,8,2",quantum:"[Rn] 5f¹⁴ 7s²",period:9,group:16},
  {num:103,sym:"Lr",name:"Lawrencium",cat:"actinide",mass:262,en:null,radius:null,octet:"2,8,18,32,32,8,3",quantum:"[Rn] 5f¹⁴ 7s² 7p¹",period:9,group:17}
];


        const grid = document.getElementById("ptableGrid");
        grid.style.gridTemplateRows = "repeat(10, 54px)";

        // Assign period/group from data (already in ELEMENTS)
        const lookup = {};
        for (const el of ELEMENTS) {
            if (!lookup[el.period]) lookup[el.period] = {};
            lookup[el.period][el.group] = el;
        }

        // Hover card
        const card = document.createElement("div");
        card.className = "el-hover-card";
        card.style.display = "none";
        document.querySelector(".ptable-overlay").appendChild(card);

        let hideCardTimeout = null;

        function showCard(el, cellEl) {
            clearTimeout(hideCardTimeout);
            const col = parseInt(cellEl.style.gridColumn);
            const rgb = CAT_COLORS[el.cat] || "76,201,240";
            card.style.display = "block";
            card.style.setProperty("--el-rgb", rgb);
            card.innerHTML = `
                <div class="hc-top">
                    <span class="hc-num">${el.num}</span>
                    <span class="hc-cat">${el.cat.replace("-"," ")}</span>
                </div>
                <div class="hc-sym">${el.sym}</div>
                <div class="hc-name">${el.name}</div>
                <div class="hc-divider"></div>
                <div class="hc-row"><span class="hc-label">Atomic Mass</span><span class="hc-val">${el.mass} u</span></div>
                <div class="hc-row"><span class="hc-label">Atomic Radius</span><span class="hc-val">${el.radius != null ? el.radius+" pm" : "—"}</span></div>
                <div class="hc-row"><span class="hc-label">Electronegativity</span><span class="hc-val">${el.en != null ? el.en : "—"}</span></div>
                <div class="hc-divider"></div>
                <div class="hc-label" style="margin-bottom:4px">Shell Config</div>
                <div class="hc-config">${el.octet.split(",").map((n,i)=>`<span class="hc-shell">${n}</span>`).join("")}</div>
                <div class="hc-divider"></div>
                <div class="hc-label" style="margin-bottom:4px">Quantum Config</div>
                <div class="hc-quantum">${el.quantum}</div>
            `;

            // Position card: avoid going off bottom or sides
            const rect = cellEl.getBoundingClientRect();
            const overlayRect = document.querySelector(".ptable-overlay").getBoundingClientRect();
            const relLeft = rect.left - overlayRect.left;
            const relTop  = rect.top  - overlayRect.top;
            const cardH   = 320; // approx card height
            const cardW   = 238;
            const margin  = 8;

            // Vertical: try to center on cell, clamp so card stays inside overlay
            let topPos = relTop + rect.height / 2 - cardH / 2;
            const maxTop = overlayRect.height - cardH - margin;
            topPos = Math.max(margin, Math.min(topPos, maxTop));
            card.style.top = topPos + "px";
            card.style.bottom = "auto";

            // Horizontal: prefer right side, fall back to left if not enough room
            const spaceRight = overlayRect.width - (relLeft + rect.width);
            if (spaceRight >= cardW + margin) {
                card.style.left  = (relLeft + rect.width + margin) + "px";
                card.style.right = "auto";
            } else {
                card.style.left  = "auto";
                card.style.right = (overlayRect.width - relLeft + margin) + "px";
            }
        }

        function hideCard() {
            hideCardTimeout = setTimeout(() => { card.style.display = "none"; }, 120);
        }

        card.addEventListener("mouseenter", () => clearTimeout(hideCardTimeout));
        card.addEventListener("mouseleave", hideCard);

        function makeCell(el) {
            const rgb = CAT_COLORS[el.cat] || "76,201,240";
            const div = document.createElement("div");
            div.className = "el-cell";
            div.style.setProperty("--el-rgb", rgb);
            div.innerHTML = `
                <span class="el-num">${el.num}</span>
                <span class="el-sym">${el.sym}</span>
                <span class="el-name">${el.name}</span>
            `;
            div.addEventListener("mouseenter", () => showCard(el, div));
            div.addEventListener("mouseleave", hideCard);
            div.addEventListener("click", () => openElementModal(el));
            return div;
        }

        // Main table rows 1–7
        for (let period = 1; period <= 7; period++) {
            for (let group = 1; group <= 18; group++) {
                const el = lookup[period]?.[group];
                if (el) {
                    const cell = makeCell(el);
                    cell.style.gridColumn = group;
                    cell.style.gridRow = period;
                    grid.appendChild(cell);
                }
            }
        }

        // Gap row
        const gap = document.createElement("div");
        gap.style.gridColumn = "1 / -1";
        gap.style.gridRow = "8";
        gap.style.height = "10px";
        grid.appendChild(gap);

        // Lanthanide / Actinide labels
        const lantLabel = document.createElement("div");
        lantLabel.className = "el-label";
        lantLabel.style.cssText = "grid-column:1/4;grid-row:9";
        lantLabel.textContent = "Lanthanides";
        grid.appendChild(lantLabel);

        const actLabel = document.createElement("div");
        actLabel.className = "el-label";
        actLabel.style.cssText = "grid-column:1/4;grid-row:10";
        actLabel.textContent = "Actinides";
        grid.appendChild(actLabel);

        // Lanthanide cells
        for (const el of ELEMENTS.filter(e => e.period === 8)) {
            const cell = makeCell(el);
            cell.style.gridColumn = el.group;
            cell.style.gridRow = "9";
            grid.appendChild(cell);
        }

        // Actinide cells
        for (const el of ELEMENTS.filter(e => e.period === 9)) {
            const cell = makeCell(el);
            cell.style.gridColumn = el.group;
            cell.style.gridRow = "10";
            grid.appendChild(cell);
        }
    })();

    periodicToggleBtn.addEventListener("click", () => {
        ptableOverlay.classList.add("visible");
        animationPaused = true;
    });

    ptableClose.addEventListener("click", () => {
        ptableOverlay.classList.remove("visible");
        animationPaused = false;
    });

    // ---- Element modal (click on periodic table cell) ----
    const elModal         = document.getElementById("elModal");
    const elModalClose    = document.getElementById("elModalClose");
    const elModelOptions  = document.querySelectorAll("#elModelToggle .model-option");
    const elModelIndicator= document.getElementById("elModelIndicator");
    const elPanelQuantum  = document.getElementById("elPanelQuantum");
    const elPanelPlanetary= document.getElementById("elPanelPlanetary");
    const elPlanetaryCanvas = document.getElementById("elPlanetaryCanvas");
    const elPlanetaryTooltip= document.getElementById("elPlanetaryTooltip");
    let elPlanetaryRAF = null;

    function openElementModal(el) {
        const ex = EXTRA[el.num] || {};

        // Identity
        document.getElementById("elModalNum").textContent  = el.num;
        document.getElementById("elModalCat").textContent  = el.cat.replace("-", " ");
        document.getElementById("elModalSym").textContent  = el.sym;
        document.getElementById("elModalName").textContent = el.name;

        // Stats
        document.getElementById("elModalMass").textContent    = el.mass + " u";
        document.getElementById("elModalRadius").textContent  = el.radius != null ? el.radius + " pm" : "—";
        document.getElementById("elModalEN").textContent      = el.en != null ? el.en : "—";
        document.getElementById("elModalIE").textContent      = ex.ie != null ? ex.ie + " eV" : "—";
        document.getElementById("elModalOx").textContent      = ex.ox || "—";
        document.getElementById("elModalState").textContent   = ex.state ? ex.state.charAt(0).toUpperCase() + ex.state.slice(1) : "—";
        document.getElementById("elModalGP").textContent      = ex.group && ex.period ? `Group ${ex.group}  •  Period ${ex.period}` : "—";
        document.getElementById("elModalOcc").textContent     = ex.occ ? ex.occ.charAt(0).toUpperCase() + ex.occ.slice(1) : "—";

        // Stability + half-life
        const stabilityEl  = document.getElementById("elModalStability");
        const halflifeRow  = document.getElementById("elStatHalflife");
        const halflifeEl   = document.getElementById("elModalHalflife");
        if (ex.hl) {
            stabilityEl.textContent = "Radioactive ☢";
            stabilityEl.style.color = "rgba(255,120,60,0.9)";
            halflifeRow.style.display = "flex";
            halflifeEl.textContent = ex.hl;
        } else {
            stabilityEl.textContent = "Stable";
            stabilityEl.style.color = "rgba(80,220,120,0.9)";
            halflifeRow.style.display = "none";
        }

        // Shell bubbles
        const shellContainer = document.getElementById("elModalShells");
        shellContainer.innerHTML = el.octet.split(",").map(n =>
            `<span class="hc-shell">${n}</span>`
        ).join("");

        document.getElementById("elModalQuantum").textContent = expandConfig(el.quantum).trim();

        // Apply category colour as CSS var
        const rgb = CAT_COLORS[el.cat] || "76,201,240";
        elModal.style.setProperty("--el-rgb", rgb);
        elModal.querySelector(".el-modal-sym").style.textShadow = `0 0 24px rgba(${rgb},0.6)`;

        // Reset to quantum tab
        elModelOptions.forEach(o => o.classList.remove("active"));
        elModelOptions[0].classList.add("active");
        elModelIndicator.style.left = "4px";
        elPanelQuantum.style.display  = "flex";
        elPanelPlanetary.style.display = "none";
        stopElPlanetary();
        stopQuantum();
        currentElForQuantum = el;

        elModal.classList.add("visible");
        requestAnimationFrame(() => startQuantum(el));
    }

    elModalClose.addEventListener("click", () => {
        elModal.classList.remove("visible");
        document.querySelector(".el-modal-inner").style.width = "";
        stopElPlanetary();
        stopQuantum();
    });
    elModal.addEventListener("click", (e) => {
        if (e.target === elModal) {
            elModal.classList.remove("visible");
            document.querySelector(".el-modal-inner").style.width = "";
            stopElPlanetary();
            stopQuantum();
        }
    });
    elModal.addEventListener("contextmenu", e => e.preventDefault());

    let currentElForQuantum = null;

    elModelOptions.forEach((opt, idx) => {
        opt.addEventListener("click", () => {
            elModelOptions.forEach(o => o.classList.remove("active"));
            opt.classList.add("active");
            elModelIndicator.style.left = idx === 0 ? "4px" : "calc(50%)";
            if (idx === 0) {
                elPanelQuantum.style.display   = "flex";
                elPanelPlanetary.style.display = "none";
                stopElPlanetary();
                requestAnimationFrame(() => startQuantum(currentElForQuantum));
            } else {
                elPanelQuantum.style.display   = "none";
                elPanelPlanetary.style.display = "flex";
                stopQuantum();
                requestAnimationFrame(() => startElPlanetary());
            }
        });
    });

    // ---- Noble gas config expander (used by modal info panel + quantum renderer) ----
    const NOBLE_FULL_EXPAND = {
        He:'1s²', Ne:'1s² 2s² 2p⁶', Ar:'1s² 2s² 2p⁶ 3s² 3p⁶',
        Kr:'1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s² 4p⁶',
        Xe:'1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s² 4p⁶ 4d¹⁰ 5s² 5p⁶',
        Rn:'1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s² 4p⁶ 4d¹⁰ 4f¹⁴ 5s² 5p⁶ 5d¹⁰ 6s² 6p⁶',
    };
    function expandConfig(cfg) {
        return cfg.replace(/\[([A-Z][a-z]?)\]\s*/g, (_, sym) => NOBLE_FULL_EXPAND[sym] ? NOBLE_FULL_EXPAND[sym]+' ' : '');
    }

    // ===== QUANTUM MODEL (Three.js) =====
    let qScene, qCamera, qRenderer, qRAF;
    let qGroups   = [];  // { group, parentLabel, subLabel, baseMats: [{mat, op, emi}] }
    let qSubMode  = false;
    let qTheta = 0.8, qPhi = 1.0, qRadius = 7;
    let qDragging = false, qLastMouse = { x: 0, y: 0 };

    const ORBITAL_COLORS = { s:0x4cc9f0, p:0xb517ff, d:0xff8c00, f:0xff2d9b, g:0x39ff6e };
    const SUB_ORBITALS = {
        s: ['s'],
        p: ['px','py','pz'],
        d: ['dxy','dxz','dyz','dx²-y²','dz²'],
        f: ['fx(x²-3y²)','fy(x²-z²)','fxz²','fz³','fyz²','fxyz','fy(3x²-y²)'],
    };

    // ---- Geometry helpers ----
    // Build a true teardrop using SphereGeometry + non-uniform scale
    // A sphere scaled (0.45, 1.0, 0.45) gives an elongated ellipsoid.
    // Then we shift it so one end (nucleus) is at origin and tip points along +Y.
    // This is NOT symmetric lens — it's a proper elongated drop.
    // For a real teardrop (asymmetric), we use a custom BufferGeometry.
    function lobeGeo(len) {
        // Build teardrop via parametric surface:
        // phi = 0..PI (latitude), theta = 0..2PI (longitude)
        // r(phi) = sin(phi) as usual for sphere
        // BUT we distort the Y axis: y = cos(phi) stretched so
        // the "south pole" (nucleus, phi=PI) is at y=0
        // and "north pole" (tip, phi=0) is at y=len
        // AND we make it asymmetric: narrow near tip, wide near nucleus
        const rows = 24, cols = 24;
        const positions = [];
        const indices   = [];

        for (let r = 0; r <= rows; r++) {
            const phi = (r / rows) * Math.PI; // 0=tip, PI=nucleus
            const t   = r / rows;             // 0=tip, 1=nucleus
            // y goes from len (tip) down to 0 (nucleus)
            const y = len * (1 - t);
            // radius profile: 0 at tip (t=0), peaks at t~0.55, 0 at nucleus (t=1)
            // Use asymmetric curve — fatter closer to nucleus side
            const rad = len * 0.38 * Math.pow(t, 0.5) * Math.pow(1 - t, 1.1) * 2.4;
            for (let c = 0; c <= cols; c++) {
                const theta = (c / cols) * Math.PI * 2;
                positions.push(
                    rad * Math.cos(theta),  // x
                    y,                      // y: tip at top, nucleus at bottom (y=0)
                    rad * Math.sin(theta)   // z
                );
            }
        }

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const a = r * (cols + 1) + c;
                const b = a + 1;
                const c1 = a + (cols + 1);
                const d  = c1 + 1;
                indices.push(a, c1, b);
                indices.push(b, c1, d);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

    function makeMat(col, op, emi) {
        const m = new THREE.MeshPhongMaterial({
            color: col, emissive: col, emissiveIntensity: emi,
            transparent: true, opacity: op,
            side: THREE.DoubleSide, depthWrite: false, shininess: 55
        });
        m.userData = { baseOp: op, baseEmi: emi };
        return m;
    }

    // Lobe: nucleus end at origin (y=0), tip points outward along (dx,dy,dz)
    // lobeGeo has tip at y=len, nucleus at y=0 — orient so +Y → outward direction
    function lobe(len, dx, dy, dz, col, op, emi) {
        const pivot = new THREE.Group();
        const mesh  = new THREE.Mesh(lobeGeo(len), makeMat(col, op, emi));
        const dir   = new THREE.Vector3(dx, dy, dz).normalize();
        const up    = new THREE.Vector3(0, 1, 0);
        if (Math.abs(dir.dot(up)) > 0.9999) {
            if (dir.y < 0) mesh.rotation.x = Math.PI;
        } else {
            mesh.quaternion.setFromUnitVectors(up, dir);
        }
        pivot.add(mesh);
        return pivot;
    }

        // ---- Build all orbital sub-groups for one token ----
    function buildToken(tok, len, col) {
        const OP_FULL = 0.58, EMI_FULL = 0.30;
        const OP_EMPTY= 0.07, EMI_EMPTY= 0.03;
        const results = [];

        if (tok.type === 's') {
            const g = new THREE.Group();
            g.add(new THREE.Mesh(
                new THREE.SphereGeometry(len * 0.50, 32, 32),
                makeMat(col, OP_FULL, EMI_FULL)
            ));
            results.push({ g, sub: `${tok.n}s` });

        } else if (tok.type === 'p') {
            const filled = Math.min(tok.count, 6);
            const axes = [[1,0,0,'x'],[0,1,0,'y'],[0,0,1,'z']];
            axes.forEach(([dx,dy,dz,name], i) => {
                const op  = i < Math.ceil(filled/2) ? OP_FULL  : OP_EMPTY;
                const emi = i < Math.ceil(filled/2) ? EMI_FULL : EMI_EMPTY;
                const g = new THREE.Group();
                g.add(lobe(len,  dx,  dy,  dz, col, op, emi));
                g.add(lobe(len, -dx, -dy, -dz, col, op, emi));
                results.push({ g, sub: `${tok.n}p${name}` });
            });

        } else if (tok.type === 'd') {
            const filled = Math.ceil(tok.count / 2);
            const defs = [
                { name:'dxy',    fn: (g,op,emi) => {
                    const r = 1/Math.SQRT2;
                    [[ r, r,0],[-r, r,0],[-r,-r,0],[ r,-r,0]].forEach(([x,y,z])=>g.add(lobe(len,x,y,z,col,op,emi))); }},
                { name:'dxz',    fn: (g,op,emi) => {
                    const r = 1/Math.SQRT2;
                    [[ r,0, r],[-r,0, r],[-r,0,-r],[ r,0,-r]].forEach(([x,y,z])=>g.add(lobe(len,x,y,z,col,op,emi))); }},
                { name:'dyz',    fn: (g,op,emi) => {
                    const r = 1/Math.SQRT2;
                    [[0, r, r],[0,-r, r],[0,-r,-r],[0, r,-r]].forEach(([x,y,z])=>g.add(lobe(len,x,y,z,col,op,emi))); }},
                { name:'dx²-y²', fn: (g,op,emi) => {
                    [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]].forEach(([x,y,z])=>g.add(lobe(len,x,y,z,col,op,emi))); }},
                { name:'dz²',    fn: (g,op,emi) => {
                    g.add(lobe(len,0,0, 1,col,op,emi));
                    g.add(lobe(len,0,0,-1,col,op,emi));
                    // Torus in XY plane (horizontal ring) — THREE.TorusGeometry is already in XY plane
                    const tor = new THREE.Mesh(
                        new THREE.TorusGeometry(len*0.40, len*0.08, 14, 36),
                        makeMat(col, op*0.75, emi*0.75)
                    );
                    // No rotation — torus naturally lies in XY plane
                    g.add(tor); }},
            ];
            defs.forEach(({ name, fn }, i) => {
                const op  = i < filled ? OP_FULL  : OP_EMPTY;
                const emi = i < filled ? EMI_FULL : EMI_EMPTY;
                const g = new THREE.Group();
                fn(g, op, emi);
                results.push({ g, sub: `${tok.n}${name}` });
            });

        } else if (tok.type === 'f') {
            const filled = Math.ceil(tok.count / 2);
            const r3 = Math.sqrt(3)/2;
            const defs = [
                { name:'fx(x²-3y²)', fn:(g,op,emi)=>{
                    g.add(lobe(len*1.1, 1,0,0,col,op,emi)); g.add(lobe(len*1.1,-1,0,0,col,op,emi));
                    [[0.5,r3,0],[-0.5,r3,0],[-0.5,-r3,0],[0.5,-r3,0]].forEach(([x,y,z])=>g.add(lobe(len*0.6,x,y,z,col,op,emi)));
                }},
                { name:'fy(x²-z²)', fn:(g,op,emi)=>{
                    g.add(lobe(len*1.1,0,1,0,col,op,emi)); g.add(lobe(len*1.1,0,-1,0,col,op,emi));
                    [[0,0.5,r3],[0,-0.5,r3],[0,-0.5,-r3],[0,0.5,-r3]].forEach(([x,y,z])=>g.add(lobe(len*0.6,x,y,z,col,op,emi)));
                }},
                { name:'fxz²', fn:(g,op,emi)=>{
                    g.add(lobe(len*1.1,0,0,1,col,op,emi)); g.add(lobe(len*1.1,0,0,-1,col,op,emi));
                    const r2=1/Math.SQRT2;
                    [[r2,0,r2],[-r2,0,r2],[-r2,0,-r2],[r2,0,-r2]].forEach(([x,y,z])=>g.add(lobe(len*0.6,x,y,z,col,op,emi)));
                }},
                { name:'fz³', fn:(g,op,emi)=>{
                    g.add(lobe(len*1.2,0,0,1,col,op,emi)); g.add(lobe(len*1.2,0,0,-1,col,op,emi));
                    // Two flat torus rings in XY plane, offset along Z axis
                    [len*0.40,-len*0.40].forEach(zOff=>{
                        const tor=new THREE.Mesh(new THREE.TorusGeometry(len*0.32,len*0.07,12,32),makeMat(col,op*0.8,emi*0.8));
                        // No rotation — torus naturally lies in XY plane, just move along Z
                        tor.position.z=zOff; g.add(tor);
                    });
                }},
                { name:'fyz²', fn:(g,op,emi)=>{
                    g.add(lobe(len*1.1,0,0,1,col,op,emi)); g.add(lobe(len*1.1,0,0,-1,col,op,emi));
                    const r2=1/Math.SQRT2;
                    [[0,r2,r2],[0,-r2,r2],[0,-r2,-r2],[0,r2,-r2]].forEach(([x,y,z])=>g.add(lobe(len*0.6,x,y,z,col,op,emi)));
                }},
                { name:'fxyz', fn:(g,op,emi)=>{
                    const r=1/Math.sqrt(3);
                    [[r,r,r],[-r,r,r],[-r,-r,r],[r,-r,r],[r,r,-r],[-r,r,-r],[-r,-r,-r],[r,-r,-r]]
                    .forEach(([x,y,z])=>g.add(lobe(len*0.75,x,y,z,col,op,emi)));
                }},
                { name:'fy(3x²-y²)', fn:(g,op,emi)=>{
                    for(let i=0;i<6;i++){
                        const a=i*Math.PI/3;
                        g.add(lobe(len*0.9,Math.cos(a),Math.sin(a),0,col,op,emi));
                    }
                }},
            ];
            defs.forEach(({ name, fn }, i) => {
                const op  = i < filled ? OP_FULL  : OP_EMPTY;
                const emi = i < filled ? EMI_FULL : EMI_EMPTY;
                const g = new THREE.Group();
                fn(g, op, emi);
                results.push({ g, sub: `${tok.n}${name}` });
            });
        }
        return results;
    }

    // ---- Opacity helpers ----
    function applyOp(group, op, emi) {
        group.traverse(o => {
            if (!o.isMesh || !o.material) return;
            o.material.opacity           = op;
            o.material.emissiveIntensity = emi;
            o.material.needsUpdate       = true;
        });
    }

    function restoreOp(group) {
        group.traverse(o => {
            if (!o.isMesh || !o.material) return;
            o.material.opacity           = o.material.userData.baseOp;
            o.material.emissiveIntensity = o.material.userData.baseEmi;
            o.material.needsUpdate       = true;
        });
    }

    function allReset() {
        qGroups.forEach(e => restoreOp(e.group));
    }

    function highlightOne(parentLabel) {
        qGroups.forEach(e => {
            if (e.parentLabel === parentLabel) applyOp(e.group, 0.88, 0.70);
            else                               applyOp(e.group, 0.04, 0.01);
        });
    }

    function highlightSub(parentLabel, subLabel) {
        qGroups.forEach(e => {
            const same   = e.parentLabel === parentLabel;
            const target = same && e.subLabel === subLabel;
            if      (target) applyOp(e.group, 0.92, 0.75);
            else if (same)   applyOp(e.group, 0.07, 0.03);
            else             applyOp(e.group, 0.03, 0.01);
        });
    }

    // ---- Sub-mode UI ----
    function enterSubMode(tok) {
        qSubMode = true;
        highlightOne(tok.label);
        const bar = document.getElementById('quantumConfigBar');
        bar.querySelector('.q-subbar')?.remove();
        const subBar = document.createElement('div');
        subBar.className = 'q-subbar';
        (SUB_ORBITALS[tok.type] || [tok.type]).forEach(sub => {
            const fullSub = `${tok.n}${sub}`;
            const sp = document.createElement('span');
            sp.className = 'q-token q-sub';
            sp.dataset.type = tok.type;
            sp.textContent  = fullSub;
            sp.addEventListener('mouseenter', () => highlightSub(tok.label, fullSub));
            sp.addEventListener('mouseleave',  () => highlightOne(tok.label));
            sp.addEventListener('click', e => {
                e.stopPropagation();
                highlightSub(tok.label, fullSub);
                subBar.querySelectorAll('.q-sub').forEach(s => s.classList.remove('q-sub-active'));
                sp.classList.add('q-sub-active');
            });
            subBar.appendChild(sp);
        });
        bar.appendChild(subBar);
    }

    function exitSubMode() {
        qSubMode = false;
        document.getElementById('quantumConfigBar')?.querySelector('.q-subbar')?.remove();
        allReset();
    }

    // ---- Axes ----
    function makeAxisLabel(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16).padStart(6,'0');
        ctx.font = 'bold 44px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:0.9, depthTest:false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.38, 0.38, 0.38);
        return sprite;
    }

    function buildQAxes(maxN, scale) {
        const len = maxN * 0.9 * scale + 1.3;
        [
            { d:[1,0,0], c:0xff4444, label:'x' },
            { d:[0,1,0], c:0x44ff88, label:'y' },
            { d:[0,0,1], c:0x4499ff, label:'z' }
        ].forEach(({ d, c, label }) => {
            const pts = [
                new THREE.Vector3(-d[0]*len,-d[1]*len,-d[2]*len),
                new THREE.Vector3( d[0]*len, d[1]*len, d[2]*len)
            ];
            qScene.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts),
                new THREE.LineBasicMaterial({ color:c, transparent:true, opacity:0.5 })
            ));
            const mkCone = (pos, rx, rz) => {
                const cone = new THREE.Mesh(
                    new THREE.ConeGeometry(0.055, 0.22, 8),
                    new THREE.MeshBasicMaterial({ color:c })
                );
                cone.position.set(...pos);
                if (rx) cone.rotation.x = rx;
                if (rz) cone.rotation.z = rz;
                qScene.add(cone);
            };
            if (d[0]) { mkCone([ d[0]*len,0,0], 0, -Math.PI/2); mkCone([-d[0]*len,0,0], 0,  Math.PI/2); }
            if (d[1]) { mkCone([0, d[1]*len,0], 0, 0);           mkCone([0,-d[1]*len,0], Math.PI, 0); }
            if (d[2]) { mkCone([0,0, d[2]*len],  Math.PI/2,0);   mkCone([0,0,-d[2]*len],-Math.PI/2,0); }

            // Label at positive tip
            const lbl = makeAxisLabel(label, c);
            lbl.position.set(d[0]*(len+0.42), d[1]*(len+0.42), d[2]*(len+0.42));
            qScene.add(lbl);
        });
    }

    // ---- Config bar ----
    function buildConfigBar(bar, tokens) {
        bar.innerHTML = '';
        tokens.forEach(tok => {
            const sp = document.createElement('span');
            sp.className = 'q-token';
            sp.dataset.type  = tok.type;
            sp.dataset.label = tok.label;
            sp.textContent   = tok.label;
            sp.addEventListener('mouseenter', () => { if (!qSubMode) highlightOne(tok.label); });
            sp.addEventListener('mouseleave',  () => { if (!qSubMode) allReset(); });
            sp.addEventListener('click', e => { e.stopPropagation(); enterSubMode(tok); });
            bar.appendChild(sp);
        });
    }

    function parseQuantumConfig(cfg) {
        const sup = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
        const full = expandConfig(cfg);
        const re = /(\d)([spdfg])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g;
        const tokens = []; let m;
        while ((m = re.exec(full)) !== null) {
            const n     = parseInt(m[1]);
            const type  = m[2];
            const count = parseInt(m[3].split('').map(c=>sup[c]||c).join(''));
            tokens.push({ n, type, count, label:`${m[1]}${m[2]}${m[3]}` });
        }
        return tokens;
    }

    // ---- Stop / Start ----
    function stopQuantum() {
        if (qRAF) { cancelAnimationFrame(qRAF); qRAF = null; }
        if (qRenderer) {
            qRenderer.dispose();
            document.getElementById('quantumViewport')?.replaceChildren();
            qRenderer = null;
        }
        qScene = null; qCamera = null; qGroups = []; qSubMode = false;
    }

    function startQuantum(el) {
        if (!el || typeof THREE === 'undefined') return;
        stopQuantum();
        const vp  = document.getElementById('quantumViewport');
        const bar = document.getElementById('quantumConfigBar');
        if (!vp || !bar) return;

        const W = vp.clientWidth  || 380;
        const H = vp.clientHeight || 300;

        qScene  = new THREE.Scene();
        qCamera = new THREE.PerspectiveCamera(45, W/H, 0.01, 500);
        qTheta = 0.8; qPhi = 1.0; qRadius = 8;
        const camUpdate = () => {
            qCamera.position.set(
                qRadius * Math.sin(qPhi) * Math.sin(qTheta),
                qRadius * Math.cos(qPhi),
                qRadius * Math.sin(qPhi) * Math.cos(qTheta)
            );
            qCamera.lookAt(0,0,0);
        };
        camUpdate();

        qRenderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
        qRenderer.setSize(W, H);
        qRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        qRenderer.setClearColor(0x000000, 0);
        vp.appendChild(qRenderer.domElement);

        qScene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const pl = new THREE.PointLight(0xffffff, 0.9, 300);
        pl.position.set(6,6,6); qScene.add(pl);

        const tokens = parseQuantumConfig(el.quantum);
        const maxN   = tokens.reduce((mx,t)=>Math.max(mx,t.n),1);
        const scale  = Math.min(1.1, 5.5 / (maxN * 1.8));

        qGroups = [];
        tokens.forEach(tok => {
            const col  = ORBITAL_COLORS[tok.type] || 0xffffff;
            const len  = tok.n * 0.85 * scale;
            buildToken(tok, len, col).forEach(({ g, sub }) => {
                qScene.add(g);
                qGroups.push({ group:g, parentLabel:tok.label, subLabel:sub });
            });
        });

        // Nucleus
        const nucR = Math.max(0.07, Math.min(0.20, el.num * 0.002)) * scale * 4;
        qScene.add(new THREE.Mesh(
            new THREE.SphereGeometry(nucR, 20, 20),
            new THREE.MeshPhongMaterial({ color:0xff4422, emissive:0x881100 })
        ));

        buildQAxes(maxN, scale);
        buildConfigBar(bar, tokens);

        // Drag rotate
        const dom = qRenderer.domElement;
        dom.addEventListener('mousedown', e => { qDragging=true; qLastMouse={x:e.clientX,y:e.clientY}; });
        window.addEventListener('mouseup',   () => qDragging=false);
        window.addEventListener('mousemove', e => {
            if (!qDragging) return;
            qTheta -= (e.clientX-qLastMouse.x)*0.008;
            qPhi    = Math.max(0.1, Math.min(Math.PI-0.1, qPhi+(e.clientY-qLastMouse.y)*0.008));
            qLastMouse = {x:e.clientX,y:e.clientY};
            camUpdate();
        });
        // Scroll zoom
        dom.addEventListener('wheel', e => {
            e.preventDefault();
            qRadius = Math.max(1.5, Math.min(30, qRadius+e.deltaY*0.015));
            camUpdate();
        }, { passive:false });
        // Click viewport → exit sub mode
        vp.addEventListener('click', () => { if (qSubMode) exitSubMode(); else allReset(); });

        // Auto rotate
        function render() {
            qRAF = requestAnimationFrame(render);
            if (!qDragging) { qTheta += 0.004; camUpdate(); }
            qRenderer.render(qScene, qCamera);
        }
        render();
    }


    function stopElPlanetary() {
        if (elPlanetaryRAF) { cancelAnimationFrame(elPlanetaryRAF); elPlanetaryRAF = null; }
    }

    function startElPlanetary() {
        stopElPlanetary();
        const pCtx = elPlanetaryCanvas.getContext("2d");

        // Get current element's actual proton count from the modal
        const protons  = parseInt(document.getElementById("elModalNum").textContent);
        const neutrons = Math.round(protons * 1.2);
        const maxShell = [2, 8, 8, 18, 18, 32, 32];
        let remaining  = protons;
        const shells   = [];
        for (let s = 0; s < maxShell.length && remaining > 0; s++) {
            shells.push(Math.min(remaining, maxShell[s]));
            remaining -= shells[shells.length - 1];
        }

        // Krypton = 36 protons, 4 shells — dynamic sizing up to Kr, capped after
        const KR_NUCLEUS  = Math.max(16, Math.min(34, 10 + 36 * 0.35)); // ~22.6
        const KR_SHELLS   = 4;
        const KR_GAP      = 44;
        const KR_OUTER    = KR_NUCLEUS + KR_GAP * KR_SHELLS; // the cap radius

        const nucleusR = protons <= 36
            ? Math.max(16, Math.min(34, 10 + protons * 0.35))
            : KR_NUCLEUS;
        const SHELL_GAP = protons <= 36
            ? KR_GAP
            : (KR_OUTER - nucleusR) / KR_SHELLS; // same visual size as Kr's 4-shell model
        const outerR  = nucleusR + SHELL_GAP * shells.length; // may grow for >4 shells
        const padding = 20;

        // Canvas is always a square fitting the outermost orbit
        // Box width is set to match so no horizontal scroll needed
        const size = (outerR + padding) * 2;
        elPlanetaryCanvas.width  = size;
        elPlanetaryCanvas.height = size;
        elPlanetaryCanvas.style.width  = size + "px";
        elPlanetaryCanvas.style.height = size + "px";
        // Expand the panel and modal to fit horizontally
        elPanelPlanetary.style.minWidth  = size + "px";
        document.querySelector(".el-modal-inner").style.width = Math.max(420, size + 48) + "px";

        const cx = size / 2, cy = size / 2;
        const angles = shells.map((count, s) => Array.from({length: count}, (_, i) => (2 * Math.PI * i) / count));
        const speeds = shells.map((_, s) => 0.014 / (s + 1));

        function draw() {
            pCtx.clearRect(0, 0, size, size);
            // Orbits
            for (let s = 0; s < shells.length; s++) {
                const r = nucleusR + SHELL_GAP * (s + 1);
                pCtx.beginPath();
                pCtx.arc(cx, cy, r, 0, Math.PI * 2);
                pCtx.strokeStyle = "rgba(255,255,230,0.15)";
                pCtx.lineWidth = 1;
                pCtx.stroke();
            }
            // Nucleus
            const g = pCtx.createRadialGradient(cx - nucleusR*0.3, cy - nucleusR*0.3, 1, cx, cy, nucleusR);
            g.addColorStop(0, "rgba(255,160,120,1)");
            g.addColorStop(0.5, "rgba(200,60,40,0.95)");
            g.addColorStop(1, "rgba(140,20,10,0.85)");
            pCtx.beginPath();
            pCtx.arc(cx, cy, nucleusR, 0, Math.PI * 2);
            pCtx.fillStyle = g;
            pCtx.fill();
            pCtx.beginPath();
            pCtx.arc(cx, cy, nucleusR + 5, 0, Math.PI * 2);
            pCtx.strokeStyle = "rgba(220,80,40,0.2)";
            pCtx.lineWidth = 6;
            pCtx.stroke();
            // Electrons
            for (let s = 0; s < shells.length; s++) {
                const r = nucleusR + SHELL_GAP * (s + 1);
                for (let e = 0; e < shells[s]; e++) {
                    angles[s][e] += speeds[s];
                    const ex = cx + r * Math.cos(angles[s][e]);
                    const ey = cy + r * Math.sin(angles[s][e]);
                    pCtx.beginPath(); pCtx.arc(ex, ey, 5, 0, Math.PI * 2);
                    pCtx.fillStyle = "rgba(255,230,80,0.2)"; pCtx.fill();
                    pCtx.beginPath(); pCtx.arc(ex, ey, 3.5, 0, Math.PI * 2);
                    pCtx.fillStyle = "rgba(255,220,60,0.95)"; pCtx.fill();
                }
            }
            elPlanetaryRAF = requestAnimationFrame(draw);
        }
        draw();

        // Nucleus hover tooltip
        elPlanetaryCanvas.onmousemove = (e) => {
            const r = elPlanetaryCanvas.getBoundingClientRect();
            const dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
            if (dx*dx + dy*dy <= nucleusR*nucleusR) {
                elPlanetaryTooltip.textContent = `Protons: ${protons}  •  Neutrons: ${neutrons}`;
                elPlanetaryTooltip.style.left = (e.clientX - elPanelPlanetary.getBoundingClientRect().left + 12) + "px";
                elPlanetaryTooltip.style.top  = (e.clientY - elPanelPlanetary.getBoundingClientRect().top  - 36) + "px";
                elPlanetaryTooltip.classList.add("visible");
            } else { elPlanetaryTooltip.classList.remove("visible"); }
        };
        elPlanetaryCanvas.onmouseleave = () => elPlanetaryTooltip.classList.remove("visible");
    }
    animate();
}

initLab();