import * as pdfjs from "resource://zotero/reader/pdf/build/pdf.mjs";
/* global window */
import { WorkerMessageHandler } from "resource://zotero/reader/pdf/build/pdf.worker.mjs";
// Use Zotero's local worker implementation in this plugin window; no remote worker is fetched.
window.pdfjsWorker = { WorkerMessageHandler };
window.zclPDF = pdfjs;
