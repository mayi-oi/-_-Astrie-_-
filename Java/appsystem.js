/* todo list 9000 fuer K3 testen! <---
    1. Mach den cool internet surfen! mit duckduckgo!
    2. Datein kann nur nutzter hochladen, erstellt, loeschen sehen
    3. Mach den Yapping editor wie text editor
    4. osu!beatmap mirror nutzten durch 'https://api.rai.moe' als Beatmap diesnt
    5. Viel spass! :D
*/

const AppSystem = {

    // ====== 1. Cool Internet surfen! (DuckDuckGo) ======
    openBrowser: function() {
        var content = '<div style="width:100%;height:100%;display:flex;flex-direction:column;">' +
            '<div style="display:flex;padding:10px;gap:8px;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.05);">' +
                '<input type="text" id="browser-url" placeholder="https://..." value="https://html.duckduckgo.com/html/" ' +
                    'style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;outline:none;font-size:13px;">' +
                '<button onclick="document.getElementById(\'browser-frame\').src = document.getElementById(\'browser-url\').value" ' +
                    'style="background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:#fff;padding:8px 18px;cursor:pointer;font-weight:500;">🚀 Los!</button>' +
            '</div>' +
            '<iframe id="browser-frame" src="https://duckduckgo.com" style="flex:1;border:none;background:#1a1a2e;"></iframe>' +
        '</div>';
        WindowSystem.create({ title: '🌐 Cool Internet!', content: content, width: 950, height: 650, x: 80, y: 60 });
    },

    // ====== 2. Datein Manager (hochladen, erstellen, loeschen, sehen) ======
    openFileManager: function() {
        var FS = {
            files: JSON.parse(localStorage.getItem('astrie_files_v2') || '[]'),
            save: function() { localStorage.setItem('astrie_files_v2', JSON.stringify(this.files)); },
            add: function(name, content) {
                content = content || '';
                this.files.push({ id: Date.now() + Math.random(), name: name, content: content, date: new Date().toLocaleString('de-DE') });
                this.save();
            },
            remove: function(id) { this.files = this.files.filter(function(f) { return f.id !== id; }); this.save(); },
            get: function(id) { return this.files.find(function(f) { return f.id == id; }); }
        };

        var self = this;
        function render() {
            var list = document.getElementById('file-list');
            if (!list) return;
            if (FS.files.length === 0) {
                list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">Ganz leer... (╥ ᴗ ╥)<br>Erstell oder lad was hoch!</div>';
                return;
            }
            list.innerHTML = FS.files.map(function(f) {
                return '<div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);gap:12px;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'transparent\'">' +
                    '<span style="font-size:20px;">📄</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="color:#fff;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + self._escapeHtml(f.name) + '</div>' +
                        '<div style="color:rgba(255,255,255,0.4);font-size:10px;">' + f.date + '</div>' +
                    '</div>' +
                    '<button onclick="window._astrieEditFile(' + f.id + ')" style="background:rgba(255,255,255,0.08);border:none;color:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px;">✏️</button>' +
                    '<button onclick="window._astrieDeleteFile(' + f.id + ')" style="background:rgba(255,80,80,0.15);border:none;color:#ff6b6b;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px;">🗑️</button>' +
                '</div>';
            }).join('');
        }

        window._astrieDeleteFile = function(id) {
            if (confirm('Wirklich loeschen?')) { FS.remove(id); render(); }
        };
        window._astrieEditFile = function(id) {
            var file = FS.get(id);
            if (!file) return;
            var editContent = '<div style="width:100%;height:100%;display:flex;flex-direction:column;padding:14px;">' +
                '<input id="edit-fname" value="' + self._escapeAttr(file.name) + '" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#fff;margin-bottom:10px;outline:none;font-size:13px;">' +
                '<textarea id="edit-fcontent" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;color:#fff;resize:none;outline:none;font-family:monospace;font-size:13px;line-height:1.5;">' + self._escapeHtml(file.content) + '</textarea>' +
                '<button onclick="window._astrieSaveEdit(' + id + ')" style="margin-top:10px;background:rgba(40,200,64,0.2);border:1px solid rgba(40,200,64,0.3);color:#28c840;border-radius:8px;padding:12px;cursor:pointer;font-weight:500;">💾 Speichern!</button>' +
            '</div>';
            WindowSystem.create({ title: '✏️ ' + file.name, content: editContent, width: 650, height: 450, x: 220, y: 140 });
        };
        window._astrieSaveEdit = function(id) {
            var f = FS.get(id);
            if (f) {
                f.name = document.getElementById('edit-fname').value;
                f.content = document.getElementById('edit-fcontent').value;
                f.date = new Date().toLocaleString('de-DE');
                FS.save();
            }
        };

        var content = '<div style="width:100%;height:100%;display:flex;flex-direction:column;">' +
            '<div style="display:flex;padding:12px;gap:8px;border-bottom:1px solid rgba(255,255,255,0.05);">' +
                '<button onclick="window._astrieNewFile()" style="background:rgba(40,200,64,0.15);border:1px solid rgba(40,200,64,0.25);color:#28c840;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:500;">➕ Neu</button>' +
                '<button onclick="document.getElementById(\'fm-upload\').click()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;">📤 Hochladen</button>' +
                '<input type="file" id="fm-upload" style="display:none;" onchange="window._astrieUpload(this)">' +
            '</div>' +
            '<div id="file-list" style="flex:1;overflow:auto;"></div>' +
        '</div>';

        window._astrieNewFile = function() {
            var name = prompt('Dateiname:', 'dokument.txt');
            if (name) { FS.add(name); render(); }
        };
        window._astrieUpload = function(input) {
            var file = input.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) { FS.add(file.name, e.target.result); render(); };
            if (file.type.indexOf('text/') === 0 || file.name.match(/\.(txt|js|html|css)$/)) {
                reader.readAsText(file);
            } else {
                FS.add(file.name, '[Binaerdatei]');
                render();
            }
        };

        WindowSystem.create({ title: '📁 Dateien!', content: content, width: 720, height: 520, x: 100, y: 80 });
        setTimeout(render, 50);
    },

    // ====== 3. Yapping Editor (Text Editor) ======
    openTextEditor: function() {
        var content = '<div style="width:100%;height:100%;display:flex;flex-direction:column;padding:12px;">' +
            '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
                '<button onclick="window._edNew()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;">🆕 Neu</button>' +
                '<button onclick="window._edSave()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;">💾 Speichern</button>' +
                '<button onclick="window._edOpen()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;">📂 Oeffnen</button>' +
            '</div>' +
            '<textarea id="yapping-area" placeholder="Hier yappen... (⎚-⎚)✍️" style="flex:1;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;color:#e0e0e0;resize:none;outline:none;font-family:monospace;font-size:14px;line-height:1.6;"></textarea>' +
            '<div style="margin-top:6px;color:rgba(255,255,255,0.3);font-size:11px;text-align:right;">Zeichen: <span id="ed-count">0</span></div>' +
        '</div>';

        window._edNew = function() {
            var ta = document.getElementById('yapping-area');
            if (ta) ta.value = '';
            var c = document.getElementById('ed-count');
            if (c) c.textContent = '0';
        };
        window._edSave = function() {
            var text = document.getElementById('yapping-area').value;
            var name = prompt('Speichern als:', 'yapping.txt');
            if (!name) return;
            var files = JSON.parse(localStorage.getItem('astrie_files_v2') || '[]');
            files.push({ id: Date.now(), name: name, content: text, date: new Date().toLocaleString('de-DE') });
            localStorage.setItem('astrie_files_v2', JSON.stringify(files));
        };
        window._edOpen = function() {
            var files = JSON.parse(localStorage.getItem('astrie_files_v2') || '[]').filter(function(f) { return typeof f.content === 'string'; });
            var name = prompt('Welche Datei?\n\n' + files.map(function(f) { return '• ' + f.name; }).join('\n'));
            var file = files.find(function(f) { return f.name === name; });
            if (file) {
                var ta = document.getElementById('yapping-area');
                if (ta) ta.value = file.content;
                var c = document.getElementById('ed-count');
                if (c) c.textContent = file.content.length;
            }
        };

        var win = WindowSystem.create({ title: '📝 Yapping Editor!', content: content, width: 750, height: 550, x: 140, y: 100 });
        setTimeout(function() {
            var ta = document.getElementById('yapping-area');
            if (ta) {
                ta.addEventListener('input', function() {
                    var c = document.getElementById('ed-count');
                    if (c) c.textContent = ta.value.length;
                });
            }
        }, 100);
    },

    // ====== 4. osu! Beatmap Mirror (api.rai.moe) ======
    openOsuDownloader: function() {
        var self = this;
        var content = '<div style="width:100%;height:100%;display:flex;flex-direction:column;padding:16px;">' +
            '<div style="text-align:center;margin-bottom:14px;">' +
                '<h2 style="color:#ff66aa;margin:0;font-size:20px;">osu! Beatmap Downloader 🎵</h2>' +
                '<p style="color:rgba(255,255,255,0.5);font-size:11px;margin:4px 0;">via api.rai.moe | .osz Support!</p>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
                '<input type="text" id="bm-search" placeholder="Beatmap Titel oder Artist..." ' +
                    'style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;color:#fff;outline:none;font-size:13px;" ' +
                    'onkeydown="if(event.key===\'Enter\')window._bmSearch()">' +
                '<button onclick="window._bmSearch()" style="background:linear-gradient(135deg,#ff66aa,#ff4499);border:none;color:#fff;border-radius:10px;padding:10px 22px;cursor:pointer;font-weight:600;">🔍 Suchen</button>' +
            '</div>' +
            '<div id="bm-results" style="flex:1;overflow:auto;border-radius:10px;background:rgba(0,0,0,0.2);padding:4px;"></div>' +
        '</div>';

        window._bmSearch = function() {
            var q = document.getElementById('bm-search').value.trim();
            var resDiv = document.getElementById('bm-results');
            if (!q) return;
            resDiv.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.5);">Laden... ⏳</div>';

            fetch('https://api.rai.moe/search?query=' + encodeURIComponent(q) + '&limit=20')
                .then(function(resp) { return resp.json(); })
                .then(function(data) {
                    if (!data.beatmaps || data.beatmaps.length === 0) {
                        resDiv.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);">Nix gefunden! Versuch was anderes~ (╥ ᴗ ╥)</div>';
                        return;
                    }
                    resDiv.innerHTML = data.beatmaps.map(function(bm) {
                        var cover = (bm.covers && bm.covers.list) ? bm.covers.list : 'https://osu.ppy.sh/images/headers/profile-covers/c1.jpg';
                        var title = bm.title || 'Unknown';
                        var artist = bm.artist || 'Unknown Artist';
                        var diff = (bm.difficulty_rating != null) ? bm.difficulty_rating.toFixed(2) : '?';
                        var mode = bm.mode || 'osu';
                        var status = bm.status || 'ranked';
                        var safeTitle = (bm.title || 'beatmap').replace(/'/g, "\\'");
                        return '<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04);gap:12px;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'transparent\'">' +
                            '<img src="' + cover + '" style="width:56px;height:56px;border-radius:8px;object-fit:cover;background:rgba(0,0,0,0.3);">' +
                            '<div style="flex:1;min-width:0;">' +
                                '<div style="color:#fff;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + self._escapeHtml(title) + '</div>' +
                                '<div style="color:rgba(255,255,255,0.55);font-size:11px;">' + self._escapeHtml(artist) + '</div>' +
                                '<div style="color:#ff66aa;font-size:11px;margin-top:2px;">★ ' + diff + ' • ' + mode + ' • ' + status + '</div>' +
                            '</div>' +
                            '<button onclick="window._bmDownload(' + bm.id + ',\'' + safeTitle + '\')" style="background:rgba(255,102,170,0.15);border:1px solid rgba(255,102,170,0.3);color:#ff66aa;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:500;">⬇️ .osz</button>' +
                        '</div>';
                    }).join('');
                })
                .catch(function(err) {
                    console.error(err);
                    resDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#ff6b6b;">API Fehler! Vielleicht ist rai.moe down? (╥ ᴗ ╥)<br><small>' + err.message + '</small></div>';
                });
        };

        window._bmDownload = function(id, title) {
            var url = 'https://api.rai.moe/d/' + id;
            var a = document.createElement('a');
            a.href = url;
            a.download = id + '.osz';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        WindowSystem.create({ title: '🎶 osu! Beatmap Mirror', content: content, width: 720, height: 600, x: 130, y: 90 });
    },

    // Hilfsfunktionen
    _escapeHtml: function(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    _escapeAttr: function(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }
};