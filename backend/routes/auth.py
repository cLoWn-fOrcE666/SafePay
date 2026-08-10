import os, uuid, random, bcrypt
import requests as http_req
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
)
from extensions import db
from models import User, Agent, Admin, Wallet, LoginLocation, FraudAlert, Notification
from services.otp_service import create_otp, verify_otp, send_otp_email

auth_bp = Blueprint('auth', __name__)
ALLOWED_EXT = {'png', 'jpg', 'jpeg', 'webp'}

BD_CITIES = [
    {'city': 'Dhaka',      'region': 'Dhaka Division',      'latitude':  23.8103, 'longitude': 90.4125},
    {'city': 'Chittagong', 'region': 'Chittagong Division', 'latitude':  22.3569, 'longitude': 91.7832},
    {'city': 'Sylhet',     'region': 'Sylhet Division',     'latitude':  24.8949, 'longitude': 91.8687},
    {'city': 'Rajshahi',   'region': 'Rajshahi Division',   'latitude':  24.3745, 'longitude': 88.6042},
    {'city': 'Khulna',     'region': 'Khulna Division',     'latitude':  22.8456, 'longitude': 89.5403},
    {'city': 'Barishal',   'region': 'Barishal Division',   'latitude':  22.7010, 'longitude': 90.3535},
    {'city': 'Mymensingh', 'region': 'Mymensingh Division', 'latitude':  24.7471, 'longitude': 90.4203},
    {'city': 'Comilla',    'region': 'Chittagong Division', 'latitude':  23.4607, 'longitude': 91.1809},
]


def _allowed(f): return '.' in f and f.rsplit('.', 1)[1].lower() in ALLOWED_EXT

def _save_file(file, sub):
    d = os.path.join(current_app.root_path, 'uploads', sub)
    os.makedirs(d, exist_ok=True)
    ext  = file.filename.rsplit('.', 1)[1].lower()
    name = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(d, name))
    return f"uploads/{sub}/{name}"

def hash_pin(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def check_pin(p, h): return bcrypt.checkpw(p.encode(), h.encode())
def make_tokens(identity):
    return {'access_token':  create_access_token(identity=identity),
            'refresh_token': create_refresh_token(identity=identity)}

def _geolocate(ip):
    if ip in ('127.0.0.1', '::1', 'localhost', '0.0.0.0'):
        c = random.choices(BD_CITIES, weights=[6,1,1,1,1,1,1,1])[0]
        return {**c, 'country': 'Bangladesh'}
    try:
        r = http_req.get(f'http://ip-api.com/json/{ip}', timeout=3)
        d = r.json()
        if d.get('status') == 'success':
            return {'city': d.get('city','Unknown'), 'region': d.get('regionName',''),
                    'country': d.get('country',''), 'latitude': d.get('lat',0.0),
                    'longitude': d.get('lon',0.0)}
    except Exception:
        pass
    return {**BD_CITIES[0], 'country': 'Bangladesh'}

def _record_login(user_id, user_type, ip):
    geo  = _geolocate(ip)
    last = LoginLocation.query.filter_by(user_id=user_id, user_type=user_type)\
        .order_by(LoginLocation.created_at.desc()).first()
    is_new = bool(last and last.city and last.city != geo['city'])
    loc = LoginLocation(user_id=user_id, user_type=user_type, ip_address=ip,
                        city=geo['city'], region=geo['region'], country=geo['country'],
                        latitude=geo['latitude'], longitude=geo['longitude'],
                        is_new_location=is_new)
    db.session.add(loc)
    db.session.commit()
    return loc, is_new


# ── serve KYC uploads ──────────────────────────────────────────────────────────
# No JWT required here — browsers cannot send auth headers when loading <img src="...">.
# Files are stored locally and the paths are random UUIDs, so this is safe.
@auth_bp.route('/uploads/<path:filepath>')
def serve_upload(filepath):
    # Strip leading 'uploads/' if accidentally included in the path
    if filepath.startswith('uploads/'):
        filepath = filepath[len('uploads/'):]
    return send_from_directory(os.path.join(current_app.root_path, 'uploads'), filepath)


# ─── USER REGISTER ────────────────────────────────────────────────────────────
@auth_bp.route('/user/register', methods=['POST'])
def user_register():
    phone = request.form.get('phone', '').strip()
    name  = request.form.get('name',  '').strip()
    pin   = request.form.get('pin',   '').strip()
    email = request.form.get('email', '').strip()

    if not phone or not name or not pin:
        return jsonify(error='phone, name, and pin are required.'), 400
    if len(pin) < 4:
        return jsonify(error='PIN must be at least 4 digits.'), 400
    if User.query.filter_by(phone=phone).first():
        return jsonify(error='Phone number already registered.'), 409

    for field in ('nid_front', 'nid_back', 'selfie'):
        f = request.files.get(field)
        if not f or not _allowed(f.filename):
            return jsonify(error=f'"{field}" image is required (jpg/png/webp).'), 400

    user = User(
        phone=phone, name=name, pin_hash=hash_pin(pin), email=email or None,
        nid_front=_save_file(request.files['nid_front'], 'user_kyc'),
        nid_back =_save_file(request.files['nid_back'],  'user_kyc'),
        selfie   =_save_file(request.files['selfie'],    'user_kyc'),
        is_approved=False,
    )
    db.session.add(user); db.session.flush()
    db.session.add(Wallet(owner_id=user.id, owner_type='user', balance=0.0))
    db.session.commit()

    admin = Admin.query.first()
    if admin:
        db.session.add(Notification(
            recipient_id=admin.id, recipient_type='admin',
            title='New User Registration',
            message=f'{name} ({phone}) submitted KYC and awaits approval.',
            notif_type='info'))
        db.session.commit()

    return jsonify(message='Registration submitted. Awaiting admin approval.',
                   user=user.to_dict()), 201


# ─── USER LOGIN STEP 1: phone + PIN → generate & send OTP ────────────────────
@auth_bp.route('/user/login', methods=['POST'])
def user_login():
    data  = request.get_json()
    phone = data.get('phone', '').strip()
    pin   = data.get('pin',   '').strip()

    user = User.query.filter_by(phone=phone).first()
    if not user or not check_pin(pin, user.pin_hash):
        return jsonify(error='Invalid phone or PIN.'), 401
    if not user.is_approved:
        if user.rejection_reason:
            return jsonify(error='Registration rejected.',
                           rejection_reason=user.rejection_reason), 403
        return jsonify(error='Account pending admin approval.'), 403
    if user.is_frozen:
        return jsonify(error='Account is frozen. Contact support.'), 403

    # Generate OTP and send
    code    = create_otp(user.id, 'user')
    dev_mode = not os.getenv('MAIL_USERNAME', '').strip()
    sent    = send_otp_email(user.email or '', code, user.name)

    response = {
        'otp_required': True,
        'user_id':      user.id,
        'message':      (
            f'OTP sent to {user.email}.' if sent
            else 'OTP generated. Check the backend console (dev mode).'
        ),
        'dev_mode':     dev_mode,
        'has_email':    bool(user.email),
    }

    # In dev mode expose OTP in response for easy testing / demo
    if dev_mode:
        response['dev_otp'] = code

    return jsonify(**response), 200


# ─── USER LOGIN STEP 2: verify OTP → issue JWT ───────────────────────────────
@auth_bp.route('/user/verify-otp', methods=['POST'])
def user_verify_otp():
    data    = request.get_json()
    user_id = data.get('user_id')
    code    = data.get('otp', '').strip()

    if not user_id or not code:
        return jsonify(error='user_id and otp are required.'), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify(error='User not found.'), 404

    ok, reason = verify_otp(user_id, 'user', code)
    if not ok:
        return jsonify(error=reason), 401

    # OTP correct — record login location and issue tokens
    ip = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()
    loc, is_new = _record_login(user.id, 'user', ip)

    if is_new:
        db.session.add(Notification(
            recipient_id=user.id, recipient_type='user',
            title='🗺️ New Login Location Detected',
            message=(f'Login from {loc.city}, {loc.region}. '
                     'If this wasn\'t you, go to Login Map and flag it immediately.'),
            notif_type='warning'))
        db.session.commit()

    wallet = Wallet.query.filter_by(owner_id=user.id, owner_type='user').first()
    return jsonify(
        **make_tokens(f"user:{user.id}"),
        user=user.to_dict(),
        balance=wallet.balance if wallet else 0.0,
        new_location=is_new,
        login_city=loc.city,
    ), 200


# ─── RESEND OTP ───────────────────────────────────────────────────────────────
@auth_bp.route('/user/resend-otp', methods=['POST'])
def user_resend_otp():
    data    = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify(error='user_id required.'), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify(error='User not found.'), 404

    code     = create_otp(user.id, 'user')
    dev_mode = not os.getenv('MAIL_USERNAME', '').strip()
    sent     = send_otp_email(user.email or '', code, user.name)

    resp = {
        'message':  f'New OTP sent to {user.email}.' if sent
                    else 'New OTP generated. Check backend console.',
        'dev_mode': dev_mode,
    }
    if dev_mode:
        resp['dev_otp'] = code

    return jsonify(**resp), 200


# ─── AGENT REGISTER ───────────────────────────────────────────────────────────
@auth_bp.route('/agent/register', methods=['POST'])
def agent_register():
    phone = request.form.get('phone', '').strip()
    name  = request.form.get('name',  '').strip()
    pin   = request.form.get('pin',   '').strip()
    biz   = request.form.get('business_name', '').strip()

    if not phone or not name or not pin:
        return jsonify(error='phone, name, and pin are required.'), 400
    if Agent.query.filter_by(phone=phone).first():
        return jsonify(error='Phone already registered as agent.'), 409

    for field in ('nid_front', 'nid_back', 'selfie'):
        f = request.files.get(field)
        if not f or not _allowed(f.filename):
            return jsonify(error=f'"{field}" image is required (jpg/png/webp).'), 400

    agent = Agent(
        phone=phone, name=name, pin_hash=hash_pin(pin), business_name=biz,
        nid_front=_save_file(request.files['nid_front'], 'agent_kyc'),
        nid_back =_save_file(request.files['nid_back'],  'agent_kyc'),
        selfie   =_save_file(request.files['selfie'],    'agent_kyc'),
        is_approved=False,
    )
    db.session.add(agent); db.session.flush()
    db.session.add(Wallet(owner_id=agent.id, owner_type='agent', balance=0.0))
    db.session.commit()

    admin = Admin.query.first()
    if admin:
        db.session.add(Notification(
            recipient_id=admin.id, recipient_type='admin',
            title='New Agent Registration',
            message=f'Agent {name} ({phone}) submitted KYC and awaits approval.',
            notif_type='info'))
        db.session.commit()

    return jsonify(message='Registration submitted. Waiting for admin approval.',
                   agent=agent.to_dict()), 201


# ─── AGENT LOGIN (no OTP — agents use PIN only) ───────────────────────────────
@auth_bp.route('/agent/login', methods=['POST'])
def agent_login():
    data  = request.get_json()
    phone = data.get('phone', '').strip()
    pin   = data.get('pin',   '').strip()

    agent = Agent.query.filter_by(phone=phone).first()
    if not agent or not check_pin(pin, agent.pin_hash):
        return jsonify(error='Invalid phone or PIN.'), 401
    if not agent.is_approved:
        if agent.rejection_reason:
            return jsonify(error='Registration rejected.',
                           rejection_reason=agent.rejection_reason), 403
        return jsonify(error='Account pending admin approval.'), 403
    if agent.is_frozen:
        return jsonify(error='Account is frozen. Contact admin.'), 403

    ip = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()
    _record_login(agent.id, 'agent', ip)
    wallet = Wallet.query.filter_by(owner_id=agent.id, owner_type='agent').first()
    return jsonify(**make_tokens(f"agent:{agent.id}"),
                   agent=agent.to_dict(),
                   balance=wallet.balance if wallet else 0.0), 200


# ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
@auth_bp.route('/admin/login', methods=['POST'])
def admin_login():
    data  = request.get_json()
    admin = Admin.query.filter_by(username=data.get('username', '').strip()).first()
    if not admin or not check_pin(data.get('password', '').strip(), admin.password_hash):
        return jsonify(error='Invalid username or password.'), 401
    return jsonify(**make_tokens(f"admin:{admin.id}"),
                   admin={'id': admin.id, 'username': admin.username}), 200


# ─── SHARED ───────────────────────────────────────────────────────────────────
@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    return jsonify(access_token=create_access_token(identity=get_jwt_identity())), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1); uid = int(uid)
    if role == 'user':
        obj = User.query.get(uid)
        w   = Wallet.query.filter_by(owner_id=uid, owner_type='user').first()
        return jsonify(role='user', user=obj.to_dict() if obj else None,
                       balance=w.balance if w else 0.0)
    elif role == 'agent':
        obj = Agent.query.get(uid)
        w   = Wallet.query.filter_by(owner_id=uid, owner_type='agent').first()
        return jsonify(role='agent', agent=obj.to_dict() if obj else None,
                       balance=w.balance if w else 0.0)
    elif role == 'admin':
        obj = Admin.query.get(uid)
        return jsonify(role='admin',
                       admin={'id': obj.id, 'username': obj.username} if obj else None)
    return jsonify(error='Unknown role.'), 400


# ─── LOGIN LOCATION ENDPOINTS ─────────────────────────────────────────────────
@auth_bp.route('/login-locations', methods=['GET'])
@jwt_required()
def get_login_locations():
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1); uid = int(uid)
    locs = LoginLocation.query.filter_by(user_id=uid, user_type=role)\
        .order_by(LoginLocation.created_at.desc()).limit(20).all()
    return jsonify(locations=[l.to_dict() for l in locs]), 200


@auth_bp.route('/login-locations/<int:loc_id>/flag', methods=['POST'])
@jwt_required()
def flag_login_location(loc_id):
    identity = get_jwt_identity()
    role, uid = identity.split(':', 1); uid = int(uid)
    loc = LoginLocation.query.get(loc_id)
    if not loc or loc.user_id != uid or loc.user_type != role:
        return jsonify(error='Location not found.'), 404
    if loc.is_flagged:
        return jsonify(error='Already flagged.'), 400
    loc.is_flagged = True
    db.session.commit()
    db.session.add(FraudAlert(
        user_id=uid, user_type=role,
        alert_type='suspicious_login_location',
        description=(f'User flagged a login from {loc.city}, {loc.region} '
                     f'(IP: {loc.ip_address}) as suspicious on '
                     f'{loc.created_at.strftime("%Y-%m-%d %H:%M UTC")}.'),
        severity='high'))
    db.session.commit()
    from services.socket_service import emit_notification
    admin = Admin.query.first()
    if admin:
        emit_notification(admin.id, 'admin',
            '🚨 Suspicious Login Flagged',
            f'User flagged a login from {loc.city} as suspicious. Check fraud alerts.',
            'danger')
    return jsonify(message='Login flagged. Admin has been alerted.',
                   location=loc.to_dict()), 200
