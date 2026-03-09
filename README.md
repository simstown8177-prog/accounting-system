# Accounting System

은행에서 내려받은 거래내역 CSV/TSV 파일을 그대로 넣으면 자동으로 읽어서 사용자별 장부에 누적 저장하고, 월 정산에 필요한 가계부형 요약 데이터를 생성하는 회계시스템입니다.

현재 저장소는 두 층으로 구성됩니다.

- Python 장부 엔진: 원본 거래 정규화, 누적 저장, 보고서 생성
- Next.js 웹 UI: Vercel 배포용 대시보드 골격

## 지원 기능

- 은행별로 다른 컬럼명을 자동 추정해 거래일, 적요, 입금/출금, 잔액, 계좌명을 표준화
- 여러 사용자의 거래를 SQLite에 누적 저장
- 여러 파일을 한 번에 읽어 사용자 장부에 반영
- 같은 거래 재업로드 시 해시 기준으로 중복 저장 방지
- 거래 설명을 기준으로 식비, 교통, 주거/공과금, 통신, 의료, 보험, 교육, 쇼핑, 금융, 급여 등으로 자동 분류
- `ledger.csv`로 조회 대상 거래 장부 출력
- `summary.json`, `monthly_summary.json`으로 월별 수입/지출/순증감, 계좌별, 카테고리별 집계 출력

## 프로젝트 구조

- `app/`: Vercel 배포용 Next.js UI
- `accounting_system/parser.py`: 원본 은행 파일 해석
- `accounting_system/categorization.py`: 가계부 카테고리 자동 분류
- `accounting_system/storage.py`: 사용자/거래 누적 저장
- `accounting_system/reporting.py`: 장부/요약 파일 생성
- `accounting_system/cli.py`: 실행 진입점
- `templates/standard_ledger_upload.csv`: 표준 업로드 양식
- `docs/upload-template.md`: 컬럼/입력 규칙 문서

## Vercel 배포

웹 구조는 Next.js 기준으로 추가되어 있습니다.

```bash
npm install
npm run build
```

Vercel에서는 루트 디렉터리를 그대로 연결하면 됩니다.

현재 UI 화면은 다음 목적의 골격입니다.

- 표준 양식 업로드
- 월 정산 요약
- 카드/할부/이자 분리 표시
- 거래 검토와 미분류 큐 확인

추가된 동작형 API:

- `GET /api/template`: 표준 업로드 CSV 양식 다운로드
- `POST /api/upload-preview`: 업로드 파일 헤더 검증과 거래 미리보기 반환

## 실행 방법

1. 거래내역을 누적 저장

```bash
python3 -m accounting_system --db ./data/ledger.db import --user hong --input ./bank-files
```

2. 월 정산 보고서 생성

```bash
python3 -m accounting_system --db ./data/ledger.db report --user hong --month 2026-03 --output ./output
```

3. 등록된 사용자 목록 조회

```bash
python3 -m accounting_system --db ./data/ledger.db users
```

표준 양식 기준으로 업로드하려면:

1. `templates/standard_ledger_upload.csv`를 엽니다.
2. 은행/카드 원본 내용을 해당 컬럼에 맞게 복붙합니다.
3. `거래구분`에 `신용카드사용`, `카드결제`, `할부이자` 등을 정확히 넣습니다.
4. 저장 후 `import` 명령으로 누적 업로드합니다.

실행 결과:

- `output/ledger.csv`
- `output/summary.json`
- `output/monthly_summary.json`
- `data/ledger.db`

## 입력 파일 형식

현재는 `csv`, `tsv`를 지원합니다. 다음과 같은 헤더들을 자동 인식합니다.

- 날짜: `거래일자`, `거래일`, `일자`, `승인일`, `date`
- 설명: `거래내용`, `적요`, `내용`, `가맹점`, `description`
- 금액: `출금금액`, `입금금액`, `거래금액`, `금액`, `amount`
- 잔액: `잔액`, `balance`
- 계좌/카드: `계좌`, `카드`, `은행`, `account`
- 표준 양식 전용: `거래구분`, `결제수단`, `계좌/카드명`, `상대처`, `수입금액`, `지출금액`, `이자/수수료`

권장 방식은 은행 원본을 직접 맞추기보다 [`docs/upload-template.md`](/home/user/accounting-system/docs/upload-template.md) 규격과 [`templates/standard_ledger_upload.csv`](/home/user/accounting-system/templates/standard_ledger_upload.csv) 양식에 맞춰 업로드하는 것입니다.

예시 CSV:

```csv
거래일자,거래내용,출금금액,입금금액,잔액,계좌
2026-03-01,급여 3월,0,3200000,5000000,주거래통장
2026-03-02,마트 장보기,85000,0,4915000,주거래통장
2026-03-03,버스 충전,50000,0,4865000,주거래통장
```

## 출력 예시

`monthly_summary.json`

```json
{
  "transaction_count": 3,
  "target_month": "2026-03",
  "income_total": "3200000.00",
  "expense_total": "135000.00",
  "net_total": "3065000.00",
  "categories": {
    "교통": "-50000.00",
    "급여": "3200000.00",
    "식비": "-85000.00"
  },
  "months": {
    "2026-03": {
      "income": "3200000.00",
      "expense": "135000.00",
      "net": "3065000.00"
    }
  },
  "accounts": {
    "주거래통장": {
      "income": "3200000.00",
      "expense": "135000.00",
      "net": "3065000.00"
    }
  }
}
```

## 테스트

```bash
python3 -m unittest discover -s tests
```

## 확장 포인트

- 은행사별 특수 포맷은 `accounting_system/parser.py`의 헤더 매핑 규칙에 추가 가능
- 카테고리 분류 규칙은 `accounting_system/categorization.py`에서 키워드 기반으로 확장 가능
- 장기 운영 시에는 SQLite 대신 Postgres로 교체하고 사용자 인증 API를 앞단에 붙이는 것이 적절
- 엑셀(`xlsx`) 원본까지 직접 받으려면 별도 파서 추가가 필요
