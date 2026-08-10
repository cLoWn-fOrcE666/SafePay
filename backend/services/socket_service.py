"""
Socket service — helper to push real-time events to connected clients.
Each user/agent/admin joins a private room named "<type>_<id>" on connect.
"""
from extensions import socketio
from extensions import db
from models import Notification


def _save_notification(recipient_id, recipient_type, title, message, notif_type='info'):
    notif = Notification(
        recipient_id=recipient_id,
        recipient_type=recipient_type,
        title=title,
        message=message,
        notif_type=notif_type,
    )
    db.session.add(notif)
    db.session.commit()
    return notif


def emit_notification(recipient_id, recipient_type, title, message, notif_type='info'):
    """Save to DB and push real-time event to the user's private room."""
    notif = _save_notification(recipient_id, recipient_type, title, message, notif_type)
    room = f"{recipient_type}_{recipient_id}"
    socketio.emit(
        'notification',
        {
            'id': notif.id,
            'title': title,
            'message': message,
            'notif_type': notif_type,
            'created_at': notif.created_at.isoformat(),
        },
        room=room,
    )
    return notif


def emit_balance_update(owner_id, owner_type, new_balance):
    """Push balance change to user/agent."""
    room = f"{owner_type}_{owner_id}"
    socketio.emit('balance_update', {'balance': new_balance}, room=room)


def emit_transaction_event(sender_id, sender_type, receiver_id, receiver_type, tx_dict):
    """Notify both parties of a completed transaction."""
    for rid, rtype in [(sender_id, sender_type), (receiver_id, receiver_type)]:
        room = f"{rtype}_{rid}"
        socketio.emit('transaction', tx_dict, room=room)
