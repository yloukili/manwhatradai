
// Application State
const state = {
    pages: [], 
    currentPageId: null,
    selectedRegionId: null,
    isProcessing: false,
    zoom: 1.0,
    // Interaction State
    interactionMode: null, // 'move', 'resize', 'draw'
    interactionTargetId: null,
    startX: 0,
    startY: 0,
    startBbox: null,
    // UI State
    lastFocusedInput: null
};

// DOM Elements
const elements = {
    uploadView: document.getElementById('upload-view'),
    editorView: document.getElementById('editor-view'),
    dropZone: document.getElementById('drop-zone'),
    resumeProjectCard: document.getElementById('resume-project-card'),
    fileInput: document.getElementById('file-input'),
    selectFilesBtn: document.getElementById('select-files-btn'),
    addPageBtn: document.getElementById('add-page-btn'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingMessage: document.getElementById('loading-message'),
    thumbnailsContainer: document.getElementById('thumbnails-container'),
    mainImage: document.getElementById('main-image'),
    overlaysLayer: document.getElementById('overlays-layer'),
    workArea: document.getElementById('work-area'),
    workspaceLoading: document.getElementById('workspace-loading'),
    pageTitle: document.getElementById('page-title'),
    pageFilename: document.getElementById('page-filename'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    processingIndicator: document.getElementById('processing-indicator'),
    processingText: document.getElementById('processing-text'),
    
    // Header Extensions
    projectTitleInput: document.getElementById('project-title'),
    zoomSlider: document.getElementById('zoom-slider'),
    zoomPercent: document.getElementById('zoom-percent'),
    
    // Editor Panel
    emptySelectionMsg: document.getElementById('empty-selection-msg'),
    regionEditor: document.getElementById('region-editor'),
    deleteRegionBtn: document.getElementById('delete-region-btn'),
    moveFrontBtn: document.getElementById('move-front-btn'),
    moveBackBtn: document.getElementById('move-back-btn'),
    closeEditorBtn: document.getElementById('close-editor-btn'),
    typeDialogueBtn: document.getElementById('type-dialogue-btn'),
    typeSfxBtn: document.getElementById('type-sfx-btn'),
    shapeSelect: document.getElementById('shape-select'),
    fontSelect: document.getElementById('font-select'),
    fontSizeSlider: document.getElementById('font-size-slider'),
    fontSizeVal: document.getElementById('font-size-val'),
    transparentBgChk: document.getElementById('transparent-bg-chk'),
    bgColorControl: document.getElementById('bg-color-control'),
    bgColorPicker: document.getElementById('bg-color-picker'),
    bgEyedropperBtn: document.getElementById('bg-eyedropper-btn'),
    bgColorHex: document.getElementById('bg-color-hex'),
    textColorPicker: document.getElementById('text-color-picker'),
    textEyedropperBtn: document.getElementById('text-eyedropper-btn'),
    textColorHex: document.getElementById('text-color-hex'),
    originalTextInput: document.getElementById('original-text-input'),
    quickTranslateBtn: document.getElementById('quick-translate-btn'),
    translationInput: document.getElementById('translation-input'),
    translationVariantsList: document.getElementById('translation-variants-list'),
    resetTranslationBtn: document.getElementById('reset-translation-btn'),
    keepOriginalChk: document.getElementById('keep-original-chk'),
    uppercaseChk: document.getElementById('uppercase-chk'),
    exportBtn: document.getElementById('export-btn'),
    
    // Symbols Palette
    openSymbolsBtn: document.getElementById('open-symbols-btn'),
    symbolsModal: document.getElementById('symbols-modal'),
    closeSymbolsModal: document.getElementById('close-symbols-modal'),
    symbolsGrid: document.getElementById('symbols-grid'),

    // Project Management
    saveProjectBtn: document.getElementById('save-project-btn'),
    loadProjectBtn: document.getElementById('load-project-btn'),
    projectInput: document.getElementById('project-input'),
    resumeProjectBtn: document.getElementById('resume-project-btn'),

    // Page Actions
    reanalyzeBtn: document.getElementById('reanalyze-btn'),
    fuseBtn: document.getElementById('fuse-btn'),
    fusedActions: document.getElementById('fused-actions'),
    unfuseBtn: document.getElementById('unfuse-btn'),
    swapFusionBtn: document.getElementById('swap-fusion-btn')
};

// Character Sets
const VIETNAMESE_CHARS = "aàáảãạâầấẩẫậăằắẳẵặeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵdđ";
const VIETNAMESE_CHARS_UPPER = VIETNAMESE_CHARS.toUpperCase();

// Initialize Icons
if (window.lucide) window.lucide.createIcons();

// --- Initialization & Sizing ---

function syncWorkAreaSize() {
    if (!elements.mainImage.complete || elements.mainImage.naturalWidth === 0) return;
    const zoom = state.zoom || 1.0;
    const w = Math.round(elements.mainImage.naturalWidth * zoom);
    const h = Math.round(elements.mainImage.naturalHeight * zoom);
    elements.workArea.style.width = `${w}px`;
    elements.workArea.style.height = `${h}px`;
    elements.mainImage.style.width = '100%';
    elements.mainImage.style.height = '100%';
}

elements.mainImage.addEventListener('load', syncWorkAreaSize);
window.addEventListener('resize', syncWorkAreaSize);

elements.zoomSlider.addEventListener('input', (e) => {
    state.zoom = parseFloat(e.target.value);
    elements.zoomPercent.innerText = `${Math.round(state.zoom * 100)}%`;
    syncWorkAreaSize();
    renderOverlays(getCurrentPage());
});

// --- Eyedropper Logic ---

async function handleEyeDrop(targetProp, pickerEl, hexEl) {
    if (!window.EyeDropper) {
        alert("Your browser does not support the EyeDropper API. Please use the color picker manually.");
        return;
    }

    const eyeDropper = new EyeDropper();
    try {
        const result = await eyeDropper.open();
        const hex = toHexColor(result.sRGBHex);
        updateRegionProp(targetProp, hex);
        pickerEl.value = hex;
        hexEl.innerText = hex.toUpperCase();
    } catch (e) {
        console.log("Eyedropper cancelled or failed", e);
    }
}

function toHexColor(color) {
    if (typeof color === "string" && color.trim().startsWith("#")) {
        return color.toUpperCase();
    }
    const match = color.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!match) return color.toUpperCase();
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

elements.bgEyedropperBtn.addEventListener('click', () => handleEyeDrop('bgColor', elements.bgColorPicker, elements.bgColorHex));
elements.textEyedropperBtn.addEventListener('click', () => handleEyeDrop('textColor', elements.textColorPicker, elements.textColorHex));

// --- Event Listeners Setup ---

elements.dropZone.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('dragover', (e) => { 
    e.preventDefault(); elements.dropZone.classList.add('border-indigo-500', 'bg-indigo-500/5'); 
});
elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5'));
elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files);
});

elements.selectFilesBtn.addEventListener('click', (e) => { e.stopPropagation(); elements.fileInput.click(); });

if (elements.resumeProjectCard) {
    elements.resumeProjectCard.addEventListener('click', () => elements.projectInput.click());
}

elements.resumeProjectBtn.addEventListener('click', (e) => { e.stopPropagation(); elements.projectInput.click(); });
elements.addPageBtn.addEventListener('click', () => elements.fileInput.click());

elements.prevPageBtn.addEventListener('click', () => {
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx > 0) loadPage(state.pages[idx - 1].id);
});
elements.nextPageBtn.addEventListener('click', () => {
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx < state.pages.length - 1) loadPage(state.pages[idx + 1].id);
});

elements.typeDialogueBtn.addEventListener('click', () => updateRegionProp('type', 'dialogue'));
elements.typeSfxBtn.addEventListener('click', () => updateRegionProp('type', 'sfx'));
elements.shapeSelect.addEventListener('change', (e) => updateRegionProp('shape', e.target.value));
elements.fontSelect.addEventListener('change', (e) => updateRegionProp('fontFamily', e.target.value));
elements.fontSizeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    elements.fontSizeVal.innerText = `${val.toFixed(1)}x`;
    updateRegionProp('fontSizeScale', val);
});
elements.transparentBgChk.addEventListener('change', (e) => {
    updateRegionProp('isTransparent', e.target.checked);
    elements.bgColorControl.style.opacity = e.target.checked ? '0.4' : '1';
    elements.bgColorControl.style.pointerEvents = e.target.checked ? 'none' : 'auto';
});
elements.bgColorPicker.addEventListener('input', (e) => {
    elements.bgColorHex.innerText = e.target.value.toUpperCase();
    updateRegionProp('bgColor', e.target.value);
});
elements.textColorPicker.addEventListener('input', (e) => {
    elements.textColorHex.innerText = e.target.value.toUpperCase();
    updateRegionProp('textColor', e.target.value);
});

elements.originalTextInput.addEventListener('focus', () => state.lastFocusedInput = elements.originalTextInput);
elements.translationInput.addEventListener('focus', () => state.lastFocusedInput = elements.translationInput);

elements.originalTextInput.addEventListener('input', (e) => updateRegionProp('originalText', e.target.value));
elements.translationInput.addEventListener('input', (e) => updateRegionProp('userTranslation', e.target.value));
elements.keepOriginalChk.addEventListener('change', (e) => updateRegionProp('keepOriginal', e.target.checked));
elements.uppercaseChk.addEventListener('change', (e) => updateRegionProp('isUppercase', e.target.checked));

elements.deleteRegionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const page = getCurrentPage();
    if (page && state.selectedRegionId) {
        page.regions = page.regions.filter(r => r.id !== state.selectedRegionId);
        state.selectedRegionId = null;
        renderOverlays(page);
        renderEditorPanel();
    }
});

elements.moveFrontBtn.addEventListener('click', () => {
    const page = getCurrentPage();
    if (!page || !state.selectedRegionId) return;
    const idx = page.regions.findIndex(r => r.id === state.selectedRegionId);
    if (idx > -1) {
        const [region] = page.regions.splice(idx, 1);
        page.regions.push(region);
        renderOverlays(page);
    }
});

elements.moveBackBtn.addEventListener('click', () => {
    const page = getCurrentPage();
    if (!page || !state.selectedRegionId) return;
    const idx = page.regions.findIndex(r => r.id === state.selectedRegionId);
    if (idx > -1) {
        const [region] = page.regions.splice(idx, 1);
        page.regions.unshift(region);
        renderOverlays(page);
    }
});

elements.quickTranslateBtn.addEventListener('click', handleQuickTranslate);
elements.closeEditorBtn.addEventListener('click', () => {
    state.selectedRegionId = null;
    renderOverlays(getCurrentPage());
    renderEditorPanel();
});

elements.resetTranslationBtn.addEventListener('click', () => {
    const region = getSelectedRegion();
    if (region) {
        const resetVal = region.translationVariants?.[0] || region.originalText || "";
        updateRegionProp('userTranslation', resetVal);
        elements.translationInput.value = resetVal;
        renderEditorPanel();
        renderOverlays(getCurrentPage());
    }
});

elements.openSymbolsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSymbolsPalette();
});

elements.closeSymbolsModal.addEventListener('click', () => {
    elements.symbolsModal.classList.add('hidden');
});

elements.exportBtn.addEventListener('click', handleExport);
elements.saveProjectBtn.addEventListener('click', saveProject);
elements.loadProjectBtn.addEventListener('click', () => elements.projectInput.click());
elements.projectInput.addEventListener('change', loadProject);

elements.reanalyzeBtn.addEventListener('click', () => {
    const page = getCurrentPage();
    if (page && confirm("Re-scan this page?")) {
        page.regions = [];
        page.status = 'pending';
        processPage(page);
    }
});

elements.fuseBtn.addEventListener('click', fuseWithNext);
elements.unfuseBtn.addEventListener('click', unfusePage);
elements.swapFusionBtn.addEventListener('click', swapFusionOrder);

// --- Projects & Files Logic ---

async function saveProject() {
    const title = elements.projectTitleInput.value.trim() || `project-${new Date().toISOString().slice(0,10)}`;
    const fileName = title + ".mhs";
    const projectContent = JSON.stringify({ version: "1.0", title, pages: state.pages });

    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'ManhwaSync Project', accept: { 'application/json': ['.mhs'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(projectContent);
            await writable.close();
            return;
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.warn("File System Access API failed, falling back to traditional download.");
        }
    }

    const blob = new Blob([projectContent], { type: "application/json" });
    saveAs(blob, fileName);
}

function loadProject(e) {
    const file = e.target.files[0];
    if (!file) return;
    elements.loadingOverlay.classList.remove('hidden');
    elements.loadingMessage.innerText = "Loading Project...";
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (!data.pages) throw new Error("Invalid project data");
            
            state.pages = data.pages;
            state.currentPageId = null;
            state.selectedRegionId = null;

            elements.projectTitleInput.value = data.title || file.name.replace(".mhs", "");
            elements.uploadView.classList.add('hidden');
            elements.editorView.classList.remove('hidden');
            
            renderThumbnails();
            loadPage(state.pages[0].id);
            processPagesQueue();
        } catch (e) { 
            console.error(e);
            alert("The loading of the project file failed."); 
        } finally {
            elements.loadingOverlay.classList.add('hidden');
        }
    };
    reader.readAsText(file);
}

// --- Export Logic ---

async function handleExport() {
    elements.loadingOverlay.classList.remove('hidden');
    elements.loadingMessage.innerText = "Exporting Chapter...";
    try {
        const zip = new JSZip();
        for (let i = 0; i < state.pages.length; i++) {
            const page = state.pages[i];
            const blob = await renderPageToBlob(page);
            const ext = page.filename.includes('.') ? page.filename.split('.').pop() : 'jpg';
            zip.file(`${(i + 1).toString().padStart(3, '0')}_${page.filename.split('.')[0]}.${ext}`, blob);
        }
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "ManhwaSync_Export.zip");
    } catch (e) {
        console.error(e);
        alert("Export failed.");
    } finally {
        elements.loadingOverlay.classList.add('hidden');
    }
}

function renderPageToBlob(page) {
    return new Promise(async (resolve) => {
        const img = await loadImage(page.imageUrl);
        const canvas = document.createElement('canvas');
        canvas.width = page.width; canvas.height = page.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        page.regions.forEach(r => {
            if (r.keepOriginal) return;
            const rx = (r.bbox.xmin / 1000) * page.width;
            const ry = (r.bbox.ymin / 1000) * page.height;
            const rw = (r.bbox.xmax - r.bbox.xmin) / 1000 * page.width;
            const rh = (r.bbox.ymax - r.bbox.ymin) / 1000 * page.height;
            
            if (!r.isTransparent) {
                ctx.fillStyle = r.bgColor || '#ffffff';
                ctx.beginPath();
                if (r.shape === 'rect') ctx.roundRect(rx, ry, rw, rh, 8);
                else ctx.ellipse(rx + rw/2, ry + rh/2, rw/2, rh/2, 0, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            let txt = r.userTranslation || "";
            if (r.isUppercase) txt = txt.toUpperCase();
            ctx.fillStyle = r.textColor || '#000000';
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle";
            const fs = Math.max(14, (r.type === 'sfx' ? rw * 0.25 : rw * 0.12) * (r.fontSizeScale || 1.0));
            ctx.font = `${r.type === 'sfx' ? 'bold italic' : 'normal'} ${fs}px ${r.fontFamily}`;
            wrapText(ctx, txt, rx + rw/2, ry + rh/2, rw * 0.85, fs * 1.2);
        });
        canvas.toBlob(resolve, 'image/jpeg', 0.95);
    });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(/\s+/);
    let line = '', lines = [];
    for (let word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxWidth && line !== '') { 
            lines.push(line); line = word; 
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    let cy = y - (lines.length - 1) * lineHeight / 2;
    for (let l of lines) { 
        ctx.fillText(l.trim(), x, cy); 
        cy += lineHeight; 
    }
}

// --- Fusing Logic ---

async function fuseWithNext() {
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx < 0 || idx === state.pages.length - 1) {
        alert("Cannot fuse the last page.");
        return;
    }
    elements.loadingOverlay.classList.remove('hidden');
    elements.loadingMessage.innerText = "Fusing Pages...";
    try {
        const p1 = state.pages[idx]; 
        const p2 = state.pages[idx + 1];
        const i1 = await loadImage(p1.imageUrl); 
        const i2 = await loadImage(p2.imageUrl);
        
        const canvas = document.createElement('canvas');
        canvas.width = i1.width + i2.width; 
        canvas.height = Math.max(i1.height, i2.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#ffffff"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(i1, 0, 0); 
        ctx.drawImage(i2, i1.width, 0);
        
        const fused = {
            id: `p-fused-${Date.now()}`, 
            filename: `fused_${p1.filename}`,
            imageUrl: canvas.toDataURL('image/jpeg', 0.95),
            width: canvas.width, height: canvas.height,
            regions: [], status: 'pending', isFused: true, 
            sourcePages: [JSON.parse(JSON.stringify(p1)), JSON.parse(JSON.stringify(p2))]
        };
        state.pages.splice(idx, 2, fused);
        renderThumbnails(); 
        loadPage(fused.id); 
        processPage(fused);
    } catch (e) { 
        console.error(e);
        alert("Fusion failed"); 
    } finally { 
        elements.loadingOverlay.classList.add('hidden'); 
    }
}

function unfusePage() {
    const page = getCurrentPage();
    if (!page?.isFused) return;
    const idx = state.pages.indexOf(page);
    state.pages.splice(idx, 1, ...page.sourcePages);
    renderThumbnails();
    loadPage(page.sourcePages[0].id);
}

async function swapFusionOrder() {
    const page = getCurrentPage();
    if (!page?.isFused) return;
    page.sourcePages.reverse();
    const [p1, p2] = page.sourcePages;
    const i1 = await loadImage(p1.imageUrl); 
    const i2 = await loadImage(p2.imageUrl);
    const canvas = document.createElement('canvas');
    canvas.width = i1.width + i2.width; canvas.height = Math.max(i1.height, i2.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(i1, 0, 0); ctx.drawImage(i2, i1.width, 0);
    page.imageUrl = canvas.toDataURL('image/jpeg', 0.95);
    page.status = 'pending'; 
    loadPage(page.id); 
    processPage(page);
}

// --- General Interaction & Canvas Logic ---

elements.overlaysLayer.addEventListener('mousedown', (e) => {
    if (e.target !== elements.overlaysLayer) return;
    const rect = elements.workArea.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    const newRegionId = `r-manual-${Date.now()}`;
    const newRegion = {
        id: newRegionId,
        bbox: { xmin: x, ymin: y, xmax: x + 1, ymax: y + 1 },
        originalText: "", 
        translationVariants: ["", "", ""],
        userTranslation: "",
        type: "dialogue", shape: "rect",
        bgColor: "#ffffff", textColor: "#000000",
        isTransparent: false,
        keepOriginal: false, isUppercase: true,
        fontFamily: "'Comic Neue', cursive", fontSizeScale: 1.0
    };
    const page = getCurrentPage();
    if (page) {
        page.regions.push(newRegion);
        state.selectedRegionId = newRegionId;
        state.interactionMode = 'draw';
        state.interactionTargetId = newRegionId;
        state.startX = e.clientX; state.startY = e.clientY;
        state.startBbox = { ...newRegion.bbox };
        renderOverlays(page);
        renderEditorPanel();
    }
});

function toggleSymbolsPalette() {
    const isHidden = elements.symbolsModal.classList.toggle('hidden');
    if (!isHidden) {
        populateSymbolsGrid();
        if (window.lucide) window.lucide.createIcons();
    }
}

function populateSymbolsGrid() {
    elements.symbolsGrid.innerHTML = '';
    const allChars = (VIETNAMESE_CHARS + VIETNAMESE_CHARS_UPPER).split('');
    allChars.forEach(char => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flex items-center justify-center h-10 w-full text-lg font-medium bg-slate-800 border border-slate-700 rounded-lg hover:bg-indigo-600 hover:border-indigo-500 hover:text-white transition-all transform active:scale-90';
        btn.innerText = char;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            insertAtCursor(char);
        });
        elements.symbolsGrid.appendChild(btn);
    });
}

function insertAtCursor(text) {
    const input = state.lastFocusedInput || elements.translationInput;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const val = input.value;
    input.value = val.slice(0, start) + text + val.slice(end);
    input.focus();
    input.setSelectionRange(start + text.length, start + text.length);
    if (input === elements.originalTextInput) updateRegionProp('originalText', input.value);
    else if (input === elements.translationInput) updateRegionProp('userTranslation', input.value);
}

// --- Image Processing Functions ---

async function handleFiles(fileList) {
    elements.loadingOverlay.classList.remove('hidden');
    elements.loadingMessage.innerText = "Scanning images...";
    try {
        const extractedPages = await extractImagesFromFiles(fileList);
        if (state.pages.length > 0) state.pages.push(...extractedPages);
        else state.pages = extractedPages;
        elements.uploadView.classList.add('hidden');
        elements.editorView.classList.remove('hidden');
        elements.loadingOverlay.classList.add('hidden');
        renderThumbnails();
        if (!state.currentPageId) loadPage(state.pages[0].id);
        processPagesQueue();
    } catch (error) {
        alert(error.message);
        elements.loadingOverlay.classList.add('hidden');
    }
}

async function processPagesQueue() {
    elements.processingIndicator.classList.remove('hidden');
    const worker = async () => {
        let page;
        while ((page = state.pages.find(p => p.status === 'pending'))) {
            await processPage(page);
        }
    };
    await Promise.all([worker(), worker()]);
    elements.processingIndicator.classList.add('hidden');
}

async function processPage(page) {
    page.status = 'processing';
    if (state.currentPageId === page.id) elements.workspaceLoading.classList.remove('hidden');
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: page.imageUrl })
        });
        const result = await response.json();
        
        page.regions = (result.regions || []).map((r, idx) => {
            let [y1, x1, y2, x2] = r.box_2d;
            const ymin = Math.min(y1, y2);
            const ymax = Math.max(y1, y2);
            const xmin = Math.min(x1, x2);
            const xmax = Math.max(x1, x2);
            const variants = r.translations || ["", "", ""];
            return {
                id: `r-${page.id}-${idx}-${Date.now()}`,
                bbox: { ymin, xmin, ymax, xmax },
                originalText: r.original, 
                translationVariants: variants,
                userTranslation: variants[0] || "",
                type: r.type || "dialogue", shape: "rect",
                bgColor: "#ffffff", textColor: "#000000",
                isTransparent: false,
                keepOriginal: false, isUppercase: r.type === 'dialogue',
                fontFamily: r.type === 'sfx' ? "'Bangers', cursive" : "'Comic Neue', cursive",
                fontSizeScale: 1.0
            };
        });
        page.status = 'completed';
    } catch (e) { page.status = 'error'; }
    
    if (state.currentPageId === page.id) {
        elements.workspaceLoading.classList.add('hidden');
        renderOverlays(page);
        renderEditorPanel();
    }
}

async function handleQuickTranslate() {
    const region = getSelectedRegion();
    if (!region || !elements.originalTextInput.value) return;
    const originalContent = elements.quickTranslateBtn.innerHTML;
    elements.quickTranslateBtn.disabled = true;
    elements.quickTranslateBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Translating...`;
    if (window.lucide) window.lucide.createIcons();
    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: elements.originalTextInput.value, type: region.type })
        });
        const result = await response.json();
        region.translationVariants = result.translations;
        region.userTranslation = result.translations[0];
        elements.translationInput.value = region.userTranslation;
        renderEditorPanel();
        renderOverlays(getCurrentPage());
    } catch (e) { alert("Translation failed"); } 
    finally { 
        elements.quickTranslateBtn.disabled = false; 
        elements.quickTranslateBtn.innerHTML = originalContent;
        if (window.lucide) window.lucide.createIcons();
    }
}

// --- Interaction Core ---

function handleGlobalMouseMove(e) {
    if (!state.interactionMode || !state.interactionTargetId) return;
    const page = getCurrentPage();
    const region = page.regions.find(r => r.id === state.interactionTargetId);
    if (!region) return;
    const rect = elements.workArea.getBoundingClientRect();
    const dx = ((e.clientX - state.startX) / rect.width) * 1000;
    const dy = ((e.clientY - state.startY) / rect.height) * 1000;
    const SNAP_THRESHOLD = 15;
    const snap = (val) => {
        if (val < SNAP_THRESHOLD) return 0;
        if (val > 1000 - SNAP_THRESHOLD) return 1000;
        return val;
    };
    if (state.interactionMode === 'move') {
        const w = state.startBbox.xmax - state.startBbox.xmin;
        const h = state.startBbox.ymax - state.startBbox.ymin;
        let x = state.startBbox.xmin + dx;
        let y = state.startBbox.ymin + dy;
        if (x < SNAP_THRESHOLD) x = 0; else if (x + w > 1000 - SNAP_THRESHOLD) x = 1000 - w;
        if (y < SNAP_THRESHOLD) y = 0; else if (y + h > 1000 - SNAP_THRESHOLD) y = 1000 - h;
        region.bbox.xmin = x; region.bbox.ymin = y; region.bbox.xmax = x + w; region.bbox.ymax = y + h;
    } else {
        region.bbox.xmax = snap(state.startBbox.xmax + dx);
        region.bbox.ymax = snap(state.startBbox.ymax + dy);
    }
    renderOverlays(page);
}

function handleGlobalMouseUp() {
    if (!state.interactionMode) return;
    if (state.interactionMode === 'draw' || state.interactionMode === 'resize') {
        const page = getCurrentPage();
        const region = page.regions.find(r => r.id === state.interactionTargetId);
        if (region) {
            const x1 = Math.min(region.bbox.xmin, region.bbox.xmax);
            const x2 = Math.max(region.bbox.xmin, region.bbox.xmax);
            const y1 = Math.min(region.bbox.ymin, region.bbox.ymax);
            const y2 = Math.max(region.bbox.ymin, region.bbox.ymax);
            region.bbox = { xmin: x1, ymin: y1, xmax: x2, ymax: y2 };
        }
    }
    state.interactionMode = null;
    state.interactionTargetId = null;
    renderOverlays(getCurrentPage());
    renderEditorPanel();
}

// --- Final Render Utilities ---

function loadPage(pageId) {
    state.currentPageId = pageId;
    const page = getCurrentPage();
    if (!page) return;
    elements.mainImage.src = page.imageUrl;
    elements.pageTitle.innerText = `Page ${state.pages.indexOf(page) + 1}`;
    elements.pageFilename.innerText = page.filename;
    elements.fusedActions.classList.toggle('hidden', !page.isFused);
    syncWorkAreaSize();
    renderThumbnails();
    renderOverlays(page);
    renderEditorPanel();
}

function renderOverlays(page) {
    if (!page) return;
    elements.overlaysLayer.innerHTML = '';
    const layerRect = elements.overlaysLayer.getBoundingClientRect();
    page.regions.forEach(region => {
        const div = document.createElement('div');
        const isSelected = region.id === state.selectedRegionId;
        const widthPercent = (region.bbox.xmax - region.bbox.xmin) / 10;
        const heightPercent = (region.bbox.ymax - region.bbox.ymin) / 10;
        div.style.top = `${region.bbox.ymin / 10}%`;
        div.style.left = `${region.bbox.xmin / 10}%`;
        div.style.width = `${widthPercent}%`;
        div.style.height = `${heightPercent}%`;
        div.className = `absolute region-box cursor-move border border-dashed border-indigo-500/20 ${isSelected ? 'selected' : ''}`;
        if (!region.keepOriginal) {
            div.style.backgroundColor = region.isTransparent ? 'transparent' : (region.bgColor || '#ffffff');
            div.style.borderRadius = (region.shape === 'rect') ? '8px' : '50%';
            const preview = document.createElement('div');
            preview.className = 'absolute inset-0 flex items-center justify-center p-2 overflow-hidden pointer-events-none text-center leading-tight whitespace-pre-wrap';
            preview.style.color = region.textColor;
            preview.style.fontFamily = region.fontFamily;
            const actualWidthPx = (widthPercent / 100) * layerRect.width;
            const baseFontSize = region.type === 'sfx' ? actualWidthPx * 0.25 : actualWidthPx * 0.12;
            const fs = Math.max(8, baseFontSize * (region.fontSizeScale || 1.0));
            preview.style.fontSize = `${fs}px`;
            let txt = region.userTranslation || "";
            preview.innerText = region.isUppercase ? txt.toUpperCase() : txt;
            div.appendChild(preview);
        }
        div.onmousedown = (e) => {
            if (e.target.classList.contains('resize-handle')) return;
            e.stopPropagation();
            state.selectedRegionId = region.id;
            state.interactionMode = 'move';
            state.interactionTargetId = region.id;
            state.startX = e.clientX; state.startY = e.clientY;
            state.startBbox = { ...region.bbox };
            renderOverlays(page);
            renderEditorPanel();
        };
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.onmousedown = (e) => {
            e.stopPropagation();
            state.interactionMode = 'resize';
            state.interactionTargetId = region.id;
            state.startX = e.clientX; state.startY = e.clientY;
            state.startBbox = { ...region.bbox };
        };
        div.appendChild(handle);
        elements.overlaysLayer.appendChild(div);
    });
}

function renderThumbnails() {
    elements.thumbnailsContainer.innerHTML = '';
    state.pages.forEach((page) => {
        const btn = document.createElement('div');
        btn.className = `thumbnail-btn w-16 h-24 mb-4 rounded-lg overflow-hidden border-2 relative shrink-0 transition-all ${page.id === state.currentPageId ? 'border-indigo-500 opacity-100' : 'border-slate-700 opacity-60'}`;
        btn.onclick = () => loadPage(page.id);
        const img = document.createElement('img');
        img.src = page.imageUrl;
        img.className = 'w-full h-full object-cover pointer-events-none';
        btn.appendChild(img);
        elements.thumbnailsContainer.appendChild(btn);
    });
}

function renderEditorPanel() {
    const region = getSelectedRegion();
    if (!region) {
        elements.emptySelectionMsg.classList.remove('hidden');
        elements.regionEditor.classList.add('hidden');
        return;
    }
    elements.emptySelectionMsg.classList.add('hidden');
    elements.regionEditor.classList.remove('hidden');
    elements.shapeSelect.value = region.shape;
    elements.fontSelect.value = region.fontFamily;
    elements.fontSizeSlider.value = region.fontSizeScale || 1.0;
    elements.fontSizeVal.innerText = `${(region.fontSizeScale || 1.0).toFixed(1)}x`;
    elements.transparentBgChk.checked = region.isTransparent || false;
    elements.bgColorPicker.value = region.bgColor || '#ffffff';
    elements.bgColorHex.innerText = (region.bgColor || '#ffffff').toUpperCase();
    elements.textColorPicker.value = region.textColor || '#000000';
    elements.textColorHex.innerText = (region.textColor || '#000000').toUpperCase();
    elements.originalTextInput.value = region.originalText || '';
    elements.translationInput.value = region.userTranslation || '';
    elements.keepOriginalChk.checked = region.keepOriginal;
    elements.uppercaseChk.checked = region.isUppercase;
    elements.translationVariantsList.innerHTML = '';
    const variantLabels = ['Literal', 'Semantic', 'Stylistic'];
    (region.translationVariants || ["", "", ""]).forEach((variant, idx) => {
        const isActive = region.userTranslation === variant;
        const card = document.createElement('button');
        card.type = "button";
        card.className = `w-full text-left p-3 rounded-lg border transition-all space-y-1 group relative ${isActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5'}`;
        card.innerHTML = `
            <div class="flex justify-between items-center pointer-events-none">
                <span class="text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-indigo-400' : 'text-slate-500'}">${variantLabels[idx]}</span>
                <i data-lucide="check" class="w-3 h-3 ${isActive ? 'opacity-100' : 'opacity-0'}"></i>
            </div>
            <p class="text-xs ${isActive ? 'text-slate-100' : 'text-slate-200'} line-clamp-2">${variant || "No text"}</p>
        `;
        card.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            region.userTranslation = variant;
            elements.translationInput.value = variant;
            renderOverlays(getCurrentPage());
            renderEditorPanel();
        });
        elements.translationVariantsList.appendChild(card);
    });
    const isDiag = region.type === 'dialogue';
    elements.typeDialogueBtn.classList.toggle('bg-slate-700', isDiag);
    elements.typeSfxBtn.classList.toggle('bg-slate-700', !isDiag);
    if (window.lucide) window.lucide.createIcons();
}

function updateRegionProp(key, val) {
    const region = getSelectedRegion();
    if (region) {
        region[key] = val;
        renderOverlays(getCurrentPage());
    }
}

async function extractImagesFromFiles(files) {
    const pages = [];
    const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (let f of sorted) {
        if (f.type.startsWith('image/')) {
            const base64 = await blobToBase64(f);
            const dims = await getImageDimensions(base64);
            pages.push({ id: `p-${Date.now()}-${Math.random()}`, filename: f.name, imageUrl: base64, ...dims, regions: [], status: 'pending' });
        }
    }
    return pages;
}

const blobToBase64 = (blob) => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
const getImageDimensions = (b64) => new Promise(res => { const i = new Image(); i.onload = () => res({ width: i.width, height: i.height }); i.src = b64; });
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function getCurrentPage() { return state.pages.find(p => p.id === state.currentPageId); }
function getSelectedRegion() { return getCurrentPage()?.regions.find(r => r.id === state.selectedRegionId); }
