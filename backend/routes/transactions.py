import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import (
    User, Agent, Transaction, TrustedContact, GuardianLink,
    MoneyRequest, Wallet, FraudAlert, Notification,
)
from services import wallet as wallet_svc
from services.anomaly import check_anomaly, log_anomaly
from services.socket_service import (
    emit_notification, emit_balance_update, emit_transaction_event,
)

tx_bp = Blueprint('transactions', __name__)

GUARDIAN_HOLD_SECONDS = 60


def require_user():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'user':
        return None, jsonify(error='User access only.'), 403
    user = User.query.get(int(uid))
    if not user or user.is_frozen:
        return None, jsonify(error='Account unavailable.'), 403
    return user, None, None


# ─── SEND MONEY ───────────────────────────────────────────────────────────────

@tx_bp.route('/send', methods=['POST'])
@jwt_required()
def send_money():
    user, err, code = require_user()
    if err:
        return err, code

    data           = request.get_json()
    receiver_phone = data.get('receiver_phone', '').strip()
    amount         = float(data.get('amount', 0))
    pin            = data.get('pin', '').strip()
    note           = data.get('note', '')

    if not receiver_phone or amount <= 0:
        return jsonify(error='receiver_phone and a positive amount are required.'), 400

    import bcrypt
    if not bcrypt.checkpw(pin.encode(), user.pin_hash.encode()):
        return jsonify(error='Incorrect PIN.'), 401

    receiver = User.query.filter_by(phone=receiver_phone).first()
    if not receiver:
        return jsonify(error='Receiver not found.'), 404
    if receiver.id == user.id:
        return jsonify(error='Cannot send money to yourself.'), 400
    if receiver.is_frozen:
        return jsonify(error='Receiver account is frozen.'), 400

    ip = request.remote_addr

    # ── Anomaly check ────────────────────────────────────────────────────────
    flags = check_anomaly(user.id, 'user', amount, ip)
    if flags:
        log_anomaly(user.id, 'user', flags, amount)

    tc = TrustedContact.query.filter_by(
        user_id=user.id, contact_phone=receiver_phone
    ).first()
    send_count = Transaction.query.filter_by(
        sender_id=user.id, sender_type='user',
        receiver_id=receiver.id, receiver_type='user',
        status='completed',
    ).count()

    trust_info = {
        'is_trusted':    tc is not None,
        'send_count':    send_count,
        'receiver_name': receiver.name,
    }

    # If anomaly flagged AND not yet confirmed by user → return hold
    if flags and not data.get('anomaly_confirmed', False):
        return jsonify(
            anomaly=True,
            flags=flags,
            hold_seconds=30,
            trust_info=trust_info,
            message='Suspicious activity detected. Wait 30s and re-confirm with PIN.',
        ), 200

    # ── Guardian check ───────────────────────────────────────────────────────
    guardian = GuardianLink.query.filter_by(user_id=user.id, is_active=True).first()

    if guardian and amount >= guardian.threshold:
        guardian_user = User.query.filter_by(phone=guardian.guardian_phone).first()

        if guardian_user:
            # Create a PENDING transaction (money not moved yet)
            deadline = datetime.utcnow() + timedelta(seconds=GUARDIAN_HOLD_SECONDS)

            tx = Transaction(
                sender_id=user.id,       sender_type='user',
                receiver_id=receiver.id, receiver_type='user',
                amount=amount,
                tx_type='transfer',
                status='pending_guardian',
                note=note,
                ip_address=ip,
                anomaly_flagged=bool(flags),
                guardian_hold_until=deadline,
            )
            db.session.add(tx)
            db.session.commit()

            # Notify guardian with actionable payload
            action_payload = json.dumps({
                'tx_id':    tx.id,
                'deadline': deadline.isoformat(),
                'amount':   amount,
                'sender':   user.name,
                'receiver': receiver.name,
            })

            _save_and_emit_guardian_notif(
                guardian_user_id=guardian_user.id,
                tx_id=tx.id,
                sender_name=user.name,
                receiver_name=receiver.name,
                amount=amount,
                deadline_iso=deadline.isoformat(),
                action_payload=action_payload,
            )

            return jsonify(
                guardian_hold=True,
                transaction_id=tx.id,
                hold_seconds=GUARDIAN_HOLD_SECONDS,
                guardian_phone=guardian.guardian_phone,
                message=(
                    f'Your guardian has been notified. '
                    f'They have {GUARDIAN_HOLD_SECONDS}s to reject this transaction. '
                    f'Re-enter your PIN after the timer to confirm.'
                ),
            ), 200

    # ── Execute transfer immediately ─────────────────────────────────────────
    try:
        tx = wallet_svc.transfer(
            sender_id=user.id,       sender_type='user',
            receiver_id=receiver.id, receiver_type='user',
            amount=amount, tx_type='transfer',
            note=note, ip_address=ip,
            anomaly_flagged=bool(flags),
        )
    except ValueError as e:
        return jsonify(error=str(e)), 400

    _post_transfer_notify(user, receiver, amount, tx)

    return jsonify(
        message='Transfer successful.',
        transaction=tx.to_dict(),
        trust_info=trust_info,
        new_balance=wallet_svc.get_balance(user.id, 'user'),
    ), 200


# ─── GUARDIAN: REJECT TRANSACTION ────────────────────────────────────────────

@tx_bp.route('/<int:tx_id>/guardian-reject', methods=['POST'])
@jwt_required()
def guardian_reject(tx_id):
    """
    Called by a guardian to block a pending_guardian transaction.
    Must be called before guardian_hold_until deadline.
    Creates a high-severity FraudAlert for the admin.
    """
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'user':
        return jsonify(error='User access only.'), 403

    guardian_user = User.query.get(int(uid))
    if not guardian_user:
        return jsonify(error='Guardian not found.'), 404

    tx = Transaction.query.get(tx_id)
    if not tx:
        return jsonify(error='Transaction not found.'), 404
    if tx.status != 'pending_guardian':
        return jsonify(error='Transaction is no longer pending.'), 400

    # Verify this user IS the guardian for the sender
    link = GuardianLink.query.filter_by(
        user_id=tx.sender_id,
        guardian_phone=guardian_user.phone,
        is_active=True,
    ).first()
    if not link:
        return jsonify(error='You are not the guardian for this transaction.'), 403

    # Check deadline
    if datetime.utcnow() > tx.guardian_hold_until:
        return jsonify(error='Guardian rejection window has expired.'), 400

    # Cancel transaction
    tx.status = 'guardian_rejected'
    db.session.commit()

    # Immediately push a socket event to the WARD so their confirm button is blocked
    from extensions import socketio as _sio
    _sio.emit('guardian_tx_rejected', {
        'tx_id':          tx_id,
        'guardian_name':  guardian_user.name,
        'guardian_phone': guardian_user.phone,
    }, room=f"user_{tx.sender_id}")

    # Raise high-severity fraud alert for admin
    sender = User.query.get(tx.sender_id)
    alert = FraudAlert(
        user_id=tx.sender_id, user_type='user',
        alert_type='guardian_rejected',
        description=(
            f'Guardian {guardian_user.name} ({guardian_user.phone}) rejected a ৳{tx.amount:.2f} '
            f'transaction from {sender.name if sender else tx.sender_id} — flagged as suspicious.'
        ),
        severity='high',
    )
    db.session.add(alert)
    db.session.commit()

    # Notify admin
    from models import Admin as AdminModel
    admin = AdminModel.query.first()
    if admin:
        emit_notification(
            admin.id, 'admin',
            '🚨 Guardian Rejection — Fraud Alert',
            f'Guardian {guardian_user.name} rejected a ৳{tx.amount:.2f} transaction '
            f'from {sender.name if sender else "user"}. Marked as suspicious.',
            'danger',
        )

    # Notify sender that guardian blocked it
    emit_notification(
        tx.sender_id, 'user',
        'Transaction Blocked by Guardian',
        f'Your guardian {guardian_user.name} rejected the ৳{tx.amount:.2f} transfer. '
        f'It has been reported to admin.',
        'danger',
    )

    return jsonify(
        message='Transaction rejected. Fraud alert raised.',
        transaction=tx.to_dict(),
    ), 200


# ─── GUARDIAN: CONFIRM TRANSACTION (after 30s window) ────────────────────────

@tx_bp.route('/<int:tx_id>/guardian-confirm', methods=['POST'])
@jwt_required()
def guardian_confirm(tx_id):
    """
    Called by the SENDER after the 30s hold expires without rejection.
    Requires the sender to re-enter their PIN.
    """
    user, err, code = require_user()
    if err:
        return err, code

    data = request.get_json()
    pin  = data.get('pin', '').strip()

    import bcrypt
    if not bcrypt.checkpw(pin.encode(), user.pin_hash.encode()):
        return jsonify(error='Incorrect PIN.'), 401

    tx = Transaction.query.get(tx_id)
    if not tx:
        return jsonify(error='Transaction not found.'), 404
    db.session.refresh(tx)   # force fresh read — avoids stale SQLAlchemy session cache
    if tx.sender_id != user.id or tx.sender_type != 'user':
        return jsonify(error='Not your transaction.'), 403
    if tx.status == 'guardian_rejected':
        return jsonify(error='Transaction was rejected by your guardian.'), 400
    if tx.status != 'pending_guardian':
        return jsonify(error='Transaction is not in pending state.'), 400

    # Deadline check — make sure 30s has actually elapsed
    if datetime.utcnow() < tx.guardian_hold_until:
        remaining = (tx.guardian_hold_until - datetime.utcnow()).seconds
        return jsonify(
            error=f'Please wait {remaining}s more before confirming.',
            remaining=remaining,
        ), 400

    # Execute the transfer now
    receiver = User.query.get(tx.receiver_id)
    if not receiver:
        tx.status = 'failed'
        db.session.commit()
        return jsonify(error='Receiver no longer available.'), 400

    try:
        completed_tx = wallet_svc.transfer(
            sender_id=user.id,       sender_type='user',
            receiver_id=receiver.id, receiver_type='user',
            amount=tx.amount, tx_type='transfer',
            note=tx.note, ip_address=tx.ip_address,
            anomaly_flagged=tx.anomaly_flagged,
        )
    except ValueError as e:
        tx.status = 'failed'
        db.session.commit()
        return jsonify(error=str(e)), 400

    # Mark original pending tx as replaced
    tx.status = 'completed'
    db.session.commit()

    _post_transfer_notify(user, receiver, tx.amount, completed_tx)

    return jsonify(
        message='Transfer confirmed and completed.',
        transaction=completed_tx.to_dict(),
        new_balance=wallet_svc.get_balance(user.id, 'user'),
    ), 200


# ─── CASH OUT (user → agent) ─────────────────────────────────────────────────

@tx_bp.route('/cashout', methods=['POST'])
@jwt_required()
def cash_out():
    user, err, code = require_user()
    if err:
        return err, code

    data        = request.get_json()
    agent_phone = data.get('agent_phone', '').strip()
    amount      = float(data.get('amount', 0))
    pin         = data.get('pin', '').strip()

    if not agent_phone or amount <= 0:
        return jsonify(error='agent_phone and a positive amount are required.'), 400

    import bcrypt
    if not bcrypt.checkpw(pin.encode(), user.pin_hash.encode()):
        return jsonify(error='Incorrect PIN.'), 401

    agent = Agent.query.filter_by(phone=agent_phone).first()
    if not agent:
        return jsonify(error='Agent not found.'), 404
    if not agent.is_approved:
        return jsonify(error='This agent is not approved.'), 400
    if agent.is_frozen:
        return jsonify(error='Agent account is currently frozen.'), 400

    try:
        tx = wallet_svc.transfer(
            sender_id=user.id,    sender_type='user',
            receiver_id=agent.id, receiver_type='agent',
            amount=amount, tx_type='cash_out',
            note=f'Cash-out via agent {agent_phone}',
            ip_address=request.remote_addr,
        )
    except ValueError as e:
        return jsonify(error=str(e)), 400

    user_balance  = wallet_svc.get_balance(user.id,  'user')
    agent_balance = wallet_svc.get_balance(agent.id, 'agent')

    emit_balance_update(user.id,  'user',  user_balance)
    emit_balance_update(agent.id, 'agent', agent_balance)

    emit_notification(
        user.id, 'user', 'Cash-Out Successful',
        f'৳{amount:.2f} debited. Collect your physical cash from agent {agent.name}.',
        'success',
    )
    emit_notification(
        agent.id, 'agent', 'Cash-Out Received',
        f'{user.name} cashed out ৳{amount:.2f} through you. Hand them the physical cash.',
        'info',
    )

    return jsonify(
        message='Cash-out successful.',
        transaction=tx.to_dict(),
        new_balance=user_balance,
        agent_name=agent.name,
    ), 200


# ─── AGENT LOOKUP ────────────────────────────────────────────────────────────

@tx_bp.route('/agent-lookup', methods=['POST'])
@jwt_required()
def agent_lookup():
    user, err, code = require_user()
    if err:
        return err, code

    phone = request.get_json().get('phone', '').strip()
    agent = Agent.query.filter_by(phone=phone).first()
    if not agent:
        return jsonify(error='Agent not found.'), 404
    if not agent.is_approved:
        return jsonify(error='This agent is not approved.'), 400
    if agent.is_frozen:
        return jsonify(error='Agent account is currently frozen.'), 400

    return jsonify(
        agent_name=agent.name,
        agent_phone=agent.phone,
        business_name=agent.business_name or '',
    ), 200


# ─── PRE-SEND LOOKUP ─────────────────────────────────────────────────────────

@tx_bp.route('/lookup', methods=['POST'])
@jwt_required()
def lookup_receiver():
    user, err, code = require_user()
    if err:
        return err, code

    phone    = request.get_json().get('phone', '').strip()
    receiver = User.query.filter_by(phone=phone).first()
    if not receiver:
        return jsonify(error='User not found.'), 404

    tc = TrustedContact.query.filter_by(user_id=user.id, contact_phone=phone).first()
    send_count = Transaction.query.filter_by(
        sender_id=user.id, sender_type='user',
        receiver_id=receiver.id, receiver_type='user',
        status='completed',
    ).count()
    last_tx = Transaction.query.filter_by(
        sender_id=user.id, sender_type='user',
        receiver_id=receiver.id, receiver_type='user',
        status='completed',
    ).order_by(Transaction.created_at.desc()).first()

    return jsonify(
        receiver_name=receiver.name,
        receiver_phone=receiver.phone,
        is_trusted=tc is not None,
        send_count=send_count,
        last_transaction=last_tx.to_dict() if last_tx else None,
    ), 200


# ─── REQUEST MONEY ────────────────────────────────────────────────────────────

@tx_bp.route('/request', methods=['POST'])
@jwt_required()
def request_money():
    user, err, code = require_user()
    if err:
        return err, code

    data         = request.get_json()
    target_phone = data.get('target_phone', '').strip()
    amount       = float(data.get('amount', 0))
    note         = data.get('note', '')

    if not target_phone or amount <= 0:
        return jsonify(error='target_phone and positive amount required.'), 400

    target = User.query.filter_by(phone=target_phone).first()
    if not target:
        return jsonify(error='Target user not found.'), 404

    req = MoneyRequest(requester_id=user.id, target_phone=target_phone, amount=amount, note=note)
    db.session.add(req)
    db.session.commit()

    emit_notification(
        target.id, 'user', 'Money Request',
        f'{user.name} is requesting ৳{amount:.2f} from you. Note: {note}', 'info',
    )
    return jsonify(message='Money request sent.', request=req.to_dict()), 201


@tx_bp.route('/requests/incoming', methods=['GET'])
@jwt_required()
def incoming_requests():
    user, err, code = require_user()
    if err:
        return err, code

    reqs = MoneyRequest.query.filter_by(
        target_phone=user.phone, status='pending'
    ).order_by(MoneyRequest.created_at.desc()).all()

    result = []
    for r in reqs:
        d = r.to_dict()
        requester = User.query.get(r.requester_id)
        d['requester_name'] = requester.name if requester else 'Unknown'
        result.append(d)
    return jsonify(requests=result), 200


@tx_bp.route('/requests/<int:req_id>/respond', methods=['POST'])
@jwt_required()
def respond_to_request(req_id):
    user, err, code = require_user()
    if err:
        return err, code

    data   = request.get_json()
    action = data.get('action')
    pin    = data.get('pin', '')

    req = MoneyRequest.query.get(req_id)
    if not req or req.target_phone != user.phone:
        return jsonify(error='Request not found.'), 404
    if req.status != 'pending':
        return jsonify(error='Request already processed.'), 400

    import bcrypt
    if not bcrypt.checkpw(pin.encode(), user.pin_hash.encode()):
        return jsonify(error='Incorrect PIN.'), 401

    requester = User.query.get(req.requester_id)
    if not requester:
        return jsonify(error='Requester not found.'), 404

    if action == 'accept':
        try:
            tx = wallet_svc.transfer(
                sender_id=user.id, sender_type='user',
                receiver_id=requester.id, receiver_type='user',
                amount=req.amount, tx_type='request',
                note=f'Money request #{req_id}',
            )
        except ValueError as e:
            return jsonify(error=str(e)), 400

        req.status = 'accepted'
        db.session.commit()

        emit_notification(requester.id, 'user', 'Request Accepted',
                          f'{user.name} sent you ৳{req.amount:.2f}.', 'success')
        emit_notification(user.id, 'user', 'Request Fulfilled',
                          f'You sent ৳{req.amount:.2f} to {requester.name}.', 'success')
        return jsonify(message='Request accepted and money sent.', transaction=tx.to_dict()), 200

    elif action == 'reject':
        req.status = 'rejected'
        db.session.commit()
        emit_notification(requester.id, 'user', 'Request Rejected',
                          f'{user.name} rejected your ৳{req.amount:.2f} request.', 'warning')
        return jsonify(message='Request rejected.'), 200

    return jsonify(error='Invalid action. Use accept or reject.'), 400


# ─── TRANSACTION HISTORY ──────────────────────────────────────────────────────

@tx_bp.route('/history', methods=['GET'])
@jwt_required()
def transaction_history():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    uid = int(uid)

    page     = request.args.get('page',     1,  type=int)
    per_page = request.args.get('per_page', 20, type=int)

    owner_type = 'user' if role == 'user' else ('agent' if role == 'agent' else None)
    if not owner_type:
        return jsonify(error='Invalid role.'), 403

    txns = Transaction.query.filter(
        db.or_(
            db.and_(Transaction.sender_id   == uid, Transaction.sender_type   == owner_type),
            db.and_(Transaction.receiver_id == uid, Transaction.receiver_type == owner_type),
        )
    ).order_by(Transaction.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    result = []
    for tx in txns.items:
        d = tx.to_dict()
        if tx.sender_type == 'user':
            s = User.query.get(tx.sender_id)
            d['sender_name']  = s.name  if s else 'Unknown'
            d['sender_phone'] = s.phone if s else ''
        else:
            s = Agent.query.get(tx.sender_id)
            d['sender_name']  = s.name  if s else 'Agent'
            d['sender_phone'] = s.phone if s else ''

        if tx.receiver_type == 'user':
            r = User.query.get(tx.receiver_id)
            d['receiver_name']  = r.name  if r else 'Unknown'
            d['receiver_phone'] = r.phone if r else ''
        else:
            r = Agent.query.get(tx.receiver_id)
            d['receiver_name']  = r.name  if r else 'Agent'
            d['receiver_phone'] = r.phone if r else ''

        d['direction'] = 'out' if (tx.sender_id == uid and tx.sender_type == owner_type) else 'in'
        result.append(d)

    return jsonify(
        transactions=result, total=txns.total,
        page=txns.page, pages=txns.pages,
    ), 200


# ─── TRANSACTION STATUS POLL ────────────────────────────────────────────────
# Ward polls this every few seconds during guardian hold to detect rejection

@tx_bp.route('/<int:tx_id>/status', methods=['GET'])
@jwt_required()
def transaction_status(tx_id):
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    uid = int(uid)

    tx = Transaction.query.get(tx_id)
    if not tx:
        return jsonify(error='Transaction not found.'), 404
    db.session.refresh(tx)

    # Only the sender or receiver may query status
    is_party = (
        (tx.sender_id == uid   and tx.sender_type   == role) or
        (tx.receiver_id == uid and tx.receiver_type == role)
    )
    if not is_party:
        return jsonify(error='Not authorised.'), 403

    return jsonify(
        tx_id=tx.id,
        status=tx.status,
        amount=tx.amount,
    ), 200


# ─── SPENDING STATS ───────────────────────────────────────────────────────────

@tx_bp.route('/stats', methods=['GET'])
@jwt_required()
def spending_stats():
    user, err, code = require_user()
    if err:
        return err, code

    from datetime import datetime, timedelta
    from sqlalchemy import func

    now       = datetime.utcnow()
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    def outgoing(since):
        return db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.sender_id   == user.id,
            Transaction.sender_type == 'user',
            Transaction.status      == 'completed',
            Transaction.created_at  >= since,
        ).scalar() or 0.0

    top_receivers_raw = (
        db.session.query(Transaction.receiver_id, func.sum(Transaction.amount).label('total'))
        .filter(
            Transaction.sender_id     == user.id,
            Transaction.sender_type   == 'user',
            Transaction.receiver_type == 'user',
            Transaction.status        == 'completed',
            Transaction.created_at    >= month_ago,
        )
        .group_by(Transaction.receiver_id)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(3).all()
    )
    top_receivers = []
    for rid, total in top_receivers_raw:
        r = User.query.get(rid)
        top_receivers.append({'name': r.name if r else 'Unknown', 'phone': r.phone if r else '', 'total': total})

    daily = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0)
        day_end   = day_start + timedelta(days=1)
        total = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.sender_id   == user.id,
            Transaction.sender_type == 'user',
            Transaction.status      == 'completed',
            Transaction.created_at  >= day_start,
            Transaction.created_at  <  day_end,
        ).scalar() or 0.0
        daily.append({'date': day_start.strftime('%b %d'), 'amount': total})

    return jsonify(
        week_total=outgoing(week_ago),
        month_total=outgoing(month_ago),
        top_receivers=top_receivers,
        daily_trend=daily,
    ), 200


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _post_transfer_notify(sender, receiver, amount, tx):
    emit_balance_update(sender.id,   'user', wallet_svc.get_balance(sender.id,   'user'))
    emit_balance_update(receiver.id, 'user', wallet_svc.get_balance(receiver.id, 'user'))
    emit_notification(sender.id,   'user', 'Money Sent',
                      f'You sent ৳{amount:.2f} to {receiver.name}.', 'success')
    emit_notification(receiver.id, 'user', 'Money Received',
                      f'You received ৳{amount:.2f} from {sender.name}.', 'success')
    emit_transaction_event(sender.id, 'user', receiver.id, 'user', tx.to_dict())


def _save_and_emit_guardian_notif(guardian_user_id, tx_id, sender_name,
                                   receiver_name, amount, deadline_iso, action_payload):
    from extensions import socketio
    notif = Notification(
        recipient_id=guardian_user_id, recipient_type='user',
        title='⚠️ Guardian Alert — Action Required',
        message=(
            f'{sender_name} is sending ৳{amount:.2f} to {receiver_name}. '
            f'You have {GUARDIAN_HOLD_SECONDS}s to REJECT this transaction.'
        ),
        notif_type='warning',
        action_type='guardian_reject',
        action_data=action_payload,
    )
    db.session.add(notif)
    db.session.commit()

    room = f"user_{guardian_user_id}"
    socketio.emit('guardian_alert', {
        'id':            notif.id,
        'title':         notif.title,
        'message':       notif.message,
        'tx_id':         tx_id,
        'deadline':      deadline_iso,
        'amount':        amount,
        'sender_name':   sender_name,
        'receiver_name': receiver_name,
        'hold_seconds':  GUARDIAN_HOLD_SECONDS,
    }, room=room)
