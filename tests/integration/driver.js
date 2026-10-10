// Runs only in a disposable Zotero profile prepared by run-zotero.mjs.
/* global Zotero, IOUtils, Services, Components, ChromeUtils, PathUtils, atob, __RESULT_PATH__, __FIXTURE_PATHS__, __MISSING_PATH__, __SCREENSHOT_PATH__, __DETAIL_SCREENSHOT_PATH__, __COMPACT_SCREENSHOT_PATH__, __DARK_SCREENSHOT_PATH__ */
/* exported startup, shutdown, install, uninstall */
var resultPath;
const { setTimeout } = ChromeUtils.importESModule(
  "resource://gre/modules/Timer.sys.mjs",
);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function startup() {
  void runAcceptance();
}
async function runAcceptance() {
  resultPath = __RESULT_PATH__;
  const results = [];
  let cardWindow;
  const windowEvents = [];
  const report = async (data) =>
    IOUtils.writeUTF8(
      resultPath,
      JSON.stringify({ ...data, results }, null, 2),
    );
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push(message);
  };
  try {
    await report({ status: "running", step: "initialize Zotero" });
    await Zotero.initializationPromise;
    await Zotero.uiReadyPromise;
    Services.io.offline = true;
    await report({ status: "running", step: "create fixtures" });
    for (let i = 0; i < 100 && !Zotero.ZoteroCardLibrary?.data.initialized; i++)
      await wait(100);
    assert(
      Zotero.ZoteroCardLibrary?.data.initialized,
      "plugin initialized in Zotero 9.0.6",
    );
    const collection = new Zotero.Collection();
    collection.name = "Research";
    await collection.saveTx();
    const targets = [];
    for (let i = 0; i < 238; i++) {
      const item = new Zotero.Item("journalArticle");
      item.setField(
        "title",
        i < 6
          ? [
              "An integrated framework for sensing and signal analysis",
              "Local imaging of complex experimental systems",
              "Methods without a figure: a controlled reference",
              "A study with an unavailable linked attachment",
              "Multi-PDF source selection in experimental literature",
              "Long-term observations of adaptive systems and their applications",
            ][i]
          : `Research paper ${String(i + 1).padStart(3, "0")}`,
      );
      item.setField(
        "publicationTitle",
        i % 2 ? "Science Advances" : "Nature Methods",
      );
      item.setField("date", "2025");
      item.setField("DOI", `10.1234/test${i}`);
      item.setField(
        "abstractNote",
        "This synthetic record exercises the local card library. No real library data is used.",
      );
      item.setField(
        "extra",
        "remark: 自动识别的简记：卡片窗口保留完整的文献浏览上下文。\nCitation Key: fixture",
      );
      item.setCreators([
        { firstName: "Ada", lastName: "Lovelace", creatorType: "author" },
      ]);
      item.addTag(i % 2 ? "成像系统" : "传感材料");
      if (i < 6) item.addToCollection(collection.id);
      await item.saveTx();
      if (i < 6) targets.push(item);
    }
    const legacyRemark = new Zotero.Item("note");
    legacyRemark.parentID = targets[1].id;
    legacyRemark.setNote("<p>旧版简记 &amp; 正文</p><p>第二行</p>");
    legacyRemark.addTag("remark");
    await legacyRemark.saveTx();
    targets[1].setField("extra", "Citation Key: legacy-fixture");
    await targets[1].saveTx();
    const paths = __FIXTURE_PATHS__;
    const attachments = [];
    for (let i = 0; i < 6; i++) {
      const attachment = await Zotero.Attachments.linkFromFile({
        file: paths[
          i === 2 ? "no-figure" : i === 1 ? "two-column" : "figure-caption"
        ],
        parentItemID: targets[i].id,
      });
      attachments.push(attachment);
    }
    const missing = attachments[3];
    missing.attachmentPath = __MISSING_PATH__;
    await missing.saveTx();
    const alternate = await Zotero.Attachments.linkFromFile({
      file: paths["two-column"],
      parentItemID: targets[4].id,
    });
    await report({ status: "running", step: "open card window" });
    const window = Zotero.ZoteroCardLibrary.api.openCardLibrary();
    cardWindow = window;
    for (const type of ["load", "unload"])
      window.addEventListener(
        type,
        (event) =>
          windowEvents.push({
            type,
            target: event.target?.URL,
            closed: window.closed,
          }),
        true,
      );
    for (let i = 0; i < 200 && !window.document.querySelector(".zcl-card"); i++)
      await wait(100);
    const d = window.document;
    [...d.querySelectorAll(".zcl-scope-button")]
      .find((node) => node.textContent === "全部文献")
      .click();
    assert(
      d.querySelectorAll(".zcl-card").length === 238,
      "238 metadata cards rendered",
    );
    assert(
      Zotero.ZoteroCardLibrary.api.openCardLibrary() === window,
      "repeated menu activation reuses the window",
    );
    const research = [...d.querySelectorAll(".zcl-scope-button")].find(
      (n) => n.textContent === "Research",
    );
    research.click();
    assert(
      d.querySelectorAll(".zcl-card").length === 6,
      "collection filter displays six matching papers",
    );
    await report({ status: "running", step: "wait for real PDF covers" });
    for (
      let i = 0;
      i < 300 && d.querySelectorAll(".zcl-card-cover img").length < 5;
      i++
    )
      await wait(100);
    const coverCount = d.querySelectorAll(".zcl-card-cover img").length;
    assert(coverCount === 5, `five local PDF covers rendered (${coverCount})`);
    assert(
      window.zclPDF.GlobalWorkerOptions.workerPort instanceof window.Worker,
      "PDF parsing uses a real background Worker",
    );
    const card = (id) => d.querySelector(`[data-item-id="${id}"]`);
    assert(
      card(targets[3].id).textContent.includes("不可用"),
      "missing linked PDF preserves its metadata card",
    );
    const boardWidth = d
      .getElementById("zcl-main")
      .getBoundingClientRect().width;
    card(targets[0].id).click();
    const detailWindow = Zotero.ZoteroCardLibrary.controller.detailWindow;
    for (
      let i = 0;
      i < 200 && !detailWindow.document.querySelector(".zcl-detail-title");
      i++
    )
      await wait(100);
    const dd = detailWindow.document;
    assert(
      !dd.querySelector(".zcl-candidate") &&
        dd.querySelector('[data-action="load-candidates"]'),
      "detail metadata opens without generating candidate previews",
    );
    assert(
      dd
        .querySelector(".zcl-detail-metadata")
        .textContent.includes("自动识别的简记"),
      "Style Extra remark appears without field configuration",
    );
    card(targets[1].id).click();
    assert(
      dd
        .querySelector(".zcl-detail-metadata")
        .textContent.includes("旧版简记 & 正文\n第二行"),
      "legacy remark-tagged notes preserve text and decode HTML entities",
    );
    card(targets[0].id).click();
    dd.querySelector('[data-action="load-candidates"]').click();
    for (let i = 0; i < 200 && !dd.querySelector(".zcl-candidate"); i++)
      await wait(100);
    assert(
      detailWindow !== window && !detailWindow.closed,
      "card opens a separate native detail window",
    );
    assert(
      !!dd.querySelector(".zcl-candidate"),
      "real bundled PDF.js finds an internal Figure candidate",
    );
    assert(
      dd
        .querySelector(".zcl-detail-view")
        .textContent.includes("10.1234/test0"),
      "detail window renders DOI",
    );
    assert(
      d.getElementById("zcl-main").getBoundingClientRect().width ===
        boardWidth && !d.querySelector(".zcl-detail-view"),
      "detail window preserves full board width",
    );
    dd.querySelector(".zcl-candidate").click();
    await wait(500);
    const statePath = PathUtils.join(
      Zotero.getProfileDirectory().path,
      "zotero-card-library",
      "state.json",
    );
    let state = JSON.parse(await IOUtils.readUTF8(statePath));
    assert(
      state.items[targets[0].id].cover.source === "candidate",
      "internal candidate reference is persisted",
    );
    assert(
      state.items[targets[2].id].cover.source === "first-page",
      "no-figure PDF falls back to first page",
    );
    card(targets[0].id)
      .querySelector('[data-action="toggle-favorite"]')
      .click();
    await wait(300);
    state = JSON.parse(await IOUtils.readUTF8(statePath));
    assert(state.items[targets[0].id].favorite, "favorite persists locally");
    card(targets[0].id).querySelector('[data-action="open-pdf"]').click();
    for (
      let i = 0;
      i < 200 &&
      !Zotero.Reader.getByTabID(
        Zotero.getMainWindow().Zotero_Tabs.getTabIDByItemID(attachments[0].id),
      );
      i++
    )
      await wait(100);
    assert(
      Boolean(
        Zotero.Reader.getByTabID(
          Zotero.getMainWindow().Zotero_Tabs.getTabIDByItemID(
            attachments[0].id,
          ),
        ),
      ),
      "card PDF action opens Zotero native Reader",
    );
    await Zotero.Notifier.trigger("open", "file", [attachments[1].id]);
    await wait(400);
    state = JSON.parse(await IOUtils.readUTF8(statePath));
    assert(
      state.items[targets[1].id].readingStatus === "reading",
      "native Reader open event updates local reading state",
    );
    // Test manual cropping through the accessible normalized-coordinate controls.
    card(targets[0].id).click();
    [...dd.querySelectorAll("button")]
      .find((n) => n.textContent === "手动框选 PDF 区域")
      .click();
    for (
      let i = 0;
      i < 100 && !dd.querySelector(".zcl-crop-stage img")?.src;
      i++
    )
      await wait(100);
    const inputs = dd.querySelectorAll(".zcl-crop-coordinates input");
    [10, 30, 90, 65].forEach((value, i) => {
      inputs[i].value = String(value);
      inputs[i].dispatchEvent(new window.Event("change"));
    });
    [...dd.querySelectorAll("dialog button")]
      .find((n) => n.textContent === "保存封面")
      .click();
    for (let i = 0; i < 100 && dd.querySelector("dialog"); i++) await wait(100);
    state = JSON.parse(await IOUtils.readUTF8(statePath));
    assert(
      state.items[targets[0].id].cover.source === "manual",
      "manual PDF crop is persisted without an annotation",
    );
    assert(
      attachments[0].getAnnotations().length === 0,
      "manual crop does not write Zotero annotations",
    );
    card(targets[4].id).click();
    const attachmentSelect = dd.querySelector(
      '.zcl-detail-section select[aria-label="封面与阅读的来源附件"]',
    );
    attachmentSelect.value = String(alternate.id);
    attachmentSelect.dispatchEvent(new window.Event("change"));
    await wait(600);
    state = JSON.parse(await IOUtils.readUTF8(statePath));
    assert(
      state.items[targets[4].id].selectedAttachmentID === alternate.id,
      "alternate PDF source is saved",
    );
    const sidebar = [...d.querySelectorAll(".zcl-sidebar-footer button")];
    sidebar.find((n) => n.textContent.includes("深色")).click();
    await wait(200);
    const originalTitle = targets[0].getField("title");
    const unaffectedCard = card(targets[1].id);
    targets[0].setField("title", "Updated title after Zotero notifier");
    await targets[0].saveTx();
    for (
      let i = 0;
      i < 100 && !card(targets[0].id)?.textContent.includes("Updated title");
      i++
    )
      await wait(100);
    assert(
      card(targets[0].id).textContent.includes("Updated title"),
      "Zotero item edits refresh card metadata",
    );
    assert(
      card(targets[1].id) === unaffectedCard,
      "Zotero item edits preserve unrelated card nodes",
    );
    targets[0].setField("title", originalTitle);
    await targets[0].saveTx();
    await wait(300);
    const destination = new Zotero.Collection();
    destination.name = "Batch destination";
    await destination.saveTx();
    await wait(300);
    card(targets[0].id).querySelector('input[type="checkbox"]').click();
    const batchSelect = d.querySelector("#zcl-batch select");
    batchSelect.value = String(destination.id);
    batchSelect.dispatchEvent(new window.Event("change"));
    d.querySelector('#zcl-batch [data-action="add-to-collection"]').click();
    for (
      let i = 0;
      i < 100 && !targets[0].getCollections().includes(destination.id);
      i++
    )
      await wait(100);
    assert(
      targets[0].getCollections().includes(destination.id),
      "explicit batch action adds the chosen collection",
    );
    assert(
      targets[0].getField("title") === originalTitle &&
        targets[0].getTags().length === 1,
      "local card actions preserve Zotero title and tags",
    );
    await wait(300);
    const controller = Zotero.ZoteroCardLibrary.controller;
    const backup = await IOUtils.readUTF8(statePath);
    controller.options.importBackup = async () => JSON.parse(backup);
    card(targets[0].id)
      .querySelector('[data-action="toggle-favorite"]')
      .click();
    await wait(200);
    [...d.querySelectorAll(".zcl-sidebar-footer button")]
      .find((n) => n.textContent === "外观与设置")
      .click();
    [...d.querySelectorAll("dialog button")]
      .find((n) => n.textContent === "选择并导入备份")
      .click();
    for (let i = 0; i < 100 && d.querySelector("dialog"); i++) await wait(100);
    state = JSON.parse(await IOUtils.readUTF8(statePath));
    assert(
      state.items[targets[0].id].favorite,
      "validated backup import restores local favorites",
    );
    card(targets[0].id).click();
    assert(
      Zotero.ZoteroCardLibrary.controller.detailWindow === detailWindow,
      "another card reuses the detail window",
    );
    assert(
      dd.querySelector(".zcl-detail-title").textContent === originalTitle,
      "reused detail window switches metadata",
    );
    detailWindow.resizeTo(820, 760);
    await wait(200);
    assert(
      d.getElementById("zcl-main").getBoundingClientRect().width === boardWidth,
      "resizing details leaves the board unchanged",
    );
    const statusSelect = dd.querySelector(".zcl-detail-controls select");
    statusSelect.value = "read";
    statusSelect.dispatchEvent(new detailWindow.Event("change"));
    await wait(200);
    state = JSON.parse(await IOUtils.readUTF8(statePath));
    assert(
      state.items[targets[0].id].readingStatus === "read",
      "detail window saves reading status locally",
    );
    assert(
      dd.querySelector('input[type="color"]').value === "#cce4dd",
      "detail color control follows reading status",
    );
    controller.options.state.colorRules = [
      { source: "tag", value: "传感材料", color: "navy", priority: 0 },
    ];
    await controller.refresh(false);
    assert(
      dd.querySelector('input[type="color"]').value === "#000080" &&
        card(targets[0].id).dataset.tone === "dark",
      "imported named rule colors match the card and color control",
    );
    const colorInput = dd.querySelector('input[type="color"]');
    colorInput.value = "#888888";
    colorInput.dispatchEvent(new detailWindow.Event("change"));
    await wait(200);
    const midCard = card(targets[0].id);
    assert(
      window.getComputedStyle(midCard).color === "rgb(0, 0, 0)" &&
        window.getComputedStyle(midCard.querySelector(".zcl-card-authors"))
          .opacity === "1",
      "mid-tone cards retain readable main and secondary text",
    );
    [...dd.querySelectorAll("button")]
      .find((n) => n.textContent === "恢复规则颜色")
      .click();
    await wait(200);
    assert(
      dd.querySelector('input[type="color"]').value === "#000080",
      "restoring rule color refreshes the detail control",
    );
    controller.options.state.colorRules = [];
    await controller.refresh(false);
    const openPDF = controller.options.library.openPDF;
    controller.options.library.openPDF = async () => {
      throw new Error("Acceptance: PDF unavailable");
    };
    dd.querySelector(".zcl-primary-button").click();
    await wait(100);
    assert(
      dd.getElementById("zcl-message").textContent.includes("操作失败"),
      "detail failures are visible in the detail window",
    );
    controller.options.library.openPDF = openPDF;
    dd.getElementById("zcl-message").textContent = "";
    const newItem = new Zotero.Item("journalArticle");
    newItem.setField("title", "Newly added fixture");
    await newItem.saveTx();
    await wait(300);
    [...d.querySelectorAll(".zcl-scope-button")]
      .find((n) => n.textContent === "全部文献")
      .click();
    assert(
      d.querySelectorAll(".zcl-card").length === 239,
      "new Zotero items appear without reopening the window",
    );
    [...d.querySelectorAll(".zcl-scope-button")]
      .find((n) => n.textContent === "Research")
      .click();
    assert(
      d.getElementById("zcl-root").dataset.theme === "dark",
      "dark theme can be selected",
    );
    [...d.querySelectorAll(".zcl-sidebar-footer button")]
      .find((n) => n.textContent.includes("浅色"))
      .click();
    await wait(200);
    assert(
      dd.documentElement.dataset.theme === "light",
      "theme changes propagate to the detail window",
    );
    // Render privileged local screenshots for layout inspection.
    async function screenshot(target, path) {
      const canvas = target.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "canvas",
      );
      canvas.width = target.innerWidth;
      canvas.height = target.innerHeight;
      canvas
        .getContext("2d")
        .drawWindow(
          target,
          0,
          0,
          target.innerWidth,
          target.innerHeight,
          "white",
        );
      const data = canvas.toDataURL("image/png").split(",")[1];
      await IOUtils.write(
        path,
        Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
      );
    }
    for (
      let i = 0;
      i < 200 && d.querySelectorAll(".zcl-card-cover img").length < 5;
      i++
    )
      await wait(100);
    await screenshot(window, __SCREENSHOT_PATH__);
    await screenshot(detailWindow, __DETAIL_SCREENSHOT_PATH__);
    window.resizeTo(800, 900);
    await wait(300);
    assert(
      [...d.querySelectorAll(".zcl-card")].every(
        (node) => node.scrollWidth <= node.clientWidth,
      ),
      "compact cards keep their controls inside the card",
    );
    await screenshot(window, __COMPACT_SCREENSHOT_PATH__);
    window.resizeTo(1440, 900);
    [...d.querySelectorAll(".zcl-sidebar-footer button")]
      .find((n) => n.textContent.includes("深色"))
      .click();
    await wait(200);
    assert(
      dd.documentElement.dataset.theme === "dark",
      "dark theme also propagates to the detail window",
    );
    await screenshot(window, __DARK_SCREENSHOT_PATH__);
    [...d.querySelectorAll(".zcl-sidebar-footer button")]
      .find((n) => n.textContent.includes("浅色"))
      .click();
    dd.querySelector('[aria-label="关闭详情"]').click();
    await wait(100);
    assert(detailWindow.closed, "detail close button closes its native window");
    card(targets[0].id).click();
    const reopenedDetail = Zotero.ZoteroCardLibrary.controller.detailWindow;
    for (
      let i = 0;
      i < 100 && !reopenedDetail.document.querySelector(".zcl-detail-view");
      i++
    )
      await wait(100);
    assert(
      reopenedDetail !== detailWindow && !reopenedDetail.closed,
      "closed detail window can reopen",
    );
    window.close();
    await wait(400);
    assert(
      reopenedDetail.closed,
      "closing the card library also closes its detail window",
    );
    assert(
      !Zotero.ZoteroCardLibrary.api.openCardLibrary().closed,
      "card window can reopen after cleanup",
    );
    const { AddonManager } = ChromeUtils.importESModule(
      "resource://gre/modules/AddonManager.sys.mjs",
    );
    const plugin = await AddonManager.getAddonByID(
      "zotero-card-library@zotero",
    );
    await plugin.disable();
    for (let i = 0; i < 100 && Zotero.ZoteroCardLibrary; i++) await wait(100);
    assert(!Zotero.ZoteroCardLibrary, "disable cleans up the plugin instance");
    await plugin.enable();
    for (let i = 0; i < 100 && !Zotero.ZoteroCardLibrary?.data.initialized; i++)
      await wait(100);
    assert(
      Zotero.ZoteroCardLibrary?.data.initialized,
      "plugin re-enables using its saved state",
    );
    await plugin.uninstall();
    for (let i = 0; i < 100 && Zotero.ZoteroCardLibrary; i++) await wait(100);
    assert(
      targets[0].getField("title") === originalTitle &&
        (await attachments[0].getFilePathAsync()),
      "uninstall preserves Zotero records and attachments",
    );
    await report({ status: "passed", version: Zotero.version, statePath });
  } catch (error) {
    await report({
      status: "failed",
      error: String(error),
      stack: error.stack,
      window: cardWindow
        ? {
            cards: cardWindow.document.querySelectorAll(".zcl-card").length,
            readyState: cardWindow.document.readyState,
            pdfLoaded: Boolean(cardWindow.zclPDF),
            events: windowEvents,
            managerWindow: Boolean(Zotero.ZoteroCardLibrary.manager.window),
            controller: Boolean(Zotero.ZoteroCardLibrary.controller),
            message:
              cardWindow.document.getElementById("zcl-message")?.textContent,
            body: cardWindow.document.body?.textContent?.slice(0, 1600),
          }
        : null,
      console: Services.console
        .getMessageArray()
        .map((m) => m.message)
        .filter((m) => m.startsWith("[JavaScript"))
        .slice(-20),
    });
  } finally {
    await wait(300);
    Services.startup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  }
}
function shutdown() {}
function install() {}
function uninstall() {}
