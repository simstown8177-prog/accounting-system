from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from .categorization import categorize
from .models import Transaction

DATE_FIELDS = ("date", "transaction date", "거래일", "거래일자", "일자", "승인일", "사용일")
DESCRIPTION_FIELDS = ("description", "details", "적요", "내용", "거래내용", "가맹점", "메모")
AMOUNT_FIELDS = ("amount", "거래금액", "금액", "출금금액", "입금금액", "승인금액", "사용금액", "지출금액", "수입금액")
WITHDRAWAL_FIELDS = ("withdrawal", "debit", "출금", "출금금액", "인출금액", "지출")
DEPOSIT_FIELDS = ("deposit", "credit", "입금", "입금금액", "수입")
BALANCE_FIELDS = ("balance", "잔액")
ACCOUNT_FIELDS = ("account", "계좌", "카드", "account name", "은행", "bank", "계좌/카드명")
TYPE_FIELDS = ("거래구분", "transaction type")
COUNTERPARTY_FIELDS = ("상대처", "merchant", "vendor")
INCOME_FIELDS = ("수입금액",)
EXPENSE_FIELDS = ("지출금액",)

DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y.%m.%d",
    "%Y/%m/%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y.%m.%d %H:%M:%S",
    "%Y/%m/%d %H:%M:%S",
    "%m/%d/%Y",
    "%d/%m/%Y",
)


@dataclass(slots=True)
class ParsedStatement:
    file_name: str
    transactions: list[Transaction]


def parse_statement(path: Path) -> ParsedStatement:
    rows = list(_read_rows(path))
    if not rows:
        return ParsedStatement(file_name=path.name, transactions=[])

    header_map = _build_header_map(rows[0].keys())
    transactions: list[Transaction] = []
    for row in rows:
        transaction = _to_transaction(path, row, header_map)
        if transaction is not None:
            transactions.append(transaction)
    transactions.sort(key=lambda item: (item.occurred_on, item.description, item.amount))
    return ParsedStatement(file_name=path.name, transactions=transactions)


def _read_rows(path: Path):
    encodings = ("utf-8-sig", "cp949", "utf-8")
    delimiters = (",", "\t", ";")
    last_error: Exception | None = None

    for encoding in encodings:
        for delimiter in delimiters:
            try:
                with path.open("r", encoding=encoding, newline="") as handle:
                    reader = csv.DictReader(handle, delimiter=delimiter)
                    if not reader.fieldnames:
                        continue
                    rows = [row for row in reader if any((value or "").strip() for value in row.values())]
                    if rows:
                        return rows
            except UnicodeDecodeError as error:
                last_error = error
                continue

    if last_error is not None:
        raise last_error
    return []


def _build_header_map(fieldnames: object) -> dict[str, str]:
    if fieldnames is None:
        return {}

    normalized = {name: _normalize_header(name) for name in fieldnames}
    header_map: dict[str, str] = {}
    for original, slim in normalized.items():
        if slim in DATE_FIELDS:
            header_map["date"] = original
        elif slim in DESCRIPTION_FIELDS:
            header_map["description"] = original
        elif slim in WITHDRAWAL_FIELDS:
            header_map["withdrawal"] = original
        elif slim in DEPOSIT_FIELDS:
            header_map["deposit"] = original
        elif slim in AMOUNT_FIELDS and "amount" not in header_map:
            header_map["amount"] = original
        elif slim in BALANCE_FIELDS:
            header_map["balance"] = original
        elif slim in ACCOUNT_FIELDS:
            header_map["account"] = original
        elif slim in TYPE_FIELDS:
            header_map["entry_type"] = original
        elif slim in COUNTERPARTY_FIELDS:
            header_map["counterparty"] = original
        elif slim in INCOME_FIELDS:
            header_map["income"] = original
        elif slim in EXPENSE_FIELDS:
            header_map["expense"] = original
    return header_map


def _to_transaction(path: Path, row: dict[str, str], header_map: dict[str, str]) -> Transaction | None:
    date_value = _pick_value(row, header_map, "date")
    description = _pick_value(row, header_map, "description") or "미분류 거래"
    counterparty = _pick_value(row, header_map, "counterparty")
    entry_type = _pick_value(row, header_map, "entry_type")
    account = _pick_value(row, header_map, "account") or path.stem

    if not date_value:
        return None

    occurred_on = _parse_date(date_value)
    if occurred_on is None:
        return None

    withdrawal = _parse_decimal(_pick_value(row, header_map, "withdrawal"))
    deposit = _parse_decimal(_pick_value(row, header_map, "deposit"))
    explicit_income = _parse_decimal(_pick_value(row, header_map, "income"))
    explicit_expense = _parse_decimal(_pick_value(row, header_map, "expense"))
    amount = _parse_decimal(_pick_value(row, header_map, "amount"))
    balance = _parse_decimal(_pick_value(row, header_map, "balance"))

    signed_amount = _resolve_amount(amount, withdrawal, deposit, explicit_income, explicit_expense, entry_type)
    if signed_amount is None:
        return None

    transaction_type = "income" if signed_amount > 0 else "expense"
    category = categorize(" ".join(part for part in (description, counterparty, entry_type) if part), float(signed_amount))
    return Transaction(
        source_file=path.name,
        account=account,
        occurred_on=occurred_on,
        description=description.strip(),
        amount=signed_amount,
        transaction_type=transaction_type,
        balance=balance,
        category=category,
    )


def _pick_value(row: dict[str, str], header_map: dict[str, str], field: str) -> str:
    column = header_map.get(field)
    if column is None:
        return ""
    return (row.get(column) or "").strip()


def _normalize_header(value: str) -> str:
    return " ".join(value.strip().lower().replace("_", " ").split())


def _parse_date(value: str):
    raw = value.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_decimal(value: str) -> Decimal | None:
    if not value:
        return None
    sanitized = (
        value.replace(",", "")
        .replace("원", "")
        .replace("$", "")
        .replace("KRW", "")
        .replace("krw", "")
        .strip()
    )
    if sanitized in {"", "-"}:
        return None
    if sanitized.startswith("(") and sanitized.endswith(")"):
        sanitized = f"-{sanitized[1:-1]}"
    try:
        return Decimal(sanitized)
    except InvalidOperation:
        return None


def _resolve_amount(
    amount: Decimal | None,
    withdrawal: Decimal | None,
    deposit: Decimal | None,
    explicit_income: Decimal | None,
    explicit_expense: Decimal | None,
    entry_type: str,
) -> Decimal | None:
    if explicit_income is not None or explicit_expense is not None:
        resolved = (explicit_income or Decimal("0")) - (explicit_expense or Decimal("0"))
        if entry_type in {"카드결제", "할부원금", "할부이자", "수수료", "연체이자", "신용카드사용", "일반계좌지출"}:
            return resolved if resolved <= 0 else -resolved
        return resolved
    if withdrawal is not None or deposit is not None:
        return (deposit or Decimal("0")) - (withdrawal or Decimal("0"))
    return amount
