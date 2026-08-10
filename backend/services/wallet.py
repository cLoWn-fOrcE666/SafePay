"""
Wallet service — all money movements go through here.
SQLAlchemy's session with with_for_update() gives us row-level locking
which is SQLite's closest equivalent to SELECT FOR UPDATE (ACID behaviour).
"""
from extensions import db
from models import Wallet, Transaction, Notification
from services.socket_service import emit_notification


def get_or_create_wallet(owner_id: int, owner_type: str) -> Wallet:
    wallet = Wallet.query.filter_by(owner_id=owner_id, owner_type=owner_type).first()
    if not wallet:
        wallet = Wallet(owner_id=owner_id, owner_type=owner_type, balance=0.0)
        db.session.add(wallet)
        db.session.commit()
    return wallet


def get_balance(owner_id: int, owner_type: str) -> float:
    wallet = Wallet.query.filter_by(owner_id=owner_id, owner_type=owner_type).first()
    return wallet.balance if wallet else 0.0


def transfer(
    sender_id: int, sender_type: str,
    receiver_id: int, receiver_type: str,
    amount: float,
    tx_type: str = 'transfer',
    note: str = None,
    ip_address: str = None,
    anomaly_flagged: bool = False,
) -> Transaction:
    """
    Atomic transfer: debit sender, credit receiver, record transaction.
    Raises ValueError on business rule violations.
    """
    if amount <= 0:
        raise ValueError("Amount must be positive.")

    try:
        # Lock both rows to prevent concurrent updates
        sender_wallet = (
            Wallet.query
            .filter_by(owner_id=sender_id, owner_type=sender_type)
            .with_for_update()
            .first()
        )
        if not sender_wallet:
            raise ValueError("Sender wallet not found.")
        if sender_wallet.balance < amount:
            raise ValueError(f"Insufficient balance. Available: {sender_wallet.balance:.2f}")

        receiver_wallet = (
            Wallet.query
            .filter_by(owner_id=receiver_id, owner_type=receiver_type)
            .with_for_update()
            .first()
        )
        if not receiver_wallet:
            receiver_wallet = Wallet(owner_id=receiver_id, owner_type=receiver_type, balance=0.0)
            db.session.add(receiver_wallet)

        sender_wallet.balance -= amount
        receiver_wallet.balance += amount

        tx = Transaction(
            sender_id=sender_id, sender_type=sender_type,
            receiver_id=receiver_id, receiver_type=receiver_type,
            amount=amount, tx_type=tx_type, status='completed',
            note=note, ip_address=ip_address,
            anomaly_flagged=anomaly_flagged,
        )
        db.session.add(tx)
        db.session.commit()
        return tx

    except Exception:
        db.session.rollback()
        raise


def credit(owner_id: int, owner_type: str, amount: float, note: str = None) -> Wallet:
    """Admin-only: directly add money to a wallet (cash-in approval)."""
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    try:
        wallet = (
            Wallet.query
            .filter_by(owner_id=owner_id, owner_type=owner_type)
            .with_for_update()
            .first()
        )
        if not wallet:
            wallet = Wallet(owner_id=owner_id, owner_type=owner_type, balance=0.0)
            db.session.add(wallet)
        wallet.balance += amount
        db.session.commit()
        return wallet
    except Exception:
        db.session.rollback()
        raise


def debit(owner_id: int, owner_type: str, amount: float) -> Wallet:
    """Admin-only: directly remove money from a wallet."""
    if amount <= 0:
        raise ValueError("Amount must be positive.")
    try:
        wallet = (
            Wallet.query
            .filter_by(owner_id=owner_id, owner_type=owner_type)
            .with_for_update()
            .first()
        )
        if not wallet or wallet.balance < amount:
            raise ValueError("Insufficient balance for debit.")
        wallet.balance -= amount
        db.session.commit()
        return wallet
    except Exception:
        db.session.rollback()
        raise
