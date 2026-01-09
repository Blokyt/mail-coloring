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

    // Dynamic Effect Containers (Will be populated)
    const effectsContainers = {
        color: document.querySelector('.effects-buttons[data-category="color"]') || createContainer('color'),
        size: document.querySelector('.effects-buttons[data-category="size"]') || createContainer('size')
    };

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
        aiColorBtn: document.getElementById('aiColorBtn'),
        emojiBtn: document.getElementById('emojiBtn'),

        // Effect Controls (Dynamic now)
        intensitySlider: document.getElementById('effectIntensity'),
        intensityValue: document.getElementById('intensityValue'),

        // AI Modal Controls
        aiModal: document.getElementById('aiModal'),
        closeAiModalBtn: document.getElementById('closeAiModal'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        toggleApiKeyBtn: document.getElementById('toggleApiKey'),
        densitySlider: document.getElementById('densitySlider'),
        densityValue: document.getElementById('densityValue'),
        emojiDensitySlider: document.getElementById('emojiDensitySlider'),
        emojiDensityValue: document.getElementById('emojiDensityValue'),
        launchAiBtn: document.getElementById('launchAiBtn'),
        aiStatus: document.getElementById('aiStatus')
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
    // INITIALIZATION
    // ============================================

    function init() {
        generateEffectButtons();
        initEventListeners();
        editor.focus();
    }

    /**
     * Generates effect buttons dynamically based on effects.js configuration
     */
    function generateEffectButtons() {
        if (!window.EFFECTS) return;

        // Helper to clear and fill container
        const fillContainer = (category, container) => {
            if (!container) return;
            container.innerHTML = ''; // Clear existing static buttons

            Object.entries(window.EFFECTS[category]).forEach(([key, effect]) => {
                const btn = document.createElement('button');
                btn.className = 'effect-btn';
                btn.dataset.effect = key;
                btn.dataset.category = category;
                btn.innerHTML = `
                    <span class="effect-icon">${effect.icon}</span>
                    <span class="effect-name">${effect.name}</span>
                `;
                container.appendChild(btn);
            });
        };

        const colorContainer = document.querySelector('.effects-buttons[data-category="color"]')
            || document.querySelector('.effects-category:nth-of-type(1) .effects-buttons');
        const sizeContainer = document.querySelector('.effects-buttons[data-category="size"]')
            || document.querySelector('.effects-category:nth-of-type(2) .effects-buttons');

        if (colorContainer) fillContainer('color', colorContainer);
        if (sizeContainer) fillContainer('size', sizeContainer);
    }

    function createContainer(type) {
        return null;
    }

    // ============================================
    // CORE SELECTION UTILITIES
    // ============================================

    function getSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return null;
        return { selection: sel, range: range };
    }

    function getCleanSelectedText() {
        const sel = getSelection();
        if (!sel) return '';
        const fragment = sel.range.cloneContents();
        const decorations = fragment.querySelectorAll('[data-decoration="true"]');
        decorations.forEach(el => el.remove());
        return fragment.textContent;
    }

    function saveSelection() {
        const sel = getSelection();
        if (sel) savedRange = sel.range.cloneRange();
    }

    function restoreSelection() {
        if (!savedRange) return false;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        return true;
    }

    function runWithSelection(action, successMessage = null, allowCollapsed = false) {
        if (!restoreSelection()) {
            editor.focus();
            const sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
                showToast('Sélectionnez du texte ou placez le curseur', true);
                return;
            }
        }

        const success = action();
        if (success !== false && successMessage) {
            showToast(successMessage);
        }
    }

    // ============================================
    // FORMATTING LOGIC
    // ============================================

    function applyInlineStyle(styleProp, value) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        // BUG FIX: Font Size Priority
        if (sel.isCollapsed && styleProp === 'fontSize') {
            insertStyledSpan('font-size', value);
            return true;
        }

        if (styleProp === 'color') {
            document.execCommand('foreColor', false, value);
        } else if (styleProp === 'backgroundColor') {
            document.execCommand('hiliteColor', false, value);
        } else if (styleProp === 'fontSize') {
            document.execCommand('fontSize', false, '7');
            const fontElements = editor.querySelectorAll('font[size="7"]');
            fontElements.forEach(el => {
                el.removeAttribute('size');
                el.style.fontSize = value;
            });
        } else if (styleProp === 'fontFamily') {
            if (sel.isCollapsed) {
                insertStyledSpan('font-family', value);
            } else {
                document.execCommand('fontName', false, value);
            }
        }
        editor.focus();
        return true;
    }

    function insertStyledSpan(property, value) {
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);

        const span = document.createElement('span');
        span.style[property] = value;
        span.innerHTML = '&#8203;';

        range.deleteContents();
        range.insertNode(span);

        range.setStart(span, 1);
        range.setEnd(span, 1);
        sel.removeAllRanges();
        sel.addRange(range);
    }

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

        if (firstNode && lastNode) {
            range.setStartBefore(firstNode);
            range.setEndAfter(lastNode);
            sel.selection.removeAllRanges();
            sel.selection.addRange(range);
        }
        editor.focus();
    }

    function applyEffect(category, effectName) {
        runWithSelection(() => {
            const selectedText = getCleanSelectedText();
            if (!selectedText) {
                showToast('Texte vide ou non sélectionné', true);
                return false;
            }

            activeEffects[category] = effectName;

            const btns = document.querySelectorAll(`.effect-btn[data-category="${category}"]`);
            btns.forEach(b => b.classList.remove('active'));
            const activeBtn = document.querySelector(`.effect-btn[data-effect="${effectName}"]`);
            if (activeBtn) activeBtn.classList.add('temp-active');

            const options = {
                intensity: parseInt(controls.intensitySlider.value),
                baseSize: parseInt(controls.fontSizeSlider.value)
            };

            const html = window.combineEffects(selectedText, activeEffects, options);
            replaceSelectionWithHtml(html);
            updateEffectUI();
        }, 'Effet appliqué !');
    }

    function handleRandomMode() {
        runWithSelection(async () => {
            const selectedText = getCleanSelectedText();
            if (!selectedText) return false;

            activeEffects = { color: null, size: null }; // Reset
            const options = {
                intensity: parseInt(controls.intensitySlider.value),
                baseSize: parseInt(controls.fontSizeSlider.value)
            };

            const res = window.applyRandomEffects(selectedText, options);
            replaceSelectionWithHtml(res.html);
            activeEffects = res.appliedEffects;

            updateEffectUI();

            // 20% chance to add emoji
            const addEmoji = Math.random() < 0.2;
            const apiKey = localStorage.getItem('gemini_api_key');

            if (addEmoji && apiKey) {
                try {
                    const emojiResult = await window.AIService.getEmojiForText(selectedText, apiKey);
                    if (emojiResult.emoji) {
                        // Find the end of current selection and add emoji
                        const sel = window.getSelection();
                        if (sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            range.collapse(false);
                            const emojiNode = document.createTextNode(' ' + emojiResult.emoji);
                            range.insertNode(emojiNode);
                        }
                        showToast(`Random + ${emojiResult.emoji} !`);
                        return;
                    }
                } catch (e) {
                    // Silently ignore emoji errors
                    console.warn('Emoji addition failed:', e);
                }
            }

            showToast('Random appliqué ! 🎲');
        });
    }

    // ============================================
    // AI COLORING
    // ============================================

    function openAiModal() {
        // Load saved API key
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) controls.apiKeyInput.value = savedKey;

        controls.aiModal.classList.remove('hidden');
    }

    function closeAiModal() {
        controls.aiModal.classList.add('hidden');
        updateAiStatus('', '');
    }

    function updateAiStatus(message, type) {
        if (!message) {
            controls.aiStatus.classList.add('hidden');
            return;
        }
        controls.aiStatus.textContent = message;
        controls.aiStatus.className = `status-text ${type}`;
    }

    async function handleAIColoring() {
        const apiKey = controls.apiKeyInput.value.trim();
        if (!apiKey) {
            showToast('Entrez une clé API', true);
            return;
        }

        // Save API key
        localStorage.setItem('gemini_api_key', apiKey);

        const text = editor.textContent.trim();
        if (!text) {
            showToast('Aucun texte dans l\'éditeur', true);
            return;
        }

        const colorDensity = parseInt(controls.densitySlider.value);
        const emojiDensity = parseInt(controls.emojiDensitySlider.value);

        try {
            controls.launchAiBtn.disabled = true;
            let emojiCount = 0;

            // Step 1: Emojis (if density > 0)
            if (emojiDensity > 0) {
                updateAiStatus('🥐 Ajout des emojis...', 'loading');
                try {
                    const emojiResult = await window.AIService.analyzeTextForEmojis(text, apiKey, emojiDensity);
                    if (emojiResult.emojis.length > 0) {
                        applyEmojisToEditor(emojiResult.emojis);
                        emojiCount = emojiResult.emojis.length;
                    }
                } catch (e) {
                    console.warn('Emoji phase failed:', e);
                }
            }

            // Step 2: Coloring
            updateAiStatus('🎨 Coloration en cours...', 'loading');
            const result = await window.AIService.analyzeTextForColoring(editor.textContent, apiKey, colorDensity);

            if (result.words.length === 0) {
                updateAiStatus('Aucun mot identifié', 'error');
                return;
            }

            applyColorToWords(result.words);

            const emojiMsg = emojiCount > 0 ? ` + ${emojiCount} 🥐` : '';
            updateAiStatus(`✨ ${result.words.length} mots colorés${emojiMsg} (${result.model})`, 'success');
            showToast(`${result.words.length} mots colorés${emojiMsg} !`);

        } catch (error) {
            console.error('AI Coloring error:', error);
            updateAiStatus(`Erreur: ${error.message}`, 'error');
            showToast('Erreur lors de l\'analyse', true);
        } finally {
            controls.launchAiBtn.disabled = false;
        }
    }

    function applyEmojisToEditor(emojiItems) {
        let html = editor.innerHTML;

        const sortedItems = [...emojiItems].sort((a, b) => b.word.length - a.word.length);

        sortedItems.forEach(item => {
            if (!item.word || !item.emoji) return;

            const escapedWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedWord})(?![\\w])`, 'i');

            html = html.replace(regex, (match) => {
                return match + ' ' + item.emoji;
            });
        });

        editor.innerHTML = html;
    }

    function applyColorToWords(words) {
        const options = {
            intensity: parseInt(controls.intensitySlider.value),
            baseSize: parseInt(controls.fontSizeSlider.value)
        };

        // Get editor HTML and process
        let html = editor.innerHTML;

        // Sort words by length (longest first) to avoid partial replacements
        const sortedWords = [...words].sort((a, b) => b.length - a.length);

        sortedWords.forEach(word => {
            // Escape special regex characters
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Create regex to match word (not inside HTML tags)
            const regex = new RegExp(`(?<![<\/\\w])${escapedWord}(?![\\w>])`, 'g');

            html = html.replace(regex, (match) => {
                const result = window.applyRandomEffects(match, options);
                return result.html;
            });
        });

        editor.innerHTML = html;
    }

    // ============================================
    // EMOJI AI (Individual word)
    // ============================================

    async function handleEmojiAdd() {
        const selectedText = getCleanSelectedText();
        if (!selectedText || selectedText.trim().length === 0) {
            showToast('Sélectionnez du texte', true);
            return;
        }

        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            showToast('Configurez d\'abord la clé API (bouton IA)', true);
            return;
        }

        try {
            showToast('Recherche d\'emoji... 🔍');
            const result = await window.AIService.getEmojiForText(selectedText, apiKey);

            if (result.emoji) {
                const sel = getSelection();
                if (sel) {
                    sel.range.collapse(false);
                    const emojiNode = document.createTextNode(' ' + result.emoji);
                    sel.range.insertNode(emojiNode);
                    editor.focus();
                }
                showToast(`Emoji ajouté ! ${result.emoji}`);
            } else {
                showToast('Aucun emoji trouvé', true);
            }
        } catch (error) {
            console.error('Emoji error:', error);
            showToast('Erreur: ' + error.message, true);
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    function initEventListeners() {
        document.addEventListener('mousedown', (e) => {
            if (!editor.contains(e.target)) saveSelection();
        });

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.effect-btn');
            if (btn) {
                applyEffect(btn.dataset.category, btn.dataset.effect);
            }
        });

        controls.textColorPalette.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (swatch) runWithSelection(() => applyInlineStyle('color', swatch.dataset.color), 'Couleur appliquée', true);
        });
        controls.bgColorPalette.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (swatch) runWithSelection(() => applyInlineStyle('backgroundColor', swatch.dataset.color), 'Fond appliqué', true);
        });

        controls.textColorCustom.addEventListener('change', function () { runWithSelection(() => applyInlineStyle('color', this.value), 'Couleur appliquée', true); });
        controls.bgColorCustom.addEventListener('change', function () { runWithSelection(() => applyInlineStyle('backgroundColor', this.value), 'Fond appliqué', true); });

        controls.fontSizeSlider.addEventListener('input', function () { controls.fontSizeValue.textContent = this.value + 'px'; });
        controls.fontSizeSlider.addEventListener('change', function () {
            runWithSelection(() => applyInlineStyle('fontSize', this.value + 'px'), 'Taille appliquée', true);
        });

        controls.fontFamilySelect.addEventListener('change', function () {
            runWithSelection(() => applyInlineStyle('fontFamily', this.value), 'Police appliquée', true);
        });

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

        controls.intensitySlider.addEventListener('input', function () { controls.intensityValue.textContent = this.value + '/10'; });
        controls.randomBtn.addEventListener('click', handleRandomMode);
        controls.copyBtn.addEventListener('click', handleCopy);
        controls.clearBtn.addEventListener('click', () => {
            if (confirm('Tout effacer ?')) {
                editor.innerHTML = '';
                activeEffects = { color: null, size: null };
                updateEffectUI();
            }
        });

        // AI Modal Events
        controls.aiColorBtn.addEventListener('click', openAiModal);
        controls.closeAiModalBtn.addEventListener('click', closeAiModal);
        controls.aiModal.querySelector('.modal-overlay').addEventListener('click', closeAiModal);
        controls.toggleApiKeyBtn.addEventListener('click', () => {
            const input = controls.apiKeyInput;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
        controls.densitySlider.addEventListener('input', function () {
            controls.densityValue.textContent = this.value + '%';
        });
        controls.emojiDensitySlider.addEventListener('input', function () {
            controls.emojiDensityValue.textContent = this.value + '%';
        });
        controls.launchAiBtn.addEventListener('click', handleAIColoring);

        // Emoji button (individual word)
        controls.emojiBtn.addEventListener('click', handleEmojiAdd);

        editor.addEventListener('keyup', updateFormatButtonStates);
        editor.addEventListener('mouseup', updateFormatButtonStates);
    }

    async function handleCopy() {
        const content = editor.innerHTML;
        if (!content || content.trim() === '') { showToast('Rien à copier', true); return; }

        const clean = cleanForOutlook(content);
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([clean], { type: 'text/html' }),
                    'text/plain': new Blob([editor.textContent], { type: 'text/plain' })
                })
            ]);
            showToast('Copié pour Outlook ! 📋');
        } catch (e) {
            fallbackCopy(clean);
        }
    }

    function fallbackCopy(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        document.body.appendChild(d);
        const r = document.createRange();
        r.selectNodeContents(d);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        try { document.execCommand('copy'); showToast('Copié !'); } catch (e) { showToast('Erreur copie', true); }
        document.body.removeChild(d);
        s.removeAllRanges();
    }

    function updateEffectUI() {
        document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
        if (activeEffects.color) {
            const btn = document.querySelector(`.effect-btn[data-effect="${activeEffects.color}"]`);
            if (btn) btn.classList.add('active');
        }
        if (activeEffects.size) {
            const btn = document.querySelector(`.effect-btn[data-effect="${activeEffects.size}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    function updateFormatButtonStates() {
        ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => {
            const id = cmd === 'strikeThrough' ? 'strikeBtn' : cmd + 'Btn';
            const btn = document.getElementById(id);
            if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
        });
        syncUIWithCursor();
    }

    function syncUIWithCursor() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentNode;

        if (editor.contains(node) || node === editor) {
            const computed = window.getComputedStyle(node);

            // 1. Sync Font Size
            const fontSize = computed.fontSize;
            if (fontSize) {
                const sizeVal = parseFloat(fontSize);
                if (!isNaN(sizeVal)) {
                    controls.fontSizeSlider.value = sizeVal;
                    controls.fontSizeValue.textContent = Math.round(sizeVal) + 'px';
                }
            }

            // 2. Sync Font Family
            let fontFamily = computed.fontFamily;
            if (fontFamily) {
                // Remove quotes "Arial" -> Arial
                fontFamily = fontFamily.replace(/['"]/g, '');

                const options = Array.from(controls.fontFamilySelect.options);

                // Try Exact Match (ignoring case)
                let match = options.find(opt => opt.value.replace(/['"]/g, '').toLowerCase() === fontFamily.toLowerCase());

                // Try Simple Name Match (Arial vs Arial, sans-serif)
                if (!match) {
                    const simpleComputed = fontFamily.split(',')[0].trim().toLowerCase();
                    match = options.find(opt => {
                        const simpleOpt = opt.value.split(',')[0].trim().replace(/['"]/g, '').toLowerCase();
                        return simpleOpt === simpleComputed;
                    });
                }

                if (match) {
                    controls.fontFamilySelect.value = match.value;
                }
            }
        }
    }

    function showToast(msg, isError = false) {
        const m = toast.querySelector('.toast-message');
        m.textContent = msg;
        toast.className = `toast show ${isError ? 'error' : ''}`;
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function cleanForOutlook(html) {
        const t = document.createElement('div');
        t.innerHTML = html;
        t.querySelectorAll('*').forEach(el => {
            el.removeAttribute('class');
            el.removeAttribute('id');
            el.removeAttribute('data-decoration');
            if (el.innerHTML === '&#8203;') el.innerHTML = ''; // Remove ZWSP
        });
        return t.innerHTML;
    }

    init();
});
