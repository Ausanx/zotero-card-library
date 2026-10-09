import { config } from "../../package.json";
export function registerMenu(onOpen: () => void): () => void {
  const id = Zotero.MenuManager.registerMenu({
    menuID: "zcl-open-card-library",
    pluginID: config.addonID,
    target: "main/menubar/tools",
    menus: [
      {
        menuType: "menuitem",
        onShowing: (_event, context) => {
          context.menuElem?.setAttribute("label", "卡片式文献库");
        },
        onCommand: () => onOpen(),
      },
    ],
  });
  if (!id) throw new Error("Unable to register card library menu");
  return () => {
    Zotero.MenuManager.unregisterMenu(id);
  };
}
