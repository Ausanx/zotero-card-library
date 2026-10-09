import * as pdfjs from "resource://zotero/reader/pdf/build/pdf.mjs";
/* global window */
// Parse PDFs off the UI thread using Zotero's installed local worker module.
const worker = new window.Worker(
  "resource://zotero/reader/pdf/build/pdf.worker.mjs",
  { type: "module" },
);
pdfjs.GlobalWorkerOptions.workerPort = worker;
window.addEventListener("unload", () => worker.terminate(), { once: true });
window.zclPDF = pdfjs;
