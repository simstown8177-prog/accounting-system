"use client";

import { useRef, useState } from "react";

const topMetrics = [
  { label: "이번 달 수입", value: "3,200,000원", note: "전월 대비 +3.2%", tone: "positive" },
  { label: "이번 달 지출", value: "1,284,500원", note: "고정지출 포함", tone: "default" },
  { label: "순현금 흐름", value: "1,915,500원", note: "계좌 기준", tone: "accent" },
  { label: "카드 청구 예정", value: "412,100원", note: "다음 결제일 04-15", tone: "warning" },
];

const budgetRows = [
  { category: "식비", spent: "428,000", budget: "500,000", ratio: 86 },
  { category: "교통", spent: "94,000", budget: "120,000", ratio: 78 },
  { category: "생활", spent: "210,000", budget: "300,000", ratio: 70 },
  { category: "금융비용", spent: "12,400", budget: "20,000", ratio: 62 },
];

const cashflowRows = [
  { label: "즉시 지출", value: "872,400원" },
  { label: "신용카드 사용", value: "321,700원" },
  { label: "카드 대금 상환", value: "280,000원" },
  { label: "할부 이자", value: "12,400원" },
];

const reviewItems = [
  { title: "거래 분리 필요", detail: "카드결제와 생활비가 합쳐진 거래 2건", priority: "high" },
  { title: "원거래 연결 필요", detail: "원거래ID 없이 들어온 할부 사용 1건", priority: "medium" },
  { title: "미분류 거래", detail: "카테고리 없는 현금 인출 3건", priority: "low" },
];

const recentTransactions = [
  {
    date: "2026-04-15",
    type: "카드결제",
    account: "주거래통장",
    description: "OO카드 4월 청구분",
    amount: "-32,100",
    state: "부채상환",
  },
  {
    date: "2026-04-15",
    type: "할부이자",
    account: "OO카드",
    description: "3개월 할부 이자",
    amount: "-2,100",
    state: "금융비용",
  },
  {
    date: "2026-04-12",
    type: "일반계좌지출",
    account: "주거래통장",
    description: "마트 장보기",
    amount: "-85,000",
    state: "식비",
  },
  {
    date: "2026-04-10",
    type: "입금",
    account: "주거래통장",
    description: "급여 4월",
    amount: "+3,200,000",
    state: "수입",
  },
];

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

export default function DashboardClient() {
  const inputRef = useRef(null);
  const [uploadState, setUploadState] = useState({
    status: "idle",
    message: "표준 CSV를 올리면 헤더와 거래 구성을 바로 검증합니다.",
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
      message: "업로드 파일을 검사하고 있습니다.",
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

      setUploadState({
        status: "success",
        message: `${payload.fileName} 파일을 인식했습니다. ${payload.rowCount}건의 거래를 확인했습니다.`,
        preview: payload,
      });
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

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Accounting System</p>
          <h1 className="dashboard-title">월 정산 대시보드</h1>
          <p className="dashboard-subtitle">생활비, 카드채무, 할부이자, 미분류 거래를 한 화면에서 확인합니다.</p>
        </div>
        <div className="dashboard-actions">
          <button className="primary-button" type="button" onClick={openPicker}>거래 업로드</button>
          <a className="secondary-button link-button" href="/api/template">양식 다운로드</a>
        </div>
        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          onChange={handleFileChange}
        />
      </header>

      <section className="dashboard-nav">
        <span className="nav-chip active">대시보드</span>
        <span className="nav-chip">월 정산</span>
        <span className="nav-chip">거래 검토</span>
        <span className="nav-chip">카드/할부</span>
        <span className="nav-chip">업로드</span>
      </section>

      <section className="summary-grid" aria-label="summary">
        {topMetrics.map((card) => (
          <article className={`summary-card ${card.tone}`} key={card.label}>
            <span className="summary-label">{card.label}</span>
            <strong className="summary-value">{card.value}</strong>
            <span className="summary-note">{card.note}</span>
          </article>
        ))}
      </section>

      <section className="hero hero-dashboard">
        <article className="hero-copy">
          <div className="section-head">
            <div>
              <p className="section-kicker">Closing Snapshot</p>
              <h2>이번 달 마감 현황</h2>
            </div>
            <span className="section-meta">2026-04 기준</span>
          </div>
          <div className="cashflow-grid">
            {cashflowRows.map((row) => (
              <div className="cashflow-card" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="hero-panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Upload Standard</p>
              <h2>표준 업로드 헤더</h2>
            </div>
            <span className={`status-pill ${uploadState.status}`}>{uploadState.status}</span>
          </div>
          <div className="template-grid">
            {uploadColumns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          <p className="panel-note">{uploadState.message}</p>
        </article>
      </section>

      <section className="content-grid">
        <article className="surface tall-surface">
          <div className="section-head">
            <div>
              <p className="section-kicker">Budget Control</p>
              <h2>예산 대비 현황</h2>
            </div>
            <span className="section-meta">카테고리별 진행률</span>
          </div>
          <div className="budget-list">
            {budgetRows.map((row) => (
              <div className="budget-row" key={row.category}>
                <div className="budget-head">
                  <strong>{row.category}</strong>
                  <span>{row.spent} / {row.budget}</span>
                </div>
                <div className="budget-bar">
                  <span style={{ width: `${row.ratio}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="section-head">
            <div>
              <p className="section-kicker">Review Queue</p>
              <h2>검토 필요 항목</h2>
            </div>
          </div>
          <div className="alert-list">
            {reviewItems.map((item) => (
              <div className={`alert-card ${item.priority}`} key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid bottom-grid">
        <article className="surface tall-surface">
          <div className="section-head">
            <div>
              <p className="section-kicker">Recent Transactions</p>
              <h2>최근 거래</h2>
            </div>
            <span className="section-meta">수입 / 지출 / 부채상환 분리</span>
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>일자</th>
                  <th>구분</th>
                  <th>계좌/카드</th>
                  <th>적요</th>
                  <th>금액</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((row) => (
                  <tr key={`${row.date}-${row.description}-${row.amount}`}>
                    <td>{row.date}</td>
                    <td>{row.type}</td>
                    <td>{row.account}</td>
                    <td>{row.description}</td>
                    <td>{row.amount}</td>
                    <td>{row.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <p className="upload-text">표준 양식 CSV를 올리면 헤더 검증과 거래 미리보기를 바로 보여줍니다.</p>
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
                  <span>수입 합계</span>
                  <strong>{uploadState.preview.totals.income}</strong>
                </div>
                <div className="metric-box">
                  <span>지출 합계</span>
                  <strong>{uploadState.preview.totals.expense}</strong>
                </div>
                <div className="metric-box">
                  <span>이자/수수료</span>
                  <strong>{uploadState.preview.totals.fees}</strong>
                </div>
              </div>
              <div className="preview-list">
                {uploadState.preview.previewRows.map((row) => (
                  <div className="preview-row" key={`${row.거래일자}-${row.적요}-${row.지출금액}-${row.수입금액}`}>
                    <span>{row.거래일자}</span>
                    <span>{row.거래구분}</span>
                    <span>{row.적요}</span>
                    <strong>{row.지출금액 || row.수입금액 || "0"}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-preview">
              <strong>아직 업로드된 파일이 없습니다.</strong>
              <p>우측 버튼으로 표준 양식 파일을 올리면 이 영역에 거래 미리보기와 기본 합계가 표시됩니다.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
