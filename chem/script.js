// ---------------- ROUTER ----------------

let bgAnimationActive = true;

async function loadPage(page) {
    const app = document.getElementById("app");
    const atomCanvas = document.getElementById("atomCanvas");

    // Cleanup library animation if leaving library
    if (window._libCleanup) { window._libCleanup(); window._libCleanup = null; }

    app.style.opacity = 0;

    // Hide bg immediately on navigate away
    if (page !== "landing") {
        bgAnimationActive = false;
        atomCanvas.style.visibility = "hidden";
        atomCanvas.style.opacity = "0";
    }

    setTimeout(async () => {
        const response = await fetch(page + ".html");
        const html = await response.text();
        app.innerHTML = html;

        // Remove old CSS
        const oldCSS = document.getElementById("page-style");
        if (oldCSS) oldCSS.remove();

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = page + ".css";
        link.id = "page-style";
        document.head.appendChild(link);

        // Remove old JS
        const oldJS = document.getElementById("page-script");
        if (oldJS) oldJS.remove();

        const script = document.createElement("script");
        script.src = page + ".js";
        script.id = "page-script";
        document.body.appendChild(script);

        // Lab page: make #app transparent so fixed canvas gets all pointer events
        if (page === "lab") {
            app.style.pointerEvents = "none";
        } else {
            app.style.pointerEvents = "";
        }

        // Restore bg canvas only on landing
        if (page === "landing") {
            bgAnimationActive = true;
            atomCanvas.style.visibility = "visible";
            atomCanvas.style.opacity = "1";
        }

        app.style.opacity = 1;

    }, 200);
}

window.addEventListener("DOMContentLoaded", () => {
    loadPage("landing");
});

// ---------------- ATOM BACKGROUND (landing only) ----------------
const canvas = document.getElementById("atomCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

class BgAtom {
    constructor() {
        this.baseRadius = 3;
        this.radius = this.baseRadius * (0.75 + Math.random());
        this.mass = this.radius * this.radius;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
    }

    update(atoms) {
        for (let other of atoms) {
            if (other === this) continue;
            let dx = this.x - other.x;
            let dy = this.y - other.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let minDist = this.radius + other.radius;

            if (dist > 0 && dist < minDist + 10) {
                let overlap = (minDist + 10) - dist;
                let force = overlap * 0.05;
                if (dist < minDist) force = (minDist - dist) * 0.5;
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;
                this.vx += fx / this.mass;
                this.vy += fy / this.mass;
                other.vx -= fx / other.mass;
                other.vy -= fy / other.mass;
            }
        }

        this.vx += (Math.random() - 0.5) * 0.02;
        this.vy += (Math.random() - 0.5) * 0.02;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < this.radius || this.x > canvas.width - this.radius) this.vx *= -1;
        if (this.y < this.radius || this.y > canvas.height - this.radius) this.vy *= -1;

        this.draw();
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(76, 201, 240, 0.6)";
        ctx.fill();
    }
}

const bgAtoms = [];
for (let i = 0; i < 180; i++) bgAtoms.push(new BgAtom());

function animateBg() {
    if (bgAnimationActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let atom of bgAtoms) atom.update(bgAtoms);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(animateBg);
}

animateBg();