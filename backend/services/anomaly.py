"""
Anomaly Detection Engine
Rules:
  1. rapid_fire      — sender sends 3+ txns in 5 minutes
  2. large_amount    — amount > 5× sender's historical average
  3. unusual_hour    — Bangladesh local time between 01:00–05:00
  4. fan_out         — same sender → 5+ distinct receivers in 10 minutes
"""
from datetime import datetime, timedelta
from sqlalchemy import func
from extensions import db
from models import Transaction, AnomalyLog, FraudAlert


BD_UTC_OFFSET = 6  # Bangladesh is UTC+6


def check_anomaly(
    sender_id: int,
    sender_type: str,
    amount: float,
    ip_address: str = None,
) -> list[str]:
    """Return list of triggered rule names (empty = clean)."""
    flags = []
    now = datetime.utcnow()
    five_min_ago = now - timedelta(minutes=5)
    ten_min_ago = now - timedelta(minutes=10)

    # Rule 1: rapid-fire (3+ txns from same sender in last 5 min)
    recent_count = Transaction.query.filter(
        Transaction.sender_id == sender_id,
        Transaction.sender_type == sender_type,
        Transaction.created_at >= five_min_ago,
        Transaction.status == 'completed',
    ).count()
    if recent_count >= 3:
        flags.append('rapid_fire')

    # Rule 2: amount > 5× average historical transaction
    avg_result = db.session.query(func.avg(Transaction.amount)).filter(
        Transaction.sender_id == sender_id,
        Transaction.sender_type == sender_type,
        Transaction.status == 'completed',
    ).scalar()
    if avg_result and amount > avg_result * 5:
        flags.append('large_amount')

    # Rule 3: unusual hour in Bangladesh time (01:00–05:00)
    bd_hour = (now.hour + BD_UTC_OFFSET) % 24
    if 1 <= bd_hour <= 5:
        flags.append('unusual_hour')

    # Rule 4: fan-out — 5+ distinct receivers in last 10 minutes
    distinct_receivers = (
        db.session.query(func.count(func.distinct(Transaction.receiver_id)))
        .filter(
            Transaction.sender_id == sender_id,
            Transaction.sender_type == sender_type,
            Transaction.created_at >= ten_min_ago,
        )
        .scalar()
    )
    if distinct_receivers and distinct_receivers >= 5:
        flags.append('fan_out')

    return flags


def log_anomaly(
    sender_id: int,
    sender_type: str,
    flags: list[str],
    amount: float,
):
    """Persist anomaly log and fraud alert for each triggered rule."""
    severity_map = {
        'rapid_fire': 'high',
        'large_amount': 'high',
        'unusual_hour': 'low',
        'fan_out': 'high',
    }
    descriptions = {
        'rapid_fire': 'Sender made 3+ transactions within 5 minutes.',
        'large_amount': f'Transaction amount ৳{amount:.2f} is 5× above average.',
        'unusual_hour': 'Transaction attempted between 01:00–05:00 BD time.',
        'fan_out': 'Sent to 5+ distinct receivers within 10 minutes.',
    }

    for rule in flags:
        log = AnomalyLog(
            user_id=sender_id,
            user_type=sender_type,
            rule_triggered=rule,
            details=descriptions.get(rule, rule),
            amount=amount,
        )
        db.session.add(log)

        alert = FraudAlert(
            user_id=sender_id,
            user_type=sender_type,
            alert_type=rule,
            description=descriptions.get(rule, rule),
            severity=severity_map.get(rule, 'medium'),
        )
        db.session.add(alert)

    db.session.commit()
