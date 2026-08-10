from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from extensions import db
from models import (
    User, Agent, Admin, Wallet, Transaction,
    CashInRequest, AnomalyLog, FraudAlert, Notification,
)
from services import wallet as wallet_svc
from services.socket_service import emit_notification, emit_balance_update

admin_bp = Blueprint('admin', __name__)

def _kyc_url(path):
    """Build a URL for a KYC image stored in the uploads folder.
    Stored paths look like 'uploads/user_kyc/abc.jpg'.
    The Flask route is  /api/auth/uploads/<filepath>
    so we must strip the leading 'uploads/' to avoid doubling it.
    """
    if not path:
        return None
    stripped = path[len('uploads/'):] if path.startswith('uploads/') else path
    return f'/api/auth/uploads/{stripped}'



def require_admin():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'admin':
        return None, jsonify(error='Admin access only.'), 403
    admin = Admin.query.get(int(uid))
    return admin, None, None


# ─── SYSTEM STATS ─────────────────────────────────────────────────────────────

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def system_stats():
    _, err, code = require_admin()
    if err:
        return err, code

    now       = datetime.utcnow()
    today     = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    def tx_volume(since):
        return db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.status == 'completed', Transaction.created_at >= since,
        ).scalar() or 0.0

    daily = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0)
        day_end   = day_start + timedelta(days=1)
        vol = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.status == 'completed',
            Transaction.created_at >= day_start,
            Transaction.created_at <  day_end,
        ).scalar() or 0.0
        daily.append({'date': day_start.strftime('%b %d'), 'volume': vol})

    return jsonify(
        total_users=User.query.count(),
        total_approved_users=User.query.filter_by(is_approved=True).count(),
        pending_user_approvals=User.query.filter_by(is_approved=False, rejection_reason=None).count(),
        total_agents=Agent.query.filter_by(is_approved=True).count(),
        pending_agent_approvals=Agent.query.filter_by(is_approved=False).count(),
        frozen_users=User.query.filter_by(is_frozen=True).count(),
        total_money_in_system=db.session.query(func.sum(Wallet.balance)).scalar() or 0.0,
        today_volume=tx_volume(today),
        week_volume=tx_volume(week_ago),
        month_volume=tx_volume(month_ago),
        pending_cashin_requests=CashInRequest.query.filter_by(status='pending').count(),
        unresolved_fraud_alerts=FraudAlert.query.filter_by(is_resolved=False).count(),
        daily_volume=daily,
    ), 200


# ─── PENDING USER REGISTRATIONS (KYC) ────────────────────────────────────────

@admin_bp.route('/users/pending', methods=['GET'])
@jwt_required()
def pending_users():
    _, err, code = require_admin()
    if err:
        return err, code

    # Pending = not approved AND no rejection reason yet
    users = User.query.filter_by(is_approved=False, rejection_reason=None)\
        .order_by(User.created_at.desc()).all()

    result = []
    for u in users:
        d = u.to_dict()
        d['nid_front_url'] = _kyc_url(u.nid_front)
        d['nid_back_url']  = _kyc_url(u.nid_back)
        d['selfie_url']    = _kyc_url(u.selfie)
        result.append(d)

    return jsonify(users=result), 200


@admin_bp.route('/users/<int:user_id>/kyc-review', methods=['POST'])
@jwt_required()
def review_user_kyc(user_id):
    _, err, code = require_admin()
    if err:
        return err, code

    data   = request.get_json()
    action = data.get('action')         # 'approve' | 'reject'
    reason = data.get('reason', '')

    user = User.query.get(user_id)
    if not user:
        return jsonify(error='User not found.'), 404
    if user.is_approved:
        return jsonify(error='User already approved.'), 400

    if action == 'approve':
        user.is_approved = True
        db.session.commit()
        emit_notification(
            user.id, 'user',
            '✅ Registration Approved',
            'Your SafePay account has been approved! You can now log in.',
            'success',
        )
        return jsonify(message='User approved.', user=user.to_dict()), 200

    elif action == 'reject':
        if not reason:
            return jsonify(error='A rejection reason is required.'), 400
        user.rejection_reason = reason
        db.session.commit()
        emit_notification(
            user.id, 'user',
            '❌ Registration Rejected',
            f'Your SafePay registration was rejected. Reason: {reason}',
            'danger',
        )
        return jsonify(message='User rejected.', user=user.to_dict()), 200

    return jsonify(error='action must be approve or reject.'), 400


# ─── AGENT APPROVALS ──────────────────────────────────────────────────────────

@admin_bp.route('/agents/pending', methods=['GET'])
@jwt_required()
def pending_agents():
    _, err, code = require_admin()
    if err:
        return err, code

    agents = Agent.query.filter_by(is_approved=False, rejection_reason=None)\
        .order_by(Agent.created_at.desc()).all()

    result = []
    for a in agents:
        d = a.to_dict()
        d['nid_front_url'] = _kyc_url(a.nid_front)
        d['nid_back_url']  = _kyc_url(a.nid_back)
        d['selfie_url']    = _kyc_url(a.selfie)
        result.append(d)

    return jsonify(agents=result), 200


@admin_bp.route('/agents/<int:agent_id>/approve', methods=['POST'])
@jwt_required()
def approve_agent(agent_id):
    _, err, code = require_admin()
    if err:
        return err, code

    data   = request.get_json()
    action = data.get('action')
    reason = data.get('reason', '')

    agent = Agent.query.get(agent_id)
    if not agent:
        return jsonify(error='Agent not found.'), 404

    if action == 'approve':
        agent.is_approved = True
        db.session.commit()
        emit_notification(
            agent.id, 'agent',
            '✅ Agent Account Approved',
            'Your SafePay agent account has been approved. You can now log in.',
            'success',
        )
        return jsonify(message='Agent approved.', agent=agent.to_dict()), 200

    elif action == 'reject':
        if not reason:
            return jsonify(error='A rejection reason is required.'), 400
        agent.rejection_reason = reason
        db.session.commit()
        return jsonify(message='Agent rejected.', agent=agent.to_dict()), 200

    return jsonify(error='action must be approve or reject.'), 400


@admin_bp.route('/agents', methods=['GET'])
@jwt_required()
def list_agents():
    _, err, code = require_admin()
    if err:
        return err, code
    agents = Agent.query.order_by(Agent.created_at.desc()).all()
    result = []
    for a in agents:
        d = a.to_dict()
        wallet = Wallet.query.filter_by(owner_id=a.id, owner_type='agent').first()
        d['balance'] = wallet.balance if wallet else 0.0
        result.append(d)
    return jsonify(agents=result), 200


# ─── CASH-IN REQUESTS ────────────────────────────────────────────────────────

@admin_bp.route('/cashin/requests', methods=['GET'])
@jwt_required()
def list_cashin_requests():
    _, err, code = require_admin()
    if err:
        return err, code
    status = request.args.get('status', 'pending')
    reqs = CashInRequest.query.filter_by(status=status)\
        .order_by(CashInRequest.created_at.desc()).all()
    return jsonify(requests=[r.to_dict() for r in reqs]), 200


@admin_bp.route('/cashin/<int:req_id>/process', methods=['POST'])
@jwt_required()
def process_cashin(req_id):
    _, err, code = require_admin()
    if err:
        return err, code

    data   = request.get_json()
    action = data.get('action')
    note   = data.get('note', '')

    req = CashInRequest.query.get(req_id)
    if not req:
        return jsonify(error='Request not found.'), 404
    if req.status != 'pending':
        return jsonify(error='Request already processed.'), 400

    req.admin_note   = note
    req.processed_at = datetime.utcnow()

    if action == 'approve':
        try:
            wallet_svc.credit(req.agent_id, 'agent', req.amount)
        except ValueError as e:
            return jsonify(error=str(e)), 400
        req.status = 'approved'
        db.session.commit()
        new_balance = wallet_svc.get_balance(req.agent_id, 'agent')
        emit_balance_update(req.agent_id, 'agent', new_balance)
        emit_notification(req.agent_id, 'agent', 'Cash-In Approved',
                          f'৳{req.amount:.2f} added to your wallet. Balance: ৳{new_balance:.2f}', 'success')
        return jsonify(message='Cash-in approved.', request=req.to_dict()), 200

    elif action == 'reject':
        req.status = 'rejected'
        db.session.commit()
        emit_notification(req.agent_id, 'agent', 'Cash-In Rejected',
                          f'৳{req.amount:.2f} cash-in rejected. Note: {note}', 'warning')
        return jsonify(message='Cash-in rejected.', request=req.to_dict()), 200

    return jsonify(error='Invalid action.'), 400


# ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    _, err, code = require_admin()
    if err:
        return err, code
    users = User.query.filter_by(is_approved=True).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        d = u.to_dict()
        wallet = Wallet.query.filter_by(owner_id=u.id, owner_type='user').first()
        d['balance'] = wallet.balance if wallet else 0.0
        result.append(d)
    return jsonify(users=result), 200


@admin_bp.route('/users/<int:user_id>/freeze', methods=['POST'])
@jwt_required()
def toggle_user_freeze(user_id):
    _, err, code = require_admin()
    if err:
        return err, code
    data   = request.get_json()
    freeze = data.get('freeze', True)
    user   = User.query.get(user_id)
    if not user:
        return jsonify(error='User not found.'), 404
    user.is_frozen = freeze
    db.session.commit()
    status = 'frozen' if freeze else 'unfrozen'
    emit_notification(user.id, 'user', f'Account {status.title()}',
                      f'Your account has been {status} by admin.',
                      'danger' if freeze else 'info')
    return jsonify(message=f'User {status}.', user=user.to_dict()), 200


@admin_bp.route('/agents/<int:agent_id>/freeze', methods=['POST'])
@jwt_required()
def toggle_agent_freeze(agent_id):
    _, err, code = require_admin()
    if err:
        return err, code
    data   = request.get_json()
    freeze = data.get('freeze', True)
    agent  = Agent.query.get(agent_id)
    if not agent:
        return jsonify(error='Agent not found.'), 404
    agent.is_frozen = freeze
    db.session.commit()
    status = 'frozen' if freeze else 'unfrozen'
    return jsonify(message=f'Agent {status}.', agent=agent.to_dict()), 200


# ─── BALANCE ADJUSTMENT ───────────────────────────────────────────────────────

@admin_bp.route('/balance/adjust', methods=['POST'])
@jwt_required()
def adjust_balance():
    _, err, code = require_admin()
    if err:
        return err, code

    data       = request.get_json()
    owner_id   = data.get('owner_id')
    owner_type = data.get('owner_type', 'user')
    action     = data.get('action')
    amount     = float(data.get('amount', 0))
    reason     = data.get('reason', 'Admin adjustment')

    if not owner_id or amount <= 0:
        return jsonify(error='owner_id and positive amount required.'), 400

    try:
        wallet = wallet_svc.credit(owner_id, owner_type, amount, reason) \
                 if action == 'credit' else wallet_svc.debit(owner_id, owner_type, amount)
    except ValueError as e:
        return jsonify(error=str(e)), 400

    emit_balance_update(owner_id, owner_type, wallet.balance)
    emit_notification(owner_id, owner_type, 'Balance Adjusted',
                      f'Admin adjusted your balance by ৳{amount:.2f} ({action}). Reason: {reason}', 'info')
    return jsonify(message='Balance adjusted.', new_balance=wallet.balance), 200


# ─── ALL TRANSACTIONS ─────────────────────────────────────────────────────────

@admin_bp.route('/transactions', methods=['GET'])
@jwt_required()
def all_transactions():
    _, err, code = require_admin()
    if err:
        return err, code

    page     = request.args.get('page',     1,  type=int)
    per_page = request.args.get('per_page', 30, type=int)

    txns = Transaction.query.order_by(Transaction.created_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)

    result = []
    for tx in txns.items:
        d = tx.to_dict()
        if tx.sender_type == 'user':
            s = User.query.get(tx.sender_id)
            d['sender_name'] = s.name if s else 'Unknown'
        else:
            s = Agent.query.get(tx.sender_id)
            d['sender_name'] = s.name if s else 'Agent'
        if tx.receiver_type == 'user':
            r = User.query.get(tx.receiver_id)
            d['receiver_name'] = r.name if r else 'Unknown'
        else:
            r = Agent.query.get(tx.receiver_id)
            d['receiver_name'] = r.name if r else 'Agent'
        result.append(d)

    return jsonify(transactions=result, total=txns.total, pages=txns.pages, page=txns.page), 200


# ─── FRAUD ALERTS ─────────────────────────────────────────────────────────────

@admin_bp.route('/fraud-alerts', methods=['GET'])
@jwt_required()
def fraud_alerts():
    _, err, code = require_admin()
    if err:
        return err, code

    alerts = FraudAlert.query.order_by(FraudAlert.created_at.desc()).limit(100).all()
    result = []
    for a in alerts:
        d = a.to_dict()
        if a.user_type == 'user':
            u = User.query.get(a.user_id)
            d['user_name']  = u.name  if u else 'Unknown'
            d['user_phone'] = u.phone if u else ''
        else:
            ag = Agent.query.get(a.user_id)
            d['user_name']  = ag.name  if ag else 'Unknown'
            d['user_phone'] = ag.phone if ag else ''
        result.append(d)
    return jsonify(alerts=result), 200


@admin_bp.route('/fraud-alerts/<int:alert_id>/resolve', methods=['POST'])
@jwt_required()
def resolve_alert(alert_id):
    _, err, code = require_admin()
    if err:
        return err, code
    alert = FraudAlert.query.get(alert_id)
    if not alert:
        return jsonify(error='Alert not found.'), 404
    alert.is_resolved = True
    db.session.commit()
    return jsonify(message='Alert resolved.'), 200
