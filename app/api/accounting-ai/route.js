const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const question = String(payload?.question || "").trim();
  const preview = payload?.preview;

  if (!question) {
    return Response.json({ error: "질문이 비어 있습니다." }, { status: 400 });
  }

  if (!preview) {
    return Response.json({ error: "업로드 분석 데이터가 없습니다." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.ACCOUNTING_AI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "서버 AI 키가 설정되지 않았습니다. OPENAI_API_KEY 또는 ACCOUNTING_AI_API_KEY를 설정해야 합니다." },
      { status: 503 }
    );
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || process.env.ACCOUNTING_AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL || process.env.ACCOUNTING_AI_MODEL || DEFAULT_MODEL;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: buildUserPrompt(question, preview),
          },
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      const message = result?.error?.message || "외부 AI 응답 호출에 실패했습니다.";
      return Response.json({ error: message }, { status: response.status });
    }

    const answer = result?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return Response.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 });
    }

    return Response.json({ answer });
  } catch {
    return Response.json({ error: "외부 AI 서비스 연결에 실패했습니다." }, { status: 502 });
  }
}

function buildSystemPrompt() {
  return [
    "너는 회계와 가계부 분석에 특화된 전문 AI다.",
    "사용자가 업로드한 거래 요약 데이터를 바탕으로 위험, 준수, 지출 구조, 수정 우선순위를 설명한다.",
    "답변은 한국어로만 작성한다.",
    "숫자는 업로드 데이터에 있는 값만 사용하고, 없는 값은 추측하지 않는다.",
    "실무자가 바로 행동할 수 있게 짧고 명확하게 답한다.",
    "가능하면 3개 이하의 짧은 문단으로 정리한다.",
  ].join(" ");
}

function buildUserPrompt(question, preview) {
  const compactPreview = {
    fileName: preview.fileName,
    rowCount: preview.rowCount,
    totals: preview.totals,
    reviewQueue: preview.reviewQueue,
    monthlyFlow: preview.monthlyFlow?.slice(0, 6),
    categorySpend: preview.categorySpend?.slice(0, 6),
    paymentSummary: preview.paymentSummary?.slice(0, 6),
    accountSummary: preview.accountSummary?.slice(0, 6),
    recentTransactions: preview.recentTransactions?.slice(0, 8),
    insights: preview.insights,
  };

  return [
    `사용자 질문: ${question}`,
    "다음은 회계 시스템이 계산한 업로드 요약 데이터다.",
    JSON.stringify(compactPreview, null, 2),
    "이 데이터만 근거로 답해라.",
  ].join("\n\n");
}
