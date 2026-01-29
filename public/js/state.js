
export const state = {
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
    lastFocusedInput: null,
    draggedPageId: null
};

export function getCurrentPage() { 
    return state.pages.find(p => p.id === state.currentPageId); 
}

export function getSelectedRegion() { 
    return getCurrentPage()?.regions.find(r => r.id === state.selectedRegionId); 
}
