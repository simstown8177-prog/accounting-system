from __future__ import annotations

import hashlib
import sqlite3
from decimal import Decimal
from pathlib import Path

from .models import StoredTransaction, Transaction, User


class LedgerStorage:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(db_path)
        self.connection.row_factory = sqlite3.Row
        self._initialize()

    def close(self) -> None:
        self.connection.close()

    def _initialize(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                source_file TEXT NOT NULL,
                account TEXT NOT NULL,
                occurred_on TEXT NOT NULL,
                description TEXT NOT NULL,
                amount TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                balance TEXT,
                category TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                transaction_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, transaction_hash),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )
        self.connection.commit()

    def get_or_create_user(self, name: str, email: str = "") -> User:
        row = self.connection.execute(
            "SELECT id, name, email FROM users WHERE name = ?",
            (name,),
        ).fetchone()
        if row is not None:
            return User(id=row["id"], name=row["name"], email=row["email"])

        cursor = self.connection.execute(
            "INSERT INTO users(name, email) VALUES(?, ?)",
            (name, email),
        )
        self.connection.commit()
        return User(id=cursor.lastrowid, name=name, email=email)

    def save_transactions(self, user: User, transactions: list[Transaction]) -> dict[str, int]:
        inserted = 0
        skipped = 0
        for transaction in transactions:
            transaction_hash = build_transaction_hash(transaction)
            try:
                self.connection.execute(
                    """
                    INSERT INTO transactions(
                        user_id, source_file, account, occurred_on, description,
                        amount, transaction_type, balance, category, notes, transaction_hash
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user.id,
                        transaction.source_file,
                        transaction.account,
                        transaction.occurred_on.isoformat(),
                        transaction.description,
                        f"{transaction.amount:.2f}",
                        transaction.transaction_type,
                        None if transaction.balance is None else f"{transaction.balance:.2f}",
                        transaction.category,
                        transaction.notes,
                        transaction_hash,
                    ),
                )
                inserted += 1
            except sqlite3.IntegrityError:
                skipped += 1
        self.connection.commit()
        return {"inserted": inserted, "skipped": skipped}

    def load_transactions(self, user: User, month: str | None = None) -> list[StoredTransaction]:
        query = """
            SELECT user_id, source_file, account, occurred_on, description, amount,
                   transaction_type, balance, category, notes, transaction_hash
            FROM transactions
            WHERE user_id = ?
        """
        params: list[object] = [user.id]
        if month:
            query += " AND substr(occurred_on, 1, 7) = ?"
            params.append(month)
        query += " ORDER BY occurred_on, description, amount"

        rows = self.connection.execute(query, tuple(params)).fetchall()
        return [self._row_to_transaction(row) for row in rows]

    def list_users(self) -> list[User]:
        rows = self.connection.execute(
            "SELECT id, name, email FROM users ORDER BY name"
        ).fetchall()
        return [User(id=row["id"], name=row["name"], email=row["email"]) for row in rows]

    def _row_to_transaction(self, row: sqlite3.Row) -> StoredTransaction:
        from datetime import date

        return StoredTransaction(
            user_id=row["user_id"],
            transaction_hash=row["transaction_hash"],
            source_file=row["source_file"],
            account=row["account"],
            occurred_on=date.fromisoformat(row["occurred_on"]),
            description=row["description"],
            amount=Decimal(row["amount"]),
            transaction_type=row["transaction_type"],
            balance=None if row["balance"] in (None, "") else Decimal(row["balance"]),
            category=row["category"],
            notes=row["notes"],
        )


def build_transaction_hash(transaction: Transaction) -> str:
    payload = "|".join(
        [
            transaction.source_file,
            transaction.account,
            transaction.occurred_on.isoformat(),
            transaction.description.strip().lower(),
            f"{transaction.amount:.2f}",
            transaction.transaction_type,
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
