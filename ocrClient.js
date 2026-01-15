const fetch = global.fetch;

async function runOCR(base64Image) {
  const response = await fetch("http://localhost:5005/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image })
  });

  const json = await response.json();

  if (!json.ok) throw new Error(json.error || "OCR failed");

  return json.regions;
}

module.exports = { runOCR };
