const REQUIRED_HEADERS = [
  "거래일자",
  "거래구분",
  "결제수단",
  "계좌/카드명",
  "적요",
  "수입금액",
  "지출금액",
];

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

  const totals = objects.reduce(
    (accumulator, row) => {
      accumulator.income += toNumber(row["수입금액"]);
      accumulator.expense += toNumber(row["지출금액"]);
      accumulator.fees += toNumber(row["이자/수수료"]);
      return accumulator;
    },
    { income: 0, expense: 0, fees: 0 }
  );

  return Response.json({
    fileName: file.name,
    rowCount: objects.length,
    headers,
    totals: {
      income: formatCurrency(totals.income),
      expense: formatCurrency(totals.expense),
      fees: formatCurrency(totals.fees),
    },
    previewRows: objects.slice(0, 5).map((row) => ({
      거래일자: row["거래일자"],
      거래구분: row["거래구분"],
      적요: row["적요"],
      수입금액: row["수입금액"],
      지출금액: row["지출금액"],
    })),
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

function toNumber(value) {
  if (!value) {
    return 0;
  }
  const normalized = value.replaceAll(",", "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
