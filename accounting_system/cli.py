from __future__ import annotations

import argparse
import json
from pathlib import Path

from .parser import parse_statement
from .reporting import build_user_month_summary, export_ledger
from .storage import LedgerStorage


def main() -> int:
    parser = argparse.ArgumentParser(
        description="은행 거래내역을 사용자별로 누적 저장하고 월 정산 보고서를 생성합니다."
    )
    parser.add_argument("--db", default="data/ledger.db", help="누적 거래 데이터를 저장할 SQLite 경로")
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="원본 거래내역을 사용자 장부에 누적 저장")
    import_parser.add_argument("--user", required=True, help="사용자명")
    import_parser.add_argument("--email", default="", help="사용자 이메일")
    import_parser.add_argument("--input", required=True, help="원본 거래내역 CSV/TSV 파일 또는 디렉터리")

    report_parser = subparsers.add_parser("report", help="사용자 누적 거래의 월 정산 보고서 생성")
    report_parser.add_argument("--user", required=True, help="사용자명")
    report_parser.add_argument("--month", default=None, help="조회 월, 예: 2026-03")
    report_parser.add_argument("--output", default="output", help="보고서 저장 디렉터리")

    users_parser = subparsers.add_parser("users", help="등록된 사용자 목록 확인")
    users_parser.add_argument("--format", choices=("table", "json"), default="table", help="출력 형식")

    args = parser.parse_args()
    storage = LedgerStorage(Path(args.db))
    try:
        if args.command == "import":
            return _run_import(storage, args.user, args.email, Path(args.input))
        if args.command == "report":
            return _run_report(storage, args.user, args.month, Path(args.output))
        if args.command == "users":
            return _run_users(storage, args.format)
    finally:
        storage.close()
    return 0


def _run_import(storage: LedgerStorage, user_name: str, email: str, input_path: Path) -> int:
    files = _collect_files(input_path)
    if not files:
        raise SystemExit("처리할 CSV/TSV 파일이 없습니다.")

    user = storage.get_or_create_user(user_name, email)
    transactions = []
    for file_path in files:
        parsed = parse_statement(file_path)
        transactions.extend(parsed.transactions)

    result = storage.save_transactions(user, transactions)
    print(f"user={user.name}")
    print(f"parsed={len(transactions)}")
    print(f"inserted={result['inserted']}")
    print(f"skipped={result['skipped']}")
    print(f"db={storage.db_path}")
    return 0


def _run_report(storage: LedgerStorage, user_name: str, month: str | None, output_path: Path) -> int:
    user = storage.get_or_create_user(user_name)
    transactions = storage.load_transactions(user, month=month)
    if not transactions:
        raise SystemExit("조회된 거래가 없습니다.")

    ledger_path, summary_path = export_ledger(transactions, output_path)
    summary = build_user_month_summary(transactions, month=month)
    month_summary_path = output_path / "monthly_summary.json"
    output_path.mkdir(parents=True, exist_ok=True)
    month_summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"user={user.name}")
    print(f"transactions={len(transactions)}")
    print(f"ledger={ledger_path}")
    print(f"summary={summary_path}")
    print(f"monthly_summary={month_summary_path}")
    return 0


def _run_users(storage: LedgerStorage, output_format: str) -> int:
    users = storage.list_users()
    if output_format == "json":
        print(json.dumps([user.to_dict() for user in users], ensure_ascii=False, indent=2))
        return 0

    for user in users:
        print(f"{user.id}\t{user.name}\t{user.email}")
    return 0


def _collect_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    return sorted(
        path
        for path in input_path.rglob("*")
        if path.is_file() and path.suffix.lower() in {".csv", ".tsv"}
    )
