import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const xpi = await readFile(".scaffold/build/zotero-card-library.xpi");
const zip = await JSZip.loadAsync(xpi);
for (const name of [
  "manifest.json",
  "bootstrap.js",
  "content/scripts/zcl.js",
  "content/card-library.xhtml",
  "content/paper-detail.xhtml",
  "content/pdf-host.mjs",
  "README.md",
  "LICENSE",
  "NOTICE",
  "docs/PRIVACY.md",
  "licenses/template-AGPL-3.0.txt",
  "BUILD.json",
]) {
  assert.ok(zip.file(name), `Missing release file: ${name}`);
}
const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.applications.zotero.id, pkg.config.addonID);
assert.equal(manifest.applications.zotero.strict_min_version, "9.0.6");
assert.equal(manifest.applications.zotero.strict_max_version, "9.*");
assert.ok(manifest.applications.zotero.update_url);
assert.ok(!manifest.applications.zotero.update_url.includes("example.invalid"));
assert.equal(manifest.permissions?.length || 0, 0);
assert.ok(
  !Object.keys(zip.files).some(
    (name) => name.startsWith("tests/") || name.startsWith("node_modules/"),
  ),
);
const script = await zip.file("content/scripts/zcl.js").async("string");
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|zotero-plugin-toolkit/.test(script));
const provenance = JSON.parse(await zip.file("BUILD.json").async("string"));
assert.match(provenance.commit, /^[a-f0-9]{40}$/);
for (const file of ["update.json", "update-beta.json"]) {
  const manifest = JSON.parse(
    await readFile(`.scaffold/build/${file}`, "utf8"),
  );
  const update = manifest.addons[pkg.config.addonID].updates.find(
    (entry) => entry.version === pkg.version,
  );
  assert.ok(update, `Missing ${pkg.version} in ${file}`);
  assert.ok(!update.update_link.includes("example.invalid"));
  assert.equal(
    update.update_hash,
    `sha512:${createHash("sha512").update(xpi).digest("hex")}`,
    `${file} hash does not match the packaged XPI`,
  );
}
console.log(
  `Verified XPI ${manifest.version}; source ${provenance.commit.slice(0, 7)}${provenance.dirty ? " (working tree changes)" : ""}.`,
);
