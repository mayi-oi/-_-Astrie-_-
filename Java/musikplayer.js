/* Todo list 3000
    1. Visualcanva-teil Musikplayer oder desktop
    2. Visualdesign mit waves erstellt
    3. Musikcontroll mit icon 'Res/Bild/Icon/Desktop/Musikplayer' und Fortschrittbalken
*/

const MUSIC_CONFIG = {
    defaultCover: 'Res/Bild/Hintergrund/astrie-hintergrund.png',
    defaultVolume: 0.35,
    defaultInactiveVolume: 0.12
};

let playlist = [];
let currentTrackIndex = -1;
let audioElement = null;
let audioCtx = null;
let analyserNode = null;
let gainNode = null;
let mediaSource = null;
let visualizerFrame = null;
let isVisualizerActive = false;

const dom = {
    cover: document.getElementById('Musikcover'),
    title: document.getElementById('Musiktitle'),
    artist: document.getElementById('Musikkünstler'),
    uploadBtn: document.getElementById('musikplayer-hochladen'),
    uploadMenu: document.getElementById('musikplayer-upload-menu'),
    dropdownBtn: document.getElementById('musikplayer-dropdown-menu'),
    dropdownImg: document.getElementById('Musikplayer-dropdown-img'),
    dropdownMenu: document.getElementById('musikplayer-dp-menu'),
    volumeSlider: document.getElementById('Vl-silder'),
    inactiveSlider: document.getElementById('IVl-silder'),
    volumeDisplay: document.getElementById('Volume-value'),
    inactiveDisplay: document.getElementById('iVolume-value')
};

document.addEventListener('DOMContentLoaded', () => {
    initUpload();
    initPlaylistUI();
    initVolume();
    initVisualizer();
    initKeyboard();
    updateVolumeDisplay();
});

// === Audio Context & Web Audio API ===
function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.85;
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
    }
}

function connectAudioElement() {
    if (!audioElement || !audioCtx) return;
    if (mediaSource) {
        try { mediaSource.disconnect(); } catch(e) {}
    }
    mediaSource = audioCtx.createMediaElementSource(audioElement);
    mediaSource.connect(analyserNode);
    analyserNode.connect(gainNode);
}

// === ID3 Tags (Cover, Titel, Künstler) ===
function extractTags(file) {
    return new Promise((resolve) => {
        if (typeof jsmediatags === 'undefined') {
            resolve(fallbackTags(file));
            return;
        }
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const t = tag.tags;
                let cover = null;
                if (t.picture && t.picture.data) {
                    const bytes = new Uint8Array(t.picture.data);
                    cover = URL.createObjectURL(new Blob([bytes], { type: t.picture.type || 'image/jpeg' }));
                }
                resolve({
                    title: t.title || cleanFilename(file.name),
                    artist: t.artist || 'Unbekannt',
                    cover: cover
                });
            },
            onError: () => resolve(fallbackTags(file))
        });
    });
}

function fallbackTags(file) {
    return {
        title: cleanFilename(file.name),
        artist: 'Unbekannt',
        cover: null
    };
}

function cleanFilename(name) {
    return name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
}

// === Upload & Drag & Drop ===
function initUpload() {
    // Toggle upload menu
    dom.uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.uploadMenu.classList.toggle('open');
    });

    // File selection via click on dropzone
    dom.uploadMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.multiple = true;
        input.onchange = (e) => {
            processFiles(e.target.files);
            dom.uploadMenu.classList.remove('open');
        };
        input.click();
    });

    // Drag & Drop
    ['dragover', 'dragleave', 'drop'].forEach(eventName => {
        dom.uploadMenu.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (eventName === 'dragover') {
                dom.uploadMenu.style.borderColor = '#FF69B4';
                dom.uploadMenu.style.background = 'rgba(255, 105, 180, 0.15)';
            } else if (eventName === 'dragleave') {
                dom.uploadMenu.style.borderColor = '';
                dom.uploadMenu.style.background = '';
            } else if (eventName === 'drop') {
                dom.uploadMenu.style.borderColor = '';
                dom.uploadMenu.style.background = '';
                processFiles(e.dataTransfer.files);
                dom.uploadMenu.classList.remove('open');
            }
        });
    });
}

async function processFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('audio/'));
    if (files.length === 0) return;

    for (const file of files) {
        const tags = await extractTags(file);
        const objectUrl = URL.createObjectURL(file);
        playlist.push({
            id: Date.now() + Math.random(),
            file,
            url: objectUrl,
            title: tags.title,
            artist: tags.artist,
            cover: tags.cover || MUSIC_CONFIG.defaultCover
        });
    }

    renderPlaylist();
    if (currentTrackIndex === -1 && playlist.length > 0) {
        loadTrack(0);
    }
}

// === Playlist UI ===
function initPlaylistUI() {
    dom.dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.dropdownMenu.classList.toggle('open');
        dom.dropdownImg.style.transform = dom.dropdownMenu.classList.contains('open') ? 'rotate(180deg)' : '';
    });
}

function renderPlaylist() {
    if (playlist.length === 0) {
        dom.dropdownMenu.innerHTML = '<h2 data-i18n="empty_playlist">Super duper leer playlist... (╥ ᴗ ╥)</h2>';
        return;
    }

    dom.dropdownMenu.innerHTML = '';
    
    // Header (bleibt immer sichtbar!)
    const header = document.createElement('div');
    header.className = 'playlist-header';
    header.innerHTML = `
        <span>${playlist.length} Song${playlist.length !== 1 ? 's' : ''}</span>
        <button class="playlist-clear" onclick="clearPlaylist()" title="Alles löschen"><img src="Res/Bild/Icon/Desktop/Musikplayer/delete_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg"></button>
    `;
    dom.dropdownMenu.appendChild(header);

    // Scrollbarer Container für die Songs
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'playlist-scroll';

    playlist.forEach((track, idx) => {
        const item = document.createElement('div');
        item.className = 'playlist-item' + (idx === currentTrackIndex ? ' active' : '');
        item.style.backgroundImage = `url('${track.cover}')`;
        
        item.innerHTML = `
            <img src="${track.cover}" class="playlist-thumb" alt="" onerror="this.src='${MUSIC_CONFIG.defaultCover}'">
            <div class="playlist-meta">
                <div class="playlist-title">${escapeHtml(track.title)}</div>
                <div class="playlist-artist">${escapeHtml(track.artist)}</div>
            </div>
            <button class="playlist-delete" onclick="event.stopPropagation(); removeTrack(${idx})" title="Entfernen">×</button>
        `;
        item.onclick = () => loadTrack(idx);
        scrollContainer.appendChild(item);
    });

    dom.dropdownMenu.appendChild(scrollContainer);
}

function removeTrack(index) {
    if (index === currentTrackIndex) {
        stopPlayback();
        currentTrackIndex = -1;
    } else if (index < currentTrackIndex) {
        currentTrackIndex--;
    }
    
    URL.revokeObjectURL(playlist[index].url);
    playlist.splice(index, 1);
    
    if (playlist.length === 0) {
        stopPlayback();
        currentTrackIndex = -1;
    }
    
    renderPlaylist();
}

function clearPlaylist() {
    stopPlayback();
    playlist.forEach(t => URL.revokeObjectURL(t.url));
    playlist = [];
    currentTrackIndex = -1;
    renderPlaylist();
}

// === Track Laden & Abspielen ===
function loadTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    
    if (audioElement) {
        audioElement.pause();
        audioElement.removeEventListener('ended', onTrackEnded);
        audioElement.removeEventListener('error', onTrackError);
    }

    currentTrackIndex = index;
    const track = playlist[index];

    ensureAudioContext();
    
    audioElement = new Audio(track.url);
    audioElement.crossOrigin = 'anonymous';
    
    audioElement.addEventListener('ended', onTrackEnded);
    audioElement.addEventListener('error', onTrackError);
    audioElement.addEventListener('canplay', () => {
        connectAudioElement();
        applyVolume();
        audioElement.play().catch(console.error);
        isVisualizerActive = true;
        startVisualizer();
    });

    dom.cover.src = track.cover;
    setMarquee(dom.title, track.title);
    setMarquee(dom.artist, track.artist);
    
    renderPlaylist();
}

function stopPlayback() {
    if (audioElement) {
        audioElement.pause();
        audioElement = null;
    }
    isVisualizerActive = false;
    stopVisualizer();
    dom.cover.src = MUSIC_CONFIG.defaultCover;
    setMarquee(dom.title, window.I18n && I18n.t ? I18n.t('musicplayer_no_music') : 'Kein Musik! :(');
    setMarquee(dom.artist, window.I18n && I18n.t ? I18n.t('musicplayer_no_artist') : 'Kein Musikkünstler! :(');
}

function onTrackEnded() {
    nextTrack();
}

function onTrackError() {
    console.error('Fehler beim Laden des Tracks');
    nextTrack();
}

function nextTrack() {
    if (playlist.length === 0) return;
    const next = (currentTrackIndex + 1) % playlist.length;
    loadTrack(next);
}

function prevTrack() {
    if (playlist.length === 0) return;
    const prev = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    loadTrack(prev);
}

function togglePlay() {
    if (!audioElement) {
        if (playlist.length > 0) loadTrack(0);
        return;
    }
    if (audioElement.paused) {
        audioElement.play();
        isVisualizerActive = true;
        startVisualizer();
    } else {
        audioElement.pause();
        isVisualizerActive = false;
        stopVisualizer();
    }
}

// === Autoscroll / Marquee ===
function setMarquee(element, text) {
    element.textContent = text;
    element.classList.remove('marquee');
    element.style.animation = 'none';
    element.style.removeProperty('--marquee-dist');
    element.style.removeProperty('--marquee-dur');
    
    requestAnimationFrame(() => {
        const parent = element.parentElement;
        if (!parent) return;
        
        const availableWidth = parent.clientWidth;
        const textWidth = element.scrollWidth;
        
        if (textWidth > availableWidth) {
            const distance = textWidth - availableWidth + 30;
            const duration = Math.max(4, distance / 40);
            element.style.setProperty('--marquee-dist', `-${distance}px`);
            element.style.setProperty('--marquee-dur', `${duration}s`);
            element.classList.add('marquee');
        }
    });
}

// === Volume Slider (Web Audio API) ===
function initVolume() {
    if (dom.volumeSlider) {
        dom.volumeSlider.addEventListener('input', () => {
            applyVolume();
            updateVolumeDisplay();
        });
    }
    if (dom.inactiveSlider) {
        dom.inactiveSlider.addEventListener('input', () => {
            applyVolume();
            updateVolumeDisplay();
        });
    }
    
    document.addEventListener('visibilitychange', () => {
        applyVolume();
    });
}

function applyVolume() {
    if (!gainNode) return;
    
    const mainVol = dom.volumeSlider ? parseInt(dom.volumeSlider.value || 35) / 100 : MUSIC_CONFIG.defaultVolume;
    const inactiveMultiplier = dom.inactiveSlider ? parseInt(dom.inactiveSlider.value || 12) / 100 : MUSIC_CONFIG.defaultInactiveVolume;
    
    const isTabHidden = document.hidden;
    const finalVolume = isTabHidden ? mainVol * inactiveMultiplier : mainVol;
    
    gainNode.gain.setTargetAtTime(finalVolume, audioCtx.currentTime, 0.1);
}

function updateVolumeDisplay() {
    if (dom.volumeDisplay) dom.volumeDisplay.textContent = dom.volumeSlider ? dom.volumeSlider.value : 35;
    if (dom.inactiveDisplay) dom.inactiveDisplay.textContent = dom.inactiveSlider ? dom.inactiveSlider.value : 12;
}

// === Canvas Visualizer ===
function initVisualizer() {
    const canvas = document.createElement('canvas');
    canvas.id = 'astrie-visualizer';
    canvas.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 120px;
        pointer-events: none;
        opacity: 0.7;
        z-index: 5;
        border-radius: 0 0 12px 12px;
        mix-blend-mode: screen;
    `;
    
    const playerContent = document.querySelector('.Musikplayer-content');
    if (playerContent) {
        playerContent.style.position = 'relative';
        playerContent.appendChild(canvas);
    }
}

function startVisualizer() {
    const canvas = document.getElementById('astrie-visualizer');
    if (!canvas || !analyserNode) return;
    
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        if (!isVisualizerActive) return;
        visualizerFrame = requestAnimationFrame(draw);
        
        const w = canvas.width = canvas.offsetWidth;
        const h = canvas.height = canvas.offsetHeight;
        
        analyserNode.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, w, h);
        
        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, 'rgba(255, 105, 180, 0.9)');
        grad.addColorStop(0.5, 'rgba(135, 206, 235, 0.7)');
        grad.addColorStop(1, 'rgba(147, 112, 219, 0.3)');
        
        const barCount = Math.min(bufferLength, 64);
        const barWidth = (w / barCount) * 0.8;
        const gap = (w / barCount) * 0.2;
        let x = 0;
        
        for (let i = 0; i < barCount; i++) {
            const percent = dataArray[i] / 255;
            const barHeight = percent * h * 0.9;
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, h - barHeight, barWidth, barHeight, [barWidth/2, barWidth/2, 0, 0]);
            } else {
                ctx.rect(x, h - barHeight, barWidth, barHeight);
            }
            ctx.fill();
            
            x += barWidth + gap;
        }
    }
    
    stopVisualizer();
    draw();
}

function stopVisualizer() {
    if (visualizerFrame) {
        cancelAnimationFrame(visualizerFrame);
        visualizerFrame = null;
    }
    const canvas = document.getElementById('astrie-visualizer');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// === Tastenkürzel ===
function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case ' ':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowRight':
                if (!e.ctrlKey) nextTrack();
                break;
            case 'ArrowLeft':
                if (!e.ctrlKey) prevTrack();
                break;
            case 'MediaTrackNext':
                nextTrack();
                break;
            case 'MediaTrackPrevious':
                prevTrack();
                break;
        }
    });
}

// === Hilfsfunktionen ===
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}