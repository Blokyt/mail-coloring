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

function applyRandomEffects(text, options = {}) {
    const selected = {
        color: getRandomEffect('color'),
        size: getRandomEffect('size')
    };
    return {
        html: combineEffects(text, selected, options),
        appliedEffects: selected
    };
}

// Export
window.EFFECTS = EFFECTS;
window.combineEffects = combineEffects;
window.getRandomEffect = getRandomEffect;
window.applyRandomEffects = applyRandomEffects;
