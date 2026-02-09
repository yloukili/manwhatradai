
import { state } from './state.js';
import { elements } from './elements.js';
import { blobToBase64, getImageDimensions, loadImage } from './utils.js';
import { analyzeImage } from './api.js';
import { renderOverlays } from './canvas.js';
import { renderEditorPanel } from './editor.js';
import { renderThumbnails } from './project.js';

export async function processPage(page, loadPageFn, sourceLanguage = null) {
    page.status = 'processing';
    if (state.currentPageId === page.id) elements.workspaceLoading.classList.remove('hidden');
    try {
        const result = await analyzeImage(page.imageUrl, sourceLanguage);
        page.regions = (result.regions || []).map((r, idx) => {
            let [y1, x1, y2, x2] = r.box_2d;
            const variants = r.translations || ["", "", ""];
            return {
                id: `r-${page.id}-${idx}-${Date.now()}`,
                bbox: { ymin: Math.min(y1, y2), xmin: Math.min(x1, x2), ymax: Math.max(y1, y2), xmax: Math.max(x1, x2) },
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
    } catch (e) {
        page.status = 'error';
        console.error("Processing error:", e);
    }
    if (state.currentPageId === page.id) {
        elements.workspaceLoading.classList.add('hidden');
        renderOverlays(page);
        renderEditorPanel();
    }
}

/**
 * Zonal OCR: Crops a section of the page and sends it to Gemini.
 * remaps coordinates back to the full page.
 */
export async function processZone(page, zoneBbox, sourceLanguage = null) {
    elements.workspaceLoading.classList.remove('hidden');
    try {
        const img = await loadImage(page.imageUrl);
        const canvas = document.createElement('canvas');

        // Convert 0-1000 coords to actual pixels
        const sx = (zoneBbox.xmin / 1000) * img.width;
        const sy = (zoneBbox.ymin / 1000) * img.height;
        const sw = ((zoneBbox.xmax - zoneBbox.xmin) / 1000) * img.width;
        const sh = ((zoneBbox.ymax - zoneBbox.ymin) / 1000) * img.height;

        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        const zoneDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const result = await analyzeImage(zoneDataUrl, sourceLanguage);

        const newRegions = (result.regions || []).map((r, idx) => {
            let [y1, x1, y2, x2] = r.box_2d;
            // Map 0-1000 relative-to-crop to 0-1000 relative-to-page
            const mapX = (x) => zoneBbox.xmin + (x * (zoneBbox.xmax - zoneBbox.xmin) / 1000);
            const mapY = (y) => zoneBbox.ymin + (y * (zoneBbox.ymax - zoneBbox.ymin) / 1000);

            const variants = r.translations || ["", "", ""];
            return {
                id: `r-zone-${Date.now()}-${idx}`,
                bbox: {
                    ymin: mapY(Math.min(y1, y2)),
                    xmin: mapX(Math.min(x1, x2)),
                    ymax: mapY(Math.max(y1, y2)),
                    xmax: mapX(Math.max(x1, x2))
                },
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

        page.regions.push(...newRegions);
        renderOverlays(page);
    } catch (e) {
        console.error("Zonal OCR Error:", e);
        alert("Zonal OCR failed.");
    } finally {
        elements.workspaceLoading.classList.add('hidden');
        elements.zonalSelection.classList.add('hidden');
        state.currentZone = null;
    }
}

export async function processPagesQueue(loadPageFn) {
    elements.processingIndicator.classList.remove('hidden');
    const lang = elements.languageSelect.value;
    const worker = async () => {
        let page;
        while ((page = state.pages.find(p => p.status === 'pending'))) {
            await processPage(page, loadPageFn, lang === 'auto' ? null : lang);
        }
    };
    await Promise.all([worker(), worker()]);
    elements.processingIndicator.classList.add('hidden');
}

export async function handleFiles(fileList, loadPageFn) {
    elements.loadingOverlay.classList.remove('hidden');
    elements.loadingMessage.innerText = "Scanning images...";
    try {
        const sorted = Array.from(fileList).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        for (let f of sorted) {
            if (f.type.startsWith('image/')) {
                const b64 = await blobToBase64(f);
                const dims = await getImageDimensions(b64);
                state.pages.push({
                    id: `p-${Date.now()}-${Math.random()}`,
                    filename: f.name,
                    imageUrl: b64,
                    ...dims,
                    regions: [],
                    status: 'pending'
                });
            }
        }
        elements.uploadView.classList.add('hidden');
        elements.editorView.classList.remove('hidden');
        renderThumbnails(loadPageFn);
        if (!state.currentPageId && state.pages.length > 0) {
            loadPageFn(state.pages[0].id);
        }
        processPagesQueue(loadPageFn);
    } catch (error) {
        alert(error.message);
    } finally {
        elements.loadingOverlay.classList.add('hidden');
    }
}
