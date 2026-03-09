from __future__ import annotations

import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class AccountingSystemTests(unittest.TestCase):
    def test_standard_template_import_supports_card_and_payment_split(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            input_dir = temp_path / "input"
            output_dir = temp_path / "output"
            db_path = temp_path / "ledger.db"
            input_dir.mkdir()

            file_path = input_dir / "standard.csv"
            with file_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(
                    [
                        "거래일자",
                        "거래구분",
                        "결제수단",
                        "계좌/카드명",
                        "적요",
                        "상대처",
                        "수입금액",
                        "지출금액",
                        "통화",
                        "카테고리",
                        "세부카테고리",
                        "할부여부",
                        "할부개월",
                        "할부회차",
                        "원거래ID",
                        "이자/수수료",
                        "잔액",
                        "메모",
                    ]
                )
                writer.writerow(
                    ["2026-03-05", "신용카드사용", "신용카드", "OO카드", "식당 모임", "음식점", "0", "90000", "KRW", "식비", "외식", "Y", "3", "1", "CARD-1", "0", "", ""]
                )
                writer.writerow(
                    ["2026-04-15", "카드결제", "계좌", "주거래통장", "OO카드 4월 청구분", "OO카드사", "0", "32100", "KRW", "카드대금", "부채상환", "N", "0", "0", "CARDPAY-1", "2100", "4882900", ""]
                )

            import_result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "accounting_system",
                    "--db",
                    str(db_path),
                    "import",
                    "--user",
                    "kim",
                    "--input",
                    str(input_dir),
                ],
                cwd="/home/user/accounting-system",
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(import_result.returncode, 0, import_result.stderr)

            report_result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "accounting_system",
                    "--db",
                    str(db_path),
                    "report",
                    "--user",
                    "kim",
                    "--output",
                    str(output_dir),
                ],
                cwd="/home/user/accounting-system",
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(report_result.returncode, 0, report_result.stderr)

            monthly_summary_path = output_dir / "monthly_summary.json"
            with monthly_summary_path.open("r", encoding="utf-8") as handle:
                monthly_summary = json.load(handle)

            self.assertEqual(monthly_summary["transaction_count"], 2)
            self.assertEqual(monthly_summary["expense_total"], "122100.00")
            self.assertIn("카드대금", monthly_summary["categories"])
            self.assertIn("식비", monthly_summary["categories"])

    def test_cli_persists_transactions_and_generates_monthly_report(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            input_dir = temp_path / "input"
            output_dir = temp_path / "output"
            db_path = temp_path / "ledger.db"
            input_dir.mkdir()

            file_path = input_dir / "bank.csv"
            with file_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["거래일자", "거래내용", "출금금액", "입금금액", "잔액", "계좌"])
                writer.writerow(["2026-03-01", "급여 3월", "0", "3200000", "5000000", "주거래통장"])
                writer.writerow(["2026-03-02", "마트 장보기", "85000", "0", "4915000", "주거래통장"])
                writer.writerow(["2026-03-03", "버스 충전", "50000", "0", "4865000", "주거래통장"])

            import_result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "accounting_system",
                    "--db",
                    str(db_path),
                    "import",
                    "--user",
                    "hong",
                    "--input",
                    str(input_dir),
                ],
                cwd="/home/user/accounting-system",
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(import_result.returncode, 0, import_result.stderr)

            report_result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "accounting_system",
                    "--db",
                    str(db_path),
                    "report",
                    "--user",
                    "hong",
                    "--month",
                    "2026-03",
                    "--output",
                    str(output_dir),
                ],
                cwd="/home/user/accounting-system",
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(report_result.returncode, 0, report_result.stderr)
            ledger_path = output_dir / "ledger.csv"
            summary_path = output_dir / "summary.json"
            monthly_summary_path = output_dir / "monthly_summary.json"
            self.assertTrue(ledger_path.exists())
            self.assertTrue(summary_path.exists())
            self.assertTrue(monthly_summary_path.exists())

            with monthly_summary_path.open("r", encoding="utf-8") as handle:
                monthly_summary = json.load(handle)

            self.assertEqual(monthly_summary["transaction_count"], 3)
            self.assertEqual(monthly_summary["income_total"], "3200000.00")
            self.assertEqual(monthly_summary["expense_total"], "135000.00")
            self.assertEqual(monthly_summary["net_total"], "3065000.00")
            self.assertEqual(monthly_summary["target_month"], "2026-03")
            self.assertIn("식비", monthly_summary["categories"])
            self.assertIn("교통", monthly_summary["categories"])
            self.assertIn("주거래통장", monthly_summary["accounts"])

    def test_cli_skips_duplicate_imports(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            input_dir = temp_path / "input"
            db_path = temp_path / "ledger.db"
            input_dir.mkdir()

            file_path = input_dir / "bank.csv"
            with file_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["거래일자", "거래내용", "출금금액", "입금금액", "잔액", "계좌"])
                writer.writerow(["2026-03-02", "마트 장보기", "85000", "0", "4915000", "주거래통장"])

            first = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "accounting_system",
                    "--db",
                    str(db_path),
                    "import",
                    "--user",
                    "hong",
                    "--input",
                    str(input_dir),
                ],
                cwd="/home/user/accounting-system",
                check=False,
                capture_output=True,
                text=True,
            )
            second = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "accounting_system",
                    "--db",
                    str(db_path),
                    "import",
                    "--user",
                    "hong",
                    "--input",
                    str(input_dir),
                ],
                cwd="/home/user/accounting-system",
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertIn("inserted=1", first.stdout)
            self.assertIn("skipped=1", second.stdout)


if __name__ == "__main__":
    unittest.main()
