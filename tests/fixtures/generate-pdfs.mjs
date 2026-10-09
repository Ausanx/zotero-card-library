import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export async function generateFixtures(directory) {
  await mkdir(directory, { recursive: true });
  const figures = [
    "0.33 0.75 0.77 rg 60 340 145 190 re f 0.18 0.50 0.68 rg 245 340 145 190 re f 0.90 0.63 0.35 rg 430 340 130 190 re f",
    "BT /F1 12 Tf 74 445 Td (INPUT) Tj ET BT /F1 12 Tf 258 445 Td (PROCESS) Tj ET BT /F1 12 Tf 446 445 Td (OUTPUT) Tj ET",
    "0.15 0.2 0.25 rg BT /F1 12 Tf 60 310 Td (Figure 1. System overview and experimental workflow) Tj ET",
  ].join("\n");
  for (const [name, body] of Object.entries({
    "figure-caption": figures,
    "two-column":
      "0.33 0.75 0.77 rg 45 330 220 240 re f 0.18 0.50 0.68 rg 335 330 220 240 re f\n0.1 0.1 0.1 rg BT /F1 10 Tf 45 300 Td (Fig. 1. Left system) Tj ET BT /F1 10 Tf 335 300 Td (Fig. 2. Right results) Tj ET",
    "no-figure":
      "BT /F1 14 Tf 60 570 Td (This paper contains text but no figures.) Tj ET",
  })) {
    const stream = `0.12 0.18 0.23 rg BT /F1 22 Tf 60 730 Td (A local research paper) Tj ET\nBT /F1 12 Tf 60 695 Td (Synthetic fixture for offline plugin acceptance tests) Tj ET\n${body}\nBT /F1 11 Tf 60 200 Td (Methods and results are illustrative test data.) Tj ET`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, i) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join(
        "",
      )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    await writeFile(resolve(directory, `${name}.pdf`), pdf);
  }
}
if (process.argv[1]?.endsWith("generate-pdfs.mjs"))
  await generateFixtures(resolve("tests/fixtures/papers"));
