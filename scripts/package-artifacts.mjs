import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import JSZip from "jszip";

const path = ".scaffold/build/zotero-card-library.xpi";
const zip = await JSZip.loadAsync(await readFile(path));
for (const file of [
  "README.md",
  "LICENSE",
  "NOTICE",
  "docs/PRIVACY.md",
  "licenses/template-AGPL-3.0.txt",
]) {
  zip.file(file, await readFile(file));
}
const pkg = JSON.parse(await readFile("package.json", "utf8"));
zip.file(
  "BUILD.json",
  JSON.stringify(
    {
      version: pkg.version,
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      dirty: Boolean(
        execFileSync("git", ["status", "--porcelain"], {
          encoding: "utf8",
        }).trim(),
      ),
    },
    null,
    2,
  ) + "\n",
);
const xpi = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
});
await writeFile(path, xpi);
const hash = `sha512:${createHash("sha512").update(xpi).digest("hex")}`;
for (const file of ["update.json", "update-beta.json"]) {
  const updatePath = `.scaffold/build/${file}`;
  const manifest = JSON.parse(await readFile(updatePath, "utf8"));
  const update = manifest.addons[pkg.config.addonID].updates.find(
    (entry) => entry.version === pkg.version,
  );
  if (!update) throw new Error(`Missing ${pkg.version} in ${file}`);
  update.update_hash = hash;
  await writeFile(updatePath, JSON.stringify(manifest, null, 2) + "\n");
}
console.log("Packaged documentation, licenses and source provenance.");
