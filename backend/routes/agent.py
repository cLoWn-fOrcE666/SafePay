import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Agent, User, CashInRequest, Wallet, Transaction
from services import wallet as wallet_svc
from services.socket_service import emit_notification, emit_balance_update

agent_bp = Blueprint('agent', __name__)


def require_agent():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'agent':
        return None, jsonify(error='Agent access only.'), 403
    agent = Agent.query.get(int(uid))
    if not agent or not agent.is_approved:
        return None, jsonify(error='Agent not approved.'), 403
    if agent.is_frozen:
        return None, jsonify(error='Agent account is frozen.'), 403
    return agent, None, None


# ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

@agent_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    agent, err, code = require_agent()
    if err:
        return err, code

    wallet  = Wallet.query.filter_by(owner_id=agent.id, owner_type='agent').first()
    balance = wallet.balance if wallet else 0.0

    from datetime import datetime, timedelta
    from sqlalchemy import func

    now   = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Cash-outs received from users today
    today_cashouts = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.receiver_id   == agent.id,
        Transaction.receiver_type == 'agent',
        Transaction.tx_type       == 'cash_out',
        Transaction.status        == 'completed',
        Transaction.created_at    >= today,
    ).scalar() or 0.0

    total_cashouts = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.receiver_id   == agent.id,
        Transaction.receiver_type == 'agent',
        Transaction.tx_type       == 'cash_out',
        Transaction.status        == 'completed',
    ).scalar() or 0.0

    pending_cashin = CashInRequest.query.filter_by(
        agent_id=agent.id, status='pending'
    ).count()

    recent_txns = Transaction.query.filter(
        db.or_(
            db.and_(Transaction.sender_id   == agent.id, Transaction.sender_type   == 'agent'),
            db.and_(Transaction.receiver_id == agent.id, Transaction.receiver_type == 'agent'),
        )
    ).order_by(Transaction.created_at.desc()).limit(5).all()

    return jsonify(
        balance=balance,
        today_cashouts=today_cashouts,
        total_cashouts=total_cashouts,
        pending_cashin=pending_cashin,
        recent_transactions=[t.to_dict() for t in recent_txns],
        agent=agent.to_dict(),
    ), 200


# ─── CASH-IN REQUEST (agent → admin for approval) ────────────────────────────

@agent_bp.route('/cashin/request', methods=['POST'])
@jwt_required()
def submit_cashin_request():
    agent, err, code = require_agent()
    if err:
        return err, code

    data   = request.get_json()
    amount = float(data.get('amount', 0))
    reason = data.get('reason', '').strip()

    if amount <= 0:
        return jsonify(error='Amount must be positive.'), 400

    req = CashInRequest(agent_id=agent.id, amount=amount, reason=reason)
    db.session.add(req)
    db.session.commit()

    from models import Admin
    admin = Admin.query.first()
    if admin:
        emit_notification(
            admin.id, 'admin',
            'New Cash-In Request',
            f'Agent {agent.name} submitted a ৳{amount:.2f} cash-in request.',
            'info',
        )

    return jsonify(message='Cash-in request submitted.', request=req.to_dict()), 201


@agent_bp.route('/cashin/requests', methods=['GET'])
@jwt_required()
def list_cashin_requests():
    agent, err, code = require_agent()
    if err:
        return err, code

    reqs = CashInRequest.query.filter_by(agent_id=agent.id)\
        .order_by(CashInRequest.created_at.desc()).all()

    return jsonify(requests=[r.to_dict() for r in reqs]), 200


# ─── SEND MONEY TO USER ───────────────────────────────────────────────────────

@agent_bp.route('/send', methods=['POST'])
@jwt_required()
def agent_send():
    agent, err, code = require_agent()
    if err:
        return err, code

    data      = request.get_json()
    user_phone = data.get('user_phone', '').strip()
    amount    = float(data.get('amount', 0))
    pin       = data.get('pin', '').strip()
    note      = data.get('note', '')

    if not user_phone or amount <= 0:
        return jsonify(error='user_phone and positive amount required.'), 400

    if not bcrypt.checkpw(pin.encode(), agent.pin_hash.encode()):
        return jsonify(error='Incorrect PIN.'), 401

    user = User.query.filter_by(phone=user_phone).first()
    if not user:
        return jsonify(error='User not found.'), 404

    try:
        tx = wallet_svc.transfer(
            sender_id=agent.id,   sender_type='agent',
            receiver_id=user.id,  receiver_type='user',
            amount=amount,
            tx_type='transfer',
            note=note,
            ip_address=request.remote_addr,
        )
    except ValueError as e:
        return jsonify(error=str(e)), 400

    agent_balance = wallet_svc.get_balance(agent.id, 'agent')
    emit_balance_update(agent.id, 'agent', agent_balance)
    emit_notification(user.id, 'user', 'Money Received',
                      f'Agent {agent.name} sent ৳{amount:.2f} to you.', 'success')

    return jsonify(
        message='Sent successfully.',
        transaction=tx.to_dict(),
        agent_balance=agent_balance,
    ), 200
