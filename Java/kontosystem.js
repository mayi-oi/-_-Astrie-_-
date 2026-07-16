// Datei zu Base64 konvertieren (für persistenter speicherung!)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}



// Bild-URL zu Base64 konvertieren (für Blob-URLs)
function urlToBase64(url) {
    return new Promise((resolve) => {
        if (!url || url.startsWith('data:') || url.startsWith('blob:') === false) {
            resolve(url);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                resolve(canvas.toDataURL('image/png'));
            } catch(e) {
                resolve(url);
            }
        };
        img.onerror = () => resolve(url);
        img.src = url;
    });
}

// Default Bilder (falls etwas kaputt geht)
const DEFAULT_PFP = 'Res/Bild/Logo/AddText_07-03-07.27.32.png';
const DEFAULT_BANNER = 'Res/Bild/Hintergrund/Default-Banner.png';

class Konto {
    constructor(data = {}) {
        this.id = data.id || `konto-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = data.name || 'Gast';
        // WICHTIG: Base64 oder Pfad speichern, nie Blob-URL!
        this.pfp = data.pfp || DEFAULT_PFP;
        this.banner = data.banner || DEFAULT_BANNER;
        this.language = data.language || 'de';
        this.volume = data.volume || 35;
        this.inactiveVolume = data.inactiveVolume || 12;
        this.wallpaper = data.wallpaper || 'AstrieOS-offziellgrund.png';
        this.todos = data.todos || [];
        this.playlist = data.playlist || [];
        this.createdAt = data.createdAt || Date.now();
        this.lastUsed = data.lastUsed || Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            pfp: this.pfp,
            banner: this.banner,
            language: this.language,
            volume: this.volume,
            inactiveVolume: this.inactiveVolume,
            wallpaper: this.wallpaper,
            todos: this.todos,
            playlist: this.playlist,
            createdAt: this.createdAt,
            lastUsed: this.lastUsed
        };
    }

    static fromJSON(json) {
        return new Konto(json);
    }
}

class KontoManager {
    constructor() {
        this.konten = [];
        this.aktivKontoId = null;
        this.todoTracker = null;
        this.buildSimulator = null;
        this.init();
    }

    init() {
        this.loadFromStorage();
        
        if (this.konten.length === 0) {
            const gast = new Konto({ name: 'Gast!', id: 'gast-default' });
            this.konten.push(gast);
            this.aktivKontoId = gast.id;
            this.saveToStorage();
        }

        if (!this.aktivKontoId || !this.getAktivKonto()) {
            this.aktivKontoId = this.konten[0].id;
        }

        this.applyKontoToUI(this.getAktivKonto());
        this.renderKontowechselOverlay();
        this.setupEventListeners();
        this.overrideUploadHandlers(); // NEU: Blob-URLs verhindern!
        
        this.todoTracker = new TodoTracker(this);
        this.todoTracker.start();

        this.buildSimulator = new BuildSimulator(this);
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('astrie_konten');
            const aktiv = localStorage.getItem('astrie_aktiv_konto');
            
            if (saved) {
                const parsed = JSON.parse(saved);
                this.konten = parsed.map(k => Konto.fromJSON(k));
            }
            if (aktiv) this.aktivKontoId = aktiv;
        } catch (e) {
            console.error('Konto laden fehlgeschlagen:', e);
            this.konten = [];
        }
    }

    saveToStorage() {
        localStorage.setItem('astrie_konten', JSON.stringify(this.konten.map(k => k.toJSON())));
        localStorage.setItem('astrie_aktiv_konto', this.aktivKontoId);
    }

    getAktivKonto() {
        return this.konten.find(k => k.id === this.aktivKontoId);
    }

    addKonto(name) {
        const neu = new Konto({ name: name || 'Neues Konto' });
        this.konten.push(neu);
        this.saveToStorage();
        this.renderKontowechselOverlay();
        
        if (window.benachrichtungSystem) {
            window.benachrichtungSystem.showToast({
                type: 'success',
                title: 'Konto erstellt!',
                message: `${neu.name} wurde hinzugefügt`,
                icon: '👤',
                color: '#4ade80',
                duration: 4000,
                sound: 'todo-done'
            });
        }
        
        return neu;
    }

    deleteKonto(id) {
        if (id === 'gast-default' && this.konten.length === 1) {
            if (window.benachrichtungSystem) {
                window.benachrichtungSystem.showToast({
                    type: 'error',
                    title: 'Nicht möglich!',
                    message: 'Das letzte Konto kann nicht gelöscht werden',
                    icon: '⚠️',
                    color: '#ff6b6b',
                    duration: 4000,
                    sound: 'clear'
                });
            }
            return false;
        }

        const idx = this.konten.findIndex(k => k.id === id);
        if (idx === -1) return false;

        const geloescht = this.konten[idx];
        this.konten.splice(idx, 1);

        if (this.aktivKontoId === id) {
            this.aktivKontoId = this.konten[0]?.id || null;
            if (this.aktivKontoId) {
                this.applyKontoToUI(this.getAktivKonto());
            }
        }

        this.saveToStorage();
        this.renderKontowechselOverlay();

        if (window.benachrichtungSystem) {
            window.benachrichtungSystem.showToast({
                type: 'update',
                title: 'Konto gelöscht',
                message: `${geloescht.name} wurde entfernt`,
                icon: '🗑️',
                color: '#e2a0ff',
                duration: 4000,
                sound: 'clear'
            });
        }

        return true;
    }

    switchKonto(id) {
        const konto = this.konten.find(k => k.id === id);
        if (!konto) return false;

        // Aktuelles Konto speichern (vor dem Wechsel)
        this.syncCurrentStateToKonto();

        this.aktivKontoId = id;
        konto.lastUsed = Date.now();
        this.saveToStorage();

        this.applyKontoToUI(konto);
        this.renderKontowechselOverlay();

        this.buildSimulator.simulateKontoWechsel(konto);

        return true;
    }

    // === UI SYNC (KORRIGIERT) ===
    applyKontoToUI(konto) {
        if (!konto) return;

        // Username
        const usernameEl = document.getElementById('username');
        if (usernameEl) usernameEl.textContent = konto.name;

        // PFP (mit Error-Handling!)
        const pfpEls = document.querySelectorAll('#pfpbild');
        pfpEls.forEach(el => {
            el.onerror = function() {
                console.warn('PFP konnte nicht geladen werden, verwende Default');
                this.onerror = null;
                this.src = DEFAULT_PFP;
            };
            el.src = konto.pfp || DEFAULT_PFP;
        });

        // Kontowechsel-Banner sync
        const kwBanner = document.getElementById('Kontowechsen-banner-bild');
        if (kwBanner) {
            kwBanner.onerror = function() {
                this.onerror = null;
                this.src = DEFAULT_BANNER;
            };
            kwBanner.src = konto.banner || DEFAULT_BANNER;
        }

        // Banner (mit Error-Handling!)
        const bannerEl = document.getElementById('Banner-bild');
        if (bannerEl) {
            bannerEl.onerror = function() {
                console.warn('Banner konnte nicht geladen werden, verwende Default');
                this.onerror = null;
                this.src = DEFAULT_BANNER;
            };
            bannerEl.src = konto.banner || DEFAULT_BANNER;
        }

        // Sprache
        if (window.I18n) {
            window.I18n.setLanguage(konto.language);
        }

        // Volumes
        const vlSlider = document.getElementById('Vl-silder');
        const ivlSlider = document.getElementById('IVl-silder');
        const vlValue = document.getElementById('Volume-value');
        const ivlValue = document.getElementById('iVolume-value');

        if (vlSlider) {
            vlSlider.value = konto.volume;
            if (vlValue) vlValue.textContent = konto.volume;
        }
        if (ivlSlider) {
            ivlSlider.value = konto.inactiveVolume;
            if (ivlValue) ivlValue.textContent = konto.inactiveVolume;
        }

        // Wallpaper
        if (konto.wallpaper) {
            document.body.style.backgroundImage = `url(${konto.wallpaper})`;
        }

        if (window.musikplayer && konto.playlist.length > 0) {
            // Playlist wiederherstellen
        }
    }

    syncCurrentStateToKonto() {
        const konto = this.getAktivKonto();
        if (!konto) return;

        const usernameEl = document.getElementById('username');
        if (usernameEl) konto.name = usernameEl.textContent;

        const pfpEl = document.getElementById('pfpbild');
        if (pfpEl) konto.pfp = pfpEl.src;

        const bannerEl = document.getElementById('Banner-bild');
        if (bannerEl) konto.banner = bannerEl.src;

        const vlSlider = document.getElementById('Vl-silder');
        if (vlSlider) konto.volume = parseInt(vlSlider.value) || 35;

        const ivlSlider = document.getElementById('IVl-silder');
        if (ivlSlider) konto.inactiveVolume = parseInt(ivlSlider.value) || 12;

        this.syncTodosFromUI(konto);
        this.saveToStorage();
    }

    syncTodosFromUI(konto) {
        const todoBox = document.querySelector('.Settingsbox-todo');
        if (!todoBox) return;
        
        const items = todoBox.querySelectorAll('li');
        konto.todos = Array.from(items).map((item, index) => {
            const text = item.textContent.trim();
            const isDone = /erledgit|erledigt|done|✓|✅/i.test(text);
            return { id: `todo-${index}`, text, done: isDone };
        });
    }

    // === NEU: Upload-Handler überschreiben (keine Blob-URLs mehr!) ===
    overrideUploadHandlers() {
        // PFP Upload
        const pfpInput = document.getElementById('pfp-file');
        if (pfpInput) {
            // Alten Handler entfernen und neuen setzen
            pfpInput.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                try {
                    const base64 = await fileToBase64(file);
                    const pfpEls = document.querySelectorAll('#pfpbild');
                    pfpEls.forEach(el => el.src = base64);
                    
                    // Direkt zum aktiven Konto speichern
                    const konto = this.getAktivKonto();
                    if (konto) {
                        konto.pfp = base64;
                        this.saveToStorage();
                    }
                    
                    if (window.benachrichtungSystem) {
                        window.benachrichtungSystem.showToast({
                            type: 'upload',
                            title: 'Profilbild aktualisiert!',
                            message: 'Bild wurde als Base64 gespeichert',
                            icon: '👤',
                            color: '#4ade80',
                            duration: 3000,
                            sound: 'upload-done'
                        });
                    }
                } catch (e) {
                    console.error('PFP Upload fehlgeschlagen:', e);
                }
            };
        }

        // Banner Upload
        const bannerInput = document.getElementById('banner-file');
        if (bannerInput) {
            bannerInput.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                try {
                    const base64 = await fileToBase64(file);
                    const bannerEl = document.getElementById('Banner-bild');
                    if (bannerEl) bannerEl.src = base64;
                    
                    const konto = this.getAktivKonto();
                    if (konto) {
                        konto.banner = base64;
                        this.saveToStorage();
                    }
                    
                    if (window.benachrichtungSystem) {
                        window.benachrichtungSystem.showToast({
                            type: 'upload',
                            title: 'Banner aktualisiert!',
                            message: 'Bild wurde als Base64 gespeichert',
                            icon: '🖼️',
                            color: '#4ade80',
                            duration: 3000,
                            sound: 'upload-done'
                        });
                    }
                } catch (e) {
                    console.error('Banner Upload fehlgeschlagen:', e);
                }
            };
        }
    }

    // === JSON IMPORT/EXPORT ===
    exportKontoToJSON(id) {
        const konto = this.konten.find(k => k.id === id);
        if (!konto) return null;

        const data = konto.toJSON();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `astrie-konto-${konto.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);

        if (window.benachrichtungSystem) {
            window.benachrichtungSystem.showToast({
                type: 'success',
                title: 'Export erledigt!',
                message: `${konto.name}.json gespeichert`,
                icon: '💾',
                color: '#4ade80',
                duration: 4000,
                sound: 'upload-done'
            });
        }

        return data;
    }

    async importKontoFromJSON(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.name || !data.id) {
                throw new Error('Ungültige Konto-Datei');
            }

            data.id = `konto-import-${Date.now()}`;
            data.name = `${data.name} (Import)`;
            
            const neu = Konto.fromJSON(data);
            this.konten.push(neu);
            this.saveToStorage();
            this.renderKontowechselOverlay();

            if (window.benachrichtungSystem) {
                window.benachrichtungSystem.showToast({
                    type: 'upload',
                    title: 'Konto importiert!',
                    message: `${neu.name} wurde geladen`,
                    detail: `${neu.todos?.length || 0} Todos, ${neu.playlist?.length || 0} Songs`,
                    icon: '⬆️',
                    color: '#f59e0b',
                    duration: 5000,
                    sound: 'upload-done'
                });
            }

            return neu;
        } catch (e) {
            if (window.benachrichtungSystem) {
                window.benachrichtungSystem.showToast({
                    type: 'error',
                    title: 'Import fehlgeschlagen!',
                    message: 'Ungültige JSON-Datei',
                    icon: '❌',
                    color: '#ff6b6b',
                    duration: 4000,
                    sound: 'clear'
                });
            }
            return null;
        }
    }

    renderKontowechselOverlay() {
        const container = document.querySelector('.Kontowechsen-box');
        if (!container) return;

        container.innerHTML = '';

        this.konten.forEach(konto => {
            const isActive = konto.id === this.aktivKontoId;
            
            const item = document.createElement('div');
            item.className = 'Kontowechsen-item';
            if (isActive) item.style.boxShadow = '0 0 0 2px #e2a0ff';
            
            item.innerHTML = `
                <img src="${konto.pfp}" width="48" height="48" style="object-fit:cover;border-radius:14px;" onerror="this.src='${DEFAULT_PFP}'">
                <div style="flex:1;">
                    <p style="margin:0;font-weight:600;color:#fff;">${konto.name} ${isActive ? '(Aktiv)' : ''}</p>
                    <p style="margin:0;font-size:0.75rem;color:rgba(255,255,255,0.6);">
                        ${new Date(konto.lastUsed).toLocaleDateString()} • ${konto.todos?.filter(t => t.done).length || 0}/${konto.todos?.length || 0} Todos
                    </p>
                </div>
                ${!isActive ? `<button class="Benachrichten-item-btn delete" onclick="kontoManager.deleteKonto('${konto.id}')" style="margin-left:8px;">🗑️</button>` : ''}
            `;

            if (!isActive) {
                item.style.cursor = 'pointer';
                item.onclick = (e) => {
                    if (e.target.closest('button')) return;
                    this.switchKonto(konto.id);
                };
            }

            container.appendChild(item);
        });
    }

    setupEventListeners() {
        // Volume Slider sync
        const vlSlider = document.getElementById('Vl-silder');
        const ivlSlider = document.getElementById('IVl-silder');
        
        if (vlSlider) {
            vlSlider.addEventListener('change', () => this.syncCurrentStateToKonto());
        }
        if (ivlSlider) {
            ivlSlider.addEventListener('change', () => this.syncCurrentStateToKonto());
        }

        // Konto hinzufügen Button
        const addBtn = document.querySelector('.Kontowechsen-add');
        if (addBtn) {
            addBtn.onclick = () => {
                const name = prompt('Name für neues Konto:', 'Neues Konto');
                if (name) this.addKonto(name);
            };
        }

        // JSON Import via Drag & Drop
        const overlay = document.getElementById('Kontowechsen-overlay');
        if (overlay) {
            overlay.addEventListener('dragover', (e) => {
                e.preventDefault();
                overlay.style.backgroundColor = '#00000080';
            });
            overlay.addEventListener('dragleave', () => {
                overlay.style.backgroundColor = '#0000004c';
            });
            overlay.addEventListener('drop', (e) => {
                e.preventDefault();
                overlay.style.backgroundColor = '#0000004c';
                const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
                files.forEach(f => this.importKontoFromJSON(f));
            });
        }

        window.addEventListener('beforeunload', () => {
            this.syncCurrentStateToKonto();
        });
    }
}

// === TODO TRACKER ===
class TodoTracker {
    constructor(kontoManager) {
        this.kontoManager = kontoManager;
        this.lastTodos = [];
        this.interval = null;
    }

    start() {
        this.parseCurrentTodos();
        this.interval = setInterval(() => this.checkTodos(), 3000);
    }

    parseCurrentTodos() {
        const todoBox = document.querySelector('.Settingsbox-todo');
        if (!todoBox) return [];
        
        const items = todoBox.querySelectorAll('li');
        return Array.from(items).map((item, index) => {
            const text = item.textContent.trim();
            const isDone = /erledgit|erledigt|done|✓|✅/i.test(text);
            return { id: `todo-${index}`, text, done: isDone };
        });
    }

    checkTodos() {
        const current = this.parseCurrentTodos();
        const konto = this.kontoManager.getAktivKonto();
        
        if (!konto) return;

        current.forEach((todo, idx) => {
            const last = this.lastTodos.find(t => t.id === todo.id);
            
            if (todo.done && (!last || !last.done)) {
                this.onTodoCompleted(todo);
            }
        });

        this.lastTodos = current;
        konto.todos = current;
        this.kontoManager.saveToStorage();
    }

    onTodoCompleted(todo) {
        if (window.benachrichtungSystem) {
            window.benachrichtungSystem.showToast({
                type: 'todo',
                title: '✅ Todo erledigt!',
                message: todo.text,
                icon: '📝',
                color: '#4ade80',
                duration: 5000,
                sound: 'todo-done'
            });
            window.benachrichtungSystem.addToHistory({
                type: 'todo',
                title: '✅ Todo erledigt!',
                message: todo.text,
                color: '#4ade80',
                timestamp: Date.now()
            });
        }
        this.kontoManager.syncCurrentStateToKonto();
    }
}

// === BUILD SIMULATOR ===
class BuildSimulator {
    constructor(kontoManager) {
        this.kontoManager = kontoManager;
        this.isBuilding = false;
    }

    simulateKontoWechsel(konto) {
        if (this.isBuilding) return;
        this.isBuilding = true;

        if (window.benachrichtungSystem) {
            window.benachrichtungSystem.showToast({
                type: 'build',
                title: '🔨 Zusammenbauen...',
                message: `Lade Konto: ${konto.name}`,
                detail: 'Synchronisiere Einstellungen...',
                icon: '🔧',
                color: '#f59e0b',
                duration: 6000,
                progress: true,
                progressValue: 0,
                sound: 'build'
            });

            let progress = 0;
            const interval = setInterval(() => {
                progress += 20;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    
                    setTimeout(() => {
                        window.benachrichtungSystem.showToast({
                            type: 'build',
                            title: '✨ Zusammenbauen erledigt!',
                            message: `${konto.name} ist bereit!`,
                            detail: '(ᵕ • ᴗ •)',
                            icon: '✨',
                            color: '#4ade80',
                            duration: 4000,
                            sound: 'todo-done'
                        });
                        this.isBuilding = false;
                    }, 500);
                }
            }, 400);
        } else {
            this.isBuilding = false;
        }
    }

    simulateFullBuild() {
        if (this.isBuilding) return;
        this.isBuilding = true;

        const steps = [
            'Lade Kontodaten...',
            'Synchronisiere Todos...',
            'Lade Playlist...',
            'Wende Wallpaper an...',
            'Sync Einstellungen...',
            'Fertig!'
        ];

        if (window.benachrichtungSystem) {
            window.benachrichtungSystem.showToast({
                type: 'build',
                title: '🔨 AstrieOS wird zusammengebaut...',
                message: steps[0],
                icon: '🔧',
                color: '#f59e0b',
                duration: 10000,
                progress: true,
                progressValue: 0,
                sound: 'build'
            });

            let step = 0;
            const interval = setInterval(() => {
                step++;
                if (step >= steps.length) {
                    clearInterval(interval);
                    window.benachrichtungSystem.showToast({
                        type: 'build',
                        title: '✨ Zusammenbauen erledigt!',
                        message: 'AstrieOS ist bereit!',
                        detail: 'Alle Systeme funktionieren',
                        icon: '✨',
                        color: '#4ade80',
                        duration: 5000,
                        sound: 'todo-done'
                    });
                    this.isBuilding = false;
                }
            }, 1500);
        }
    }
}

// === GLOBALE INSTANZ ===
let kontoManager;

document.addEventListener('DOMContentLoaded', () => {
    const checkInterval = setInterval(() => {
        if (window.benachrichtungSystem) {
            clearInterval(checkInterval);
            kontoManager = new KontoManager();
            window.kontoManager = kontoManager;
        }
    }, 100);

    setTimeout(() => {
        if (!kontoManager) {
            kontoManager = new KontoManager();
            window.kontoManager = kontoManager;
        }
    }, 5000);
});

// === HILFSFUNKTIONEN FÜR HTML ===
function exportAktivKonto() {
    if (kontoManager) {
        kontoManager.exportKontoToJSON(kontoManager.aktivKontoId);
    }
}

function importKontoFromFile(input) {
    if (kontoManager && input.files[0]) {
        kontoManager.importKontoFromJSON(input.files[0]);
        input.value = '';
    }
}