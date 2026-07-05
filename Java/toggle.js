// "." = classTag und "#" = id class

function kontotoggle() { document.querySelector('.Nutztercenteroverlay').classList.toggle('Nutztercenter-active'); }
document.getElementById('Nutztercenter-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Nutztercenter-overlay')) kontotoggle(); });

function infotoggle() { document.querySelector('.Infooverlay').classList.toggle('Info-active'); }
document.getElementById('Info-overlay').addEventListener('click', (e) => { if (e.target === document.getElementById('Info-overlay')) infotoggle(); });