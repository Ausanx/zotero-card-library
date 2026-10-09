import { CoverService } from "./cover-service";
import { createPdfAdapter, type PdfDocumentLike } from "./pdf-adapter";
import { getStateDirectory } from "../data/zotero-state-io";
export function createZoteroCoverService(window: Window): CoverService {
  const win = window as any;
  if (!win.zclPDF) throw new Error("Bundled PDF.js did not load");
  let current: { id: number; stamp: string; document: PdfDocumentLike } | null =
    null;
  let disposed = false;
  const metadata = async (id: number) => {
    const attachment = Zotero.Items.get(id);
    const path = await attachment?.getFilePathAsync();
    if (!path) throw new Error("Local PDF unavailable");
    const stat = await IOUtils.stat(path);
    return { path, stamp: `${path}:${stat.size}:${stat.lastModified}` };
  };
  const load = async (id: number): Promise<PdfDocumentLike> => {
    if (disposed) throw new Error("PDF service closed");
    const { path, stamp } = await metadata(id);
    if (current?.id === id && current.stamp === stamp) return current.document;
    if (current) {
      await current.document.destroy?.();
      current = null;
    }
    const data = await IOUtils.read(path);
    const task = win.zclPDF.getDocument({
      data: new win.Uint8Array(data),
      cMapUrl: "resource://zotero/reader/pdf/web/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "resource://zotero/reader/pdf/web/standard_fonts/",
      wasmUrl: "resource://zotero/reader/pdf/web/wasm/",
      isEvalSupported: false,
    });
    const pdf = await task.promise;
    if (disposed) {
      await pdf.destroy();
      throw new Error("PDF service closed");
    }
    current = { id, stamp, document: pdf };
    return pdf;
  };
  const cacheDirectory = PathUtils.join(getStateDirectory(), "covers");
  const pathFor = async (key: string) => {
    const bytes = new win.TextEncoder().encode(key);
    const digest = await win.crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new win.Uint8Array(digest) as Uint8Array)
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    return PathUtils.join(cacheDirectory, `${hash}.json`);
  };
  return new CoverService({
    pdf: createPdfAdapter(load, () => window.document),
    fingerprint: async (id) => (await metadata(id)).stamp,
    pageCount: async (id) => (await load(id)).numPages,
    cache: {
      async read(key) {
        try {
          return await IOUtils.readUTF8(await pathFor(key));
        } catch {
          return null;
        }
      },
      async write(key, value) {
        if (disposed) return;
        await IOUtils.makeDirectory(cacheDirectory, { ignoreExisting: true });
        const path = await pathFor(key);
        await IOUtils.writeUTF8(path, value, { tmpPath: `${path}.tmp` });
      },
    },
    dispose: () => {
      disposed = true;
      void current?.document.destroy?.();
      current = null;
    },
  });
}
