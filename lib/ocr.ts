// Real OCR using Tesseract.js — runs entirely in the browser.
// No file bytes leave the device. Workers and language data are loaded
// from a CDN on first use.

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    const { createWorker } = await import('tesseract.js');
    workerPromise = createWorker(['eng'], 1, { logger: () => {} });
  }
  return workerPromise;
}

export type OcrProgress = (pct: number) => void;

export async function ocrImage(file: File | Blob, onProgress?: OcrProgress): Promise<string> {
  const worker = await getWorker();
  onProgress?.(10);
  const { data } = await worker.recognize(file);
  onProgress?.(100);
  return data.text.trim();
}

// Render PDF pages to canvas using pdf.js, then OCR each page.
// Uses a CDN-hosted worker to avoid bundler resolution issues.
export async function ocrPdf(file: File, onProgress?: OcrProgress): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdfjs: typeof import('pdfjs-dist') = await import('pdfjs-dist');
  // Pin the worker to the exact version installed to avoid API mismatches.
  const version = pdfjs.version;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  const loadingTask = pdfjs.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  let fullText = '';
  const numPages = Math.min(pdf.numPages, 20);
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    // pdfjs v4 render params differ slightly; use `as any` to stay compatible.
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), 'image/png')
    );
    fullText += await ocrImage(blob) + '\n\n';
    onProgress?.(Math.round((i / numPages) * 100));
  }
  return fullText.trim();
}