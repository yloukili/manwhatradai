
import { state, getCurrentPage } from './state.js';
import { elements } from './elements.js';
import { loadImage, wrapText } from './utils.js';
import { processPagesQueue } from './processing.js';

export function renderThumbnails(onPageLoad) {
    elements.thumbnailsContainer.innerHTML = '';
    state.pages.forEach((page, idx) => {
        const btn = document.createElement('div');
        btn.dataset.id = page.id;
        btn.dataset.index = idx;
        btn.draggable = true;
        btn.className = `thumbnail-btn w-16 h-24 mb-4 rounded-lg overflow-hidden border-2 relative shrink-0 transition-all ${page.id === state.currentPageId ? 'border-indigo-500 opacity-100' : 'border-slate-700 opacity-60'}`;
        
        const img = document.createElement('img');
        img.src = page.imageUrl;
        img.className = 'w-full h-full object-cover pointer-events-none';
        btn.appendChild(img);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-page-btn absolute top-1 right-1 w-5 h-5 bg-red-600/80 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-10';
        removeBtn.innerHTML = '<i data-lucide="x" class="w-3 h-3"></i>';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm("Remove this page from project?")) {
                state.pages.splice(idx, 1);
                if (state.currentPageId === page.id) {
                    if (state.pages.length > 0) onPageLoad(state.pages[Math.min(idx, state.pages.length - 1)].id);
                    else {
                        elements.editorView.classList.add('hidden');
                        elements.uploadView.classList.remove('hidden');
                        state.currentPageId = null;
                    }
                } else renderThumbnails(onPageLoad);
            }
        };
        btn.appendChild(removeBtn);

        // Drag & Drop
        btn.ondragstart = (e) => { 
            state.draggedPageId = page.id; 
            btn.classList.add('dragging'); 
            e.dataTransfer.effectAllowed = 'move'; 
        };
        btn.ondragend = () => { 
            btn.classList.remove('dragging'); 
            state.draggedPageId = null; 
            document.querySelectorAll('.thumbnail-btn').forEach(el => el.classList.remove('drag-over')); 
        };
        btn.ondragover = (e) => { e.preventDefault(); btn.classList.add('drag-over'); };
        btn.ondragleave = () => btn.classList.remove('drag-over');
        btn.ondrop = (e) => { 
            e.preventDefault(); 
            const fromId = state.draggedPageId; 
            if (fromId && fromId !== page.id) {
                const fromIdx = state.pages.findIndex(p => p.id === fromId);
                const toIdx = state.pages.findIndex(p => p.id === page.id);
                const [moved] = state.pages.splice(fromIdx, 1);
                state.pages.splice(toIdx, 0, moved);
                renderThumbnails(onPageLoad);
            }
        };

        btn.onclick = () => onPageLoad(page.id);
        elements.thumbnailsContainer.appendChild(btn);
    });
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Saves the project as a .mhs file. 
 * Prefers showSaveFilePicker if available.
 */
export async function handleSaveProject() {
    const title = elements.projectTitleInput.value.trim() || `project-${new Date().toISOString().slice(0,10)}`;
    const content = JSON.stringify({ version: "1.0", title, pages: state.pages });
    const blob = new Blob([content], { type: "application/json" });

    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: title + ".mhs",
                types: [{
                    description: 'ManhwaSync Project',
                    accept: { 'application/json': ['.mhs'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error("Save picker failed, falling back", e);
        }
    }
    // Fallback to FileSaver.js
    saveAs(blob, title + ".mhs");
}

/**
 * Handles the file input event for loading a .mhs project.
 */
export function handleLoadProjectFile(event, onPageLoad) {
    const file = event.target.files[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.pages) throw new Error("Invalid project format");
            
            state.pages = data.pages;
            elements.projectTitleInput.value = data.title || file.name.replace(".mhs", "");
            
            elements.uploadView.classList.add('hidden');
            elements.editorView.classList.remove('hidden');
            
            renderThumbnails(onPageLoad);
            if (state.pages.length > 0) {
                onPageLoad(state.pages[0].id);
                processPagesQueue(onPageLoad);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to load project file. Ensure it is a valid .mhs file.");
        }
        // Reset so user can re-import the same file if needed
        elements.projectInput.value = '';
    };
    reader.readAsText(file);
}

export async function handleExport() {
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

async function renderPageToBlob(page) {
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
            if (r.shape === 'rect') { 
                if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 8); 
                else ctx.rect(rx, ry, rw, rh); 
            } else {
                ctx.ellipse(rx + rw/2, ry + rh/2, Math.abs(rw/2), Math.abs(rh/2), 0, 0, 2 * Math.PI);
            }
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
    return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
}
