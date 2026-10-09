import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

if (!(basicTool.getGlobal("Zotero") as Record<string, any>)[config.addonInstance]) {
  _globalThis.addon = new Addon();
  (Zotero as any)[config.addonInstance] = addon;
}
