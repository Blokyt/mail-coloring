/**
 * EFFECTS LIBRARY
 * Extensible effects system for Mail Coloring
 * All effects are Outlook-compatible (inline styles only)
 */

// ============================================
// EFFECT CONFIGURATIONS (Data Support)
// ============================================

const EFFECT_CONFIGS = {
    color: {
        rainbow: {
            name: "Arc-en-ciel",
            icon: "🌈",
            description: "Colorie chaque caractère avec les couleurs de l'arc-en-ciel",
            decoration: { before: "✨ ", after: " ✨" },
            colors: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0099ff", "#6633ff", "#9400d3"]
        },
        flame: {
            name: "Flamme",
            icon: "🔥",
            description: "Alternance jaune/orange/rouge avec flammes",
            decoration: { before: "🔥 ", after: " 🔥" },
            colors: ["#ffff00", "#ff7f00", "#ff4500", "#ff0000"]
        },
        flower: {
            name: "Fleur",
            icon: "🌸",
            description: "Alternance violet/rose/saumon avec fleurs",
            decoration: { before: "🌸 ", after: " 🌺" },
            colors: ["#9400d3", "#ff69b4", "#ff1493", "#fa8072"]
        }
    },
    size: {
        wave: {
            name: "Vague",
            icon: "🌊",
            description: "Taille des caractères en forme de vague sinusoïdale",
            getOffset: (index, total, options) => {
                const amplitude = 2 + (options.intensity - 1) * 2;
                return Math.sin(index * 0.5) * amplitude;
            }
        },
        rise: {
            name: "Montée",
            icon: "📈",
            description: "Taille augmente progressivement",
            getOffset: (index, total, options) => {
                const progress = index / Math.max(1, total - 1);
                const maxSize = options.baseSize + (options.intensity * 4);
                return progress * (maxSize - options.baseSize);
            }
        },
        fall: {
            name: "Descente",
            icon: "📉",
            description: "Taille diminue progressivement",
            getOffset: (index, total, options) => {
                const progress = index / Math.max(1, total - 1);
                const maxSize = options.baseSize + (options.intensity * 4);
                const minSize = Math.max(8, options.baseSize - options.intensity);
                // Calculate difference from baseSize to target size
                const targetSize = maxSize - progress * (maxSize - minSize);
                return targetSize - options.baseSize;
            }
        }
    }
};

// ============================================
// CORE LOGIC (Factorized)
// ============================================

/**
 * Core function to apply transformations to text
 * @param {string} text - Input text
 * @param {Object} activeEffects - { color: 'rainbow', size: 'wave' }
 * @param {Object} options - { intensity: 5, baseSize: 16 }
 */
function combineEffects(text, activeEffects, options = {}) {
    const chars = [...text];
    const intensity = options.intensity || 5;
    const baseSize = options.baseSize || 16;

    // Resolve active configs
    const colorConfig = activeEffects.color ? EFFECT_CONFIGS.color[activeEffects.color] : null;
    const sizeConfig = activeEffects.size ? EFFECT_CONFIGS.size[activeEffects.size] : null;

    let htmlParts = [];

    // Add Prefix Decoration
    if (colorConfig?.decoration?.before) {
        htmlParts.push(`<span data-decoration="true">${colorConfig.decoration.before}</span>`);
    }

    // Process Characters
    let charIndex = 0; // Index ignoring spaces
    const totalChars = chars.filter(c => c !== ' ').length;

    chars.forEach((char, i) => {
        if (char === ' ') {
            htmlParts.push(' ');
            return;
        }

        let styleString = '';

        // 1. Calculate Color
        if (colorConfig) {
            const color = colorConfig.colors[charIndex % colorConfig.colors.length];
            styleString += `color: ${color};`;
        }

        // 2. Calculate Size
        if (sizeConfig) {
            const offset = sizeConfig.getOffset(charIndex, totalChars, { ...options, baseSize });
            const size = Math.max(8, Math.round(baseSize + offset));
            styleString += `font-size: ${size}px;`;
        }

        if (styleString) {
            htmlParts.push(`<span style="${styleString}">${char}</span>`);
        } else {
            htmlParts.push(char);
        }

        charIndex++;
    });

    // Add Suffix Decoration
    if (colorConfig?.decoration?.after) {
        htmlParts.push(`<span data-decoration="true">${colorConfig.decoration.after}</span>`);
    }

    return htmlParts.join('');
}

// ============================================
// PUBLIC API (Backwards Compatibility)
// ============================================

// Expose the raw configs so the UI can generate buttons
const EFFECTS = {
    color: EFFECT_CONFIGS.color,
    size: EFFECT_CONFIGS.size
};

// Main Apply function (legacy wrapper if needed, or simple direct usage)
function getRandomEffect(category) {
    const keys = Object.keys(EFFECTS[category]);
    return keys[Math.floor(Math.random() * keys.length)];
}

// Color palette for uniform colors
const COLOR_PALETTE = [
    "#ff0000", "#ffba6b", "#fcff3d", "#6ecb6b",
    "#4df9ff", "#3d329b", "#ac2dac", "#d12e7a",
    "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"
];

function getRandomColor() {
    return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

// Font palette
const FONT_PALETTE = [
    "Arial, sans-serif",
    "Times New Roman, serif",
    "Georgia, serif",
    "Verdana, sans-serif",
    "Courier New, monospace",
    "Segoe UI, sans-serif",
    "Comic Sans MS, cursive",
    "Impact, sans-serif",
    "Tangerine, cursive",
    "Cinzel Decorative, serif",
    "MedievalSharp, cursive"
];

function getRandomFont() {
    return FONT_PALETTE[Math.floor(Math.random() * FONT_PALETTE.length)];
}

function applyRandomEffects(text, options = {}) {
    const usePresetEffect = Math.random() < 0.5;

    if (usePresetEffect) {
        // ========== PRESET EFFECTS (50%) ==========
        const effectType = Math.random();
        let selected = { color: null, size: null };

        if (effectType < 0.33) {
            // Couleur seule (33%)
            selected.color = getRandomEffect('color');
        } else if (effectType < 0.66) {
            // Taille seule (33%)
            selected.size = getRandomEffect('size');
        } else {
            // Les deux (34%)
            selected.color = getRandomEffect('color');
            selected.size = getRandomEffect('size');
        }

        const font = getRandomFont();
        const html = `<span style="font-family: ${font};">${combineEffects(text, selected, options)}</span>`;
        return {
            html,
            appliedEffects: { mode: 'preset', ...selected, font }
        };
    } else {
        // ========== SIMPLE UNIFORM MODE (50%) ==========
        const simpleType = Math.random();
        let uniformColor = null;
        let uniformBg = null;
        let appliedEffects = { mode: 'simple' };

        if (simpleType < 0.4) {
            // Couleur uniforme seulement (40%)
            uniformColor = getRandomColor();
            appliedEffects.color = uniformColor;
        } else if (simpleType < 0.7) {
            // Fond uniforme seulement (30%)
            uniformBg = getRandomColor();
            appliedEffects.bg = uniformBg;
        } else {
            // Couleur + Fond (30%)
            uniformColor = getRandomColor();
            uniformBg = getRandomColor();
            // Assurer le contraste
            while (uniformBg === uniformColor) {
                uniformBg = getRandomColor();
            }
            appliedEffects.color = uniformColor;
            appliedEffects.bg = uniformBg;
        }

        // 50% chance d'ajouter un effet de taille
        const addSizeEffect = Math.random() < 0.5;
        let sizeEffectName = null;

        if (addSizeEffect) {
            sizeEffectName = getRandomEffect('size');
            appliedEffects.size = sizeEffectName;
        }

        // Build HTML
        let html = '';

        if (sizeEffectName) {
            // Apply size effect character by character with uniform color
            const chars = [...text];
            const sizeConfig = EFFECT_CONFIGS.size[sizeEffectName];
            const baseSize = options.baseSize || 16;
            const intensity = options.intensity || 5;
            let charIndex = 0;
            const totalChars = chars.filter(c => c !== ' ').length;

            let parts = [];
            chars.forEach(char => {
                if (char === ' ') {
                    parts.push(' ');
                    return;
                }

                const offset = sizeConfig.getOffset(charIndex, totalChars, { intensity, baseSize });
                const size = Math.max(8, Math.round(baseSize + offset));

                let style = `font-size: ${size}px;`;
                if (uniformColor) style += ` color: ${uniformColor};`;
                if (uniformBg) style += ` background-color: ${uniformBg};`;

                parts.push(`<span style="${style}">${char}</span>`);
                charIndex++;
            });

            html = parts.join('');
        } else {
            // Simple span wrapper
            let style = '';
            if (uniformColor) style += `color: ${uniformColor};`;
            if (uniformBg) style += ` background-color: ${uniformBg};`;
            html = `<span style="${style}">${text}</span>`;
        }

        // Wrap with random font
        const font = getRandomFont();
        appliedEffects.font = font;
        html = `<span style="font-family: ${font};">${html}</span>`;

        return { html, appliedEffects };
    }
}

// Export
window.EFFECTS = EFFECTS;
window.combineEffects = combineEffects;
window.getRandomEffect = getRandomEffect;
window.applyRandomEffects = applyRandomEffects;
