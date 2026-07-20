const WindowSystem = {
    windows: [],
    activeWindow: null,
    zIndexBase: 1000,

    create: function(options) {
        options = options || {};
        var id = 'win-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        var win = document.createElement('div');
        win.className = 'astrie-window';
        win.id = id;

        var title = options.title || 'Fenster';
        var width = options.width || 800;
        var height = options.height || 600;
        var x = options.x || 100 + (this.windows.length * 30);
        var y = options.y || 100 + (this.windows.length * 30);

        win.style.position = 'fixed';
        win.style.left = x + 'px';
        win.style.top = y + 'px';
        win.style.width = width + 'px';
        win.style.height = height + 'px';
        win.style.background = 'rgba(25, 25, 35, 0.92)';
        win.style.border = '1px solid rgba(255,255,255,0.08)';
        win.style.borderRadius = '14px';
        win.style.overflow = 'hidden';
        win.style.display = 'flex';
        win.style.flexDirection = 'column';
        win.style.boxShadow = '0 2px 2px rgba(0, 0, 0, 0.32)';
        win.style.zIndex = this.zIndexBase;
        win.style.backdropFilter = 'blur(24px)';
        win.style.webkitBackdropFilter = 'blur(24px)';
        win.style.minWidth = '320px';
        win.style.minHeight = '220px';
        win.style.animation = 'windowOpen 0.2s ease';

        var html = '<div class="window-titlebar" style="display:flex;align-items:center;padding:10px 14px;background:rgba(0,0,0,0.25);border-bottom:1px solid rgba(255,255,255,0.06);cursor:default;user-select:none;">' +
            '<div class="window-buttons" style="display:flex;gap:10px;margin-right:14px;">' +
                '<div class="win-btn close" title="Schließen" style="width:14px;height:14px;border-radius:50%;background:#ff5f57;cursor:pointer;box-shadow:inset 0 0 0 0.5px rgba(0,0,0,0.2);transition:transform 0.15s,filter 0.15s;"></div>' +
                '<div class="win-btn minimize" title="Minimieren" style="width:14px;height:14px;border-radius:50%;background:#febc2e;cursor:pointer;box-shadow:inset 0 0 0 0.5px rgba(0,0,0,0.2);transition:transform 0.15s,filter 0.15s;"></div>' +
                '<div class="win-btn maximize" title="Vollbild" style="width:14px;height:14px;border-radius:50%;background:#28c840;cursor:pointer;box-shadow:inset 0 0 0 0.5px rgba(0,0,0,0.2);transition:transform 0.15s,filter 0.15s;"></div>' +
            '</div>' +
            '<div class="window-title" style="flex:1;text-align:center;color:rgba(255,255,255,0.9);font-size:13px;font-weight:500;letter-spacing:0.3px;pointer-events:none;">' + title + '</div>' +
            '<div style="width:68px;"></div>' +
        '</div>' +
        '<div class="window-content" style="flex:1;overflow:auto;position:relative;">' + (options.content || '') + '</div>' +
        '<div class="window-resize-handle" style="position:absolute;bottom:0;right:0;width:20px;height:20px;cursor:se-resize;background:linear-gradient(135deg, transparent 55%, rgba(255,255,255,0.15) 55%);border-bottom-right-radius:14px;z-index:10;"></div>' +
        '<div class="window-resize-left" style="position:absolute;left:0;top:40px;bottom:0;width:6px;cursor:w-resize;"></div>' +
        '<div class="window-resize-right" style="position:absolute;right:0;top:40px;bottom:0;width:6px;cursor:e-resize;"></div>' +
        '<div class="window-resize-bottom" style="position:absolute;left:6px;right:6px;bottom:0;height:6px;cursor:s-resize;"></div>';

        win.innerHTML = html;

        if (!document.getElementById('window-anim-style')) {
            var style = document.createElement('style');
            style.id = 'window-anim-style';
            style.textContent = '@keyframes windowOpen { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }' +
                '.astrie-window ::-webkit-scrollbar { width:8px; height:8px; }' +
                '.astrie-window ::-webkit-scrollbar-track { background:transparent; }' +
                '.astrie-window ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:4px; }' +
                '.astrie-window ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.25); }';
            document.head.appendChild(style);
        }

        document.body.appendChild(win);
        this.windows.push(win);
        this.focus(win);

        var self = this;
        var titlebar = win.querySelector('.window-titlebar');
        var closeBtn = win.querySelector('.win-btn.close');
        var minimizeBtn = win.querySelector('.win-btn.minimize');
        var maximizeBtn = win.querySelector('.win-btn.maximize');
        var resizeHandle = win.querySelector('.window-resize-handle');
        var resizeLeft = win.querySelector('.window-resize-left');
        var resizeRight = win.querySelector('.window-resize-right');
        var resizeBottom = win.querySelector('.window-resize-bottom');

        closeBtn.addEventListener('click', function(e) { e.stopPropagation(); self.close(win); });
        minimizeBtn.addEventListener('click', function(e) { e.stopPropagation(); self.minimize(win); });
        maximizeBtn.addEventListener('click', function(e) { e.stopPropagation(); self.maximize(win); });

        [closeBtn, minimizeBtn, maximizeBtn].forEach(function(btn) {
            btn.addEventListener('mouseenter', function() { btn.style.transform = 'scale(1.15)'; btn.style.filter = 'brightness(1.2)'; });
            btn.addEventListener('mouseleave', function() { btn.style.transform = 'scale(1)'; btn.style.filter = 'brightness(1)'; });
        });

        var isDragging = false, dragX = 0, dragY = 0;
        titlebar.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('win-btn')) return;
            if (win.dataset.maximized === 'true') return;
            isDragging = true;
            dragX = e.clientX - win.offsetLeft;
            dragY = e.clientY - win.offsetTop;
            self.focus(win);
        });

        var isResizing = false, resizeDir = '';
        function startResize(e, dir) {
            isResizing = true;
            resizeDir = dir;
            e.stopPropagation();
            self.focus(win);
        }

        resizeHandle.addEventListener('mousedown', function(e) { startResize(e, 'se'); });
        resizeRight.addEventListener('mousedown', function(e) { startResize(e, 'e'); });
        resizeBottom.addEventListener('mousedown', function(e) { startResize(e, 's'); });
        resizeLeft.addEventListener('mousedown', function(e) { startResize(e, 'w'); });

        function onMouseMove(e) {
            if (isDragging) {
                win.style.left = (e.clientX - dragX) + 'px';
                win.style.top = (e.clientY - dragY) + 'px';
            }
            if (isResizing && win.dataset.maximized !== 'true') {
                var rect = win.getBoundingClientRect();
                if (resizeDir.indexOf('e') !== -1) {
                    var w = e.clientX - rect.left;
                    if (w > 320) win.style.width = w + 'px';
                }
                if (resizeDir.indexOf('s') !== -1) {
                    var h = e.clientY - rect.top;
                    if (h > 220) win.style.height = h + 'px';
                }
                if (resizeDir.indexOf('w') !== -1) {
                    var newW = rect.right - e.clientX;
                    if (newW > 320) {
                        win.style.width = newW + 'px';
                        win.style.left = e.clientX + 'px';
                    }
                }
            }
        }

        function onMouseUp() { isDragging = false; isResizing = false; }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        win._cleanup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        win.addEventListener('mousedown', function() { self.focus(win); });

        return win;
    },

    focus: function(win) {
        this.zIndexBase++;
        win.style.zIndex = this.zIndexBase;
        for (var i = 0; i < this.windows.length; i++) {
            this.windows[i].style.boxShadow = '0 25px 70px rgba(0,0,0,0.6)';
        }
        win.style.boxShadow = '0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)';
        this.activeWindow = win;
    },

    close: function(win) {
        var self = this;
        win.style.animation = 'windowOpen 0.15s ease reverse';
        setTimeout(function() {
            if (win._cleanup) win._cleanup();
            win.remove();
            self.windows = self.windows.filter(function(w) { return w !== win; });
        }, 140);
    },

    minimize: function(win) {
        win.dataset.minimized = 'true';
        win.style.display = 'none';
    },

    maximize: function(win) {
        if (win.dataset.maximized === 'true') {
            win.style.left = win.dataset.prevLeft;
            win.style.top = win.dataset.prevTop;
            win.style.width = win.dataset.prevWidth;
            win.style.height = win.dataset.prevHeight;
            win.dataset.maximized = 'false';
        } else {
            win.dataset.prevLeft = win.style.left;
            win.dataset.prevTop = win.style.top;
            win.dataset.prevWidth = win.style.width;
            win.dataset.prevHeight = win.style.height;
            win.style.left = '10px';
            win.style.top = '10px';
            win.style.width = 'calc(100vw - 20px)';
            win.style.height = 'calc(100vh - 20px)';
            win.dataset.maximized = 'true';
        }
    }
};