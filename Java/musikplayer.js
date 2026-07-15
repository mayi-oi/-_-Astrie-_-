const MUSIC_CONFIG = {
    defaultCover: 'Res/Bild/Hintergrund/astrie-hintergrund.png',
    defaultVolume: 0.35,
    defaultInactiveVolume: 0.12
};

let playlist = [];
let currentTrackIndex = -1;
let audioElement = null;
let nextAudioElement = null;
let audioCtx = null;
let analyserNode = null;
let masterGainNode = null;
let currentGainNode = null;
let nextGainNode = null;
let mediaSource = null;
let nextMediaSource = null;
let visualizerFrame = null;
let isVisualizerActive = false;
let isCrossfading = false;
const CROSSFADE_DURATION = 4;

function dispatchMusicEvent(eventType, data = {}) {
    window.dispatchEvent(new CustomEvent('astrie-music-event', {
        detail: { eventType, data }
    }));
}

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

        masterGainNode = audioCtx.createGain();
        masterGainNode.connect(audioCtx.destination);

        currentGainNode = audioCtx.createGain();
        currentGainNode.connect(analyserNode);

        nextGainNode = audioCtx.createGain();
        nextGainNode.connect(analyserNode);

        analyserNode.connect(masterGainNode);
    }
}

function connectCurrentAudio() {
    if (!audioElement || !audioCtx || !currentGainNode) return;
    if (mediaSource) {
        try { mediaSource.disconnect(); } catch(e) {}
    }
    mediaSource = audioCtx.createMediaElementSource(audioElement);
    mediaSource.connect(currentGainNode);
}

function connectNextAudio() {
    if (!nextAudioElement || !audioCtx || !nextGainNode) return;
    if (nextMediaSource) {
        try { nextMediaSource.disconnect(); } catch(e) {}
    }
    nextMediaSource = audioCtx.createMediaElementSource(nextAudioElement);
    nextMediaSource.connect(nextGainNode);
}

// === ID3 Tags ===
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
    dom.uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.uploadMenu.classList.toggle('open');
    });

    dom.uploadMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,.osz';
        input.multiple = true;
        input.onchange = (e) => {
            processFiles(e.target.files);
            dom.uploadMenu.classList.remove('open');
        };
        input.click();
    });

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
    const files = Array.from(fileList);
    if (files.length === 0) return;
    dispatchMusicEvent('upload-start', { filename: files[0].name, total: files.length });

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.osz')) {
            if (typeof JSZip === 'undefined') {
                console.error('JSZip nicht geladen – .osz Unterstützung nicht verfügbar');
                continue;
            }
            await processOszFile(file);
        } else if (file.type.startsWith('audio/')) {
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
    }

    dispatchMusicEvent('upload-done', { 
        title: playlist[playlist.length - 1]?.title || 'Musik', 
        count: files.length 
    });

    renderPlaylist();
    if (currentTrackIndex === -1 && playlist.length > 0) {
        loadTrack(0);
    }
}

// === .osz Beatmap Support ===
async function processOszFile(file) {
    try {
        const zip = await JSZip.loadAsync(file);
        const osuFiles = [];
        const audioFiles = [];
        const imageFiles = [];

        zip.forEach((relativePath, zipEntry) => {
            if (relativePath.endsWith('.osu')) osuFiles.push(zipEntry);
            else if (/\.(mp3|ogg|wav|flac)$/i.test(relativePath)) audioFiles.push(zipEntry);
            else if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(relativePath)) imageFiles.push(zipEntry);
        });

        if (audioFiles.length === 0) {
            console.warn('Keine Audio-Datei in .osz gefunden');
            return;
        }

        let title = cleanFilename(file.name).replace(/\.osz$/i, '');
        let artist = 'Unbekannt';
        let audioFilename = '';
        let bgFilename = '';

        if (osuFiles.length > 0) {
            const osuContent = await osuFiles[0].async('text');
            const metadata = parseOsuFile(osuContent);
            title = metadata.title || title;
            artist = metadata.artist || artist;
            audioFilename = metadata.audioFilename || '';
            bgFilename = metadata.background || '';
        }

        let audioEntry = audioFiles[0];
        if (audioFilename) {
            const found = audioFiles.find(f => f.name.split('/').pop().toLowerCase() === audioFilename.toLowerCase());
            if (found) audioEntry = found;
        }

        let cover = MUSIC_CONFIG.defaultCover;
        if (bgFilename) {
            const bgEntry = imageFiles.find(f => f.name.split('/').pop().toLowerCase() === bgFilename.toLowerCase());
            if (bgEntry) {
                cover = URL.createObjectURL(await bgEntry.async('blob'));
            }
        } else if (imageFiles.length > 0) {
            cover = URL.createObjectURL(await imageFiles[0].async('blob'));
        }

        const audioBlob = await audioEntry.async('blob');
        const audioExt = audioEntry.name.split('.').pop();
        const audioFile = new File([audioBlob], `${title}.${audioExt}`, { type: `audio/${audioExt}` });
        const objectUrl = URL.createObjectURL(audioFile);
        const tags = await extractTags(audioFile);

        playlist.push({
            id: Date.now() + Math.random(),
            file: audioFile,
            url: objectUrl,
            title: tags.title !== cleanFilename(audioFile.name) ? tags.title : title,
            artist: tags.artist !== 'Unbekannt' ? tags.artist : artist,
            cover: cover
        });

    } catch (err) {
        console.error('Fehler beim Verarbeiten der .osz Datei:', err);
    }
}

function parseOsuFile(content) {
    const lines = content.split(/\r?\n/);
    const metadata = {};
    let section = '';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            section = trimmed.slice(1, -1);
            continue;
        }

        if (section === 'General') {
            if (trimmed.startsWith('AudioFilename:')) metadata.audioFilename = trimmed.substring('AudioFilename:'.length).trim();
        } else if (section === 'Metadata') {
            if (trimmed.startsWith('TitleUnicode:')) metadata.titleUnicode = trimmed.substring('TitleUnicode:'.length).trim();
            else if (trimmed.startsWith('Title:')) metadata.title = trimmed.substring('Title:'.length).trim();
            else if (trimmed.startsWith('ArtistUnicode:')) metadata.artistUnicode = trimmed.substring('ArtistUnicode:'.length).trim();
            else if (trimmed.startsWith('Artist:')) metadata.artist = trimmed.substring('Artist:'.length).trim();
        } else if (section === 'Events') {
            if (trimmed.startsWith('0,') || trimmed.startsWith('1,')) {
                const match = trimmed.match(/"([^"]+)"/);
                if (match) metadata.background = match[1];
            }
        }
    }

    if (metadata.titleUnicode) metadata.title = metadata.titleUnicode;
    if (metadata.artistUnicode) metadata.artist = metadata.artistUnicode;
    return metadata;
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
    
    const header = document.createElement('div');
    header.className = 'playlist-header';
    header.innerHTML = `
        <span>${playlist.length} Song${playlist.length !== 1 ? 's' : ''}</span>
        <button class="playlist-clear" onclick="clearPlaylist()" title="Alles löschen"><img src="Res/Bild/Icon/Desktop/Musikplayer/delete_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg"></button>
    `;
    dom.dropdownMenu.appendChild(header);

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
    
    if (nextAudioElement) {
        nextAudioElement.pause();
        nextAudioElement.removeEventListener('canplay', onNextCanPlay);
        nextAudioElement = null;
    }
    if (nextMediaSource) {
        try { nextMediaSource.disconnect(); } catch(e) {}
        nextMediaSource = null;
    }
    
    URL.revokeObjectURL(playlist[index].url);
    playlist.splice(index, 1);
    
    if (playlist.length === 0) {
        stopPlayback();
        currentTrackIndex = -1;
    }
    
    renderPlaylist();
    
    if (playlist.length > 0 && currentTrackIndex !== -1 && audioElement && !audioElement.paused) {
        prepareNextTrack();
    }
}

function clearPlaylist() {
    stopPlayback();
    playlist.forEach(t => {
        URL.revokeObjectURL(t.url);
        if (t.cover && t.cover.startsWith('blob:') && t.cover !== MUSIC_CONFIG.defaultCover) {
            URL.revokeObjectURL(t.cover);
        }
    });
    playlist = [];
    currentTrackIndex = -1;
    renderPlaylist();
}

// === Track Laden & Abspielen ===
function loadTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    
    isCrossfading = false;
    
    // Alten Track aufräumen
    if (audioElement) {
        audioElement.pause();
        audioElement.removeEventListener('ended', onTrackEnded);
        audioElement.removeEventListener('error', onTrackError);
        audioElement.removeEventListener('timeupdate', onTimeUpdate);
        audioElement.removeEventListener('canplay', onCurrentCanPlay);
    }
    if (mediaSource) {
        try { mediaSource.disconnect(); } catch(e) {}
        mediaSource = null;
    }
    
    // Nächsten Track aufräumen
    if (nextAudioElement) {
        nextAudioElement.pause();
        nextAudioElement.removeEventListener('canplay', onNextCanPlay);
        nextAudioElement = null;
    }
    if (nextMediaSource) {
        try { nextMediaSource.disconnect(); } catch(e) {}
        nextMediaSource = null;
    }
    
    // Gains zurücksetzen
    const now = audioCtx ? audioCtx.currentTime : 0;
    if (currentGainNode) {
        currentGainNode.gain.cancelScheduledValues(now);
        currentGainNode.gain.setValueAtTime(1, now);
    }
    if (nextGainNode) {
        nextGainNode.gain.cancelScheduledValues(now);
        nextGainNode.gain.setValueAtTime(0, now);
    }

    currentTrackIndex = index;
    const track = playlist[index];

    ensureAudioContext();
    
    audioElement = new Audio(track.url);
    audioElement.crossOrigin = 'anonymous';
    
    audioElement.addEventListener('ended', onTrackEnded);
    audioElement.addEventListener('error', onTrackError);
    audioElement.addEventListener('timeupdate', onTimeUpdate);
    audioElement.addEventListener('canplay', onCurrentCanPlay);

    dom.cover.src = track.cover;
    setMarquee(dom.title, track.title);
    setMarquee(dom.artist, track.artist);
    
    renderPlaylist();
}

function onCurrentCanPlay() {
    if (!audioElement || audioElement.dataset.connected === 'true') return;
    audioElement.dataset.connected = 'true';
    
    connectCurrentAudio();
    applyVolume();
    audioElement.play().catch(console.error);
    isVisualizerActive = true;
    startVisualizer();
    
    prepareNextTrack();
}

function prepareNextTrack() {
    if (playlist.length <= 1) return;
    
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    const track = playlist[nextIndex];
    
    if (nextAudioElement) {
        nextAudioElement.pause();
        nextAudioElement.removeEventListener('canplay', onNextCanPlay);
        nextAudioElement = null;
    }
    if (nextMediaSource) {
        try { nextMediaSource.disconnect(); } catch(e) {}
        nextMediaSource = null;
    }
    
    nextAudioElement = new Audio(track.url);
    nextAudioElement.crossOrigin = 'anonymous';
    nextAudioElement.preload = 'auto';
    nextAudioElement.addEventListener('canplay', onNextCanPlay);
    nextAudioElement.addEventListener('error', () => {
        console.error('Fehler beim Laden des nächsten Tracks');
        nextAudioElement = null;
    });
}

function onNextCanPlay() {
    if (!nextAudioElement || nextAudioElement.dataset.connected === 'true') return;
    nextAudioElement.dataset.connected = 'true';
    
    connectNextAudio();
    nextGainNode.gain.value = 0;
}

function onTimeUpdate() {
    if (!audioElement || !audioElement.duration || isCrossfading || !nextAudioElement || nextAudioElement.readyState < 2) return;
    
    const remaining = audioElement.duration - audioElement.currentTime;
    if (remaining <= CROSSFADE_DURATION) {
        const fadeDuration = Math.max(0.5, remaining - 0.1);
        startCrossfade(fadeDuration);
    }
}

function startCrossfade(fadeDuration) {
    if (isCrossfading || !audioCtx || !currentGainNode || !nextGainNode || !nextAudioElement) return;
    isCrossfading = true;
    
    const now = audioCtx.currentTime;
    const endTime = now + fadeDuration;
    
    // Current Track fade out
    const currentVol = Math.max(currentGainNode.gain.value, 0.001);
    currentGainNode.gain.setValueAtTime(currentVol, now);
    currentGainNode.gain.exponentialRampToValueAtTime(0.001, endTime);
    
    // Next Track fade in
    nextGainNode.gain.setValueAtTime(0.001, now);
    nextGainNode.gain.exponentialRampToValueAtTime(1, endTime);
    
    // Next Track starten
    nextAudioElement.play().catch(err => {
        console.error('Fehler beim Starten des Crossfade:', err);
        isCrossfading = false;
    });
    
    setTimeout(() => finishCrossfade(), fadeDuration * 1000);
}

function finishCrossfade() {
    if (!isCrossfading) return;
    
    // Alten Track stoppen
    if (audioElement) {
        audioElement.pause();
        audioElement.removeEventListener('ended', onTrackEnded);
        audioElement.removeEventListener('error', onTrackError);
        audioElement.removeEventListener('timeupdate', onTimeUpdate);
        audioElement.removeEventListener('canplay', onCurrentCanPlay);
    }
    if (mediaSource) {
        try { mediaSource.disconnect(); } catch(e) {}
        mediaSource = null;
    }
    
    // Referenzen switchen
    audioElement = nextAudioElement;
    nextAudioElement = null;
    
    mediaSource = nextMediaSource;
    nextMediaSource = null;
    
    // ═══════════════════════════════════════
    // FIX #1: Neuen Track auf currentGainNode umverbinden!
    // ═══════════════════════════════════════
    if (mediaSource && currentGainNode) {
        try { 
            mediaSource.disconnect(); 
            mediaSource.connect(currentGainNode);
        } catch(e) {}
    }
    
    // ═══════════════════════════════════════
    // FIX #2: Alte scheduled values canceln
    // ═══════════════════════════════════════
    const now = audioCtx ? audioCtx.currentTime : 0;
    if (currentGainNode) {
        currentGainNode.gain.cancelScheduledValues(now);
        currentGainNode.gain.setValueAtTime(1, now);
    }
    if (nextGainNode) {
        nextGainNode.gain.cancelScheduledValues(now);
        nextGainNode.gain.setValueAtTime(0, now);
    }
    
    // Track-Index aktualisieren
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    
    // UI aktualisieren
    const track = playlist[currentTrackIndex];
    dom.cover.src = track.cover;
    setMarquee(dom.title, track.title);
    setMarquee(dom.artist, track.artist);
    renderPlaylist();
    
    // ═══════════════════════════════════════
    // FIX #3: Listener nur hinzufügen wenn Track existiert
    // ═══════════════════════════════════════
    if (audioElement) {
        audioElement.addEventListener('ended', onTrackEnded);
        audioElement.addEventListener('error', onTrackError);
        audioElement.addEventListener('timeupdate', onTimeUpdate);
    }
    
    isCrossfading = false;
    isVisualizerActive = true;
    
    // Nächsten Track vorbereiten
    prepareNextTrack();
}

function stopPlayback() {
    if (audioElement) {
        audioElement.pause();
        audioElement = null;
    }
    if (nextAudioElement) {
        nextAudioElement.pause();
        nextAudioElement = null;
    }
    isCrossfading = false;
    isVisualizerActive = false;
    stopVisualizer();
    dom.cover.src = MUSIC_CONFIG.defaultCover;
    setMarquee(dom.title, window.I18n && I18n.t ? I18n.t('musicplayer_no_music') : 'Kein Musik! :(');
    setMarquee(dom.artist, window.I18n && I18n.t ? I18n.t('musicplayer_no_artist') : 'Kein Musikkünstler! :(');
}

function onTrackEnded() {
    if (isCrossfading) return;
    nextTrack();
}

function onTrackError() {
    console.error('Fehler beim Laden des Tracks');
    if (isCrossfading) return;
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
        const track = playlist[currentTrackIndex];
            if (track) {
                dispatchMusicEvent('now-playing', { title: track.title, artist: track.artist });
        }
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

// === Volume Slider ===
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
    if (!masterGainNode) return;
    
    const mainVol = dom.volumeSlider ? parseInt(dom.volumeSlider.value || 35) / 100 : MUSIC_CONFIG.defaultVolume;
    const inactiveMultiplier = dom.inactiveSlider ? parseInt(dom.inactiveSlider.value || 12) / 100 : MUSIC_CONFIG.defaultInactiveVolume;
    
    const isTabHidden = document.hidden;
    const finalVolume = isTabHidden ? mainVol * inactiveMultiplier : mainVol;
    
    masterGainNode.gain.setTargetAtTime(finalVolume, audioCtx.currentTime, 0.1);
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