from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from decimal import Decimal


@dataclass(slots=True)
class User:
    id: int | None
    name: str
    email: str = ""

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "name": self.name, "email": self.email}


@dataclass(slots=True)
class Transaction:
    source_file: str
    account: str
    occurred_on: date
    description: str
    amount: Decimal
    transaction_type: str
    balance: Decimal | None
    category: str
    notes: str = ""

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["occurred_on"] = self.occurred_on.isoformat()
        data["amount"] = f"{self.amount:.2f}"
        data["balance"] = "" if self.balance is None else f"{self.balance:.2f}"
        return data


@dataclass(slots=True)
class StoredTransaction(Transaction):
    user_id: int = 0
    transaction_hash: str = ""
