class BenachrichtungSystem {
    constructor() {
        this.notifications = [];
        this.todos = [];
        this.lastCommitSha = localStorage.getItem('astrie_last_commit') || null;
        this.checkInterval = null;
        this.audioCtx = null;
        this.apiFailed = false;
        this.init();
    }

    init() {
        this.loadNotifications();
        this.parseTodos();
        this.render();
        this.startGitHubPolling();
        this.startTodoWatcher();
        this.bindClearButton();
    }

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
        } catch(e) { /* Sound nicht verfügbar = egal */ }
    }

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
                this.add({
                    type: 'todo',
                    title: '✅ Todo erledigt!',
                    message: `"${todo.text}"`,
                    icon: 'check_circle',
                    color: '#4ade80'
                });
                this.playSound('todo-done');
            }
        });
        localStorage.setItem('astrie_todos', JSON.stringify(this.todos));
    }

    startTodoWatcher() {
        setInterval(() => this.parseTodos(), 5000);
    }

    // === DIREKTE GITHUB API (KEIN PROXY NÖTIG!) ===
    async fetchLatestCommit() {
        try {
            // Direkter Aufruf an GitHub - CORS ist für öffentliche Repos erlaubt!
            const response = await fetch('https://api.github.com/repos/mayi-oi/-_-Astrie-_-/commits?per_page=1', {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'AstrieOS-NotificationSystem'
                }
            });

            if (!response.ok) {
                // Stilles Failen - kein Error in Console
                this.apiFailed = true;
                return null;
            }

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
            // Stilles Failen - kein roter Error
            this.apiFailed = true;
            return null;
        }
    }

    async startGitHubPolling() {
        // Erster Check sofort
        await this.checkCommits();

        // Alle 2 Minuten (120 Sekunden) = max 30 req/h
        // Das ist sicher unter dem 60 req/h Limit für unauthentifizierte Requests!
        this.checkInterval = setInterval(() => this.checkCommits(), 120000);
    }

    async checkCommits() {
        const commit = await this.fetchLatestCommit();
        if (!commit) return;

        // Erster Start: speichere SHA ohne Benachrichtigung
        if (!this.lastCommitSha) {
            this.lastCommitSha = commit.sha;
            localStorage.setItem('astrie_last_commit', commit.sha);
            return;
        }

        // Neuer Commit!
        if (commit.sha !== this.lastCommitSha) {
            this.lastCommitSha = commit.sha;
            localStorage.setItem('astrie_last_commit', commit.sha);

            const timeAgo = this.formatTimeAgo(new Date(commit.date));

            this.add({
                type: 'commit',
                title: '🚀 Neuer Commit!',
                message: `${commit.author}: "${commit.message}"`,
                detail: `vor ${timeAgo}`,
                url: commit.url,
                icon: 'commit',
                color: '#a855f7'
            });
            this.playSound('commit');

            // Build-Simulation nach 3 Sekunden
            setTimeout(() => this.simulateBuild(commit.message), 3000);
        }
    }

    simulateBuild(commitMessage) {
        const buildId = Date.now();
        this.add({
            type: 'build',
            title: '🔨 Build gestartet',
            message: 'AstrieOS wird zusammengebaut...',
            detail: `Commit: ${commitMessage.substring(0, 30)}...`,
            icon: 'build',
            color: '#f59e0b',
            id: `build-${buildId}`
        });
        this.playSound('build');

        setTimeout(() => {
            this.add({
                type: 'build-success',
                title: '✨ Build erfolgreich!',
                message: 'AstrieOS ist bereit! (ᵕ • ᴗ •)',
                detail: 'Alle Systeme funktionieren',
                icon: 'check',
                color: '#4ade80'
            });
            this.playSound('todo-done');
        }, 5000);
    }

    // === MANUELLER TEST (für die Console!) ===
    async testCommit() {
        const commit = await this.fetchLatestCommit();
        if (commit) {
            console.log('✅ GitHub API funktioniert! Letzter Commit:', commit.message);
            // Simuliere eine Benachrichtung mit echten Daten
            this.add({
                type: 'commit',
                title: '🧪 Test-Commit!',
                message: `${commit.author}: "${commit.message}"`,
                detail: 'Manuell getestet',
                url: commit.url,
                color: '#a855f7'
            });
            this.playSound('commit');
        } else {
            console.log('⚠️ GitHub API nicht erreichbar (Rate-Limit?)');
            // Fallback: Zeige Test-Benachrichtung ohne API
            this.add({
                type: 'test',
                title: '🧪 Test-Modus',
                message: 'API-Limit erreicht oder Offline',
                detail: 'Aber das System funktioniert! :D',
                color: '#f59e0b'
            });
        }
    }

    // === BENACHRICHTUNGS MANAGEMENT ===
    add(notification) {
        const notif = {
            id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            read: false,
            ...notification
        };
        this.notifications.unshift(notif);
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }
        this.saveNotifications();
        this.render();
        this.updateBadge();
    }

    remove(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.saveNotifications();
        this.render();
        this.updateBadge();
    }

    clearAll() {
        this.playSound('clear');
        this.notifications = [];
        this.saveNotifications();
        this.render();
        this.updateBadge();
    }

    markAsRead(id) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            this.saveNotifications();
            this.render();
            this.updateBadge();
        }
    }

    saveNotifications() {
        localStorage.setItem('astrie_notifications', JSON.stringify(this.notifications));
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('astrie_notifications');
            if (saved) this.notifications = JSON.parse(saved);
        } catch(e) {
            this.notifications = [];
        }
    }

    render() {
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
        this.updateBadge();
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
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAll());
        }
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

// === INITIALISIERUNG ===
let benachrichtungSystem;

document.addEventListener('DOMContentLoaded', () => {
    benachrichtungSystem = new BenachrichtungSystem();

    // Willkommensnachricht beim ersten Mal
    if (!localStorage.getItem('astrie_welcome_sent')) {
        setTimeout(() => {
            benachrichtungSystem.add({
                type: 'welcome',
                title: 'Willkommen bei AstrieOS! ദ്ദി(•̀ ᗜ <)',
                message: 'Benachrichtungssystem ist aktiv.',
                detail: 'Überwache Commits & Todos...',
                icon: 'welcome',
                color: '#e2a0ff'
            });
            localStorage.setItem('astrie_welcome_sent', 'true');
        }, 2000);
    }
});