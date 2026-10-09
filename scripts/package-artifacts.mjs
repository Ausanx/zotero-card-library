import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
await writeFile(
  path,
  await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
);
console.log("Packaged documentation, licenses and source provenance.");
