
export async function analyzeImage(imageUrl, sourceLanguage = null) {
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: imageUrl,
            sourceLanguage: sourceLanguage
        })
    });
    if (!response.ok) throw new Error("API analysis failed");
    return await response.json();
}

export async function translateText(text, type, sourceLanguage = null) {
    const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type, sourceLanguage })
    });
    if (!response.ok) throw new Error("API translation failed");
    return await response.json();
}
