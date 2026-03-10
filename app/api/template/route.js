import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const filePath = path.join(process.cwd(), "templates", "standard_ledger_upload.csv");
  const content = await readFile(filePath, "utf-8");
  const csvWithBom = `\uFEFF${content}`;

  return new Response(csvWithBom, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"standard_ledger_upload.csv\"; filename*=UTF-8''standard_ledger_upload.csv",
    },
  });
}
