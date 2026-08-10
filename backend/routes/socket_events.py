"""
Socket event handlers.
Clients join a private room on connect so we can push targeted events.
Room name convention: "<role>_<id>"  e.g. "user_3", "agent_1", "admin_1"
"""
from flask_socketio import join_room, leave_room
from flask_jwt_extended import decode_token
from extensions import socketio


@socketio.on('connect')
def on_connect(auth):
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get('token')
    if not token:
        return  # unauthenticated socket — still allow connection

    try:
        decoded = decode_token(token)
        identity = decoded.get('sub', '')
        if ':' in identity:
            role, uid = identity.split(':', 1)
            room = f"{role}_{uid}"
            join_room(room)
    except Exception:
        pass  # bad token — ignore, don't crash the server


@socketio.on('disconnect')
def on_disconnect():
    pass


@socketio.on('join')
def on_join(data):
    """Client can explicitly join their room by sending {token: '...'}"""
    token = data.get('token') if isinstance(data, dict) else None
    if not token:
        return
    try:
        decoded = decode_token(token)
        identity = decoded.get('sub', '')
        if ':' in identity:
            role, uid = identity.split(':', 1)
            room = f"{role}_{uid}"
            join_room(room)
    except Exception:
        pass
