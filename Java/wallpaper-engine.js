const WallpaperEngine = {
    currentType: localStorage.getItem('astrie_wallpaper_type') || 'static',
    currentSource: localStorage.getItem('astrie_wallpaper_source') || '/Res/Bild/Hintergrund/AstrieOS-offziellgrund.png',
    videoElement: null,
    canvasElement: null,
    shaderCanvas: null,
    gl: null,
    animationId: null,
    shaderProgram: null,
    startTime: 0,
    db: null,
    DB_NAME: 'AstrieOS_WallpaperDB',
    DB_VERSION: 1,
    STORE_NAME: 'userWallpapers',

    officialWallpapers: [
        { name: 'AstrieOS-offziellgrund.png', type: 'static', path: '/Res/Bild/Hintergrund/AstrieOS-offziellgrund.png', preview: '/Res/Bild/Hintergrund/AstrieOS-offziellgrund.png' },
        { name: 'Astrie-hintergrund-v2.png', type: 'static', path: '/Res/Bild/Hintergrund/Astrie-hintergrund-v2.png', preview: '/Res/Bild/Hintergrund/Astrie-hintergrund-v2.png' },
        { name: 'Astrie-hintergrund-blau.png', type: 'static', path: '/Res/Bild/Hintergrund/Astrie-hintergrund-blau.png', preview: '/Res/Bild/Hintergrund/Astrie-hintergrund-blau.png' },
        { name: 'astrie-hintergrund.png', type: 'static', path: '/Res/Bild/Hintergrund/astrie-hintergrund.png', preview: '/Res/Bild/Hintergrund/astrie-hintergrund.png' },
        { name: 'Default-banner.png', type: 'static', path: '/Res/Bild/Hintergrund/Default-Banner.png', preview: '/Res/Bild/Hintergrund/Default-Banner.png' },
    ],

    liveWallpapers: [
        { name: 'Starfield', type: 'canvas', id: 'starfield', description: 'Fliegende Sterne im Weltraum' },
        { name: 'Aurora Borealis', type: 'canvas', id: 'aurora', description: 'Tanzende Polarlichter' },
        { name: 'Matrix Rain', type: 'canvas', id: 'matrix', description: 'Digitaler Regen à la Matrix' },
        { name: 'Visualizer', type: 'canvas', id: 'visualizer', description: 'Fühlt dein Musik!' },
        { name: 'Particle Flow', type: 'canvas', id: 'particles', description: 'Interaktive Partikelströme' },
        { name: 'Gradient Waves', type: 'shader', id: 'gradient-waves', description: 'Fließende Farbwellen (GPU)' },
        { name: 'Nebula Cloud', type: 'shader', id: 'nebula', description: 'Prozedurale Nebelwolke (GPU)' }
    ],

    userWallpapers: [],

    // ============================================
    // INDEXEDDB
    // ============================================
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(this.db); };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    },

    async getAllWallpapers() {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async saveWallpaper(wallpaper) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.put(wallpaper);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject({ source: 'request', error: request.error, event: e });
            tx.onerror = (e) => reject({ source: 'transaction', error: tx.error, event: e });
            tx.onabort = (e) => reject({ source: 'abort', error: 'Transaction aborted', event: e });
        });
    },

    async deleteWallpaper(id) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getWallpaperCount() {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // ============================================
    // SPEICHER-PRÜFUNG
    // ============================================
    async checkStorage(fileSize) {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const used = estimate.usage || 0;
                const total = estimate.quota || 0;
                const available = total - used;
                console.log('Speicher:', { used: this.formatBytes(used), total: this.formatBytes(total), available: this.formatBytes(available) });
                if (available < fileSize * 1.5) {
                    return { ok: false, reason: 'Nicht genug Speicher verfügbar. Verfügbar: ' + this.formatBytes(available) + ', Benötigt: ~' + this.formatBytes(fileSize * 1.5) };
                }
            }
            return { ok: true };
        } catch (e) {
            console.warn('Speicherprüfung fehlgeschlagen:', e);
            return { ok: true };
        }
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // ============================================
    // BILDKOMPRIMIERUNG
    // ============================================
    async compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let width = img.width, height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const byteString = atob(dataUrl.split(',')[1]);
                const newSize = byteString.length;
                console.log('Bild komprimiert:', this.formatBytes(file.size), '→', this.formatBytes(newSize));
                resolve(dataUrl);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht geladen werden')); };
            img.src = url;
        });
    },

    // ============================================
    // AUTO-SCROLL HILFSFUNKTION
    // ============================================
    initAutoScroll(element) {
        // Prüfe ob Text zu lang ist
        if (element.scrollWidth > element.clientWidth) {
            const diff = element.scrollWidth - element.clientWidth;
            // Dauer basierend auf Länge (min 4s, max 12s)
            const duration = Math.max(4, Math.min(12, diff / 15));
            element.style.setProperty('--scroll-dur', duration + 's');
            element.style.setProperty('--scroll-dist', '-' + (diff + 20) + 'px');
            element.classList.add('scroll');
        }
    },

    // ============================================
    // INITIALISIERUNG
    // ============================================
    async init() {
        await this.initDB();
        await this.loadUserWallpapers();
        this.applyWallpaper(this.currentType, this.currentSource);
        this.renderWallpaperMenus();
    },

    // ============================================
    // WALLPAPER ANWENDEN
    // ============================================
    applyWallpaper(type, source) {
        this.cleanup();
        this.currentType = type;
        this.currentSource = source;
        localStorage.setItem('astrie_wallpaper_type', type);
        localStorage.setItem('astrie_wallpaper_source', source);
        const desktop = document.getElementById('desktop-wallpaper');
        if (!desktop) return;
        switch(type) {
            case 'static': this.applyStatic(desktop, source); break;
            case 'video': this.applyVideo(desktop, source); break;
            case 'canvas': this.applyCanvas(desktop, source); break;
            case 'shader': this.applyShader(desktop, source); break;
        }
        this.updateActiveSelection();
    },

    applyStatic(desktop, source) {
        desktop.innerHTML = '';
        desktop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-image: url('${source}'); background-position: center; background-size: cover; background-repeat: no-repeat; z-index: -1;`;
    },

    applyVideo(desktop, source) {
        desktop.innerHTML = '';
        desktop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1;';
        this.videoElement = document.createElement('video');
        this.videoElement.src = source;
        this.videoElement.autoplay = true;
        this.videoElement.loop = true;
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;
        this.videoElement.style.cssText = 'position: absolute; top: 50%; left: 50%; min-width: 100%; min-height: 100%; width: auto; height: auto; transform: translate(-50%, -50%); object-fit: cover;';
        desktop.appendChild(this.videoElement);
        this.videoElement.play().catch(e => console.log('Video autoplay blocked:', e));
    },

    applyCanvas(desktop, canvasId) {
        desktop.innerHTML = '';
        desktop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background: #000;';
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
        desktop.appendChild(this.canvasElement);
        const ctx = this.canvasElement.getContext('2d');
        this.resizeCanvas();
        this.startCanvasRenderer(canvasId, ctx);
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    },

    applyShader(desktop, shaderId) {
        desktop.innerHTML = '';
        desktop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background: #000;';
        this.shaderCanvas = document.createElement('canvas');
        this.shaderCanvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
        desktop.appendChild(this.shaderCanvas);
        this.gl = this.shaderCanvas.getContext('webgl') || this.shaderCanvas.getContext('experimental-webgl');
        if (!this.gl) { console.error('WebGL nicht unterstützt!'); this.applyStatic(desktop, '/Res/Bild/Hintergrund/AstrieOS-offziellgrund.png'); return; }
        this.resizeShaderCanvas();
        this.startShaderRenderer(shaderId);
        window.addEventListener('resize', this.resizeShaderCanvas.bind(this));
    },

    // ============================================
    // CANVAS RENDERER
    // ============================================
    startCanvasRenderer(id, ctx) {
        this.startTime = Date.now();
        switch(id) {
            case 'starfield': this.renderStarfield(ctx); break;
            case 'aurora': this.renderAurora(ctx); break;
            case 'matrix': this.renderMatrix(ctx); break;
            case 'particles': this.renderParticles(ctx); break;
        }
    },

    renderStarfield(ctx) {
        const stars = [];
        for (let i = 0; i < 400; i++) stars.push({ x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000, z: Math.random() * 2000, size: Math.random() * 2 + 0.5 });
        const animate = () => {
            if (!this.canvasElement) return;
            const w = this.canvasElement.width, h = this.canvasElement.height, cx = w/2, cy = h/2;
            ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, w, h);
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
            gradient.addColorStop(0, 'rgba(40, 20, 80, 0.3)'); gradient.addColorStop(0.5, 'rgba(20, 10, 50, 0.1)'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
            stars.forEach(star => {
                star.z -= 2;
                if (star.z <= 0) { star.z = 2000; star.x = Math.random() * w - cx; star.y = Math.random() * h - cy; }
                const sx = (star.x / star.z) * 500 + cx, sy = (star.y / star.z) * 500 + cy;
                const size = (1 - star.z / 2000) * star.size * 3, brightness = (1 - star.z / 2000);
                if (sx > 0 && sx < w && sy > 0 && sy < h) {
                    ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fillStyle = `rgba(200, 220, 255, ${brightness})`; ctx.fill();
                    if (brightness > 0.7) { ctx.beginPath(); ctx.arc(sx, sy, size * 3, 0, Math.PI * 2); ctx.fillStyle = `rgba(150, 180, 255, ${brightness * 0.2})`; ctx.fill(); }
                }
            });
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    },

    renderAurora(ctx) {
        const animate = () => {
            if (!this.canvasElement) return;
            const w = this.canvasElement.width, h = this.canvasElement.height, time = (Date.now() - this.startTime) * 0.001;
            ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 100; i++) { const sx = (i * 137.5) % w, sy = (i * 89.7) % (h * 0.6); const twinkle = Math.sin(time * 2 + i) * 0.5 + 0.5; ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.8})`; ctx.fill(); }
            const colors = [{r:0,g:255,b:150},{r:100,g:0,b:255},{r:255,g:50,b:150},{r:0,g:200,b:255}];
            colors.forEach((color, layer) => {
                ctx.beginPath(); ctx.moveTo(0, h);
                for (let x = 0; x <= w; x += 5) { const y = h * 0.3 + Math.sin(x * 0.003 + time * 0.5 + layer) * 80 + Math.sin(x * 0.007 + time * 0.3 + layer * 2) * 40 + Math.sin(x * 0.001 + time * 0.8) * 60; ctx.lineTo(x, y); }
                ctx.lineTo(w, h); ctx.closePath();
                const grad = ctx.createLinearGradient(0, h * 0.2, 0, h);
                grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0)`); grad.addColorStop(0.3, `rgba(${color.r},${color.g},${color.b},0.3)`); grad.addColorStop(0.6, `rgba(${color.r},${color.g},${color.b},0.1)`); grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
                ctx.fillStyle = grad; ctx.fill();
            });
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    },

    renderMatrix(ctx) {
        const w = this.canvasElement.width, h = this.canvasElement.height, fontSize = 16;
        const columns = Math.floor(w / fontSize), drops = Array(columns).fill(1);
        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
        const animate = () => {
            if (!this.canvasElement) return;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; ctx.fillRect(0, 0, w, h);
            ctx.font = `${fontSize}px monospace`;
            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)], x = i * fontSize, y = drops[i] * fontSize;
                const brightness = Math.random(); ctx.fillStyle = brightness > 0.95 ? '#fff' : `rgba(0, 255, 100, ${0.5 + brightness * 0.5})`; ctx.fillText(char, x, y);
                if (y > h && Math.random() > 0.975) drops[i] = 0; drops[i]++;
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    },

    renderParticles(ctx) {
        const particles = [], numParticles = 150;
        const w = this.canvasElement.width, h = this.canvasElement.height;
        let mouseX = w / 2, mouseY = h / 2;
        const onMouseMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
        document.addEventListener('mousemove', onMouseMove); this._mouseHandler = onMouseMove;
        for (let i = 0; i < numParticles; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, size: Math.random() * 3 + 1, color: `hsl(${Math.random() * 60 + 240}, 70%, 60%)` });
        const animate = () => {
            if (!this.canvasElement) return;
            const cw = this.canvasElement.width, ch = this.canvasElement.height;
            ctx.fillStyle = 'rgba(10, 5, 30, 0.15)'; ctx.fillRect(0, 0, cw, ch);
            particles.forEach((p, i) => {
                const dx = mouseX - p.x, dy = mouseY - p.y, dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200) { p.vx += dx * 0.0001; p.vy += dy * 0.0001; }
                p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.vy *= 0.99;
                if (p.x < 0) p.x = cw; if (p.x > cw) p.x = 0; if (p.y < 0) p.y = ch; if (p.y > ch) p.y = 0;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
                for (let j = i + 1; j < particles.length; j++) { const p2 = particles[j], ddx = p.x - p2.x, ddy = p.y - p2.y, d = Math.sqrt(ddx * ddx + ddy * ddy); if (d < 100) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = `rgba(150, 100, 255, ${(1 - d / 100) * 0.2})`; ctx.lineWidth = 0.5; ctx.stroke(); } }
            });
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    },

    // ============================================
    // SHADER RENDERER
    // ============================================
    startShaderRenderer(shaderId) {
        this.startTime = Date.now(); const gl = this.gl;
        const vsSource = `attribute vec4 aPosition; void main() { gl_Position = aPosition; }`;
        const shaders = {
            'gradient-waves': `precision highp float; uniform float uTime; uniform vec2 uResolution; void main() { vec2 uv = gl_FragCoord.xy / uResolution.xy; float t = uTime * 0.3; vec3 col = vec3(0.0); col.r = sin(uv.x * 3.0 + t) * 0.5 + 0.5; col.g = sin(uv.y * 3.0 + t * 1.3) * 0.5 + 0.5; col.b = sin((uv.x + uv.y) * 2.0 + t * 0.7) * 0.5 + 0.5; col = mix(col, vec3(0.4, 0.2, 0.6), 0.3); gl_FragColor = vec4(col, 1.0); }`,
            'nebula': `precision highp float; uniform float uTime; uniform vec2 uResolution; float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float smoothNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = noise(i); float b = noise(i + vec2(1.0, 0.0)); float c = noise(i + vec2(0.0, 1.0)); float d = noise(i + vec2(1.0, 1.0)); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); } float fbm(vec2 p) { float value = 0.0; float amplitude = 0.5; for (int i = 0; i < 5; i++) { value += amplitude * smoothNoise(p); p *= 2.0; amplitude *= 0.5; } return value; } void main() { vec2 uv = gl_FragCoord.xy / uResolution.xy; float t = uTime * 0.1; vec2 p = uv * 3.0; float n = fbm(p + t); float n2 = fbm(p * 1.5 - t * 0.5); vec3 col = vec3(0.05, 0.02, 0.1); col += vec3(0.3, 0.1, 0.5) * n; col += vec3(0.1, 0.3, 0.6) * n2 * 0.5; col += vec3(0.5, 0.2, 0.8) * pow(n * n2, 2.0); gl_FragColor = vec4(col, 1.0); }`
        };
        const fsSource = shaders[shaderId] || shaders['gradient-waves'];
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        this.shaderProgram = gl.createProgram(); gl.attachShader(this.shaderProgram, vertexShader); gl.attachShader(this.shaderProgram, fragmentShader); gl.linkProgram(this.shaderProgram);
        if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) { console.error('Shader link error:', gl.getProgramInfoLog(this.shaderProgram)); return; }
        const positions = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
        const positionBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const positionLocation = gl.getAttribLocation(this.shaderProgram, 'aPosition'); gl.enableVertexAttribArray(positionLocation); gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        const timeLocation = gl.getUniformLocation(this.shaderProgram, 'uTime'); const resolutionLocation = gl.getUniformLocation(this.shaderProgram, 'uResolution');
        const animate = () => {
            if (!this.gl) return; const time = (Date.now() - this.startTime) * 0.001;
            gl.viewport(0, 0, this.shaderCanvas.width, this.shaderCanvas.height); gl.useProgram(this.shaderProgram);
            gl.uniform1f(timeLocation, time); gl.uniform2f(resolutionLocation, this.shaderCanvas.width, this.shaderCanvas.height); gl.drawArrays(gl.TRIANGLES, 0, 6);
            this.animationId = requestAnimationFrame(animate);
        }; animate();
    },

    compileShader(type, source) {
        const gl = this.gl; const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { console.error('Shader compile error:', gl.getShaderInfoLog(shader)); gl.deleteShader(shader); return null; }
        return shader;
    },

    resizeCanvas() { if (!this.canvasElement) return; this.canvasElement.width = window.innerWidth; this.canvasElement.height = window.innerHeight; },
    resizeShaderCanvas() { if (!this.shaderCanvas) return; this.shaderCanvas.width = window.innerWidth; this.shaderCanvas.height = window.innerHeight; if (this.gl) this.gl.viewport(0, 0, this.shaderCanvas.width, this.shaderCanvas.height); },

    cleanup() {
        if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
        if (this.videoElement) { this.videoElement.pause(); this.videoElement.src = ''; this.videoElement = null; }
        if (this.canvasElement) { if (this._mouseHandler) { document.removeEventListener('mousemove', this._mouseHandler); this._mouseHandler = null; } this.canvasElement = null; }
        if (this.shaderCanvas) { if (this.gl && this.shaderProgram) { this.gl.deleteProgram(this.shaderProgram); } this.shaderCanvas = null; this.gl = null; this.shaderProgram = null; }
        window.removeEventListener('resize', this.resizeCanvas); window.removeEventListener('resize', this.resizeShaderCanvas);
    },

    // ============================================
    // NUTZER WALLPAPERS
    // ============================================
    async loadUserWallpapers() {
        try { const wallpapers = await this.getAllWallpapers(); this.userWallpapers = wallpapers.map(wp => ({ id: wp.id, name: wp.name, type: wp.type, date: wp.date })); }
        catch (e) { console.error('Fehler beim Laden der Wallpapers:', e); this.userWallpapers = []; }
    },

    async addUserWallpaper(file) {
        const count = await this.getWallpaperCount();
        if (count >= 50) { alert('Maximale Anzahl an Wallpapers erreicht (50)! Lösche zuerst welche.'); return; }
        if (file.size > 50 * 1024 * 1024) { alert('Datei zu groß! Maximum ist 50MB.'); return; }
        const storageCheck = await this.checkStorage(file.size);
        if (!storageCheck.ok) { alert('Speicherprüfung: ' + storageCheck.reason); return; }
        let dataUrl;
        let finalType = file.type.startsWith('video/') ? 'video' : 'static';
        try {
            if (finalType === 'static' && file.type.startsWith('image/')) {
                console.log('Komprimiere Bild...');
                dataUrl = await this.compressImage(file, 1920, 1080, 0.85);
            } else if (finalType === 'video') {
                if (file.size > 20 * 1024 * 1024) { alert('Video zu groß! Maximum für Videos ist 10MB (empfohlen: komprimiere das Video vorher).'); return; }
                dataUrl = await this.readFileAsDataURL(file);
            } else {
                dataUrl = await this.readFileAsDataURL(file);
            }
        } catch (err) {
            console.error('Fehler beim Verarbeiten:', err);
            alert('Fehler beim Verarbeiten der Datei: ' + err.message);
            return;
        }
        const wallpaper = { id: 'user_' + Date.now(), name: file.name, type: finalType, data: dataUrl, date: new Date().toISOString() };
        try {
            await this.saveWallpaper(wallpaper);
            this.userWallpapers.push({ id: wallpaper.id, name: wallpaper.name, type: wallpaper.type, date: wallpaper.date });
            this.renderWallpaperMenus();
            this.applyWallpaper(wallpaper.type, wallpaper.data);
            console.log('Wallpaper erfolgreich gespeichert!');
        } catch (err) {
            console.error('Speicherfehler (Details):', err);
            let errorMsg = 'Fehler beim Speichern!';
            if (err && err.error) errorMsg += '\nTechnisch: ' + err.error;
            if (err && err.source) errorMsg += '\nQuelle: ' + err.source;
            if (err && err.error && err.error.name) errorMsg += '\nName: ' + err.error.name;
            if (err && err.error && err.error.message) errorMsg += '\nNachricht: ' + err.error.message;
            errorMsg += '\n\nTipp: Probiere ein kleineres Bild (unter 1MB) oder lösche alte Wallpapers.';
            alert(errorMsg);
        }
    },

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('FileReader Fehler: ' + e));
            reader.readAsDataURL(file);
        });
    },

    async removeUserWallpaper(id) {
        try { await this.deleteWallpaper(id); this.userWallpapers = this.userWallpapers.filter(w => w.id !== id); this.renderWallpaperMenus(); }
        catch (e) { console.error('Fehler beim Löschen:', e); }
    },

    // ============================================
    // UI RENDERING - NEUE PREVIEW-CARDS
    // ============================================
    renderWallpaperMenus() {
        this.renderOfficialMenu();
        this.renderUserMenu();
        this.renderLiveMenu();
        this.updateActiveSelection();
        // Auto-Scroll nach dem Rendern initialisieren
        setTimeout(() => this.initAllAutoScrolls(), 100);
    },

    initAllAutoScrolls() {
        document.querySelectorAll('.wallpaper-title').forEach(el => this.initAutoScroll(el));
    },

    renderOfficialMenu() {
        const menu = document.getElementById('desktop-offizell-papier-menu');
        if (!menu) return;
        menu.innerHTML = this.officialWallpapers.map(wp => {
            const isActive = this.currentType === 'static' && this.currentSource === wp.path;
            return `
            <div class="Desktop-item wallpaper-item ${isActive ? 'active-wallpaper' : ''}" 
                 data-type="static" 
                 data-source="${wp.path}"
                 style="background-image: url('${wp.preview}')"
                 onclick="WallpaperEngine.applyWallpaper('static', '${wp.path}')">
                <div class="wallpaper-preview" style="background-image: url('${wp.preview}')"></div>
                <div class="wallpaper-meta">
                    <div class="wallpaper-title">${wp.name}</div>
                </div>
            </div>
            `;
        }).join('');
    },

    renderUserMenu() {
        const menu = document.getElementById('nutzer-papier-menu');
        if (!menu) return;
        if (this.userWallpapers.length === 0) { menu.innerHTML = '<div class="Desktop-item"><p>Ganz leere menü... :(</p></div>'; return; }
        menu.innerHTML = this.userWallpapers.map(wp => {
            const isActive = this.currentType === wp.type && this.currentSource === wp.data;
            return `
            <div class="Desktop-item wallpaper-item ${isActive ? 'active-wallpaper' : ''}"
                 data-type="${wp.type}" 
                 data-source="${wp.data || ''}"
                 style="background: linear-gradient(135deg, #1a0a2e, #4a1a6e)"
                 onclick="WallpaperEngine.loadAndApplyUserWallpaper('${wp.id}')">
                <div class="wallpaper-preview" style="background: linear-gradient(135deg, #2a1a4e, #6a3a9e)"></div>
                <div class="wallpaper-meta">
                    <div class="wallpaper-title">${wp.name}</div>
                </div>
                <span class="wallpaper-delete" onclick="event.stopPropagation(); WallpaperEngine.removeUserWallpaper('${wp.id}')">×</span>
            </div>
            `;
        }).join('');
    },

    async loadAndApplyUserWallpaper(id) {
        try { const wallpapers = await this.getAllWallpapers(); const wallpaper = wallpapers.find(w => w.id === id); if (wallpaper) this.applyWallpaper(wallpaper.type, wallpaper.data); }
        catch (e) { console.error('Fehler beim Laden:', e); }
    },

    renderLiveMenu() {
        const menu = document.getElementById('live-papier-menu');
        if (!menu) return;
        menu.innerHTML = this.liveWallpapers.map(wp => {
            const isActive = this.currentType === wp.type && this.currentSource === wp.id;
            return `
            <div class="Desktop-item wallpaper-item ${isActive ? 'active-wallpaper' : ''}"
                 data-type="${wp.type}" 
                 data-source="${wp.id}"
                 style="background: linear-gradient(135deg, #1a0a2e, #4a1a6e)"
                 onclick="WallpaperEngine.applyWallpaper('${wp.type}', '${wp.id}')">
                <div class="wallpaper-preview live-preview ${wp.type}-preview">
                    <span class="live-badge">LIVE</span>
                </div>
                <div class="wallpaper-meta">
                    <div class="wallpaper-title">${wp.name}</div>
                    <div class="wallpaper-desc">${wp.description}</div>
                </div>
            </div>
            `;
        }).join('');
    },

    updateActiveSelection() {
        document.querySelectorAll('.wallpaper-item').forEach(item => {
            const type = item.dataset.type, source = item.dataset.source;
            if (type === this.currentType && source === this.currentSource) item.classList.add('active-wallpaper');
            else item.classList.remove('active-wallpaper');
        });
    }
};

function livetoggle() { const dropdown = document.getElementById('live-papier-menu'); if (dropdown) dropdown.classList.toggle('open'); }

document.addEventListener('DOMContentLoaded', function() {
    WallpaperEngine.init();
    const uploadBtn = document.getElementById('user-upload');
    if (uploadBtn) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*,video/*'; fileInput.style.display = 'none'; fileInput.id = 'wallpaper-upload-input';
        document.body.appendChild(fileInput);
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) WallpaperEngine.addUserWallpaper(e.target.files[0]); });
    }
});