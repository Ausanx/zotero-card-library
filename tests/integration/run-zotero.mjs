import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  appendFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import JSZip from "jszip";
import { generateFixtures } from "../fixtures/generate-pdfs.mjs";
const root = resolve(".scaffold", `zotero-test-${Date.now()}`),
  profile = join(root, "profile"),
  driver = join(root, "driver"),
  fixtures = join(root, "papers");
await Promise.all([
  mkdir(join(profile, "extensions"), { recursive: true }),
  mkdir(join(profile, "data"), { recursive: true }),
  mkdir(driver, { recursive: true }),
  generateFixtures(fixtures),
]);
const result = join(root, "result.json"),
  screenshot = join(root, "screenshot.png");
const substitutions = {
  __RESULT_PATH__: result,
  __SCREENSHOT_PATH__: screenshot,
  __DETAIL_SCREENSHOT_PATH__: join(root, "detail.png"),
  __COMPACT_SCREENSHOT_PATH__: join(root, "compact.png"),
  __DARK_SCREENSHOT_PATH__: join(root, "dark.png"),
  __MISSING_PATH__: join(root, "missing.pdf"),
  __FIXTURE_PATHS__: Object.fromEntries(
    ["figure-caption", "two-column", "no-figure"].map((name) => [
      name,
      join(fixtures, `${name}.pdf`),
    ]),
  ),
};
let source = await readFile("tests/integration/driver.js", "utf8");
for (const [key, value] of Object.entries(substitutions))
  source = source.replaceAll(key, JSON.stringify(value));
await writeFile(join(driver, "bootstrap.js"), source);
await writeFile(
  join(driver, "manifest.json"),
  JSON.stringify({
    manifest_version: 2,
    name: "Local acceptance driver",
    version: "1.0",
    applications: {
      zotero: {
        id: "zcl-test@local",
        update_url: "https://example.invalid/zcl-test/update.json",
        strict_min_version: "9.0.6",
        strict_max_version: "9.*",
      },
    },
  }),
);
const driverZip = new JSZip();
driverZip.file("bootstrap.js", source);
driverZip.file("manifest.json", await readFile(join(driver, "manifest.json")));
await writeFile(
  join(profile, "extensions", "zcl-test@local.xpi"),
  await driverZip.generateAsync({ type: "nodebuffer" }),
);
await copyFile(
  ".scaffold/build/zotero-card-library.xpi",
  join(profile, "extensions", "zotero-card-library@zotero.xpi"),
);
const prefs = {
  "extensions.zotero.dataDir": join(profile, "data"),
  "extensions.zotero.useDataDir": true,
  "extensions.zotero.firstRun2": false,
  "extensions.zotero.lastVersion": "9.0.6",
  "extensions.zotero.sync.autoSync": false,
  "extensions.zotero.automaticScraperUpdates": false,
  "extensions.autoDisableScopes": 0,
  "extensions.enabledScopes": 15,
  "extensions.startupScanScopes": 15,
  "extensions.update.enabled": false,
  "app.update.auto": false,
  "browser.shell.checkDefaultBrowser": false,
  "toolkit.telemetry.reportingpolicy.firstRun": false,
};
prefs["extensions.logging.enabled"] = true;
await writeFile(
  join(profile, "user.js"),
  Object.entries(prefs)
    .map(
      ([key, value]) =>
        `user_pref(${JSON.stringify(key)},${JSON.stringify(value)});`,
    )
    .join("\n"),
);
console.log(`Test directory: ${root}`);
const executable =
  process.env.ZOTERO_BIN || "D:/Program Files/Zotero/zotero.exe";
const child = spawn(
  executable,
  ["-no-remote", "-headless", "-profile", profile],
  {
    windowsHide: true,
    env: { ...process.env, MOZ_HEADLESS: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
const log = (chunk) => {
  output += chunk;
  void appendFile(join(root, "process.log"), chunk);
};
child.stdout.on("data", log);
child.stderr.on("data", log);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
let completed = false;
for (let i = 0; i < 180; i++) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  try {
    const status = JSON.parse(await readFile(result, "utf8"));
    if (status.status !== "running") {
      console.log(JSON.stringify(status, null, 2));
      completed = true;
      process.exitCode = status.status === "passed" ? 0 : 1;
      break;
    }
  } catch {
    /* The driver has not written its status yet. */
  }
  if (child.exitCode !== null) break;
}
await writeFile(join(root, "process.log"), output);
if (!completed) {
  console.error(`Test did not finish; inspect ${root}`);
  process.exitCode = 1;
}
if (child.exitCode === null) child.kill();
