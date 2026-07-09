const I18n = {
    // ═══════════════════════════════════════════════════
    //  Systemsprache automatisch erkennen (super easy lol)
    // ═══════════════════════════════════════════════════
    getSystemLang() {
        const browserLang = navigator.language || navigator.userLanguage; // z.B. "de-DE", "fr-FR", "en-US"
        const base = browserLang.split('-')[0]; // "de", "fr", "en"...

        // Map auf unsere verfügbaren Sprachen
        const langMap = {
            'de': 'de', 'en': 'en', 'fr': 'fr', 'sv': 'sv',
            'ja': 'ja', 'ko': 'ko', 'zh': 'zh-CN' // zh → vereinfacht als default
        };

        // Spezialfall: zh-TW vs zh-CN prüfen
        if (browserLang === 'zh-TW' || browserLang === 'zh-HK') return 'zh-TW';
        if (browserLang.startsWith('zh')) return 'zh-CN';

        return langMap[base] || 'de'; // Fallback Deutsch
    },

    // Aktuelle Sprache (localStorage > Systemsprache > Default)
    currentLang: localStorage.getItem('astrie-language') || null,

    // Cache für geladene Übersetzungen
    translations: {},

    // Verfügbare Sprachen
    languages: {
        'de': { name: 'Deutsch', file: 'Java/Sprache/de.json' },
        'en': { name: 'English', file: 'Java/Sprache/en.json' },
        'fr': { name: 'Français', file: 'Java/Sprache/fr.json' },
        'sv': { name: 'Svenska', file: 'Java/Sprache/sv.json' },
        'ja': { name: '日本語', file: 'Java/Sprache/ja.json' },
        'ko': { name: '한국어', file: 'Java/Sprache/ko.json' },
        'zh-TW': { name: '中文（繁體）', file: 'Java/Sprache/zh-TW.json' },
        'zh-CN': { name: '中文（简体）', file: 'Java/Sprache/zh-CN.json' }
    },

    // ═══════════════════════════════════════════════════
    //  Sprache laden
    // ═══════════════════════════════════════════════════
    async loadLanguage(lang) {
        if (!this.languages[lang]) {
            console.warn(`[i18n] Sprache "${lang}" nicht gefunden, nutze Deutsch.`);
            lang = 'de';
        }

        try {
            const response = await fetch(this.languages[lang].file);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.translations = await response.json();
            this.currentLang = lang;
            localStorage.setItem('astrie-language', lang);
            console.log(`[i18n] Sprache geladen: ${this.languages[lang].name}`);
            return true;
        } catch (error) {
            console.error(`[i18n] Fehler beim Laden von ${lang}:`, error);
            return false;
        }
    },

    // ═══════════════════════════════════════════════════
    //  Übersetzung abrufen (mit Fallback)
    // ═══════════════════════════════════════════════════
    t(key, fallback = null) {
        return this.translations[key] || fallback || `[${key}]`;
    },

    // ═══════════════════════════════════════════════════
    //  DOM aktualisieren - alle [data-i18n] Elemente
    // ═══════════════════════════════════════════════════
    updateDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = this.t(key);

            if (el.hasAttribute('data-i18n-html')) {
                el.innerHTML = translated;
            } else {
                el.textContent = translated;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });
    },

    // ═══════════════════════════════════════════════════
    //  Sprache wechseln
    // ═══════════════════════════════════════════════════
    async setLanguage(lang) {
        const success = await this.loadLanguage(lang);
        if (success) {
            this.updateDOM();
            document.dispatchEvent(new CustomEvent('languageChanged', { 
                detail: { language: lang } 
            }));
        }
        return success;
    },

    // ═══════════════════════════════════════════════════
    //  Initialisierung
    // ═══════════════════════════════════════════════════
    async init() {
        // Wenn noch keine Sprache im localStorage → Systemsprache nutzen
        if (!this.currentLang) {
            this.currentLang = this.getSystemLang();
            console.log(`[i18n] Systemsprache erkannt: ${this.currentLang}`);
        }
        await this.loadLanguage(this.currentLang);
        this.updateDOM();
    }
};

// ═══════════════════════════════════════════════════════
//  Beim Laden der Seite starten
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    I18n.init();
});