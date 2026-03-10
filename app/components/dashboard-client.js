"use client";

import { useMemo, useRef, useState } from "react";

const uploadColumns = [
  "거래일자",
  "거래구분",
  "결제수단",
  "계좌/카드명",
  "적요",
  "상대처",
  "수입금액",
  "지출금액",
  "카테고리",
  "원거래ID",
  "이자/수수료",
];

const emptySummary = [
  { label: "이번 업로드 수입", value: "-", note: "표준 양식 CSV 업로드 필요", tone: "positive" },
  { label: "이번 업로드 지출", value: "-", note: "생활비와 금융비용 포함", tone: "default" },
  { label: "순현금 흐름", value: "-", note: "업로드 후 즉시 계산", tone: "accent" },
  { label: "검토 필요 건수", value: "-", note: "미분류와 누락 항목 합산", tone: "warning" },
];

const starterPrompts = [
  "이번 업로드에서 가장 먼저 손봐야 할 항목 알려줘",
  "가계부 기준으로 지출 구조를 요약해줘",
  "누락되거나 위험한 거래 유형을 설명해줘",
];

export default function DashboardClient() {
  const inputRef = useRef(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantStatus, setAssistantStatus] = useState("idle");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "회계 AI 코파일럿입니다. 업로드된 거래를 기준으로 위험 항목, 지출 구조, 정리 우선순위를 실제 AI 응답으로 설명합니다.",
    },
  ]);
  const [uploadState, setUploadState] = useState({
    status: "idle",
    message: "표준 CSV를 올리면 문제 거래, 월별 흐름, 결제수단별 지출이 바로 계산됩니다.",
    preview: null,
  });

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setUploadState({
      status: "loading",
      message: "업로드 파일을 검사하고 실무용 지표를 계산하고 있습니다.",
      preview: null,
    });

    try {
      const response = await fetch("/api/upload-preview", {
        method: "POST",
        body,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "업로드 처리 중 오류가 발생했습니다.");
      }

      const reviewCount = payload.reviewQueue.reduce((sum, item) => sum + item.count, 0);
      setUploadState({
        status: "success",
        message: `${payload.fileName}에서 ${payload.rowCount}건을 읽었습니다. 검토 필요 항목은 ${reviewCount}건입니다.`,
        preview: payload,
      });
      setChatMessages([
        {
          role: "assistant",
          text: buildAssistantWelcome(payload),
        },
      ]);
    } catch (error) {
      setUploadState({
        status: "error",
        message: error.message,
        preview: null,
      });
    } finally {
      event.target.value = "";
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  async function handleAsk(question) {
    if (!question.trim()) {
      return;
    }

    const userQuestion = question.trim();
    setAssistantOpen(true);
    setChatMessages((current) => [
      ...current,
      { role: "user", text: userQuestion },
    ]);
    setAssistantInput("");

    if (!uploadState.preview) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "아직 업로드된 거래가 없습니다. 먼저 CSV를 올리면 서버 AI가 실제 거래 데이터를 기준으로 답변합니다.",
        },
      ]);
      return;
    }

    setAssistantStatus("loading");

    try {
      const response = await fetch("/api/accounting-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
          preview: uploadState.preview,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "AI 응답을 불러오지 못했습니다.");
      }

      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: payload.answer,
        },
      ]);
      setAssistantStatus("success");
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error.message || "AI 응답 중 오류가 발생했습니다.",
        },
      ]);
      setAssistantStatus("error");
    }
  }

  const summaryCards = uploadState.preview
    ? [
        {
          label: "이번 업로드 수입",
          value: uploadState.preview.totals.income,
          note: `${uploadState.preview.rowCount}건 기준`,
          tone: "positive",
        },
        {
          label: "이번 업로드 지출",
          value: uploadState.preview.totals.expense,
          note: `이자/수수료 ${uploadState.preview.totals.fees}`,
          tone: "default",
        },
        {
          label: "순현금 흐름",
          value: uploadState.preview.totals.net,
          note: "수입 - 지출 기준",
          tone: "accent",
        },
        {
          label: "검토 필요 건수",
          value: `${uploadState.preview.reviewQueue.reduce((sum, item) => sum + item.count, 0)}건`,
          note: uploadState.preview.reviewQueue[0]?.title || "검토 항목 없음",
          tone: "warning",
        },
      ]
    : emptySummary;

  const overviewIndicators = useMemo(
    () => buildOverviewIndicators(uploadState.preview),
    [uploadState.preview]
  );

  const dashboardHighlights = useMemo(
    () => buildDashboardHighlights(uploadState.preview),
    [uploadState.preview]
  );

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div className="header-copy">
          <p className="eyebrow">Accounting System</p>
          <h1 className="dashboard-title">실무형 회계 · 가계부 컨트롤 타워</h1>
          <p className="dashboard-subtitle">
            대시보드는 한 눈에 보이도록 요약하고, 가계부는 스크롤형 상세 페이지로 분리했습니다. 업로드 즉시 안전, 준수, 위험 상태와 지출 흐름을 바로 읽을 수 있습니다.
          </p>
        </div>
        <div className="dashboard-actions">
          <button className="primary-button" type="button" onClick={openPicker}>거래 업로드</button>
          <a className="secondary-button link-button" href="/api/template">양식 다운로드</a>
          <button
            className="secondary-button ai-button"
            type="button"
            onClick={() => setAssistantOpen((current) => !current)}
          >
            회계 AI 대화
          </button>
        </div>
        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          onChange={handleFileChange}
        />
      </header>

      <section className="page-switcher" aria-label="view switcher">
        <button
          type="button"
          className={`switch-chip ${activeView === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveView("dashboard")}
        >
          대시보드
        </button>
        <button
          type="button"
          className={`switch-chip ${activeView === "ledger" ? "active" : ""}`}
          onClick={() => setActiveView("ledger")}
        >
          가계부 상세
        </button>
        <span className="switch-note">대시보드는 한 페이지 요약, 가계부는 거래 중심 상세 보기</span>
      </section>

      {activeView === "dashboard" ? (
        <section className="dashboard-screen">
          <section className="summary-grid" aria-label="summary">
            {summaryCards.map((card) => (
              <article className={`summary-card ${card.tone}`} key={card.label}>
                <span className="summary-label">{card.label}</span>
                <strong className="summary-value">{card.value}</strong>
                <span className="summary-note">{card.note}</span>
              </article>
            ))}
          </section>

          <section className="dashboard-overview">
            <article className="surface overview-panel">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Situation Board</p>
                  <h2>전체 상황</h2>
                </div>
                <span className={`status-pill ${uploadState.status}`}>{uploadState.status}</span>
              </div>
              <div className="indicator-grid">
                {overviewIndicators.map((item) => (
                  <article className="indicator-card" key={item.label}>
                    <div
                      className={`indicator-ring ${item.tone}`}
                      style={{ "--indicator-fill": `${item.score}%` }}
                    >
                      <span>{item.score}</span>
                    </div>
                    <strong>{item.label}</strong>
                    <span>{item.state}</span>
                  </article>
                ))}
              </div>
              <p className="panel-note">{uploadState.message}</p>
            </article>

            <article className="surface action-panel">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Action Queue</p>
                  <h2>즉시 확인할 항목</h2>
                </div>
                <span className="section-meta">{uploadState.preview ? "업로드 분석 완료" : "파일 대기 중"}</span>
              </div>
              {uploadState.preview ? (
                <div className="alert-list compact-alerts">
                  {uploadState.preview.reviewQueue.length > 0 ? (
                    uploadState.preview.reviewQueue.slice(0, 4).map((item) => (
                      <div className={`alert-card ${item.severity}`} key={item.title}>
                        <div className="alert-head">
                          <strong>{item.title}</strong>
                          <span>{item.count}건</span>
                        </div>
                        <p>{item.detail}</p>
                      </div>
                    ))
                  ) : (
                    <div className="alert-card low">
                      <div className="alert-head">
                        <strong>즉시 검토할 오류 없음</strong>
                        <span>0건</span>
                      </div>
                      <p>현재 업로드 파일 기준으로 필수 누락과 미분류 거래가 확인되지 않았습니다.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-preview">
                  <strong>업로드 후 우선순위가 바로 보이도록 구성했습니다.</strong>
                  <p>문제 거래는 합계보다 먼저 이 영역에서 확인할 수 있습니다.</p>
                </div>
              )}
            </article>
          </section>

          <section className="dashboard-overview bottom">
            <article className="surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Horizontal Snapshot</p>
                  <h2>가로형 그래프 지표</h2>
                </div>
                <span className="section-meta">지출 구조와 현금흐름 요약</span>
              </div>
              {uploadState.preview ? (
                <div className="chart-stack">
                  {dashboardHighlights.map((item) => (
                    <div className="chart-row" key={item.label}>
                      <div className="chart-meta">
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                      </div>
                      <div className="chart-bar">
                        <span className={item.tone} style={{ width: `${item.width}%` }} />
                      </div>
                      <p>{item.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-preview">
                  <strong>대시보드는 그래프 중심으로 한 페이지에 압축됩니다.</strong>
                  <p>업로드가 들어오면 상위 지출, 결제수단, 순현금흐름이 작은 가로 그래프로 표시됩니다.</p>
                </div>
              )}
            </article>

            <article className="surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">AI Copilot</p>
                  <h2>전문 AI 기능</h2>
                </div>
              </div>
              <div className="ai-teaser">
                <p className="panel-note">
                  회계와 가계부 문맥에 맞춰 질문을 받을 수 있는 전용 대화 버튼을 분리했습니다. 업로드 기준 요약, 위험 설명, 정리 순서를 바로 물을 수 있습니다.
                </p>
                <div className="prompt-grid">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="prompt-chip"
                      onClick={() => handleAsk(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          </section>
        </section>
      ) : (
        <section className="ledger-screen">
          <section className="ledger-hero">
            <article className="surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Ledger Workspace</p>
                  <h2>가계부 상세 보기</h2>
                </div>
                <span className="section-meta">스크롤 기반 상세 분석</span>
              </div>
              <p className="panel-note">
                거래 목록, 월별 흐름, 카테고리 지출, 결제수단 분석을 세부 항목 단위로 나눠 보도록 페이지를 분리했습니다.
              </p>
            </article>

            <article className="surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Upload Standard</p>
                  <h2>표준 업로드 헤더</h2>
                </div>
              </div>
              <div className="template-grid">
                {uploadColumns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
            </article>
          </section>

          <section className="content-grid">
            <article className="surface tall-surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Monthly Flow</p>
                  <h2>월별 현금 흐름</h2>
                </div>
                <span className="section-meta">수입 / 지출 / 순증감</span>
              </div>
              {uploadState.preview ? (
                <div className="stack-list">
                  {uploadState.preview.monthlyFlow.map((row) => (
                    <div className="stack-item stack-item-grid" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>수입 {row.income}</span>
                      <span>지출 {row.expense}</span>
                      <span>순증감 {row.net}</span>
                      <span>{row.count}건</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-preview">
                  <strong>월별 흐름이 먼저 보여야 마감이 됩니다.</strong>
                  <p>원본을 올리면 월 기준 수입, 지출, 순현금흐름을 바로 확인할 수 있습니다.</p>
                </div>
              )}
            </article>

            <article className="surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Category Spend</p>
                  <h2>지출 큰 카테고리</h2>
                </div>
              </div>
              {uploadState.preview ? (
                <div className="budget-list">
                  {uploadState.preview.categorySpend.map((row) => (
                    <div className="budget-row" key={row.label}>
                      <div className="budget-head">
                        <strong>{row.label}</strong>
                        <span>{row.expense}</span>
                      </div>
                      <div className="budget-bar">
                        <span
                          style={{ width: `${Math.min(100, (row.ratio / maxExpense(uploadState.preview.categorySpend)) * 100 || 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-preview">
                  <strong>카테고리 지출 비교가 비어 있습니다.</strong>
                  <p>어디에 돈을 썼는지 바로 보기 위해 상위 지출 카테고리를 업로드 기준으로 계산합니다.</p>
                </div>
              )}
            </article>
          </section>

          <section className="content-grid bottom-grid">
            <article className="surface tall-surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Payment And Accounts</p>
                  <h2>결제수단 / 계좌 분석</h2>
                </div>
                <span className="section-meta">카드와 계좌를 분리해 읽기</span>
              </div>
              {uploadState.preview ? (
                <div className="two-column-panels">
                  <div className="mini-panel">
                    <strong className="mini-panel-title">결제수단별</strong>
                    <div className="stack-list compact-stack">
                      {uploadState.preview.paymentSummary.map((row) => (
                        <div className="stack-item stack-item-grid short-grid" key={row.label}>
                          <strong>{row.label}</strong>
                          <span>지출 {row.expense}</span>
                          <span>{row.count}건</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mini-panel">
                    <strong className="mini-panel-title">계좌/카드별</strong>
                    <div className="stack-list compact-stack">
                      {uploadState.preview.accountSummary.map((row) => (
                        <div className="stack-item stack-item-grid short-grid" key={row.label}>
                          <strong>{row.label}</strong>
                          <span>수입 {row.income}</span>
                          <span>지출 {row.expense}</span>
                          <span>{row.count}건</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-preview">
                  <strong>카드/계좌 구분이 안 되면 실무에서 바로 막힙니다.</strong>
                  <p>결제수단과 계좌/카드명 기준으로 따로 집계해 카드값과 생활비를 섞지 않게 했습니다.</p>
                </div>
              )}
            </article>

            <article className="surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Upload Preview</p>
                  <h2>업로드 결과</h2>
                </div>
              </div>
              <div className="upload-box">
                <p className="upload-title">파일 업로드</p>
                <p className="upload-text">표준 양식 CSV를 올리면 헤더 검증 뒤에 실무형 요약과 거래 미리보기를 바로 반환합니다.</p>
                <div className="upload-actions">
                  <button className="primary-button" type="button" onClick={openPicker}>파일 선택</button>
                  <a className="secondary-button link-button" href="/api/template">양식 다운로드</a>
                </div>
              </div>

              {uploadState.preview ? (
                <>
                  <div className="preview-metrics">
                    <div className="metric-box">
                      <span>거래 수</span>
                      <strong>{uploadState.preview.rowCount}건</strong>
                    </div>
                    <div className="metric-box">
                      <span>월 수</span>
                      <strong>{uploadState.preview.monthlyFlow.length}개월</strong>
                    </div>
                    <div className="metric-box">
                      <span>미분류</span>
                      <strong>{findIssueCount(uploadState.preview.reviewQueue, "미분류 거래")}건</strong>
                    </div>
                    <div className="metric-box">
                      <span>원거래 누락</span>
                      <strong>{findIssueCount(uploadState.preview.reviewQueue, "원거래 연결 누락")}건</strong>
                    </div>
                  </div>
                  <div className="preview-list">
                    {uploadState.preview.previewRows.map((row) => (
                      <div className="preview-row" key={`${row.거래일자}-${row.적요}-${row.지출금액}-${row.수입금액}`}>
                        <span>{row.거래일자}</span>
                        <span>{row.거래구분}</span>
                        <span>{row.적요}</span>
                        <strong>{row.지출금액 || row.수입금액 || "0원"}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-preview">
                  <strong>아직 업로드된 파일이 없습니다.</strong>
                  <p>파일을 올리면 건수, 누락 현황, 최근 거래 미리보기가 표시됩니다.</p>
                </div>
              )}
            </article>
          </section>

          <section className="content-grid bottom-grid">
            <article className="surface tall-surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Recent Transactions</p>
                  <h2>최근 거래와 검토 플래그</h2>
                </div>
                <span className="section-meta">문제 거래를 바로 찾기</span>
              </div>
              {uploadState.preview ? (
                <div className="table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>일자</th>
                        <th>구분</th>
                        <th>결제수단</th>
                        <th>적요</th>
                        <th>금액</th>
                        <th>카테고리</th>
                        <th>플래그</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadState.preview.recentTransactions.map((row) => (
                        <tr key={`${row.date}-${row.description}-${row.amount}`}>
                          <td>{row.date}</td>
                          <td>{row.type}</td>
                          <td>{row.paymentMethod}</td>
                          <td>{row.description}</td>
                          <td>{row.amount}</td>
                          <td>{row.category}</td>
                          <td>{row.flags.join(", ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-preview">
                  <strong>최근 거래도 실제 파일 기준으로 보여야 합니다.</strong>
                  <p>업로드 후에는 최근 거래와 함께 검토 플래그를 보여서 어느 행을 먼저 고쳐야 할지 바로 알 수 있습니다.</p>
                </div>
              )}
            </article>

            <article className="surface">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Practical Standard</p>
                  <h2>실무 적용 기준</h2>
                </div>
              </div>
              <ul className="review-list compact">
                <li>업로드 직후 미분류 거래와 누락값이 먼저 보여야 합니다.</li>
                <li>카드 사용, 카드 결제, 이자/수수료가 생활비와 섞이면 안 됩니다.</li>
                <li>월별 흐름과 결제수단별 지출을 같은 화면에서 비교할 수 있어야 합니다.</li>
                <li>문제 거래는 합계보다 먼저 수정 큐로 노출되어야 합니다.</li>
              </ul>
            </article>
          </section>
        </section>
      )}

      <aside className={`assistant-drawer ${assistantOpen ? "open" : ""}`}>
        <div className="assistant-header">
          <div>
            <p className="section-kicker">Accounting AI</p>
            <h2>회계 AI 대화</h2>
          </div>
          <span className={`status-pill ${assistantStatus}`}>{assistantStatus}</span>
          <button className="ghost-button" type="button" onClick={() => setAssistantOpen(false)}>
            닫기
          </button>
        </div>
        <div className="assistant-body">
          {chatMessages.map((message, index) => (
            <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
              {message.text}
            </div>
          ))}
        </div>
        <div className="assistant-footer">
          <div className="prompt-grid compact-prompts">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="prompt-chip"
                onClick={() => handleAsk(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="assistant-input-row">
            <input
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="예: 이번 달 위험한 거래 유형 설명해줘"
            />
            <button className="primary-button" type="button" onClick={() => handleAsk(assistantInput)}>
              질문
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}

function buildOverviewIndicators(preview) {
  if (!preview) {
    return [
      { label: "안전", score: 62, state: "대기", tone: "positive" },
      { label: "준수", score: 58, state: "대기", tone: "accent" },
      { label: "위험", score: 41, state: "미확인", tone: "warning" },
      { label: "현금흐름", score: 55, state: "대기", tone: "accent" },
      { label: "분류정확도", score: 48, state: "미확인", tone: "default" },
    ];
  }

  const reviewCount = preview.reviewQueue.reduce((sum, item) => sum + item.count, 0);
  const uncategorized = findIssueCount(preview.reviewQueue, "미분류 거래");
  const missingOrigin = findIssueCount(preview.reviewQueue, "원거래 연결 누락");
  const missingType = findIssueCount(preview.reviewQueue, "거래구분 누락");
  const netIsPositive = preview.totals.net.startsWith("+");

  return [
    {
      label: "안전",
      score: clampScore(88 - reviewCount * 4),
      state: reviewCount > 6 ? "주의" : "안정",
      tone: "positive",
    },
    {
      label: "준수",
      score: clampScore(84 - (missingType + missingOrigin) * 7),
      state: missingType + missingOrigin > 0 ? "보완 필요" : "준수",
      tone: "accent",
    },
    {
      label: "위험",
      score: clampScore(24 + reviewCount * 6),
      state: reviewCount > 5 ? "높음" : "관리 가능",
      tone: "warning",
    },
    {
      label: "현금흐름",
      score: netIsPositive ? 78 : 39,
      state: netIsPositive ? "유입 우세" : "유출 우세",
      tone: netIsPositive ? "positive" : "warning",
    },
    {
      label: "분류정확도",
      score: clampScore(90 - uncategorized * 8),
      state: uncategorized > 0 ? "정리 필요" : "양호",
      tone: uncategorized > 0 ? "warning" : "accent",
    },
  ];
}

function buildDashboardHighlights(preview) {
  if (!preview) {
    return [
      { label: "생활/운영 지출", value: "-", note: "업로드 후 계산", width: 48, tone: "accent" },
      { label: "금융비용", value: "-", note: "이자/수수료 반영", width: 24, tone: "warning" },
      { label: "주 결제수단", value: "-", note: "결제수단별 지출", width: 36, tone: "positive" },
    ];
  }

  const topCategory = preview.categorySpend[0];
  const secondCategory = preview.categorySpend[1];
  const topPayment = preview.paymentSummary[0];
  const maxCategoryRatio = maxExpense(preview.categorySpend);
  const maxPaymentRatio = maxExpense(preview.paymentSummary);

  return [
    {
      label: topCategory?.label || "상위 카테고리",
      value: topCategory?.expense || "-",
      note: "현재 가장 큰 지출 카테고리",
      width: percentOf(topCategory?.ratio, maxCategoryRatio),
      tone: "accent",
    },
    {
      label: secondCategory?.label || "차순위 카테고리",
      value: secondCategory?.expense || "-",
      note: "지출 집중도 비교",
      width: percentOf(secondCategory?.ratio, maxCategoryRatio),
      tone: "positive",
    },
    {
      label: topPayment?.label || "주 결제수단",
      value: topPayment?.expense || "-",
      note: "결제수단 기준 최대 지출",
      width: percentOf(topPayment?.ratio, maxPaymentRatio),
      tone: "warning",
    },
  ];
}

function buildAssistantWelcome(preview) {
  const topIssue = preview.reviewQueue[0];
  const topInsight = preview.insights[0];

  if (!preview) {
    return "회계 AI 코파일럿입니다. 거래 파일을 업로드하면 가계부와 회계 기준으로 우선순위를 바로 설명합니다.";
  }

  return `${preview.fileName} 분석을 시작했습니다. ${topIssue ? `${topIssue.title} ${topIssue.count}건이 가장 먼저 보입니다.` : "즉시 검토할 오류는 크지 않습니다."} ${topInsight || ""}`.trim();
}

function findIssueCount(reviewQueue, title) {
  return reviewQueue.find((item) => item.title === title)?.count || 0;
}

function maxExpense(rows) {
  return rows.reduce((max, row) => Math.max(max, row.ratio), 0);
}

function percentOf(value, max) {
  if (!value || !max) {
    return 0;
  }

  return Math.min(100, (value / max) * 100);
}

function clampScore(value) {
  return Math.max(12, Math.min(96, Math.round(value)));
}
