// Todo list 3000:
// 1. Singlecore und Multicore function (ich meinte wirklich)
// 2. Fps limit function (das auch)

// --- Threading-Modus ---
let threadMode = localStorage.getItem('astrie_thread_mode') || 'singlecore';

function Thread_modus() {
    toggleMenu('thread-menu');
}

// --- FPS-Limit ---
let fpsLimit = localStorage.getItem('astrie_fps_limit') || 'v-sync';

function Fpslimit() {
    toggleMenu('limit-menu');
}

// --- FPS-Zeiger ---
let fpsVisible = localStorage.getItem('astrie_fps_visible') === 'true';
let fpsOverlay = null;
let tickId = null;
let lastTime = 0;
let lastTickTime = 0;
let frameCount = 0;
let currentFps = 0;

function Fpszeigen() {
    fpsVisible = !fpsVisible;
    localStorage.setItem('astrie_fps_visible', fpsVisible);
    updateFpsDisplay();
}

// FPS-Limit Mapping zu echten Zahlen
const FPS_LIMITS = {
    'v-sync': 60,
    '2x-refresh rate': 120,
    '4x-refresh rate': 240,
    '8x-refresh rate': 480,
    'komplett unlimitiv': 0
};

function getTargetFps() {
    return FPS_LIMITS[fpsLimit] !== undefined ? FPS_LIMITS[fpsLimit] : 60;
}

function toggleMenu(menuId) {
    const rendererMenus = ['limit-menu', 'thread-menu'];
    rendererMenus.forEach(id => {
        const el = document.getElementById(id);
        if (el && id !== menuId) el.style.display = 'none';
    });
    
    const menu = document.getElementById(menuId);
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

// ============================================
// FPS COUNTER ENGINE (ECHTE FUNKTION!)
// ============================================

function createFpsOverlay() {
    if (fpsOverlay) return;
    
    fpsOverlay = document.createElement('div');
    fpsOverlay.id = 'fps-zeiger';
    fpsOverlay.style.cssText = `
        position: fixed;
        bottom: 48px;
        left: 10px;
        background: rgba(0,0,0,0.85);
        color: #00ff88;
        font-family: 'Google-sans';
        font-size: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        z-index: 99999;
        pointer-events: none;
        border: 1px solid rgba(0,255,136,0.3);
        backdrop-filter: blur(6px);
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        transition: opacity 0.2s ease;
        min-width: 120px;
    `;
    document.body.appendChild(fpsOverlay);
}

function updateFpsOverlay() {
    if (!fpsOverlay) return;
    
    let color = '#00ff88';
    let glow = 'rgba(0,255,136,0.5)';
    if (currentFps < 30) {
        color = '#ff4444';
        glow = 'rgba(255,68,68,0.5)';
    } else if (currentFps < 55) {
        color = '#ffcc00';
        glow = 'rgba(255,204,0,0.5)';
    }
    
    fpsOverlay.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;box-shadow:0 0 8px ${glow};animation:pulse 1s infinite;"></span>
            <span style="font-size:14px;font-weight:bold;color:${color};">${currentFps} FPS</span>
        </div>
        <div style="font-size:10px;opacity:0.7;color:#aaa;">Limit: ${fpsLimit}</div>
        <div style="font-size:10px;opacity:0.7;color:#aaa;">Thread: ${threadMode === 'multicore' ? 'Multi-Core' : 'Single-Core'}</div>
        <style>
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        </style>
    `;
}

function updateFpsDisplay() {
    const btn = document.querySelector('.Render-fps-zeigen');
    
    if (fpsVisible) {
        if (!fpsOverlay) createFpsOverlay();
        fpsOverlay.style.display = 'block';
        fpsOverlay.style.opacity = '1';
        
        if (btn) {
            btn.style.background = 'rgba(0, 255, 136, 0.15)';
            btn.style.borderLeft = '3px solid #00ff88';
            btn.style.fontWeight = 'bold';
        }
        
        if (!tickId) startFpsLoop();
    } else {
        if (fpsOverlay) {
            fpsOverlay.style.opacity = '0';
            setTimeout(() => {
                if (!fpsVisible && fpsOverlay) fpsOverlay.style.display = 'none';
            }, 200);
        }
        if (btn) {
            btn.style.background = 'transparent';
            btn.style.borderLeft = '3px solid transparent';
            btn.style.fontWeight = 'normal';
        }
        stopFpsLoop();
    }
}

// ============================================
// ECHTER RENDERER LOOP (Singlecore/Multicore + FPS-Limit)
// ============================================

function startFpsLoop() {
    if (tickId) return;
    lastTime = performance.now();
    lastTickTime = lastTime;
    frameCount = 0;
    scheduleTick();
}

function stopFpsLoop() {
    if (tickId) {
        clearTimeout(tickId);
        cancelAnimationFrame(tickId);
        tickId = null;
    }
}

function restartFpsLoop() {
    stopFpsLoop();
    if (fpsVisible) startFpsLoop();
}

function scheduleTick() {
    if (!fpsVisible) return;
    
    const targetFps = getTargetFps();
    const isSinglecore = threadMode === 'singlecore';
    
    let delay = 0;
    
    if (isSinglecore) {
        // === SINGLECORE ===
        // Ein Core muss alles allein machen -> langsamer, mehr Overhead
        if (targetFps === 0) {
            // Unlimitiv im Singlecore: ~100 FPS max (10ms Delay simuliert Core-Last)
            delay = 10;
        } else {
            // Limitiert: Ziel-FPS + 5ms Singlecore-Overhead
            delay = Math.max(16, (1000 / targetFps) + 5);
        }
        tickId = setTimeout(tick, delay);
    } else {
        // === MULTICORE ===
        // Mehrere Cores können parallel arbeiten -> flüssiger, schneller
        if (targetFps === 0) {
            // Unlimitiv: So schnell wie möglich (~250 FPS mit setTimeout(0))
            tickId = setTimeout(tick, 0);
        } else if (targetFps <= 60) {
            // v-sync (60): requestAnimationFrame für flüssiges, synchronisiertes Rendering
            tickId = requestAnimationFrame(tick);
        } else {
            // 2x/4x/8x: Versuche höhere Rates mit setTimeout
            delay = 1000 / targetFps;
            tickId = setTimeout(tick, delay);
        }
    }
}

function tick() {
    if (!fpsVisible) return;
    
    const now = performance.now();
    frameCount++;
    
    // FPS-Anzeige alle 400ms aktualisieren
    if (now - lastTime >= 50) {
        currentFps = Math.round((frameCount * 1000) / (now - lastTime));
        frameCount = 0;
        lastTime = now;
        updateFpsOverlay();
    }
    
    // Nächsten Frame schedulen
    scheduleTick();
}

// ============================================
// UI UPDATES
// ============================================

function updateThreadSelection() {
    document.querySelectorAll('.Thread-item').forEach(item => {
        const mode = item.textContent.toLowerCase().includes('multi') ? 'multicore' : 'singlecore';
        if (mode === threadMode) {
            item.style.background = 'rgba(0, 255, 136, 0.15)';
            item.style.fontWeight = 'bold';
            item.style.borderLeft = '3px solid #00ff88';
            item.style.color = '#fff';
        } else {
            item.style.background = 'transparent';
            item.style.fontWeight = 'normal';
            item.style.borderLeft = '3px solid transparent';
            item.style.color = '#ccc';
        }
    });
}

function updateLimitSelection() {
    document.querySelectorAll('.Limit-item').forEach(item => {
        if (item.textContent.trim() === fpsLimit) {
            item.style.background = 'rgba(0, 255, 136, 0.15)';
            item.style.fontWeight = 'bold';
            item.style.borderLeft = '3px solid #00ff88';
            item.style.color = '#fff';
        } else {
            item.style.background = 'transparent';
            item.style.fontWeight = 'normal';
            item.style.borderLeft = '3px solid transparent';
            item.style.color = '#ccc';
        }
    });
}

// ============================================
// INITIALISIERUNG
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // --- Thread-Items Click ---
    document.querySelectorAll('.Thread-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.style.transition = 'all 0.15s ease';
        item.style.padding = '8px 12px';
        item.style.margin = '2px 0';
        item.style.borderRadius = '4px';
        
        item.addEventListener('click', function() {
            threadMode = this.textContent.toLowerCase().includes('multi') ? 'multicore' : 'singlecore';
            localStorage.setItem('astrie_thread_mode', threadMode);
            updateThreadSelection();
            document.getElementById('thread-menu').style.display = 'none';
            restartFpsLoop(); // Loop neu starten mit neuem Threading-Modus
        });
    });
    
    // --- Limit-Items Click ---
    document.querySelectorAll('.Limit-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.style.transition = 'all 0.15s ease';
        item.style.padding = '8px 12px';
        item.style.margin = '2px 0';
        item.style.borderRadius = '4px';
        
        item.addEventListener('click', function() {
            fpsLimit = this.textContent.trim();
            localStorage.setItem('astrie_fps_limit', fpsLimit);
            updateLimitSelection();
            document.getElementById('limit-menu').style.display = 'none';
            restartFpsLoop(); // Loop neu starten mit neuem Limit
        });
    });
    
    // --- Click-Outside: Nur Renderer-Menüs schließen ---
    document.addEventListener('click', function(e) {
        const threadBtn = document.querySelector('.Render-thread');
        const limitBtn = document.querySelector('.Render-fps');
        const threadMenu = document.getElementById('thread-menu');
        const limitMenu = document.getElementById('limit-menu');
        
        if (threadMenu && threadBtn && !threadBtn.contains(e.target) && !threadMenu.contains(e.target)) {
            threadMenu.style.display = 'none';
        }
        if (limitMenu && limitBtn && !limitBtn.contains(e.target) && !limitMenu.contains(e.target)) {
            limitMenu.style.display = 'none';
        }
    });
    
    
    // --- Initiale UI ---
    updateThreadSelection();
    updateLimitSelection();
    updateFpsDisplay();
});