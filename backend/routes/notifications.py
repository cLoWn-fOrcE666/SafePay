from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Notification, TrustedContact, GuardianLink, User

notif_bp = Blueprint('notifications', __name__)


@notif_bp.route('/', methods=['GET'])
@jwt_required()
def get_notifications():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    uid = int(uid)

    notifs = Notification.query.filter_by(
        recipient_id=uid, recipient_type=role
    ).order_by(Notification.created_at.desc()).limit(50).all()

    unread = Notification.query.filter_by(
        recipient_id=uid, recipient_type=role, is_read=False
    ).count()

    return jsonify(notifications=[n.to_dict() for n in notifs], unread=unread), 200


@notif_bp.route('/<int:notif_id>/read', methods=['POST'])
@jwt_required()
def mark_read(notif_id):
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    notif = Notification.query.get(notif_id)
    if not notif or notif.recipient_id != int(uid):
        return jsonify(error='Not found.'), 404
    notif.is_read = True
    db.session.commit()
    return jsonify(message='Marked as read.'), 200


@notif_bp.route('/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    Notification.query.filter_by(
        recipient_id=int(uid), recipient_type=role, is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return jsonify(message='All notifications marked as read.'), 200


# ─── TRUSTED CONTACTS ────────────────────────────────────────────────────────

@notif_bp.route('/trusted-contacts', methods=['GET'])
@jwt_required()
def get_trusted_contacts():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'user':
        return jsonify(error='User only.'), 403
    contacts = TrustedContact.query.filter_by(user_id=int(uid)).all()
    return jsonify(contacts=[c.to_dict() for c in contacts]), 200


@notif_bp.route('/trusted-contacts', methods=['POST'])
@jwt_required()
def add_trusted_contact():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'user':
        return jsonify(error='User only.'), 403

    data = request.get_json()
    phone = data.get('phone', '').strip()
    name = data.get('name', '').strip()

    if not phone:
        return jsonify(error='Phone required.'), 400

    existing = TrustedContact.query.filter_by(user_id=int(uid), contact_phone=phone).first()
    if existing:
        return jsonify(error='Contact already trusted.'), 409

    tc = TrustedContact(user_id=int(uid), contact_phone=phone, contact_name=name)
    db.session.add(tc)
    db.session.commit()
    return jsonify(contact=tc.to_dict()), 201


@notif_bp.route('/trusted-contacts/<int:tc_id>', methods=['DELETE'])
@jwt_required()
def remove_trusted_contact(tc_id):
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    tc = TrustedContact.query.get(tc_id)
    if not tc or tc.user_id != int(uid):
        return jsonify(error='Not found.'), 404
    db.session.delete(tc)
    db.session.commit()
    return jsonify(message='Contact removed.'), 200


# ─── GUARDIAN MODE ────────────────────────────────────────────────────────────

@notif_bp.route('/guardian', methods=['GET'])
@jwt_required()
def get_guardian():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'user':
        return jsonify(error='User only.'), 403
    link = GuardianLink.query.filter_by(user_id=int(uid)).first()
    return jsonify(guardian=link.to_dict() if link else None), 200


@notif_bp.route('/guardian', methods=['POST'])
@jwt_required()
def set_guardian():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    if role != 'user':
        return jsonify(error='User only.'), 403

    data = request.get_json()
    guardian_phone = data.get('guardian_phone', '').strip()
    threshold = float(data.get('threshold', 500))

    if not guardian_phone:
        return jsonify(error='guardian_phone required.'), 400

    link = GuardianLink.query.filter_by(user_id=int(uid)).first()
    if link:
        link.guardian_phone = guardian_phone
        link.threshold = threshold
        link.is_active = True
    else:
        link = GuardianLink(user_id=int(uid), guardian_phone=guardian_phone, threshold=threshold)
        db.session.add(link)
    db.session.commit()
    return jsonify(guardian=link.to_dict()), 200


@notif_bp.route('/guardian/disable', methods=['POST'])
@jwt_required()
def disable_guardian():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1)
    link = GuardianLink.query.filter_by(user_id=int(uid)).first()
    if link:
        link.is_active = False
        db.session.commit()
    return jsonify(message='Guardian mode disabled.'), 200
