(function () {

    document.getElementById("libBackBtn").addEventListener("click", () => loadPage("landing"));

    // ---- Topics Data ----
    const SECTIONS = [
        {
            label: "Fundamentals",
            topics: [
                { name: "Atomic Structure",        icon: "⚛",  tag: "core",     accent: "#4cc9f0" },
                { name: "Quantum Numbers",          icon: "🔢", tag: "core",     accent: "#4cc9f0" },
                { name: "Electronic Configuration", icon: "🧮", tag: "core",     accent: "#4cc9f0" },
                { name: "The Periodic Table",       icon: "🗂", tag: "core",     accent: "#4cc9f0" },
            ]
        },
        {
            label: "Orbitals & Bonding",
            topics: [
                { name: "Orbital Shapes",     icon: "🫧", tag: "structure", accent: "#b517ff" },
                { name: "Chemical Bonding",   icon: "🔗", tag: "structure", accent: "#b517ff" },
                { name: "Molecular Geometry", icon: "📐", tag: "structure", accent: "#b517ff" },
                { name: "Hybridization",      icon: "🔀", tag: "structure", accent: "#b517ff" },
            ]
        },
        {
            label: "Deeper Concepts",
            topics: [
                { name: "Periodic Trends",        icon: "📈", tag: "advanced", accent: "#ff8c00" },
                { name: "Radioactivity & Nuclear", icon: "☢",  tag: "advanced", accent: "#ff8c00" },
                { name: "Thermochemistry",         icon: "🔥", tag: "advanced", accent: "#ff8c00" },
                { name: "Reaction Kinetics",       icon: "⏱", tag: "advanced", accent: "#ff8c00" },
            ]
        },
        {
            label: "The Weird Stuff",
            topics: [
                { name: "Wave-Particle Duality",   icon: "〰",  tag: "quantum", accent: "#39ff6e" },
                { name: "Uncertainty Principle",   icon: "❓", tag: "quantum", accent: "#39ff6e" },
                { name: "Quantum Tunneling",        icon: "🌀", tag: "quantum", accent: "#39ff6e" },
                { name: "The Higgs Field",          icon: "✨", tag: "quantum", accent: "#39ff6e" },
            ]
        },
    ];

    // ---- Build topics grid ----
    const grid = document.getElementById("libTopicsGrid");
    SECTIONS.forEach(sec => {
        // Section header
        const hdr = document.createElement("div");
        hdr.className = "lib-section-header";
        hdr.innerHTML = `<span class="lib-section-label">${sec.label}</span><div class="lib-section-line"></div>`;
        grid.appendChild(hdr);

        // Cards
        sec.topics.forEach((t, i) => {
            const card = document.createElement("div");
            card.className = "lib-topic-card";
            card.style.setProperty("--accent", t.accent);
            card.style.animationDelay = `${i * 0.05}s`;
            card.innerHTML = `
                <span class="lib-topic-icon">${t.icon}</span>
                <div class="lib-topic-name">${t.name}</div>
                <span class="lib-topic-tag">${t.tag}</span>
            `;
            card.addEventListener("click", () => openTopic(t));
            grid.appendChild(card);
        });
    });

    // ---- Open topic ----
    function openTopic(topic) {
        const topicsEl = document.getElementById("libTopics");
        const articleEl = document.getElementById("libArticle");
        const body     = document.getElementById("libArticleBody");

        topicsEl.style.display = "none";
        articleEl.style.display = "flex";
        articleEl.style.opacity = "0";
        articleEl.style.animation = "none";
        void articleEl.offsetWidth;
        articleEl.style.animation = "panelIn 0.3s ease forwards";
        articleEl.style.setProperty("--topic-accent", topic.accent);

        body.innerHTML = "";

        document.getElementById("libArticleBack").onclick = () => {
            articleEl.style.display = "none";
            topicsEl.style.display  = "block";
        };

        fetchArticle(topic, body, null);
    }

    // ---- Show placeholder ----
    function fetchArticle(topic, bodyEl, loadingEl) {
        loadingEl.style.display = "none";
        bodyEl.style.display    = "block";
        bodyEl.innerHTML = `
            <h1>${topic.name}</h1>
            <p class="lib-subtitle" style="color:rgba(255,255,255,0.45);font-style:italic;margin-bottom:32px;">
                the void is endless... haven't found this in there yet
            </p>
        `;
    }

    // ==============================
    // ---- Higgs Field Animation ----
    // ==============================
    const canvas = document.getElementById("higgsBg");
    const ctx    = canvas.getContext("2d");

    let W, H, raf;
    let particles = [];
    let molecules = [];
    let segments  = [];
    let prevConn  = new Set();
    let frame     = 0;

    const MAX_PARTICLES  = 100;
    const SPAWN_INTERVAL = 10;
    const CONNECT_DIST   = 80;
    const COLORS = ["76,201,240","181,23,255","255,140,0","57,255,110","255,45,155"];

    function resize() {
        W = canvas.width  = canvas.offsetWidth;
        H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function spawnParticle(fx, fy) {
        if (particles.length >= MAX_PARTICLES) return;
        particles.push({
            x: fx !== undefined ? fx : Math.random()*W,
            y: fy !== undefined ? fy : Math.random()*H,
            vx: (Math.random()-0.5)*0.30,
            vy: (Math.random()-0.5)*0.30,
            r: 0, maxR: 4+Math.random()*9,
            phase: "grow",
            holdTimer: 180+Math.random()*120,
            speed: 0.05+Math.random()*0.07,
            col: COLORS[Math.floor(Math.random()*COLORS.length)],
            alpha: 0,
        });
    }

    function getConnected() {
        const n=particles.length, adj=Array.from({length:n},()=>[]);
        for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) {
            const a=particles[i],b=particles[j];
            if (a.phase==='dead'||b.phase==='dead') continue;
            const dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy);
            const thr=CONNECT_DIST*((a.r+b.r)/(a.maxR+b.maxR)*0.5+0.5);
            if (dist<thr){adj[i].push(j);adj[j].push(i);}
        }
        const visited=new Set(),chains=[];
        for (let i=0;i<n;i++) {
            if (visited.has(i)||particles[i].phase==='dead'||adj[i].length===0) continue;
            const chain=[],queue=[i];
            while (queue.length){const c=queue.shift();if(visited.has(c))continue;visited.add(c);chain.push(c);adj[c].forEach(nb=>{if(!visited.has(nb))queue.push(nb);});}
            if (chain.length>1) chains.push(chain);
        }
        return {adj,chains};
    }

    function trySpawn() {
        if (particles.length>=MAX_PARTICLES) return;
        const {chains}=getConnected();
        let spawned=false;
        if (chains.length) {
            for (const chain of [...chains].sort(()=>Math.random()-0.5)) {
                const n=chain.length;
                const prob=n===2?0.08:n===3?0.16:n===4?0.25:0.25/(n-2);
                if (Math.random()>prob) continue;
                const anchor=particles[chain[Math.floor(Math.random()*chain.length)]];
                const angle=Math.random()*Math.PI*2, dist=CONNECT_DIST*(0.4+Math.random()*0.45);
                spawnParticle(Math.max(10,Math.min(W-10,anchor.x+Math.cos(angle)*dist)),Math.max(10,Math.min(H-10,anchor.y+Math.sin(angle)*dist)));
                spawned=true; break;
            }
        }
        if (!spawned) spawnParticle();
    }

    function tryFormMolecule(chains) {
        for (const chain of chains) {
            const n=chain.length;
            if (n!==2&&n!==3) continue;
            if (Math.random()>0.0008) continue;
            const members=chain.map(i=>particles[i]);
            const dominant=members.reduce((a,b)=>a.maxR>b.maxR?a:b);
            const isCyclic=n===3&&Math.random()<0.72;
            const cx=members.reduce((s,p)=>s+p.x,0)/n, cy=members.reduce((s,p)=>s+p.y,0)/n;
            const sep=9;
            const offsets=n===2?[[-sep/2,0],[sep/2,0]]:[[0,-sep],[-sep*0.866,sep*0.5],[sep*0.866,sep*0.5]];
            molecules.push({
                x:cx,y:cy,vx:dominant.vx,vy:dominant.vy,
                members:members.map((p,i)=>({col:p.col,r:Math.max(3,p.maxR*0.7),ox:offsets[i][0],oy:offsets[i][1]})),
                cyclic:isCyclic,alpha:0.9,angle:0,spin:(Math.random()-0.5)*0.012,
            });
            chain.forEach(i=>{particles[i].phase='dead';});
            return;
        }
    }

    function breakLine(x1,y1,x2,y2,col) {
        const count=4+Math.floor(Math.random()*3);
        for (let i=0;i<count;i++) {
            const t0=i/count,t1=(i+1)/count,mx=x1+(x2-x1)*(t0+t1)/2,my=y1+(y2-y1)*(t0+t1)/2;
            const life=22+Math.random()*22;
            segments.push({x1:x1+(x2-x1)*t0,y1:y1+(y2-y1)*t0,x2:x1+(x2-x1)*t1,y2:y1+(y2-y1)*t1,vx:(mx/W-0.5)*1.0+(Math.random()-0.5)*0.6,vy:(my/H-0.5)*1.0+(Math.random()-0.5)*0.6,life,maxLife:life,col});
        }
    }

    function tick() {
        raf=requestAnimationFrame(tick); frame++;
        ctx.clearRect(0,0,W,H);
        if (frame%SPAWN_INTERVAL===0) trySpawn();

        particles=particles.filter(p=>p.phase!=='dead');
        particles.forEach(p=>{
            p.x+=p.vx; p.y+=p.vy;
            if(p.x<0||p.x>W)p.vx*=-1; if(p.y<0||p.y>H)p.vy*=-1;
            if(p.phase==='grow'){p.r=Math.min(p.r+p.speed*p.maxR,p.maxR);p.alpha=Math.min(p.alpha+0.04,0.85);if(p.r>=p.maxR)p.phase='hold';}
            else if(p.phase==='hold'){p.holdTimer--;if(p.holdTimer<=0)p.phase='shrink';}
            else if(p.phase==='shrink'){p.r=Math.max(p.r-p.speed*p.maxR*0.65,0);p.alpha=Math.max(p.alpha-0.022,0);if(p.r<=0)p.phase='dead';}
        });

        const {chains}=getConnected();
        const currConn=new Set(), connData={};
        for (let i=0;i<particles.length;i++) for (let j=i+1;j<particles.length;j++) {
            const a=particles[i],b=particles[j];
            if(a.phase==='dead'||b.phase==='dead') continue;
            const dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy);
            const thr=CONNECT_DIST*((a.r+b.r)/(a.maxR+b.maxR)*0.5+0.5);
            if(dist<thr){const key=`${i}-${j}`;currConn.add(key);connData[key]={a,b,la:Math.min(a.alpha,b.alpha)*(1-dist/thr)*0.65};}
        }
        prevConn.forEach(key=>{if(!currConn.has(key)){const[i,j]=key.split('-').map(Number);const a=particles[i],b=particles[j];if(a&&b)breakLine(a.x,a.y,b.x,b.y,a.col);}});
        prevConn=currConn;
        tryFormMolecule(chains);

        Object.values(connData).forEach(({a,b,la})=>{
            const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
            g.addColorStop(0,`rgba(${a.col},${la})`);g.addColorStop(1,`rgba(${b.col},${la})`);
            ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=g;ctx.lineWidth=1.0;ctx.stroke();
        });

        segments=segments.filter(s=>s.life>0);
        segments.forEach(s=>{
            s.x1+=s.vx;s.y1+=s.vy;s.x2+=s.vx;s.y2+=s.vy;s.life--;
            const a=(s.life/s.maxLife)*0.45;
            ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.strokeStyle=`rgba(${s.col},${a})`;ctx.lineWidth=0.7;ctx.stroke();
        });

        particles.forEach(p=>{
            if(p.r<=0)return;
            const gw=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.6);
            gw.addColorStop(0,`rgba(${p.col},${p.alpha*0.28})`);gw.addColorStop(1,`rgba(${p.col},0)`);
            ctx.beginPath();ctx.arc(p.x,p.y,p.r*2.6,0,Math.PI*2);ctx.fillStyle=gw;ctx.fill();
            ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(${p.col},${p.alpha})`;ctx.fill();
        });

        molecules=molecules.filter(m=>m.alpha>0.01);
        molecules.forEach(m=>{
            m.x+=m.vx;m.y+=m.vy;m.angle+=m.spin;
            const margin=60;
            if(m.x<-margin||m.x>W+margin||m.y<-margin||m.y>H+margin)m.alpha=Math.max(0,m.alpha-0.04);
            const cos=Math.cos(m.angle),sin=Math.sin(m.angle);
            const n=m.members.length;
            const pairs=m.cyclic&&n===3?[[0,1],[1,2],[2,0]]:Array.from({length:n-1},(_,i)=>[i,i+1]);
            pairs.forEach(([ai,bi])=>{
                const a=m.members[ai],b=m.members[bi];
                const ax=m.x+cos*a.ox-sin*a.oy,ay=m.y+sin*a.ox+cos*a.oy;
                const bx=m.x+cos*b.ox-sin*b.oy,by=m.y+sin*b.ox+cos*b.oy;
                const g=ctx.createLinearGradient(ax,ay,bx,by);
                g.addColorStop(0,`rgba(${a.col},${m.alpha*0.55})`);g.addColorStop(1,`rgba(${b.col},${m.alpha*0.55})`);
                ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.strokeStyle=g;ctx.lineWidth=1.1;ctx.stroke();
            });
            m.members.forEach(mb=>{
                const px=m.x+cos*mb.ox-sin*mb.oy,py=m.y+sin*mb.ox+cos*mb.oy;
                const gw=ctx.createRadialGradient(px,py,0,px,py,mb.r*2.4);
                gw.addColorStop(0,`rgba(${mb.col},${m.alpha*0.28})`);gw.addColorStop(1,`rgba(${mb.col},0)`);
                ctx.beginPath();ctx.arc(px,py,mb.r*2.4,0,Math.PI*2);ctx.fillStyle=gw;ctx.fill();
                ctx.beginPath();ctx.arc(px,py,mb.r,0,Math.PI*2);ctx.fillStyle=`rgba(${mb.col},${m.alpha})`;ctx.fill();
            });
        });
    }

    for (let i=0;i<22;i++) {
        spawnParticle();
        const p=particles[particles.length-1];
        p.r=Math.random()*p.maxR; p.alpha=p.r/p.maxR*0.85;
        if(p.r>=p.maxR*0.8){p.phase='hold';p.holdTimer=180+Math.random()*120;}
    }
    tick();

    window._libCleanup=()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};

})();