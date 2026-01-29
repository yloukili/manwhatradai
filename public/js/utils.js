
export const VIETNAMESE_CHARS = "aàáảãạâầấẩẫậăằắẳẵặeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵdđ";
export const VIETNAMESE_CHARS_UPPER = VIETNAMESE_CHARS.toUpperCase();

export function toHexColor(color) {
    if (typeof color === "string" && color.trim().startsWith("#")) {
        return color.toUpperCase();
    }
    const match = color.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!match) return (color || "#FFFFFF").toUpperCase();
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function blobToBase64(blob) {
    return new Promise(res => { 
        const r = new FileReader(); 
        r.onload = () => res(r.result); 
        r.readAsDataURL(blob); 
    });
}

export function getImageDimensions(b64) {
    return new Promise(res => { 
        const i = new Image(); 
        i.onload = () => res({ width: i.width, height: i.height }); 
        i.src = b64; 
    });
}

export function loadImage(src) { 
    return new Promise((res, rej) => { 
        const i = new Image(); 
        i.crossOrigin = "anonymous"; 
        i.onload = () => res(i); 
        i.onerror = rej; 
        i.src = src; 
    }); 
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
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

export async function handleEyeDrop() {
    if (!window.EyeDropper) {
        alert("Your browser does not support the EyeDropper API.");
        return null;
    }
    const eyeDropper = new EyeDropper();
    try {
        const result = await eyeDropper.open();
        return toHexColor(result.sRGBHex);
    } catch (e) {
        return null;
    }
}
