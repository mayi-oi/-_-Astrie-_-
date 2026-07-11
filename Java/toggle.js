// "." = classTag und "#" = id class

function kontotoggle() { document.querySelector('.Nutztercenteroverlay').classList.toggle('Nutztercenter-active'); }
document.getElementById('Nutztercenter-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Nutztercenter-overlay')) kontotoggle(); });

function infotoggle() { document.querySelector('.Infooverlay').classList.toggle('Info-active'); }
document.getElementById('Info-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Info-overlay')) infotoggle(); });

function Nutzterhochladen_toggle() { document.querySelector('.Nutztercustomoverlay').classList.toggle('Hochladen-active'); }
document.getElementById('Nutztercustom-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Nutztercustom-overlay')) Nutzterhochladen_toggle(); });

function musiktoggle() { document.querySelector('.Musikplayeroverlay').classList.toggle('Musik-active'); }
document.getElementById('Musikplayer-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Musikplayer-overlay')) musiktoggle(); });

function Settingtoggle() { document.querySelector('.Settingsoverlay').classList.toggle('Settings-active'); }
document.getElementById('Settings-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Settings-overlay')) Settingtoggle(); });

function Kontoswitch() { document.querySelector('.Kontowechsenoverlay').classList.toggle('Kontowechsen-active'); }
document.getElementById('Kontowechsen-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Kontowechsen-overlay')) Kontoswitch(); });

// Keybind shortcuts
function init() {
    document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 
        switch(e.code) {
            case 'KeyA': kontotoggle(); break;
            case 'KeyI': infotoggle(); break;
            case 'KeyM': musiktoggle(); break;
            case 'KeyS': Settingtoggle(); break;
            case 'KeyK': Kontoswitch(); break;
        }
    }

// Dropdown menü
function Musikplayer_playlist() {
    const dropdown = document.getElementById('musikplayer-dp-menu');
    if (dropdown) dropdown.classList.toggle('open');
}

function spdropdown() {
    const dropdown = document.getElementById('sp-dp-menu');
    if (dropdown) dropdown.classList.toggle('open');
}

function Keybindtoggle() {
    const dropdown = document.getElementById('keybind-dp-menu');
    if (dropdown) dropdown.classList.toggle('open');
}

function Musikplayer_hochladen() {
    const dropdown = document.getElementById('musikplayer-upload-menu');
    if (dropdown) dropdown.classList.toggle('open');
}

function Visualcanva() {
    const dropdown = document.getElementById('visualcanva-menu');
    if (dropdown) dropdown.classList.toggle('open');
}

function Visualdesign() {
    const dropdown = document.getElementById('visualdesign-menu');
    if (dropdown) dropdown.classList.toggle('open');
}

// init
window.addEventListener('DOMContentLoaded', init)