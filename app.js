/**
 * MAIL COLORING - Main Application
 * Handles UI interactions, text formatting, and Outlook-compatible HTML export.
 * 
 * @module App
 */

document.addEventListener('DOMContentLoaded', function () {
    // ============================================
    // DOM ELEMENTS
    // ============================================
    const editor = document.getElementById('editor');
    const toast = document.getElementById('toast');

    // Controls Collection
    const controls = {
        // Color Controls
        textColorPalette: document.getElementById('textColorPalette'),
        textColorCustom: document.getElementById('textColorCustom'),
        clearTextColorBtn: document.getElementById('clearTextColor'),
        bgColorPalette: document.getElementById('bgColorPalette'),
        bgColorCustom: document.getElementById('bgColorCustom'),
        clearBgColorBtn: document.getElementById('clearBgColor'),

        // Font Controls
        fontSizeSlider: document.getElementById('fontSize'),
        fontSizeValue: document.getElementById('fontSizeValue'),
        fontFamilySelect: document.getElementById('fontFamily'),

        // Format Buttons
        boldBtn: document.getElementById('boldBtn'),
        italicBtn: document.getElementById('italicBtn'),
        underlineBtn: document.getElementById('underlineBtn'),
        strikeBtn: document.getElementById('strikeBtn'),
        clearFormatBtn: document.getElementById('clearFormatBtn'),

        // Global Actions
        copyBtn: document.getElementById('copyBtn'),
        clearBtn: document.getElementById('clearBtn'),
        randomBtn: document.getElementById('randomBtn'),

        // Effect Controls
        effectButtons: document.querySelectorAll('.effect-btn'),
        intensitySlider: document.getElementById('effectIntensity'),
        intensityValue: document.getElementById('intensityValue')
    };

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    let savedRange = null;
    let activeEffects = {
        color: null,
        size: null
    };

    // ============================================
    // CORE SELECTION UTILITIES
    // ============================================

    /**
     * Safely retrieves the current selection within the editor.
     * @returns {Object|null} Object containing {selection, range} or null if invalid.
     */
    function getSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount === 0) return null;

        const range = sel.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return null;

        return { selection: sel, range: range };
    }

    /**
     * Extracts text content from selection, stripping existing decoration elements.
     * Crucial for re-applying effects without duplicating emojis/spans.
     * @returns {string} Cleaned text content.
     */
    function getCleanSelectedText() {
        const sel = getSelection();
        if (!sel) return '';

        const fragment = sel.range.cloneContents();
        // Remove elements marked as decorations (like ✨ or 🔥 added by effects)
        const decorations = fragment.querySelectorAll('[data-decoration="true"]');
        decorations.forEach(el => el.remove());

        return fragment.textContent;
    }

    /**
     * Saves the current selection range to state.
     * Used to restore selection after clicking on UI buttons (which steals focus).
     */
    function saveSelection() {
        const sel = getSelection();
        if (sel) {
            savedRange = sel.range.cloneRange();
        }
    }

    /**
     * Restores the saved selection range.
     * @returns {boolean} True if selection was restored, false otherwise.
     */
    function restoreSelection() {
        if (!savedRange) return false;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        return true;
    }

    /**
     * Higher-order function to execute an action while maintaining selection context.
     * @param {Function} action - The function to execute.
     * @param {string|null} successMessage - Optional toast message on success.
     */
    function runWithSelection(action, successMessage = null) {
        if (!restoreSelection()) {
            showToast('Sélectionnez du texte d\'abord', true);
            return;
        }

        const success = action();

        if (success !== false && successMessage) {
            showToast(successMessage);
        }
    }

    // ============================================
    // FORMATTING LOGIC
    // ============================================

    /**
     * Applies standard inline styles using document.execCommand.
     * Maintains legacy compatibility for Outlook.
     * @param {string} styleProp - property to change (color, backgroundColor, etc.)
     * @param {string} value - value to apply
     */
    function applyInlineStyle(styleProp, value) {
        if (styleProp === 'color') {
            document.execCommand('foreColor', false, value);
        } else if (styleProp === 'backgroundColor') {
            document.execCommand('hiliteColor', false, value);
        } else if (styleProp === 'fontSize') {
            // Workaround: execCommand 'fontSize' uses 1-7 scale.
            // We apply size '7' temporarily then replace with precise pixel value.
            document.execCommand('fontSize', false, '7');
            const fontElements = editor.querySelectorAll('font[size="7"]');
            fontElements.forEach(el => {
                el.removeAttribute('size');
                el.style.fontSize = value;
            });
        } else if (styleProp === 'fontFamily') {
            document.execCommand('fontName', false, value);
        }
        editor.focus();
        return true;
    }

    /**
     * Replaces the current selection with generated HTML.
     * Keeps the new content selected to allow sequential edits.
     * @param {string} html - HTML string to insert.
     */
    function replaceSelectionWithHtml(html) {
        const sel = getSelection();
        if (!sel) return;

        const range = sel.range;
        range.deleteContents();

        const temp = document.createElement('div');
        temp.innerHTML = html;

        const fragment = document.createDocumentFragment();
        let firstNode = temp.firstChild;
        let lastNode = null;

        while (temp.firstChild) {
            lastNode = temp.firstChild;
            fragment.appendChild(lastNode);
        }

        range.insertNode(fragment);

        // Maintain selection on the newly inserted content
        if (firstNode && lastNode) {
            range.setStartBefore(firstNode);
            range.setEndAfter(lastNode);
            sel.selection.removeAllRanges();
            sel.selection.addRange(range);
        }

        editor.focus();
    }

    /**
     * Coordinates the application of complex effects from effects.js.
     * @param {string} category - 'color' or 'size'
     * @param {string} effectName - key from EFFECTS object
     */
    function applyEffect(category, effectName) {
        runWithSelection(() => {
            const selectedText = getCleanSelectedText();
            if (!selectedText) {
                showToast('Texte vide ou non sélectionné', true);
                return false;
            }

            // Update Effect State
            activeEffects[category] = effectName;

            // Visual Update
            const categoryButtons = document.querySelectorAll(`.effect-btn[data-category="${category}"]`);
            categoryButtons.forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`.effect-btn[data-effect="${effectName}"]`);
            if (btn) btn.classList.add('temp-active');

            // Generate & Apply
            const options = {
                intensity: parseInt(controls.intensitySlider.value),
                baseSize: parseInt(controls.fontSizeSlider.value)
            };

            const html = combineEffects(selectedText, activeEffects, options);
            replaceSelectionWithHtml(html);

            updateEffectUI();
        }, 'Effet appliqué !');
    }

    /**
     * Handles the Random Mode logic with different scenarios.
     */
    function handleRandomMode() {
        runWithSelection(() => {
            const selectedText = getCleanSelectedText();
            if (!selectedText) return false;

            // Reset pending state
            activeEffects = { color: null, size: null };
            // We don't strictly need these execCommands anymore since we replace the content, 
            // but it's good safety to clear selection formatting if we were to change logic later.
            // Actually, replacing HTML overwrites it anyway.

            const options = {
                intensity: parseInt(controls.intensitySlider.value),
                baseSize: parseInt(controls.fontSizeSlider.value)
            };

            // 5 Random Scenarios
            const scenario = Math.floor(Math.random() * 5);
            let resultHtml = selectedText;
            let msg = '';

            switch (scenario) {
                case 0: // Full Effects (Color + Size)
                    const res = applyRandomEffects(selectedText, options);
                    resultHtml = res.html;
                    activeEffects = res.appliedEffects;
                    msg = 'Random: Effets complets';
                    break;
                case 1: // Background Color Only
                    const bgCol = getRandomPaletteColor('bgColorPalette');
                    resultHtml = `<span style="background-color: ${bgCol}">${selectedText}</span>`;
                    msg = 'Random: Fond couleur';
                    break;
                case 2: // Text Color Only
                    const txtCol = getRandomPaletteColor('textColorPalette');
                    resultHtml = `<span style="color: ${txtCol}">${selectedText}</span>`;
                    msg = 'Random: Couleur texte';
                    break;
                case 3: // Background + Size Effect
                    const bgCol2 = getRandomPaletteColor('bgColorPalette');
                    activeEffects.size = getRandomEffect('size');
                    const innerHtml = combineEffects(selectedText, { size: activeEffects.size }, options);
                    resultHtml = `<span style="background-color: ${bgCol2}">${innerHtml}</span>`;
                    msg = 'Random: Fond + Taille';
                    break;
                case 4: // Text Color + Size Effect
                    const txtCol2 = getRandomPaletteColor('textColorPalette');
                    activeEffects.size = getRandomEffect('size');
                    const innerHtml2 = combineEffects(selectedText, { size: activeEffects.size }, options);
                    resultHtml = `<span style="color: ${txtCol2}">${innerHtml2}</span>`;
                    msg = 'Random: Couleur + Taille';
                    break;
            }

            // Random Formatting (Bold, Italic, Underline)
            // "joue aussi sur la police bold italiqe et souligné mais pas barré"
            if (Math.random() < 0.3) {
                resultHtml = `<b>${resultHtml}</b>`;
                // Update activeEffects just so we track something? 
                // Actually activeEffects is mostly for the UI highlighting (effects panel), 
                // for B/I/U we might want to update the toolbar buttons, but since we replace HTML, 
                // the cursor position updates usually handle button state.
            }
            if (Math.random() < 0.3) resultHtml = `<i>${resultHtml}</i>`;
            if (Math.random() < 0.3) resultHtml = `<u>${resultHtml}</i>`;

            // Random Font Family
            // "et la police random"
            const FONTS = [
                "Arial, sans-serif", "Times New Roman, serif", "Georgia, serif", "Verdana, sans-serif", "Courier New, monospace",
                "Segoe UI, sans-serif", "Calibri, sans-serif", "Trebuchet MS, sans-serif",
                "Comic Sans MS, cursive", "Papyrus, fantasy", "Impact, sans-serif",
                "Tangerine, cursive", "Cinzel Decorative, serif", "MedievalSharp, cursive", "Uncial Antiqua, cursive"
            ];

            // 50% chance to change font? Or always? User said "et la police random", implies it should be part of the random mix.
            // Let's make it always random or high probability contextually, but consistent with "Random" button behavior (total chaos).
            const randomFont = FONTS[Math.floor(Math.random() * FONTS.length)];
            resultHtml = `<span style="font-family: ${randomFont}">${resultHtml}</span>`;

            replaceSelectionWithHtml(resultHtml);
            updateEffectUI();
            showToast(msg);
        });
    }

    // ============================================
    // EVENT LISTENERS INITIALIZATION
    // ============================================

    function initEventListeners() {
        // --- Selection Saving ---
        document.addEventListener('mousedown', function (e) {
            if (!editor.contains(e.target)) saveSelection();
        });

        // --- Color Palettes ---
        controls.textColorPalette.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (swatch) runWithSelection(() => applyInlineStyle('color', swatch.dataset.color), 'Couleur appliquée');
        });

        controls.bgColorPalette.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (swatch) runWithSelection(() => applyInlineStyle('backgroundColor', swatch.dataset.color), 'Fond appliqué');
        });

        // --- Custom Pickers & Clears ---
        controls.textColorCustom.addEventListener('change', function () {
            runWithSelection(() => applyInlineStyle('color', this.value), 'Couleur appliquée');
        });
        controls.bgColorCustom.addEventListener('change', function () {
            runWithSelection(() => applyInlineStyle('backgroundColor', this.value), 'Fond appliqué');
        });
        controls.clearTextColorBtn.addEventListener('click', () => {
            runWithSelection(() => applyInlineStyle('color', '#000000'), 'Couleur retirée');
        });
        controls.clearBgColorBtn.addEventListener('click', () => {
            runWithSelection(() => applyInlineStyle('backgroundColor', '#ffffff'), 'Fond retiré');
        });

        // --- Fonts & Formatting ---
        controls.fontSizeSlider.addEventListener('input', function () { controls.fontSizeValue.textContent = this.value + 'px'; });
        controls.fontSizeSlider.addEventListener('change', function () { runWithSelection(() => applyInlineStyle('fontSize', this.value + 'px'), 'Taille appliquée'); });

        controls.fontFamilySelect.addEventListener('change', function () { runWithSelection(() => applyInlineStyle('fontFamily', this.value), 'Police appliquée'); });

        ['bold', 'italic', 'underline', 'strike'].forEach(type => {
            const btn = controls[`${type}Btn`];
            if (btn) {
                btn.addEventListener('click', () => {
                    const cmd = type === 'strike' ? 'strikeThrough' : type;
                    document.execCommand(cmd, false, null);
                    editor.focus();
                    btn.classList.toggle('active', document.queryCommandState(cmd));
                });
            }
        });

        controls.clearFormatBtn.addEventListener('click', () => {
            document.execCommand('removeFormat', false, null);
            runWithSelection(() => document.execCommand('hiliteColor', false, 'transparent'), 'Formatage effacé');
        });

        // --- Effects ---
        controls.effectButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                applyEffect(this.dataset.category, this.dataset.effect);
            });
        });

        controls.intensitySlider.addEventListener('input', function () { controls.intensityValue.textContent = this.value + '/10'; });
        controls.randomBtn.addEventListener('click', handleRandomMode);

        // --- Main Actions ---
        controls.copyBtn.addEventListener('click', handleCopy);
        controls.clearBtn.addEventListener('click', handleClear);

        // --- Editor Interactions ---
        editor.addEventListener('keyup', updateFormatButtonStates);
        editor.addEventListener('mouseup', updateFormatButtonStates);
        editor.addEventListener('keydown', handleKeyboardShortcuts);
    }

    // ============================================
    // ACTION HANDLERS
    // ============================================

    async function handleCopy() {
        const content = editor.innerHTML;
        if (!content || content.trim() === '' || content === '<br>') {
            showToast('Rien à copier !', true);
            return;
        }

        const cleanHtml = cleanForOutlook(content);

        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([cleanHtml], { type: 'text/html' }),
                    'text/plain': new Blob([editor.textContent], { type: 'text/plain' })
                })
            ]);
            showToast('Copié ! Collez dans Outlook');
        } catch (err) {
            fallbackCopy(cleanHtml);
        }
    }

    function fallbackCopy(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv);

        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        try {
            document.execCommand('copy');
            showToast('Copié ! Collez dans Outlook');
        } catch (e) {
            showToast('Erreur de copie', true);
        }
        document.body.removeChild(tempDiv);
        sel.removeAllRanges();
    }

    function handleClear() {
        if (confirm('Effacer tout le contenu ?')) {
            editor.innerHTML = '';
            activeEffects = { color: null, size: null };
            updateEffectUI();
            showToast('Contenu effacé');
        }
    }

    function handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            const key = e.key.toLowerCase();
            if (['b', 'i', 'u'].includes(key)) {
                e.preventDefault();
                controls[`${key === 'u' ? 'underline' : key === 'b' ? 'bold' : 'italic'}Btn`].click();
            }
        }
    }

    // ============================================
    // UI HELPERS
    // ============================================

    function updateEffectUI() {
        controls.effectButtons.forEach(btn => btn.classList.remove('active'));
        if (activeEffects.color) {
            const btn = document.querySelector(`[data-effect="${activeEffects.color}"]`);
            if (btn) btn.classList.add('active');
        }
        if (activeEffects.size) {
            const btn = document.querySelector(`[data-effect="${activeEffects.size}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    function updateFormatButtonStates() {
        controls.boldBtn.classList.toggle('active', document.queryCommandState('bold'));
        controls.italicBtn.classList.toggle('active', document.queryCommandState('italic'));
        controls.underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
        controls.strikeBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));
    }

    function showToast(message, isError = false) {
        const toastMessage = toast.querySelector('.toast-message');
        toastMessage.textContent = message;
        toast.classList.remove('error');
        if (isError) toast.classList.add('error');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function getRandomPaletteColor(paletteId) {
        const swatches = document.getElementById(paletteId).querySelectorAll('.color-swatch');
        if (!swatches.length) return '#000000';
        return swatches[Math.floor(Math.random() * swatches.length)].dataset.color;
    }

    function cleanForOutlook(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        temp.querySelectorAll('*').forEach(el => {
            el.removeAttribute('class');
            el.removeAttribute('id');
            el.removeAttribute('data-decoration');
        });
        return temp.innerHTML;
    }

    // Start
    initEventListeners();
    editor.focus();
});
