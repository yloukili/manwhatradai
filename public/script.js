
import { state, getCurrentPage, getSelectedRegion } from './js/state.js';
import { elements } from './js/elements.js';
import { translateText } from './js/api.js';
import { syncWorkAreaSize, renderOverlays, handleMouseDown } from './js/canvas.js';
import { renderEditorPanel, refreshFusedComposite, loadPage, updateRegionProp, renderSymbols } from './js/editor.js';
import { renderThumbnails, handleExport, handleSaveProject, handleLoadProjectFile } from './js/project.js';
import { handleFiles, processPage, processZone } from './js/processing.js';
import { handleEyeDrop } from './js/utils.js';

// --- Initialization ---
if (window.lucide) window.lucide.createIcons();

// --- Draggable Utility ---
const makeDraggable = (element, handle) => {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        // Override the default right/bottom positioning once dragged
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
};

// Initialize Draggability
const symbolHeader = elements.symbolsModal.querySelector('.p-3.border-b');
if (symbolHeader) {
    symbolHeader.classList.add('symbols-header');
    makeDraggable(elements.symbolsModal, symbolHeader);
}

// --- Event Listeners Centralization ---

// Zoom & View
elements.zoomSlider.addEventListener('input', (e) => {
    state.zoom = parseFloat(e.target.value);
    elements.zoomPercent.innerText = `${Math.round(state.zoom * 100)}%`;
    syncWorkAreaSize();
    renderOverlays(getCurrentPage());
});

// File Uploads
elements.dropZone.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); elements.dropZone.classList.add('border-indigo-500', 'bg-indigo-500/5'); });
elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5'));
elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files, loadPage);
});

elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files, loadPage);
});

elements.selectFilesBtn.addEventListener('click', (e) => { e.stopPropagation(); elements.fileInput.click(); });
elements.addPageBtn.addEventListener('click', () => elements.fileInput.click());

// Project Management (Loading)
const triggerProjectLoad = (e) => {
    if (e) e.stopPropagation();
    elements.projectInput.click();
};

elements.resumeProjectCard.addEventListener('click', triggerProjectLoad);
elements.resumeProjectBtn.addEventListener('click', triggerProjectLoad);
elements.loadProjectBtn.addEventListener('click', triggerProjectLoad);

elements.projectInput.addEventListener('change', (e) => handleLoadProjectFile(e, loadPage));

// Project Management (Saving)
elements.saveProjectBtn.addEventListener('click', handleSaveProject);

// Navigation
elements.prevPageBtn.addEventListener('click', () => {
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx > 0) loadPage(state.pages[idx - 1].id);
});
elements.nextPageBtn.addEventListener('click', () => {
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx < state.pages.length - 1) loadPage(state.pages[idx + 1].id);
});

// Region Editing
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

// Colors & Eyedropper
elements.bgColorPicker.addEventListener('input', (e) => {
    elements.bgColorHex.innerText = e.target.value.toUpperCase();
    updateRegionProp('bgColor', e.target.value);
});
elements.textColorPicker.addEventListener('input', (e) => {
    elements.textColorHex.innerText = e.target.value.toUpperCase();
    updateRegionProp('textColor', e.target.value);
});
elements.bgEyedropperBtn.addEventListener('click', async () => {
    const color = await handleEyeDrop();
    if (color) {
        elements.bgColorPicker.value = color;
        elements.bgColorHex.innerText = color;
        updateRegionProp('bgColor', color);
    }
});
elements.textEyedropperBtn.addEventListener('click', async () => {
    const color = await handleEyeDrop();
    if (color) {
        elements.textColorPicker.value = color;
        elements.textColorHex.innerText = color;
        updateRegionProp('textColor', color);
    }
});

// Inputs Focus & Text sync
elements.originalTextInput.addEventListener('focus', () => state.lastFocusedInput = elements.originalTextInput);
elements.translationInput.addEventListener('focus', () => state.lastFocusedInput = elements.translationInput);
elements.originalTextInput.addEventListener('input', (e) => updateRegionProp('originalText', e.target.value));
elements.translationInput.addEventListener('input', (e) => updateRegionProp('userTranslation', e.target.value));
elements.keepOriginalChk.addEventListener('change', (e) => updateRegionProp('keepOriginal', e.target.checked));
elements.uppercaseChk.addEventListener('change', (e) => updateRegionProp('isUppercase', e.target.checked));

// Layer Control
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

// Quick Translation
elements.quickTranslateBtn.addEventListener('click', async () => {
    const region = getSelectedRegion();
    if (!region || !elements.originalTextInput.value) return;
    elements.quickTranslateBtn.disabled = true;
    try {
        const lang = elements.languageSelect.value;
        const result = await translateText(elements.originalTextInput.value, region.type, lang === 'auto' ? null : lang);
        region.translationVariants = result.translations;
        region.userTranslation = result.translations[0];
        elements.translationInput.value = region.userTranslation;
        renderEditorPanel();
        renderOverlays(getCurrentPage());
    } catch (e) {
        alert("Translation failed");
    } finally {
        elements.quickTranslateBtn.disabled = false;
    }
});

elements.closeEditorBtn.addEventListener('click', () => { state.selectedRegionId = null; renderOverlays(getCurrentPage()); renderEditorPanel(); });
elements.exportBtn.addEventListener('click', handleExport);

// AI Rescan
elements.reanalyzeBtn.addEventListener('click', () => { elements.rescanModal.classList.remove('hidden'); });
elements.rescanCancelBtn.addEventListener('click', () => elements.rescanModal.classList.add('hidden'));
elements.rescanConfirmBtn.addEventListener('click', () => {
    const page = getCurrentPage();
    if (page) {
        const lang = elements.languageSelect.value;
        elements.rescanModal.classList.add('hidden');
        page.regions = [];
        page.status = 'pending';
        processPage(page, loadPage, lang === 'auto' ? null : lang);
    }
});

// Zonal Actions
elements.selectZoneBtn.addEventListener('click', () => {
    state.isZonalMode = !state.isZonalMode;
    elements.selectZoneBtn.classList.toggle('bg-slate-700', state.isZonalMode);
    elements.selectZoneBtn.classList.toggle('active', state.isZonalMode);
    if (!state.isZonalMode) {
        elements.zonalSelection.classList.add('hidden');
        elements.zoneConfirmMenu.classList.add('hidden');
    }
});

elements.zoneClearBtn.addEventListener('click', () => {
    elements.zonalSelection.classList.add('hidden');
    elements.zoneConfirmMenu.classList.add('hidden');
    state.currentZone = null;
});

elements.zoneTranslateBtn.addEventListener('click', () => {
    const page = getCurrentPage();
    if (page && state.currentZone) {
        const lang = elements.languageSelect.value;
        processZone(page, state.currentZone, lang === 'auto' ? null : lang);
        elements.zoneConfirmMenu.classList.add('hidden');
        // Disable mode after starting
        state.isZonalMode = false;
        elements.selectZoneBtn.classList.remove('bg-slate-700', 'active');
    }
});

// Fusion Actions
elements.fuseBtn.addEventListener('click', async () => {
    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
    if (idx < 0 || idx === state.pages.length - 1) return;
    const p1 = state.pages[idx], p2 = state.pages[idx + 1];
    const fused = {
        id: `p-fused-${Date.now()}`,
        filename: `fused_${p1.filename}`,
        width: p1.width,
        height: p1.height,
        regions: [],
        status: 'pending',
        isFused: true,
        fusionOrientation: 'vertical',
        sourcePages: [
            { id: p1.id, imageUrl: p1.imageUrl, width: p1.width, height: p1.height, x: 0, y: 0, scale: 1.0 },
            { id: p2.id, imageUrl: p2.imageUrl, width: p2.width, height: p2.height, x: 0, y: 0, scale: 1.0 }
        ]
    };
    await refreshFusedComposite(fused);
    state.pages.splice(idx, 2, fused);
    renderThumbnails(loadPage);
    loadPage(fused.id);
    processPage(fused, loadPage);
});

elements.unfuseBtn.addEventListener('click', () => {
    const page = getCurrentPage(); if (!page?.isFused) return;
    const idx = state.pages.indexOf(page);
    const restored = page.sourcePages.map(sp => ({
        id: sp.id,
        filename: `restored_${sp.id}.jpg`,
        imageUrl: sp.imageUrl,
        width: sp.width,
        height: sp.height,
        regions: [],
        status: 'completed'
    }));
    state.pages.splice(idx, 1, ...restored);
    renderThumbnails(loadPage);
    loadPage(restored[0].id);
});

elements.swapFusionBtn.addEventListener('click', async () => {
    const page = getCurrentPage(); if (!page?.isFused) return;
    page.sourcePages.reverse();
    await refreshFusedComposite(page);
    page.status = 'pending';
    loadPage(page.id);
    processPage(page, loadPage);
});

// --- Canvas Interactions ---
elements.overlaysLayer.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', (e) => {
    if (!state.interactionMode) return;
    const rect = elements.workArea.getBoundingClientRect();
    const curX = ((e.clientX - rect.left) / rect.width) * 1000;
    const curY = ((e.clientY - rect.top) / rect.height) * 1000;

    if (state.interactionMode === 'zone') {
        state.currentZone.xmax = curX;
        state.currentZone.ymax = curY;
        const xmin = Math.min(state.currentZone.xmin, state.currentZone.xmax);
        const xmax = Math.max(state.currentZone.xmin, state.currentZone.xmax);
        const ymin = Math.min(state.currentZone.ymin, state.currentZone.ymax);
        const ymax = Math.max(state.currentZone.ymin, state.currentZone.ymax);

        elements.zonalSelection.style.top = `${ymin / 10}%`;
        elements.zonalSelection.style.left = `${xmin / 10}%`;
        elements.zonalSelection.style.width = `${(xmax - xmin) / 10}%`;
        elements.zonalSelection.style.height = `${(ymax - ymin) / 10}%`;
        return;
    }

    if (!state.interactionTargetId) return;
    const page = getCurrentPage();
    const region = page.regions.find(r => r.id === state.interactionTargetId);
    if (!region) return;
    const dx = ((e.clientX - state.startX) / rect.width) * 1000, dy = ((e.clientY - state.startY) / rect.height) * 1000;

    if (state.interactionMode === 'move') {
        const w = state.startBbox.xmax - state.startBbox.xmin, h = state.startBbox.ymax - state.startBbox.ymin;
        region.bbox.xmin = Math.max(0, Math.min(1000 - w, state.startBbox.xmin + dx));
        region.bbox.ymin = Math.max(0, Math.min(1000 - h, state.startBbox.ymin + dy));
        region.bbox.xmax = region.bbox.xmin + w; region.bbox.ymax = region.bbox.ymin + h;
    } else {
        region.bbox.xmax = Math.max(0, Math.min(1000, state.startBbox.xmax + dx));
        region.bbox.ymax = Math.max(0, Math.min(1000, state.startBbox.ymax + dy));
    }

    // Low-latency visual update
    const div = document.querySelector(`.region-box[data-id="${region.id}"]`);
    if (div) {
        div.style.top = `${region.bbox.ymin / 10}%`;
        div.style.left = `${region.bbox.xmin / 10}%`;
        div.style.width = `${(region.bbox.xmax - region.bbox.xmin) / 10}%`;
        div.style.height = `${(region.bbox.ymax - region.bbox.ymin) / 10}%`;
    }
});

window.addEventListener('mouseup', (e) => {
    if (!state.interactionMode) return;
    const page = getCurrentPage();

    if (state.interactionMode === 'zone') {
        // Fix coordinates if drawn backwards
        const xmin = Math.min(state.currentZone.xmin, state.currentZone.xmax);
        const xmax = Math.max(state.currentZone.xmin, state.currentZone.xmax);
        const ymin = Math.min(state.currentZone.ymin, state.currentZone.ymax);
        const ymax = Math.max(state.currentZone.ymin, state.currentZone.ymax);
        state.currentZone = { xmin, ymin, xmax, ymax };

        // Only show confirm if zone is big enough
        if (xmax - xmin > 5 && ymax - ymin > 5) {
            elements.zoneConfirmMenu.classList.remove('hidden');
            const rect = elements.workArea.getBoundingClientRect();
            // Position near cursor
            elements.zoneConfirmMenu.style.top = `${e.clientY - rect.top}px`;
            elements.zoneConfirmMenu.style.left = `${e.clientX - rect.left}px`;
        } else {
            elements.zonalSelection.classList.add('hidden');
            state.currentZone = null;
        }
    } else {
        const region = page.regions.find(r => r.id === state.interactionTargetId);
        if (region && (state.interactionMode === 'draw' || state.interactionMode === 'resize')) {
            const xmin = Math.min(region.bbox.xmin, region.bbox.xmax), xmax = Math.max(region.bbox.xmin, region.bbox.xmax);
            const ymin = Math.min(region.bbox.ymin, region.bbox.ymax), ymax = Math.max(region.bbox.ymin, region.bbox.ymax);
            region.bbox = { xmin, ymin, xmax, ymax };
        }
    }

    state.interactionMode = null; state.interactionTargetId = null;
    renderOverlays(getCurrentPage());
    renderEditorPanel();
});

// --- Fusion Controls ---
elements.fuseOrientVert.addEventListener('click', () => { const p = getCurrentPage(); p.fusionOrientation = 'vertical'; refreshFusedComposite(p); renderEditorPanel(); });
elements.fuseOrientHoriz.addEventListener('click', () => { const p = getCurrentPage(); p.fusionOrientation = 'horizontal'; refreshFusedComposite(p); renderEditorPanel(); });
elements.fuseP1X.addEventListener('input', (e) => { const p = getCurrentPage(); p.sourcePages[0].x = parseInt(e.target.value); refreshFusedComposite(p); });
elements.fuseP1Y.addEventListener('input', (e) => { const p = getCurrentPage(); p.sourcePages[0].y = parseInt(e.target.value); refreshFusedComposite(p); });
elements.fuseP1Scale.addEventListener('input', (e) => { const p = getCurrentPage(); p.sourcePages[0].scale = parseFloat(e.target.value); refreshFusedComposite(p); });
elements.fuseP2X.addEventListener('input', (e) => { const p = getCurrentPage(); p.sourcePages[1].x = parseInt(e.target.value); refreshFusedComposite(p); });
elements.fuseP2Y.addEventListener('input', (e) => { const p = getCurrentPage(); p.sourcePages[1].y = parseInt(e.target.value); refreshFusedComposite(p); });
elements.fuseP2Scale.addEventListener('input', (e) => { const p = getCurrentPage(); p.sourcePages[1].scale = parseFloat(e.target.value); refreshFusedComposite(p); });

// --- Symbols ---
elements.openSymbolsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.symbolsModal.classList.toggle('hidden');
    renderSymbols();
});
elements.closeSymbolsModal.addEventListener('click', () => elements.symbolsModal.classList.add('hidden'));
