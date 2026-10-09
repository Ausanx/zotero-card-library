import type { StateIO } from "./state-store";
export function getStateDirectory(): string {
  return PathUtils.join(
    Zotero.getProfileDirectory().path,
    "zotero-card-library",
  );
}
export function getStatePath(): string {
  return PathUtils.join(getStateDirectory(), "state.json");
}
export function createZoteroStateIO(): StateIO {
  return {
    read: (path) => IOUtils.readUTF8(path),
    async write(path, contents) {
      await IOUtils.makeDirectory(PathUtils.parent(path)!, {
        ignoreExisting: true,
      });
      await IOUtils.writeUTF8(path, contents, { tmpPath: `${path}.write` });
    },
    async replace(tempPath, targetPath) {
      await IOUtils.move(tempPath, targetPath, { noOverwrite: false });
    },
  };
}
