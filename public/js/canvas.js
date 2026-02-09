
import { state, getCurrentPage } from './state.js';
import { elements } from './elements.js';
import { renderEditorPanel } from './editor.js';

export function syncWorkAreaSize() {
    if (!elements.mainImage.complete || elements.mainImage.naturalWidth === 0) return;
    const zoom = state.zoom || 1.0;
    const w = Math.round(elements.mainImage.naturalWidth * zoom);
    const h = Math.round(elements.mainImage.naturalHeight * zoom);
    elements.workArea.style.width = `${w}px`;
    elements.workArea.style.height = `${h}px`;
    elements.mainImage.style.width = '100%';
    elements.mainImage.style.height = '100%';
}

export function renderOverlays(page) {
    if (!page) return;
    elements.overlaysLayer.innerHTML = '';
    const layerRect = elements.overlaysLayer.getBoundingClientRect();

    page.regions.forEach(region => {
        const div = document.createElement('div');
        div.dataset.id = region.id;
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

        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        div.appendChild(handle);
        elements.overlaysLayer.appendChild(div);
    });
}

export function handleMouseDown(e) {
    const rect = elements.workArea.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    const page = getCurrentPage();
    if (!page) return;

    // Reset zone confirm if active
    elements.zoneConfirmMenu.classList.add('hidden');

    if (state.isZonalMode) {
        state.interactionMode = 'zone';
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.startBbox = { xmin: x, ymin: y, xmax: x, ymax: y };
        state.currentZone = { ...state.startBbox };
        elements.zonalSelection.classList.remove('hidden');
        elements.zonalSelection.style.top = `${y / 10}%`;
        elements.zonalSelection.style.left = `${x / 10}%`;
        elements.zonalSelection.style.width = '0%';
        elements.zonalSelection.style.height = '0%';
        return;
    }

    // Resize handle detection
    if (e.target.classList.contains('resize-handle')) {
        const regionDiv = e.target.parentElement;
        const regionId = regionDiv.dataset.id;
        const region = page.regions.find(r => r.id === regionId);
        if (region) {
            e.stopPropagation();
            state.interactionMode = 'resize';
            state.interactionTargetId = region.id;
            state.startX = e.clientX;
            state.startY = e.clientY;
            state.startBbox = { ...region.bbox };
            return;
        }
    }

    // Existing bubble detection
    const regionBox = e.target.closest('.region-box');
    if (regionBox) {
        const regionId = regionBox.dataset.id;
        const region = page.regions.find(r => r.id === regionId);
        if (region) {
            e.stopPropagation();
            state.selectedRegionId = region.id;
            state.interactionMode = 'move';
            state.interactionTargetId = region.id;
            state.startX = e.clientX;
            state.startY = e.clientY;
            state.startBbox = { ...region.bbox };

            document.querySelectorAll('.region-box').forEach(el => el.classList.remove('selected'));
            regionBox.classList.add('selected');
            renderEditorPanel();
            return;
        }
    }

    // Create new bubble (if not in zonal mode)
    if (e.target === elements.overlaysLayer) {
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
        page.regions.push(newRegion);
        state.selectedRegionId = newRegionId;
        state.interactionMode = 'draw';
        state.interactionTargetId = newRegionId;
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.startBbox = { ...newRegion.bbox };
        renderOverlays(page);
        renderEditorPanel();
    }
}
