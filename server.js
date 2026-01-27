// server.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const sharp = require("sharp");
const Jimp = require("jimp");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = process.env.PORT || 3000;

// ===============================
// CONFIG
// ===============================
const JOBS_DIR = path.join(__dirname, "tmp", "jobs");
fs.mkdirSync(JOBS_DIR, { recursive: true });

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.LOCAL_MODEL || "mistral";

const OCR_URL = process.env.OCR_URL || "http://localhost:5005/ocr";

// ===============================
// QUEUE SYSTEM
// ===============================
const queue = [];
let processing = false;

function enqueue(job) {
  return new Promise((resolve) => {
    queue.push({ ...job, resolve });
    processQueue();
  });
}

async function processQueue() {
  if (processing || queue.length === 0) return;

  processing = true;
  const job = queue.shift();

  try {
    const result = await processAnalyzeJob(job);
    job.resolve(result);
  } catch (err) {
    console.error("Job failed:", err);
    job.resolve({ ok: false, error: err.message });
  }

  processing = false;
  setTimeout(processQueue, 10);
}

// ===============================
// HELPERS
// ===============================
function splitIntoChunks(arr, size = 6) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function polygonToBox(p) {
  const xs = p.map((pt) => pt[0]);
  const ys = p.map((pt) => pt[1]);

  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);

  return [ymin, xmin, ymax, xmax];
}

// Try to repair JSON from LLM
function attemptJSONRepair(str) {
  let fixed = str.replace(/[\u0000-\u001F]+/g, "");
  const first = fixed.indexOf("[");
  const last = fixed.lastIndexOf("]");
  if (first !== -1 && last !== -1) {
    fixed = fixed.substring(first, last + 1);
    try {
      return JSON.parse(fixed);
    } catch (_) {}
  }
  throw new Error("Could not repair JSON");
}

// ===============================
// OCR → Regions builder
// ===============================
function buildRegionsFromOCR(raw) {
  const out = [];

  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    console.warn("⚠ OCR raw format empty");
    return out;
  }

  const item = raw[0];
  const polys = item.rec_polys || [];
  const texts = item.rec_texts || [];

  if (polys.length !== texts.length) {
    console.warn("⚠ Poly/text mismatch:", polys.length, texts.length);
  }

  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i];
    const text = texts[i] || "";

    if (!Array.isArray(poly) || poly.length === 0) continue;

    const box_2d = polygonToBox(poly);
    out.push({
      box_2d,
      original: text,
      translation: "",
      type: "dialogue"
    });
  }

  return out;
}

// ===============================
// Chunked Mistral translator (super stable)
// ===============================
async function mistralTranslate(jobId, regions) {
  const CHUNK_SIZE = 6;
  const chunks = splitIntoChunks(regions, CHUNK_SIZE);
  const finalOutput = [];
  console.log(chunks);
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];

    const itemsText = chunk
      .map((r, idx) => {
        return `
ITEM ${idx + 1}
TEXT: ${r.original}
BBOX: ${JSON.stringify(r.box_2d)}
`.trim();
      })
      .join("\n\n");

    const prompt = `
You translate OCR text extracted from comics.

For EACH item, return an element of a JSON array with the form:
{
 "box_2d": [ymin, xmin, ymax, xmax],
 "original": "...",
 "translations": ["...", "..."],
 "type": "dialogue" | "narration" | "sfx"
}

Strict rules:
- RETURN ONLY a JSON ARRAY.
- NO explanations.
- NO extra text.
- NO comments.
- translation language is always english.
- Translation fields must only contain the translation, nothing more. 
- Each translation must come in 3 variants: 
  . Literal
  . Semantic variant of literal
  . stylistic variant of literal 

ITEMS:
${itemsText}
`;

    const body = {
      model: OLLAMA_MODEL,
      prompt,
      stream: false
    };

    console.log(`🔵 Calling Mistral chunk ${ci + 1}/${chunks.length}`);

    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error("Ollama returned " + res.status);
    }

    const json = await res.json();
    let txt = json.response;
    console.log(txt);
    let arr;
    try {
      arr = JSON.parse(txt);
    } catch {
      console.warn("⚠ Invalid JSON → attempting repair");
      arr = attemptJSONRepair(txt);
    }

    finalOutput.push(...arr);
  }

  return { ok: true, regions: finalOutput };
}

// ===============================
// ANALYZE JOB
// ===============================
async function processAnalyzeJob({ jobId, debug }) {
  const jobDir = path.join(JOBS_DIR, jobId);
  const base64 = fs.readFileSync(path.join(jobDir, "input.base64"), "utf8");
  const imgBuffer = Buffer.from(base64, "base64");

  // ---------- 1) SEND TO OCR SERVICE ----------
  const response = await fetch(OCR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, debug })
  });

  if (!response.ok) {
    throw new Error("OCR service returned " + response.status);
  }

  const ocrResult = await response.json();
  if (!ocrResult.ok) {
    throw new Error("OCR error: " + ocrResult.error);
  }

  const regions = ocrResult.regions || [];

  // ---------- DEBUG ----------
  if (debug) {
    fs.writeFileSync(path.join(jobDir, "ocr.debug.json"), JSON.stringify(ocrResult, null, 2));
  }

  // ---------- 2) TRANSLATE VIA MISTRAL ----------
  const mistralResult = await mistralTranslate(jobId, regions);

  // ---------- DEBUG ----------
  if (debug) {
    fs.writeFileSync(path.join(jobDir, "mistral.final.json"), JSON.stringify(mistralResult, null, 2));
  }

  return mistralResult;
}

// ===============================
// API ROUTES
// ===============================
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analyze", async (req, res) => {
  try {
    const { image, debug } = req.body;
    if (!image) return res.status(400).json({ ok: false, error: "Missing image" });

    const jobId = uuidv4();
    const jobDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const cleanBase64 = image.replace(/^data:.*;base64,/, "");
    fs.writeFileSync(path.join(jobDir, "input.base64"), cleanBase64);

    const result = await enqueue({ jobId, debug });
    return res.json(result);

  } catch (err) {
    console.error("Analyze error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


// ===============================
// RENDER API
// ===============================
app.post("/api/render", async (req, res) => {
  try {
    const { image, regions } = req.body;

    if (!image) return res.status(400).json({ error: "image required" });
    if (!regions || !Array.isArray(regions)) return res.status(400).json({ error: "regions[] required" });

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");
    const inputBuffer = Buffer.from(cleanBase64, "base64");

    const jimpImg = await Jimp.read(inputBuffer);

    for (const reg of regions) {
      if (reg.keep_original_text) continue;

      const [ymin, xmin, ymax, xmax] = reg.box_2d.map((n) => Math.round(n));
      const pad = 12;

      const w = (xmax - xmin) + pad * 2;
      const h = (ymax - ymin) + pad * 2;

      const overlay = new Jimp(w, h, 0xffffffff);
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

      overlay.print(
        font,
        0,
        0,
        { text: reg.translation || "", alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE },
        w,
        h
      );

      jimpImg.composite(overlay, xmin - pad, ymin - pad);
    }

    const finalBuffer = await jimpImg.getBufferAsync(Jimp.MIME_PNG);

    res.json({
      ok: true,
      image: `data:image/png;base64,${finalBuffer.toString("base64")}`
    });

  } catch (err) {
    console.error("/api/render error:", err);
    res.status(500).json({ error: err.message });
  }
});


// New Endpoint for Text-Only Translation
app.post('/api/translate', async (req, res) => {
    try {
        const { text, type } = req.body;

        if (!text) return res.status(400).json({ error: "No text provided" });
        let prompt = `
        You are a professional translator, you handle OCR texts extracted from comics. Translate the provided text into natural, immersive English. 
        The expected return format is a JSON object with the form:
        {
          "translations": ["...", "...", "..."],
          "type": "dialogue" | "narration" | "sfx"
        }
          Strict rules:
          - RETURN ONLY a JSON OBJECT, .
          - NO explanations.
          - NO extra text.
          - NO comments.
          - translation language is always english.
          - Translation fields must only contain the translation, nothing more. 
          - Each translation must come in 3 variants: 
            . Literal a strict traduction of the orifinal text
            . Semantic variant of literal
            . stylistic variant of literal 

        Translate this: "${text}"`;

      const body = {
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      };

      console.log(`🔵 Calling Mistral`);

      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error("Ollama returned " + response.status);
      }

      const json = await response.json();
      let txt = json.response;
      console.log(txt);
      res.json(txt);

    } catch (error) {
        console.error("Translation Error:", error);
        res.status(500).json({ error: "Translation failed" });
    }
});


// ===============================
// SERVER
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Open http://localhost:${port}`);
});
