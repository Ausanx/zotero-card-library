import { exportBackup, importBackup } from "./state-store";
import type { PluginState } from "../domain/types";
async function chooseFile(
  window: Window,
  save: boolean,
): Promise<string | null> {
  const picker: nsIFilePicker = (Components.classes as any)[
    "@mozilla.org/filepicker;1"
  ].createInstance(Components.interfaces.nsIFilePicker);
  picker.init(
    window.browsingContext,
    save ? "导出卡片库备份" : "导入卡片库备份",
    save ? picker.modeSave! : picker.modeOpen!,
  );
  picker.appendFilter("JSON", "*.json");
  if (save) {
    picker.defaultString = "zotero-card-library-backup.json";
    picker.defaultExtension = "json";
  }
  const result = await new Promise<number>((resolve) => picker.open(resolve));
  return result === picker.returnCancel ? null : picker.file?.path || null;
}
export async function exportStateFile(
  window: Window,
  state: PluginState,
): Promise<void> {
  const path = await chooseFile(window, true);
  if (path)
    await IOUtils.writeUTF8(path, exportBackup(state), {
      tmpPath: `${path}.tmp`,
    });
}
export async function importStateFile(
  window: Window,
): Promise<PluginState | null> {
  const path = await chooseFile(window, false);
  return path ? importBackup(await IOUtils.readUTF8(path)) : null;
}
