import { analyzeLedgerRows, REQUIRED_HEADERS } from "../../lib/ledger-preview";

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: "업로드 파일이 없습니다." }, { status: 400 });
  }

  const text = await file.text();
  const delimiter = detectDelimiter(text);
  const rows = parseDelimitedText(text, delimiter);

  if (rows.length < 2) {
    return Response.json({ error: "헤더와 데이터 행이 필요합니다." }, { status: 400 });
  }

  const headers = rows[0].map((value) => value.trim());
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return Response.json(
      {
        error: `필수 헤더가 없습니다: ${missing.join(", ")}`,
        missingHeaders: missing,
      },
      { status: 400 }
    );
  }

  const records = rows.slice(1).filter((row) => row.some((value) => value.trim() !== ""));
  const objects = records.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index]?.trim() || "";
    });
    return item;
  });

  const analysis = analyzeLedgerRows(objects);

  return Response.json({
    fileName: file.name,
    rowCount: objects.length,
    headers,
    ...analysis,
  });
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  return firstLine.includes("\t") ? "\t" : ",";
}

function parseDelimitedText(text, delimiter) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  return lines.map((line) => splitLine(line, delimiter));
}

function splitLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}
