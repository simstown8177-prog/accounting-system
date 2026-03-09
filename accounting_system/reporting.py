from __future__ import annotations

import csv
import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

from .models import Transaction


def export_ledger(transactions: list[Transaction], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = output_dir / "ledger.csv"
    summary_path = output_dir / "summary.json"

    with ledger_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "occurred_on",
                "account",
                "description",
                "amount",
                "transaction_type",
                "category",
                "balance",
                "source_file",
                "notes",
            ],
        )
        writer.writeheader()
        for transaction in transactions:
            writer.writerow(transaction.to_dict())

    summary = build_summary(transactions)
    with summary_path.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    return ledger_path, summary_path


def build_summary(transactions: list[Transaction]) -> dict[str, object]:
    income = Decimal("0")
    expense = Decimal("0")
    by_category: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    by_month: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"income": Decimal("0"), "expense": Decimal("0"), "net": Decimal("0")}
    )

    for transaction in transactions:
        month_key = transaction.occurred_on.strftime("%Y-%m")
        by_category[transaction.category] += transaction.amount
        if transaction.amount > 0:
            income += transaction.amount
            by_month[month_key]["income"] += transaction.amount
        else:
            expense += abs(transaction.amount)
            by_month[month_key]["expense"] += abs(transaction.amount)
        by_month[month_key]["net"] += transaction.amount

    return {
        "transaction_count": len(transactions),
        "income_total": _format_decimal(income),
        "expense_total": _format_decimal(expense),
        "net_total": _format_decimal(income - expense),
        "categories": {key: _format_decimal(value) for key, value in sorted(by_category.items())},
        "months": {
            key: {name: _format_decimal(amount) for name, amount in value.items()}
            for key, value in sorted(by_month.items())
        },
    }


def build_user_month_summary(transactions: list[Transaction], month: str | None = None) -> dict[str, object]:
    summary = build_summary(transactions)
    summary["target_month"] = month or "all"
    summary["accounts"] = _build_account_summary(transactions)
    return summary


def _build_account_summary(transactions: list[Transaction]) -> dict[str, dict[str, str]]:
    by_account: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"income": Decimal("0"), "expense": Decimal("0"), "net": Decimal("0")}
    )
    for transaction in transactions:
        account = by_account[transaction.account]
        if transaction.amount > 0:
            account["income"] += transaction.amount
        else:
            account["expense"] += abs(transaction.amount)
        account["net"] += transaction.amount

    return {
        name: {key: _format_decimal(value) for key, value in totals.items()}
        for name, totals in sorted(by_account.items())
    }


def _format_decimal(value: Decimal) -> str:
    return f"{value:.2f}"
