/**
 * EFFECTS LIBRARY
 * Extensible effects system for Mail Coloring
 * All effects are Outlook-compatible (inline styles only)
 */

const EFFECTS = {
    // ============================================
    // COLOR EFFECTS
    // ============================================
    color: {
        rainbow: {
            name: "Arc-en-ciel",
            icon: "🌈",
            description: "Colorie chaque caractère avec les couleurs de l'arc-en-ciel",
            decoration: { before: "✨ ", after: " ✨" },
            colors: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0099ff", "#6633ff", "#9400d3"],
            apply: function (text, options = {}) {
                const chars = [...text];
                const colors = this.colors;
                let html = this.decoration.before;

                chars.forEach((char, i) => {
                    if (char === ' ') {
                        html += ' ';
                    } else {
                        const colorIndex = i % colors.length;
                        html += `<span style="color: ${colors[colorIndex]};">${char}</span>`;
                    }
                });

                html += this.decoration.after;
                return html;
            }
        },

        flame: {
            name: "Flamme",
            icon: "🔥",
            description: "Alternance jaune/orange/rouge avec flammes",
            decoration: { before: "🔥 ", after: " 🔥" },
            colors: ["#ffff00", "#ff7f00", "#ff4500", "#ff0000"],
            apply: function (text, options = {}) {
                const chars = [...text];
                const colors = this.colors;
                let html = this.decoration.before;

                chars.forEach((char, i) => {
                    if (char === ' ') {
                        html += ' ';
                    } else {
                        const colorIndex = i % colors.length;
                        html += `<span style="color: ${colors[colorIndex]};">${char}</span>`;
                    }
                });

                html += this.decoration.after;
                return html;
            }
        },

        flower: {
            name: "Fleur",
            icon: "🌸",
            description: "Alternance violet/rose/saumon avec fleurs",
            decoration: { before: "🌸 ", after: " 🌺" },
            colors: ["#9400d3", "#ff69b4", "#ff1493", "#fa8072"],
            apply: function (text, options = {}) {
                const chars = [...text];
                const colors = this.colors;
                let html = this.decoration.before;

                chars.forEach((char, i) => {
                    if (char === ' ') {
                        html += ' ';
                    } else {
                        const colorIndex = i % colors.length;
                        html += `<span style="color: ${colors[colorIndex]};">${char}</span>`;
                    }
                });

                html += this.decoration.after;
                return html;
            }
        }
    },

    // ============================================
    // SIZE EFFECTS
    // ============================================
    size: {
        wave: {
            name: "Vague",
            icon: "🌊",
            description: "Taille des caractères en forme de vague sinusoïdale",
            apply: function (text, options = {}) {
                const intensity = options.intensity || 5;
                const baseSize = options.baseSize || 16;
                const chars = [...text];

                // Intensity affects amplitude: 1 = subtle (2px), 10 = extreme (20px)
                const amplitude = 2 + (intensity - 1) * 2;
                const frequency = 0.5; // Wave frequency

                let html = '';
                chars.forEach((char, i) => {
                    if (char === ' ') {
                        html += ' ';
                    } else {
                        const sizeOffset = Math.sin(i * frequency) * amplitude;
                        const size = Math.max(8, Math.round(baseSize + sizeOffset));
                        html += `<span style="font-size: ${size}px;">${char}</span>`;
                    }
                });

                return html;
            }
        },

        rise: {
            name: "Montée",
            icon: "📈",
            description: "Taille augmente progressivement",
            apply: function (text, options = {}) {
                const intensity = options.intensity || 5;
                const baseSize = options.baseSize || 16;
                const chars = [...text];

                // Intensity affects size increment per character
                const increment = 0.5 + (intensity - 1) * 0.5;
                const maxSize = baseSize + (intensity * 4);

                let html = '';
                const nonSpaceCount = chars.filter(c => c !== ' ').length;
                let charIndex = 0;

                chars.forEach((char) => {
                    if (char === ' ') {
                        html += ' ';
                    } else {
                        const progress = charIndex / Math.max(1, nonSpaceCount - 1);
                        const size = Math.round(baseSize + progress * (maxSize - baseSize));
                        html += `<span style="font-size: ${size}px;">${char}</span>`;
                        charIndex++;
                    }
                });

                return html;
            }
        },

        fall: {
            name: "Descente",
            icon: "📉",
            description: "Taille diminue progressivement",
            apply: function (text, options = {}) {
                const intensity = options.intensity || 5;
                const baseSize = options.baseSize || 16;
                const chars = [...text];

                // Start big, end small
                const maxSize = baseSize + (intensity * 4);
                const minSize = Math.max(8, baseSize - intensity);

                let html = '';
                const nonSpaceCount = chars.filter(c => c !== ' ').length;
                let charIndex = 0;

                chars.forEach((char) => {
                    if (char === ' ') {
                        html += ' ';
                    } else {
                        const progress = charIndex / Math.max(1, nonSpaceCount - 1);
                        const size = Math.round(maxSize - progress * (maxSize - minSize));
                        html += `<span style="font-size: ${size}px;">${char}</span>`;
                        charIndex++;
                    }
                });

                return html;
            }
        }
    }
};

/**
 * Combine multiple effects (one from each category)
 * @param {string} text - The text to apply effects to
 * @param {Object} selectedEffects - { color: 'rainbow', size: 'wave' }
 * @param {Object} options - { intensity: 5, baseSize: 16 }
 * @returns {string} HTML with combined inline styles
 */
function combineEffects(text, selectedEffects, options = {}) {
    const chars = [...text];
    const intensity = options.intensity || 5;
    const baseSize = options.baseSize || 16;

    // Get color effect if selected
    const colorEffect = selectedEffects.color ? EFFECTS.color[selectedEffects.color] : null;
    const sizeEffect = selectedEffects.size ? EFFECTS.size[selectedEffects.size] : null;

    // Calculate decorations
    let prefix = '';
    let suffix = '';

    if (colorEffect && colorEffect.decoration) {
        // Wrap decorations in a span with a marker class/attribute for easier removal later
        // We use inline style for Outlook, and a data attribute for our logic
        if (colorEffect.decoration.before) {
            prefix = `<span data-decoration="true">${colorEffect.decoration.before}</span>`;
        }
        if (colorEffect.decoration.after) {
            suffix = `<span data-decoration="true">${colorEffect.decoration.after}</span>`;
        }
    }

    // Generate combined HTML
    // Use array push/join for better performance
    let htmlParts = [prefix];

    // Pre-calculate size values if size effect is active
    let sizeValues = [];
    if (sizeEffect) {
        const amplitude = 2 + (intensity - 1) * 2;
        const maxSize = baseSize + (intensity * 4);
        const minSize = Math.max(8, baseSize - intensity);
        const nonSpaceCount = chars.filter(c => c !== ' ').length;
        let charIdx = 0;

        chars.forEach((char, i) => {
            if (char === ' ') {
                sizeValues.push(null);
            } else {
                let size = baseSize;

                if (selectedEffects.size === 'wave') {
                    const sizeOffset = Math.sin(charIdx * 0.5) * amplitude;
                    size = Math.max(8, Math.round(baseSize + sizeOffset));
                } else if (selectedEffects.size === 'rise') {
                    const progress = charIdx / Math.max(1, nonSpaceCount - 1);
                    size = Math.round(baseSize + progress * (maxSize - baseSize));
                } else if (selectedEffects.size === 'fall') {
                    const progress = charIdx / Math.max(1, nonSpaceCount - 1);
                    size = Math.round(maxSize - progress * (maxSize - minSize));
                }

                sizeValues.push(size);
                charIdx++;
            }
        });
    }

    // Build the HTML
    let colorIndex = 0;
    chars.forEach((char, i) => {
        if (char === ' ') {
            htmlParts.push(' ');
        } else {
            let styles = [];

            // Add color
            if (colorEffect) {
                const colors = colorEffect.colors;
                styles.push(`color: ${colors[colorIndex % colors.length]}`);
            }

            // Add size
            if (sizeValues[i] !== null && sizeValues[i] !== undefined) {
                styles.push(`font-size: ${sizeValues[i]}px`);
            }

            if (styles.length > 0) {
                htmlParts.push(`<span style="${styles.join('; ')};">${char}</span>`);
            } else {
                htmlParts.push(char);
            }

            colorIndex++;
        }
    });

    htmlParts.push(suffix);
    return htmlParts.join('');
}

/**
 * Get a random effect from a category
 * @param {string} category - 'color' or 'size'
 * @returns {string} Effect name
 */
function getRandomEffect(category) {
    const effects = Object.keys(EFFECTS[category]);
    return effects[Math.floor(Math.random() * effects.length)];
}

/**
 * Apply random effects from all categories
 * @param {string} text - The text to apply effects to
 * @param {Object} options - { intensity: 5, baseSize: 16 }
 * @returns {Object} { html: string, appliedEffects: { color: string, size: string } }
 */
function applyRandomEffects(text, options = {}) {
    const selectedEffects = {
        color: getRandomEffect('color'),
        size: getRandomEffect('size')
    };

    return {
        html: combineEffects(text, selectedEffects, options),
        appliedEffects: selectedEffects
    };
}

// Export for use in app.js
window.EFFECTS = EFFECTS;
window.combineEffects = combineEffects;
window.getRandomEffect = getRandomEffect;
window.applyRandomEffects = applyRandomEffects;
