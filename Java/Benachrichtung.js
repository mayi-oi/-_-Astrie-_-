class BenachrichtungSystem {
    constructor() {
        this.notifications = [];
        this.todos = [];
        this.toasts = [];
        this.lastCommitSha = localStorage.getItem('astrie_last_commit') || null;
        this.checkInterval = null;
        this.audioCtx = null;
        this.apiFailed = false;
        this.init();
    }

    init() {
        this.createToastContainer();
        this.loadNotifications();
        this.parseTodos();
        this.renderOverlay();
        this.startGitHubPolling();
        this.startTodoWatcher();
        this.bindClearButton();
        this.bindMusikplayerEvents();
    }

    // === TOAST CONTAINER ===
    createToastContainer() {
        if (document.getElementById('astrie-toast-container')) return;
        const container = document.createElement('div');
        container.id = 'astrie-toast-container';
        document.body.appendChild(container);
    }

    // === SOUND EFFEKTE ===
    playSound(type = 'default') {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            const now = ctx.currentTime;

            switch(type) {
                case 'commit':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.setValueAtTime(659.25, now + 0.1);
                    osc.frequency.setValueAtTime(783.99, now + 0.2);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                    osc.start(now); osc.stop(now + 0.4);
                    break;
                case 'todo-done':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                    osc.start(now); osc.stop(now + 0.3);
                    break;
                case 'build':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.linearRampToValueAtTime(150, now + 0.3);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                    osc.start(now); osc.stop(now + 0.4);
                    break;
                case 'upload':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.setValueAtTime(600, now + 0.08);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                    osc.start(now); osc.stop(now + 0.15);
                    break;
                case 'upload-done':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.setValueAtTime(800, now + 0.1);
                    osc.frequency.setValueAtTime(1200, now + 0.2);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
                    osc.start(now); osc.stop(now + 0.35);
                    break;
                case 'now-playing':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(330, now);
                    osc.frequency.setValueAtTime(440, now + 0.12);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                    osc.start(now); osc.stop(now + 0.25);
                    break;
                case 'update':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, now);
                    osc.frequency.setValueAtTime(1100, now + 0.1);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                    osc.start(now); osc.stop(now + 0.3);
                    break;
                case 'clear':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                    osc.start(now); osc.stop(now + 0.25);
                    break;
                default:
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523.25, now);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                    osc.start(now); osc.stop(now + 0.2);
            }
        } catch(e) {}
    }

    // === TOAST SYSTEM ===
    showToast(options) {
        const {
            type = 'info',
            title = 'Benachrichtung',
            message = '',
            detail = '',
            icon = '🔔',
            color = '#e2a0ff',
            duration = 5000,
            progress = false,
            progressValue = 0,
            sound = 'default',
            url = null
        } = options;

        const container = document.getElementById('astrie-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `astrie-toast astrie-toast-${type}`;
        toast.style.setProperty('--toast-color', color);

        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        toast.id = id;

        let progressHtml = '';
        if (progress) {
            progressHtml = `<div class="astrie-toast-progress"><div class="astrie-toast-progress-bar" style="width: ${progressValue}%"></div></div>`;
        }

        let urlHtml = '';
        if (url) {
            urlHtml = `<button class="astrie-toast-btn" onclick="window.open('${url}', '_blank')">Öffnen</button>`;
        }

        toast.innerHTML = `
            <div class="astrie-toast-icon">${icon}</div>
            <div class="astrie-toast-content">
                <div class="astrie-toast-title">${this.escapeHtml(title)}</div>
                <div class="astrie-toast-message">${this.escapeHtml(message)}</div>
                ${detail ? `<div class="astrie-toast-detail">${this.escapeHtml(detail)}</div>` : ''}
                <div class="astrie-toast-actions">
                    ${urlHtml}
                    <button class="astrie-toast-btn astrie-toast-close">✕</button>
                </div>
            </div>
            ${progressHtml}
            <div class="astrie-toast-timer" style="animation-duration: ${duration}ms"></div>
        `;

        container.appendChild(toast);

        // Sound abspielen
        if (sound) this.playSound(sound);

        // Auto-entfernen
        const removeTimer = setTimeout(() => this.removeToast(id), duration);

        // Pause on hover
        toast.addEventListener('mouseenter', () => {
            const timer = toast.querySelector('.astrie-toast-timer');
            if (timer) timer.style.animationPlayState = 'paused';
        });
        toast.addEventListener('mouseleave', () => {
            const timer = toast.querySelector('.astrie-toast-timer');
            if (timer) timer.style.animationPlayState = 'running';
        });

        // Close button
        const closeBtn = toast.querySelector('.astrie-toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(removeTimer);
                this.removeToast(id);
            });
        }

        // Click to dismiss (außer auf Buttons)
        toast.addEventListener('click', (e) => {
            if (e.target.closest('.astrie-toast-btn')) return;
            clearTimeout(removeTimer);
            this.removeToast(id);
        });

        this.toasts.push({ id, element: toast, timer: removeTimer });

        // Auch in Overlay-History speichern
        this.addToHistory({ type, title, message, detail, color, url, timestamp: Date.now() });
    }

    removeToast(id) {
        const idx = this.toasts.findIndex(t => t.id === id);
        if (idx === -1) return;

        const toast = this.toasts[idx].element;
        toast.classList.add('astrie-toast-exit');

        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);

        this.toasts.splice(idx, 1);
    }

    updateToastProgress(id, percent) {
        const toast = this.toasts.find(t => t.id === id);
        if (!toast) return;
        const bar = toast.element.querySelector('.astrie-toast-progress-bar');
        if (bar) bar.style.width = `${percent}%`;
    }

    // === MUSIKPLAYER EVENT INTEGRATION ===
    bindMusikplayerEvents() {
        // Globaler Event-Listener für Musikplayer-Events
        window.addEventListener('astrie-music-event', (e) => {
            const { eventType, data } = e.detail;
            this.handleMusicEvent(eventType, data);
        });
    }

    handleMusicEvent(type, data) {
        switch(type) {
            case 'upload-start':
                this.showToast({
                    type: 'upload',
                    title: 'Dein Musik wird hochladen',
                    message: data.filename || 'Datei wird verarbeitet...',
                    detail: '0 von ' + (data.total || 1),
                    icon: '⬆️',
                    color: '#f59e0b',
                    duration: 30000,
                    progress: true,
                    progressValue: 0,
                    sound: 'upload'
                });
                break;
            case 'upload-progress':
                this.updateToastProgress(data.toastId, data.percent);
                break;
            case 'upload-done':
                this.showToast({
                    type: 'success',
                    title: 'Dein Musik sind erledigt!',
                    message: data.title || 'Upload abgeschlossen',
                    detail: `${data.count || 1} Song(s) zur Playlist hinzugefügt`,
                    icon: '✅',
                    color: '#4ade80',
                    duration: 6000,
                    sound: 'upload-done'
                });
                break;
            case 'now-playing':
                this.showToast({
                    type: 'music',
                    title: 'Now Playing...',
                    message: data.title || 'Unbekannter Song',
                    detail: data.artist || 'Unbekannter Künstler',
                    icon: '🎵',
                    color: '#a855f7',
                    duration: 4000,
                    sound: 'now-playing'
                });
                break;
            case 'build-start':
                this.showToast({
                    type: 'build',
                    title: '🔨 Zusammenbauen...',
                    message: 'AstrieOS wird gebaut',
                    detail: data.detail || 'Bitte warten...',
                    icon: '🔧',
                    color: '#f59e0b',
                    duration: 8000,
                    progress: true,
                    progressValue: 0,
                    sound: 'build'
                });
                break;
            case 'build-success':
                this.showToast({
                    type: 'build',
                    title: '✨ Zusammenbauen erledigt!',
                    message: 'AstrieOS ist bereit!',
                    detail: '(ᵕ • ᴗ •)',
                    icon: '✨',
                    color: '#4ade80',
                    duration: 6000,
                    sound: 'todo-done'
                });
                break;
        }
    }

    // === TODO PARSER ===
    parseTodos() {
        const todoBox = document.querySelector('.Settingsbox-todo');
        if (!todoBox) return;
        const items = todoBox.querySelectorAll('li');
        this.todos = Array.from(items).map((item, index) => {
            const text = item.textContent.trim();
            const isDone = /erledgit|erledigt|done|✓|✅/i.test(text);
            return { id: `todo-${index}`, text, done: isDone, timestamp: Date.now() };
        });

        const savedTodos = JSON.parse(localStorage.getItem('astrie_todos') || '[]');
        this.todos.forEach(todo => {
            const saved = savedTodos.find(t => t.id === todo.id);
            if (saved && !saved.done && todo.done) {
                this.showToast({
                    type: 'todo',
                    title: '✅ Todo erledigt!',
                    message: todo.text,
                    icon: '📝',
                    color: '#4ade80',
                    duration: 5000,
                    sound: 'todo-done'
                });
                this.addToHistory({
                    type: 'todo',
                    title: '✅ Todo erledigt!',
                    message: todo.text,
                    color: '#4ade80',
                    timestamp: Date.now()
                });
            }
        });
        localStorage.setItem('astrie_todos', JSON.stringify(this.todos));
    }

    startTodoWatcher() {
        setInterval(() => this.parseTodos(), 5000);
    }

    // === GITHUB API (DIREKT) ===
    async fetchLatestCommit() {
        try {
            const response = await fetch('https://api.github.com/repos/mayi-oi/-_-Astrie-_-/commits?per_page=1', {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'AstrieOS-NotificationSystem'
                }
            });
            if (!response.ok) { this.apiFailed = true; return null; }
            const data = await response.json();
            if (!data || data.length === 0) return null;
            this.apiFailed = false;
            return {
                sha: data[0].sha,
                message: data[0].commit.message,
                author: data[0].commit.author.name,
                date: data[0].commit.author.date,
                url: data[0].html_url
            };
        } catch (error) {
            this.apiFailed = true;
            return null;
        }
    }

    async startGitHubPolling() {
        await this.checkCommits();
        this.checkInterval = setInterval(() => this.checkCommits(), 120000); // 2 Min
    }

    async checkCommits() {
        const commit = await this.fetchLatestCommit();
        if (!commit) return;
        if (!this.lastCommitSha) {
            this.lastCommitSha = commit.sha;
            localStorage.setItem('astrie_last_commit', commit.sha);
            return;
        }
        if (commit.sha !== this.lastCommitSha) {
            this.lastCommitSha = commit.sha;
            localStorage.setItem('astrie_last_commit', commit.sha);
            const timeAgo = this.formatTimeAgo(new Date(commit.date));

            this.showToast({
                type: 'update',
                title: 'AstrieOS!* hat ein update!',
                message: `${commit.author}: "${commit.message}"`,
                detail: `vor ${timeAgo} • 2026.7.14 → 2026.7.15`,
                icon: '📋',
                color: '#e2a0ff',
                duration: 10000,
                sound: 'update',
                url: commit.url
            });

            this.addToHistory({
                type: 'commit',
                title: '🚀 Neuer Commit!',
                message: `${commit.author}: "${commit.message}"`,
                detail: `vor ${timeAgo}`,
                url: commit.url,
                color: '#a855f7',
                timestamp: Date.now()
            });

            this.playSound('commit');
            setTimeout(() => this.simulateBuild(commit.message), 3000);
        }
    }

    simulateBuild(commitMessage) {
        this.showToast({
            type: 'build',
            title: '🔨 Zusammenbauen...',
            message: 'AstrieOS wird gebaut',
            detail: `Commit: ${commitMessage.substring(0, 30)}...`,
            icon: '🔧',
            color: '#f59e0b',
            duration: 8000,
            progress: true,
            progressValue: 0,
            sound: 'build'
        });

        setTimeout(() => {
            this.showToast({
                type: 'build',
                title: '✨ Zusammenbauen erledigt!',
                message: 'AstrieOS ist bereit! (ᵕ • ᴗ •)',
                detail: 'Alle Systeme funktionieren',
                icon: '✨',
                color: '#4ade80',
                duration: 6000,
                sound: 'todo-done'
            });
        }, 5000);
    }

    // === OVERLAY HISTORY ===
    addToHistory(notification) {
        const notif = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            read: false,
            ...notification
        };
        this.notifications.unshift(notif);
        if (this.notifications.length > 50) this.notifications = this.notifications.slice(0, 50);
        this.saveNotifications();
        this.renderOverlay();
        this.updateBadge();
    }

    remove(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.saveNotifications();
        this.renderOverlay();
        this.updateBadge();
    }

    clearAll() {
        this.playSound('clear');
        this.notifications = [];
        this.saveNotifications();
        this.renderOverlay();
        this.updateBadge();
    }

    markAsRead(id) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif) { notif.read = true; this.saveNotifications(); this.renderOverlay(); this.updateBadge(); }
    }

    saveNotifications() {
        localStorage.setItem('astrie_notifications', JSON.stringify(this.notifications));
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('astrie_notifications');
            if (saved) this.notifications = JSON.parse(saved);
        } catch(e) { this.notifications = []; }
    }

    renderOverlay() {
        const container = document.querySelector('.Benachrichten-content');
        if (!container) return;
        const oldList = container.querySelector('.Benachrichten-liste');
        if (oldList) oldList.remove();
        const list = document.createElement('div');
        list.className = 'Benachrichten-liste';

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="Benachrichten-empty">
                    <p>Keine Benachrichtungen! (⎚-⎚)</p>
                    <p style="font-size: 0.8rem; opacity: 0.6;">
                        ${this.apiFailed ? 'GitHub API aktuell nicht erreichbar...' : 'Warte auf Commits oder erledige Todos...'}
                    </p>
                </div>
            `;
        } else {
            this.notifications.forEach(notif => {
                const item = document.createElement('div');
                item.className = `Benachrichten-item ${notif.read ? 'read' : 'unread'}`;
                item.style.borderLeft = `3px solid ${notif.color || '#e2a0ff'}`;
                const time = this.formatTimeAgo(new Date(notif.timestamp));
                item.innerHTML = `
                    <div class="Benachrichten-item-header">
                        <span class="Benachrichten-item-title">${this.escapeHtml(notif.title)}</span>
                        <span class="Benachrichten-item-time">${time}</span>
                    </div>
                    <div class="Benachrichten-item-message">${this.escapeHtml(notif.message)}</div>
                    ${notif.detail ? `<div class="Benachrichten-item-detail">${this.escapeHtml(notif.detail)}</div>` : ''}
                    <div class="Benachrichten-item-actions">
                        ${notif.url ? `<button class="Benachrichten-item-btn" onclick="window.open('${notif.url}', '_blank')">Öffnen</button>` : ''}
                        <button class="Benachrichten-item-btn" onclick="benachrichtungSystem.markAsRead('${notif.id}')">Gelesen</button>
                        <button class="Benachrichten-item-btn delete" onclick="benachrichtungSystem.remove('${notif.id}')">Löschen</button>
                    </div>
                `;
                list.appendChild(item);
            });
        }
        const tools = container.querySelector('.Benachrichten-tools');
        if (tools) tools.after(list);
        else container.appendChild(list);
    }

    updateBadge() {
        const unread = this.notifications.filter(n => !n.read).length;
        const counters = document.querySelectorAll('#Benachrichten-counter');
        counters.forEach(c => {
            c.textContent = unread;
            c.style.color = unread > 0 ? '#ff6b6b' : '#ffffff';
        });
        const notfiIcon = document.querySelector('.Topbar-notfi img');
        if (notfiIcon) {
            notfiIcon.style.animation = unread > 0 ? 'notfi-pulse 2s infinite' : 'none';
        }
    }

    bindClearButton() {
        const clearBtn = document.getElementById('benachrichten-clear');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearAll());
    }

    formatTimeAgo(date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'gerade eben';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

function testToast(type) {
    if (!benachrichtungSystem) {
        console.error('BenachrichtungSystem noch nicht initialisiert!');
        return;
    }

    switch(type) {
        case 'upload':
            benachrichtungSystem.showToast({
                type: 'upload',
                title: 'Dein Musik wird hochladen',
                message: 'Astrie-beatmap.osz',
                detail: '0 von 39',
                icon: '⬆️',
                color: '#f59e0b',
                duration: 8000,
                progress: true,
                progressValue: 0,
                sound: 'upload'
            });
            // Simuliere Fortschritt
            let uploadPct = 0;
            const uploadInterval = setInterval(() => {
                uploadPct += Math.random() * 20 + 10;
                if (uploadPct >= 100) {
                    uploadPct = 100;
                    clearInterval(uploadInterval);
                }
                // Update wird über Toast-ID gemacht - hier vereinfacht
            }, 500);
            break;

        case 'upload-done':
            benachrichtungSystem.showToast({
                type: 'success',
                title: 'Dein Musik sind erledigt!',
                message: 'Astrie-beatmap',
                detail: '1 Song zur Playlist hinzugefügt',
                icon: '✅',
                color: '#4ade80',
                duration: 6000,
                sound: 'upload-done'
            });
            break;

        case 'now-playing':
            benachrichtungSystem.showToast({
                type: 'music',
                title: 'Now Playing...',
                message: 'Astrie Theme Song',
                detail: 'AstrieOS Soundteam',
                icon: '🎵',
                color: '#a855f7',
                duration: 4000,
                sound: 'now-playing'
            });
            break;

        case 'update':
            benachrichtungSystem.showToast({
                type: 'update',
                title: 'AstrieOS!* hat ein update!',
                message: 'mayi-oi: "Fix wallpaper engine"',
                detail: '2026.7.14 → 2026.7.15',
                icon: '📋',
                color: '#e2a0ff',
                duration: 7000,
                sound: 'update',
                url: 'https://github.com/mayi-oi/-_-Astrie-_-/commit/abc123'
            });
            break;

        case 'build':
            benachrichtungSystem.showToast({
                type: 'build',
                title: '🔨 Zusammenbauen...',
                message: 'AstrieOS wird gebaut',
                detail: 'Commit: Fix wallpaper engine...',
                icon: '🔧',
                color: '#f59e0b',
                duration: 6000,
                progress: true,
                progressValue: 0,
                sound: 'build'
            });
            // Simuliere Build-Fortschritt
            let buildPct = 0;
            const buildInterval = setInterval(() => {
                buildPct += 15;
                if (buildPct >= 100) {
                    buildPct = 100;
                    clearInterval(buildInterval);
                }
            }, 600);
            break;

        case 'build-done':
            benachrichtungSystem.showToast({
                type: 'build',
                title: '✨ Zusammenbauen erledigt!',
                message: 'AstrieOS ist bereit!',
                detail: '(ᵕ • ᴗ •)',
                icon: '✨',
                color: '#4ade80',
                duration: 5000,
                sound: 'todo-done'
            });
            break;

        case 'todo':
            benachrichtungSystem.showToast({
                type: 'todo',
                title: '✅ Todo erledigt!',
                message: 'Sprache übersetzt [Erledgit! :D]',
                icon: '📝',
                color: '#4ade80',
                duration: 5000,
                sound: 'todo-done'
            });
            break;

        case 'welcome':
            benachrichtungSystem.showToast({
                type: 'welcome',
                title: 'Willkommen bei AstrieOS!',
                message: 'Benachrichtungs-Bar ist aktiv!',
                detail: 'Überwache Commits, Uploads & Todos...',
                icon: '🚀',
                color: '#e2a0ff',
                duration: 5000,
                sound: 'update'
            });
            break;

        case 'all':
            // Alle nacheinander mit Verzögerung
            const sequence = ['upload', 'upload-done', 'now-playing', 'update', 'build', 'build-done'];
            sequence.forEach((t, i) => {
                setTimeout(() => testToast(t), i * 1200);
            });
            break;

        case 'clear':
            benachrichtungSystem.clearAll();
            break;
    }
}

// GitHub API Test
async function testGitHubAPI() {
    if (!benachrichtungSystem) return;

    benachrichtungSystem.showToast({
        type: 'info',
        title: '🌐 Teste GitHub API...',
        message: 'Frage commits ab...',
        icon: '⏳',
        color: '#e2a0ff',
        duration: 4000,
        sound: 'default'
    });

    const commit = await benachrichtungSystem.fetchLatestCommit();

    if (commit) {
        benachrichtungSystem.showToast({
            type: 'success',
            title: '✅ API funktioniert!',
            message: `Letzter Commit: "${commit.message.substring(0, 30)}..."`,
            detail: `von ${commit.author}`,
            icon: '🎉',
            color: '#4ade80',
            duration: 5000,
            sound: 'todo-done',
            url: commit.url
        });
    } else {
        benachrichtungSystem.showToast({
            type: 'error',
            title: '⚠️ API nicht erreichbar',
            message: 'Rate-Limit erreicht oder Offline',
            detail: 'Versuche es später erneut',
            icon: '🔌',
            color: '#ff6b6b',
            duration: 5000,
            sound: 'clear'
        });
    }
}

// Tastenkürzel für Tests (nur im Dev-Modus)
document.addEventListener('keydown', (e) => {
    // Nur wenn Settings-Overlay offen ist
    const settingsOpen = document.querySelector('.Settingsoverlay.Settings-active');
    if (!settingsOpen) return;

    if (e.key === 't' && e.ctrlKey) {
        e.preventDefault();
        testToast('all');
    }
});

// === INITIALISIERUNG ===
let benachrichtungSystem;

document.addEventListener('DOMContentLoaded', () => {
    benachrichtungSystem = new BenachrichtungSystem();
    if (!localStorage.getItem('astrie_welcome_sent')) {
        setTimeout(() => {
            benachrichtungSystem.showToast({
                type: 'welcome',
                title: 'Willkommen bei AstrieOS!',
                message: 'Benachrichtungs-Bar ist aktiv!',
                detail: 'Überwache Commits, Uploads & Todos...',
                icon: '🚀',
                color: '#e2a0ff',
                duration: 5000,
                sound: 'update'
            });
            localStorage.setItem('astrie_welcome_sent', 'true');
        }, 1500);
    }
});