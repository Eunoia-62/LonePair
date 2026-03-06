# LonePair
# ⚛ LonePair

**LonePair** is an interactive chemistry and physics web app built to make atomic and quantum concepts genuinely visual and explorable — not just readable.

No frameworks. No bundlers. Just a browser.

---

## The Lab

The core of LonePair. A dark sandbox where atoms live, bounce, and collide.

Spawn atoms by clicking empty space. Right-click to delete. Each atom has mass-dependent physics — heavier atoms hit harder, move slower. You can tune size, velocity, and direction before spawning.

The real depth is in the **Periodic Table**. Open it, click any of the 118 elements, and a detail modal slides in with everything about that element — atomic mass, radius, electronegativity, ionization energy, oxidation states, standard state, occurrence, and stability. Radioactive elements show their half-life in human-readable form (from milliseconds for synthetic superheavies, to billions of years for thorium).

Inside the modal, two model views:

### Planetary Model
A live animated Bohr model. Electrons orbit their shells in real time, outer shells moving slower than inner ones. The nucleus shows proton and neutron count on hover. Shell sizing adapts dynamically up to Krypton, then caps so heavy elements don't explode off the screen.

### Quantum Model
A full 3D orbital renderer powered by Three.js. Every shell of every element is rendered simultaneously — s orbitals as spheres, p orbitals as teardrop lobes along x/y/z, d orbitals as cloverleaf patterns (dxy, dxz, dyz between axes; dx²-y² on axes; dz² with its characteristic torus ring), and f orbitals each with their own distinct geometry. Colored by type: cyan for s, purple for p, orange for d, pink for f.

The electronic configuration is shown in full — no noble gas shorthand. Every token in the config bar is hoverable to isolate that orbital, and clickable to enter sub-orbital mode where you can inspect px, py, pz individually, or dxy vs dz², etc. Drag to rotate. Scroll to zoom. x/y/z axes labeled and bidirectional.

---

## The Library

A frosted glass panel floating over a generative background — the **Higgs Field**.

Particles spawn randomly across the canvas, grow, drift, connect to nearby particles with glowing gradient lines, then shrink and die. When a connection breaks, the line shatters into fragments that drift apart and fade. The spawning is chain-biased: when particles are bonded, new ones are more likely to appear nearby, encouraging chains and clusters to form naturally.

Occasionally — rarely, like the real thing — two or three bonded particles don't die. They collapse together, lock into a molecule (linear or cyclic triangle), and drift off screen in the direction of whichever particle had the most energy. Then they're gone.

The library itself holds 16 topic articles across four sections: Fundamentals, Orbitals & Bonding, Deeper Concepts, and The Weird Stuff — from atomic structure all the way to the Higgs field and quantum tunneling.

---

## Built With

- Vanilla HTML, CSS, JavaScript
- [Three.js r128](https://threejs.org/) for 3D orbital rendering
- Orbitron + Inter from Google Fonts
- Runs on any static file server

---

*Built from scratch, one electron at a time.*
