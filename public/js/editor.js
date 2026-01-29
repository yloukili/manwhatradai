
import { state, getCurrentPage, getSelectedRegion } from './state.js';
import { elements } from './elements.js';
import { renderOverlays, syncWorkAreaSize } from './canvas.js';
import { loadImage, VIETNAMESE_CHARS, VIETNAMESE_CHARS_UPPER } from './utils.js';
import { renderThumbnails } from './project.js';

export function loadPage(pageId) {
    state.currentPageId = pageId;
    const page = getCurrentPage();
    if (!page) return;
    elements.mainImage.src = page.imageUrl;
    elements.pageTitle.innerText = `Page ${state.pages.indexOf(page) + 1}`;
    elements.pageFilename.innerText = page.filename;
    elements.fusedActions.classList.toggle('hidden', !page.isFused);
    syncWorkAreaSize();
    renderThumbnails(loadPage);
    renderOverlays(page);
    renderEditorPanel();
}

export function updateRegionProp(key, val) {
    const region = getSelectedRegion();
    if (region) {
        region[key] = val;
        renderOverlays(getCurrentPage());
    }
}

export function renderEditorPanel() {
    const page = getCurrentPage();
    const region = getSelectedRegion();
    
    elements.emptySelectionMsg.classList.add('hidden');
    elements.regionEditor.classList.add('hidden');
    elements.fusionEditor.classList.add('hidden');

    if (region) {
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
    } else if (page?.isFused) {
        elements.fusionEditor.classList.remove('hidden');
        const [p1, p2] = page.sourcePages;
        elements.fuseP1X.value = p1.x;
        elements.fuseP1Y.value = p1.y;
        elements.fuseP1Scale.value = p1.scale;
        elements.fuseP2X.value = p2.x;
        elements.fuseP2Y.value = p2.y;
        elements.fuseP2Scale.value = p2.scale;
        const isVert = page.fusionOrientation === 'vertical';
        elements.fuseOrientVert.className = `flex-1 py-2 rounded-md text-xs font-bold transition-all ${isVert ? 'bg-slate-700 text-white' : 'text-slate-400'}`;
        elements.fuseOrientHoriz.className = `flex-1 py-2 rounded-md text-xs font-bold transition-all ${!isVert ? 'bg-slate-700 text-white' : 'text-slate-400'}`;
    } else {
        elements.emptySelectionMsg.classList.remove('hidden');
    }
    if (window.lucide) window.lucide.createIcons();
}

export async function refreshFusedComposite(page) {
    const [p1, p2] = page.sourcePages;
    const i1 = await loadImage(p1.imageUrl);
    const i2 = await loadImage(p2.imageUrl);
    const canvas = document.createElement('canvas');
    const isVert = page.fusionOrientation === 'vertical';

    if (isVert) {
        canvas.width = Math.max(i1.width * p1.scale, i2.width * p2.scale);
        canvas.height = (i1.height * p1.scale) + (i2.height * p2.scale);
    } else {
        canvas.width = (i1.width * p1.scale) + (i2.width * p2.scale);
        canvas.height = Math.max(i1.height * p1.scale, i2.height * p2.scale);
    }

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw P1
    ctx.drawImage(i1, p1.x, p1.y, i1.width * p1.scale, i1.height * p1.scale);
    
    // Draw P2 relative to P1
    let x2 = p2.x, y2 = p2.y;
    if (isVert) y2 += (i1.height * p1.scale);
    else x2 += (i1.width * p1.scale);
    ctx.drawImage(i2, x2, y2, i2.width * p2.scale, i2.height * p2.scale);

    page.imageUrl = canvas.toDataURL('image/jpeg', 0.95);
    page.width = canvas.width;
    page.height = canvas.height;
    
    if (state.currentPageId === page.id) {
        elements.mainImage.src = page.imageUrl;
        syncWorkAreaSize();
        renderOverlays(page);
    }
}

export function renderSymbols() {
    elements.symbolsGrid.innerHTML = '';
    const allSymbols = (VIETNAMESE_CHARS + VIETNAMESE_CHARS_UPPER).split('');
    allSymbols.forEach(char => {
        const btn = document.createElement('button'); 
        btn.className = 'symbol-btn'; 
        btn.innerText = char;
        btn.onclick = (e) => {
            e.stopPropagation();
            const input = state.lastFocusedInput || elements.translationInput;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const val = input.value;
            input.value = val.slice(0, start) + char + val.slice(end);
            input.focus(); 
            input.setSelectionRange(start + 1, start + 1);
            if (input === elements.originalTextInput) updateRegionProp('originalText', input.value);
            else updateRegionProp('userTranslation', input.value);
        };
        elements.symbolsGrid.appendChild(btn);
    });
}
