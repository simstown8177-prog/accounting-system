"use client";

import { useRef, useState } from "react";

const summaryCards = [
  { label: "이번 달 수입", value: "3,200,000원", tone: "positive" },
  { label: "이번 달 지출", value: "1,284,500원", tone: "default" },
  { label: "카드 청구 예정", value: "412,100원", tone: "accent" },
  { label: "할부 이자", value: "12,400원", tone: "warning" },
];

const monthlyRows = [
  { month: "2026-03", income: "3,200,000", expense: "1,284,500", cardBill: "412,100", net: "1,915,500" },
  { month: "2026-02", income: "3,200,000", expense: "1,418,200", cardBill: "366,300", net: "1,781,800" },
  { month: "2026-01", income: "3,100,000", expense: "1,205,000", cardBill: "280,000", net: "1,895,000" },
];

const transactionRows = [
  {
    date: "2026-03-05",
    type: "신용카드사용",
    method: "신용카드",
    account: "OO카드",
    description: "식당 모임",
    category: "식비",
    amount: "-90,000",
    status: "정상 분류",
  },
  {
    date: "2026-03-12",
    type: "일반계좌지출",
    method: "체크카드",
    account: "주거래통장",
    description: "마트 장보기",
    category: "식비",
    amount: "-85,000",
    status: "정상 분류",
  },
  {
    date: "2026-04-15",
    type: "카드결제",
    method: "계좌",
    account: "주거래통장",
    description: "OO카드 4월 청구분",
    category: "카드대금",
    amount: "-32,100",
    status: "부채상환",
  },
  {
    date: "2026-04-15",
    type: "할부이자",
    method: "신용카드",
    account: "OO카드",
    description: "3개월 할부 이자",
    category: "금융",
    amount: "-2,100",
    status: "금융비용",
  },
];

const reviewItems = [
  "카드결제와 생활비가 섞인 거래 2건",
  "원거래ID 없이 들어온 할부 사용 1건",
  "카테고리 없는 현금 인출 3건",
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
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Persistent Household Ledger</p>
          <h1>작은 폰트 기준으로 정리한 월 정산 대시보드 구조</h1>
          <p className="hero-text">
            계좌 지출, 신용카드 사용, 카드 결제, 할부 이자까지 분리 저장하고 누적 데이터 기준으로 월 정산을 돕는 화면입니다.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={openPicker}>표준 양식 업로드</button>
            <a className="secondary-button link-button" href="/api/template">양식 다운로드</a>
          </div>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={handleFileChange}
          />
        </div>
        <div className="hero-panel">
          <div className="panel-label">업로드 기준</div>
          <div className="template-grid">
            {uploadColumns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          <p className="panel-note">표준 엑셀 또는 CSV 헤더가 이 구조와 같으면 자동 인식 대상으로 처리</p>
        </div>
      </section>

      <section className="summary-grid" aria-label="summary">
        {summaryCards.map((card) => (
          <article className={`summary-card ${card.tone}`} key={card.label}>
            <span className="summary-label">{card.label}</span>
            <strong className="summary-value">{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="surface tall-surface">
          <div className="section-head">
            <div>
              <p className="section-kicker">Monthly Settlement</p>
              <h2>월별 정산</h2>
            </div>
            <span className="section-meta">최근 3개월</span>
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>월</th>
                  <th>수입</th>
                  <th>지출</th>
                  <th>카드청구</th>
                  <th>순증감</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{row.income}</td>
                    <td>{row.expense}</td>
                    <td>{row.cardBill}</td>
                    <td>{row.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="surface">
          <div className="section-head">
            <div>
              <p className="section-kicker">Card And Installment</p>
              <h2>카드/할부 현황</h2>
            </div>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <span>이번 달 카드 청구</span>
              <strong>412,100원</strong>
            </div>
            <div className="stack-item">
              <span>남은 할부 원금</span>
              <strong>180,000원</strong>
            </div>
            <div className="stack-item">
              <span>예상 할부 이자</span>
              <strong>12,400원</strong>
            </div>
            <div className="stack-item">
              <span>연체 위험 건수</span>
              <strong>0건</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="content-grid bottom-grid">
        <article className="surface tall-surface">
          <div className="section-head">
            <div>
              <p className="section-kicker">Transactions</p>
              <h2>거래 검토</h2>
            </div>
            <span className="section-meta">생활비 / 부채상환 / 금융비용 분리</span>
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>일자</th>
                  <th>구분</th>
                  <th>수단</th>
                  <th>계좌/카드</th>
                  <th>적요</th>
                  <th>카테고리</th>
                  <th>금액</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {transactionRows.map((row) => (
                  <tr key={`${row.date}-${row.description}-${row.amount}`}>
                    <td>{row.date}</td>
                    <td>{row.type}</td>
                    <td>{row.method}</td>
                    <td>{row.account}</td>
                    <td>{row.description}</td>
                    <td>{row.category}</td>
                    <td>{row.amount}</td>
                    <td>{row.status}</td>
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
              <h2>업로드 검증</h2>
            </div>
            <span className={`status-pill ${uploadState.status}`}>{uploadState.status}</span>
          </div>
          <div className="upload-box">
            <p className="upload-title">표준 양식 업로드</p>
            <p className="upload-text">{uploadState.message}</p>
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
                  <div className="preview-row" key={`${row.거래일자}-${row.적요}-${row.지출금액}`}>
                    <span>{row.거래일자}</span>
                    <span>{row.거래구분}</span>
                    <span>{row.적요}</span>
                    <strong>{row.지출금액 || row.수입금액 || "0"}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ul className="review-list compact">
              {reviewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
