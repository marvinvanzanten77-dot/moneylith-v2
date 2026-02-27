type ExtractResult = {
  text: string;
  note?: string;
};

const OCR_LANG = "eng+nld";

async function runOcr(input: string | Blob): Promise<string> {
  const tesseract = await import("tesseract.js");
  const createWorkerAny = (tesseract as any).createWorker;
  const worker = await createWorkerAny(OCR_LANG);

  try {
    const result = await worker.recognize(input);
    return result?.data?.text || "";
  } finally {
    try {
      await worker.terminate();
    } catch {
      // ignore terminate failures
    }
  }
}

export async function extractTextFromImageFile(file: File): Promise<ExtractResult> {
  const text = await runOcr(file);
  return { text, note: "OCR via afbeelding" };
}

async function extractTextLayerFromPdf(data: ArrayBuffer, maxPages: number): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  const { getDocument, GlobalWorkerOptions } = pdfjs as any;
  GlobalWorkerOptions.workerSrc = new URL(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.worker.min.js",
    import.meta.url
  ).toString();

  const doc = await getDocument({ data }).promise;
  const pageCount = Math.min(doc.numPages, maxPages);
  let text = "";
  for (let i = 1; i <= pageCount; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (item?.str ? String(item.str) : ""))
      .join(" ");
    text += `${pageText}\n`;
  }
  if (doc.numPages > pageCount) {
    text += `\n[PDF beperkt tot ${pageCount} pagina's]`;
  }
  return { text, pageCount };
}

async function extractPdfViaOcr(data: ArrayBuffer, maxPages: number): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  const { getDocument, GlobalWorkerOptions } = pdfjs as any;
  GlobalWorkerOptions.workerSrc = new URL(
    /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.worker.min.js",
    import.meta.url
  ).toString();

  const doc = await getDocument({ data }).promise;
  const pageCount = Math.min(doc.numPages, maxPages);
  let text = "";

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    const pageText = await runOcr(dataUrl);
    text += `${pageText}\n`;
  }

  return text;
}

export async function extractTextFromPdfFile(file: File, options?: { maxPages?: number }): Promise<ExtractResult> {
  const maxPages = options?.maxPages ?? 6;
  const data = await file.arrayBuffer();

  const textLayer = await extractTextLayerFromPdf(data, maxPages);
  const normalized = textLayer.text.replace(/\s+/g, " ").trim();
  if (normalized.length >= 120) {
    return { text: textLayer.text, note: "PDF-tekstextractie uitgevoerd" };
  }

  const ocrText = await extractPdfViaOcr(data, maxPages);
  return {
    text: ocrText,
    note: "PDF had weinig selecteerbare tekst; OCR fallback toegepast",
  };
}
