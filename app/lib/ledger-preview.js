export const REQUIRED_HEADERS = [
  "거래일자",
  "거래구분",
  "결제수단",
  "계좌/카드명",
  "적요",
  "수입금액",
  "지출금액",
];

const ISSUE_CONFIG = [
  {
    key: "missingType",
    title: "거래구분 누락",
    severity: "high",
    detail: "입금, 카드결제, 신용카드사용 같은 기준값이 비어 있어 집계 왜곡 위험이 큽니다.",
  },
  {
    key: "missingCategory",
    title: "미분류 거래",
    severity: "medium",
    detail: "카테고리가 비어 있어 가계부 보고서에서 바로 읽히지 않습니다.",
  },
  {
    key: "zeroAmount",
    title: "금액 0원 거래",
    severity: "medium",
    detail: "수입금액과 지출금액이 모두 0이면 원장 기준으로 쓸모없는 행일 가능성이 높습니다.",
  },
  {
    key: "installmentMissingOrigin",
    title: "원거래 연결 누락",
    severity: "high",
    detail: "할부나 카드 사용 행에 원거래ID가 없어 추적과 상환 연결이 어렵습니다.",
  },
  {
    key: "feeSeparatedReview",
    title: "금융비용 분리 검토",
    severity: "low",
    detail: "이자/수수료가 잡혀 있어 생활비와 금융비용을 분리해서 보는 편이 좋습니다.",
  },
];

export function analyzeLedgerRows(rows) {
  const normalizedRows = rows.map((row, index) => normalizeRow(row, index));
  const totals = normalizedRows.reduce(
    (accumulator, row) => {
      accumulator.income += row.income;
      accumulator.expense += row.expense;
      accumulator.fees += row.fees;
      accumulator.net += row.net;
      return accumulator;
    },
    { income: 0, expense: 0, fees: 0, net: 0 }
  );

  const issueCounts = {
    missingType: 0,
    missingCategory: 0,
    zeroAmount: 0,
    installmentMissingOrigin: 0,
    feeSeparatedReview: 0,
  };

  const byMonth = new Map();
  const byCategory = new Map();
  const byPayment = new Map();
  const byType = new Map();
  const byAccount = new Map();

  for (const row of normalizedRows) {
    incrementGroup(byMonth, row.monthKey, row);
    incrementGroup(byCategory, row.displayCategory, row);
    incrementGroup(byPayment, row.paymentMethod, row);
    incrementGroup(byType, row.transactionType, row);
    incrementGroup(byAccount, row.accountName, row);

    if (!row.rawType) {
      issueCounts.missingType += 1;
    }
    if (!row.rawCategory) {
      issueCounts.missingCategory += 1;
    }
    if (row.income === 0 && row.expense === 0) {
      issueCounts.zeroAmount += 1;
    }
    if (row.needsOrigin && !row.originId) {
      issueCounts.installmentMissingOrigin += 1;
    }
    if (row.fees > 0) {
      issueCounts.feeSeparatedReview += 1;
    }
  }

  const reviewQueue = ISSUE_CONFIG
    .map((config) => ({
      ...config,
      count: issueCounts[config.key],
    }))
    .filter((item) => item.count > 0);

  const recentTransactions = [...normalizedRows]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 8)
    .map((row) => ({
      date: row.date,
      type: row.transactionType,
      paymentMethod: row.paymentMethod,
      account: row.accountName,
      description: row.description,
      amount: formatSignedCurrency(row.net),
      category: row.displayCategory,
      flags: buildFlags(row),
    }));

  return {
    totals: {
      income: formatCurrency(totals.income),
      expense: formatCurrency(totals.expense),
      fees: formatCurrency(totals.fees),
      net: formatSignedCurrency(totals.net),
    },
    monthlyFlow: sortSummaryRows(byMonth, { chronological: true }),
    categorySpend: sortSummaryRows(byCategory, { expenseOnly: true }).slice(0, 6),
    paymentSummary: sortSummaryRows(byPayment, { expenseOnly: true }),
    typeSummary: sortSummaryRows(byType),
    accountSummary: sortSummaryRows(byAccount),
    reviewQueue,
    recentTransactions,
    previewRows: normalizedRows.slice(0, 5).map((row) => ({
      거래일자: row.date,
      거래구분: row.rawType || "미입력",
      적요: row.description,
      수입금액: row.income ? formatCurrency(row.income) : "",
      지출금액: row.expense ? formatCurrency(row.expense) : "",
    })),
    insights: buildInsights(totals, byCategory, byPayment, reviewQueue),
  };
}

function normalizeRow(row, index) {
  const income = toNumber(row["수입금액"]);
  const expense = toNumber(row["지출금액"]);
  const fees = toNumber(row["이자/수수료"]);
  const date = String(row["거래일자"] || "").trim();
  const rawType = String(row["거래구분"] || "").trim();
  const rawCategory = String(row["카테고리"] || "").trim();
  const paymentMethod = String(row["결제수단"] || "").trim() || "미입력";
  const accountName = String(row["계좌/카드명"] || "").trim() || "미입력";
  const description = String(row["적요"] || "").trim() || "적요 없음";
  const monthKey = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "미확인";

  return {
    id: `${date}-${description}-${index}`,
    date,
    monthKey,
    income,
    expense,
    fees,
    net: income - expense,
    rawType,
    rawCategory,
    transactionType: rawType || "미입력",
    paymentMethod,
    accountName,
    description,
    displayCategory: rawCategory || inferCategory(rawType, income - expense, fees),
    originId: String(row["원거래ID"] || "").trim(),
    needsOrigin: ["신용카드사용", "할부원금", "할부이자"].includes(rawType),
  };
}

function inferCategory(type, net, fees) {
  if (fees > 0 || type === "할부이자" || type === "수수료" || type === "연체이자") {
    return "금융비용";
  }
  if (type === "카드결제" || type === "할부원금") {
    return "부채상환";
  }
  if (type === "계좌이체") {
    return "자금이동";
  }
  if (net > 0 || type === "입금") {
    return "수입";
  }
  return "미분류";
}

function buildFlags(row) {
  const flags = [];
  if (!row.rawCategory) {
    flags.push("카테고리 확인");
  }
  if (!row.rawType) {
    flags.push("거래구분 확인");
  }
  if (row.needsOrigin && !row.originId) {
    flags.push("원거래ID 필요");
  }
  if (row.fees > 0) {
    flags.push("이자/수수료 포함");
  }
  return flags;
}

function incrementGroup(map, key, row) {
  const current = map.get(key) || { label: key, income: 0, expense: 0, net: 0, count: 0 };
  current.income += row.income;
  current.expense += row.expense;
  current.net += row.net;
  current.count += 1;
  map.set(key, current);
}

function sortSummaryRows(map, options = {}) {
  const rows = [...map.values()];
  if (options.chronological) {
    rows.sort((left, right) => right.label.localeCompare(left.label, "ko"));
  } else {
    rows.sort((left, right) => {
      const leftMetric = options.expenseOnly ? left.expense : Math.abs(left.net);
      const rightMetric = options.expenseOnly ? right.expense : Math.abs(right.net);
      return rightMetric - leftMetric || left.label.localeCompare(right.label, "ko");
    });
  }

  return rows.map((row) => ({
    label: row.label,
    income: formatCurrency(row.income),
    expense: formatCurrency(row.expense),
    net: formatSignedCurrency(row.net),
    count: row.count,
    ratio: options.expenseOnly && row.expense > 0 ? row.expense : Math.abs(row.net),
  }));
}

function buildInsights(totals, categoryMap, paymentMap, reviewQueue) {
  const largestCategory = sortSummaryRows(categoryMap, { expenseOnly: true })[0];
  const largestPayment = sortSummaryRows(paymentMap, { expenseOnly: true })[0];
  const highestIssue = [...reviewQueue].sort((left, right) => right.count - left.count)[0];
  const insights = [];

  if (largestCategory) {
    insights.push(`가장 큰 지출 카테고리는 ${largestCategory.label}이며 ${largestCategory.expense}입니다.`);
  }
  if (largestPayment) {
    insights.push(`지출이 가장 큰 결제수단은 ${largestPayment.label}이며 ${largestPayment.expense}입니다.`);
  }
  if (highestIssue) {
    insights.push(`가장 먼저 정리할 항목은 ${highestIssue.title} ${highestIssue.count}건입니다.`);
  }
  if (totals.net < 0) {
    insights.push("이번 업로드 기준 순현금흐름이 음수입니다.");
  }

  return insights.slice(0, 3);
}

export function toNumber(value) {
  if (!value) {
    return 0;
  }

  const normalized = String(value).replaceAll(",", "").replaceAll("원", "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function formatSignedCurrency(value) {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}
