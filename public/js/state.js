
export const state = {
    pages: [],
    currentPageId: null,
    selectedRegionId: null,
    isProcessing: false,
    zoom: 1.0,
    // Interaction State
    interactionMode: null, // 'move', 'resize', 'draw', 'zone'
    interactionTargetId: null,
    startX: 0,
    startY: 0,
    startBbox: null,
    // UI State
    lastFocusedInput: null,
    draggedPageId: null,
    // Zonal State
    isZonalMode: false,
    currentZone: null // { xmin, ymin, xmax, ymax } (0-1000)
};

export function getCurrentPage() {
    return state.pages.find(p => p.id === state.currentPageId);
}

export function getSelectedRegion() {
    return getCurrentPage()?.regions.find(r => r.id === state.selectedRegionId);
}
