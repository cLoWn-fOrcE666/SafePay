from datetime import datetime
from extensions import db


class User(db.Model):
    __tablename__ = 'users'
    id               = db.Column(db.Integer, primary_key=True)
    phone            = db.Column(db.String(20), unique=True, nullable=False)
    name             = db.Column(db.String(100), nullable=False)
    pin_hash         = db.Column(db.String(200), nullable=False)
    email            = db.Column(db.String(200))          # for OTP delivery
    is_active        = db.Column(db.Boolean, default=True)
    is_frozen        = db.Column(db.Boolean, default=False)
    is_approved      = db.Column(db.Boolean, default=False)
    rejection_reason = db.Column(db.String(500))
    nid_front        = db.Column(db.String(300))
    nid_back         = db.Column(db.String(300))
    selfie           = db.Column(db.String(300))
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    wallet = db.relationship(
        'Wallet', foreign_keys='Wallet.owner_id',
        primaryjoin="and_(Wallet.owner_id==User.id, Wallet.owner_type=='user')",
        uselist=False,
    )
    trusted_contacts = db.relationship('TrustedContact', backref='user', lazy=True)
    guardian_link    = db.relationship(
        'GuardianLink', foreign_keys='GuardianLink.user_id',
        backref='user', uselist=False,
    )

    def to_dict(self):
        return {
            'id':               self.id,
            'phone':            self.phone,
            'name':             self.name,
            'email':            self.email,
            'is_active':        self.is_active,
            'is_frozen':        self.is_frozen,
            'is_approved':      self.is_approved,
            'rejection_reason': self.rejection_reason,
            'has_nid':          bool(self.nid_front),
            'created_at':       self.created_at.isoformat(),
        }


class Agent(db.Model):
    __tablename__ = 'agents'
    id               = db.Column(db.Integer, primary_key=True)
    phone            = db.Column(db.String(20), unique=True, nullable=False)
    name             = db.Column(db.String(100), nullable=False)
    pin_hash         = db.Column(db.String(200), nullable=False)
    business_name    = db.Column(db.String(150))
    is_approved      = db.Column(db.Boolean, default=False)
    is_frozen        = db.Column(db.Boolean, default=False)
    rejection_reason = db.Column(db.String(500))
    nid_front        = db.Column(db.String(300))
    nid_back         = db.Column(db.String(300))
    selfie           = db.Column(db.String(300))
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    wallet = db.relationship(
        'Wallet', foreign_keys='Wallet.owner_id',
        primaryjoin="and_(Wallet.owner_id==Agent.id, Wallet.owner_type=='agent')",
        uselist=False,
    )

    def to_dict(self):
        return {
            'id':               self.id,
            'phone':            self.phone,
            'name':             self.name,
            'business_name':    self.business_name,
            'is_approved':      self.is_approved,
            'is_frozen':        self.is_frozen,
            'rejection_reason': self.rejection_reason,
            'has_nid':          bool(self.nid_front),
            'created_at':       self.created_at.isoformat(),
        }


class Admin(db.Model):
    __tablename__ = 'admins'
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)


class Wallet(db.Model):
    __tablename__ = 'wallets'
    id         = db.Column(db.Integer, primary_key=True)
    owner_id   = db.Column(db.Integer, nullable=False)
    owner_type = db.Column(db.String(10), nullable=False)
    balance    = db.Column(db.Float, default=0.0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'owner_id':   self.owner_id,
            'owner_type': self.owner_type,
            'balance':    self.balance,
        }


class Transaction(db.Model):
    __tablename__ = 'transactions'
    id                  = db.Column(db.Integer, primary_key=True)
    sender_id           = db.Column(db.Integer, nullable=False)
    sender_type         = db.Column(db.String(10), nullable=False)
    receiver_id         = db.Column(db.Integer, nullable=False)
    receiver_type       = db.Column(db.String(10), nullable=False)
    amount              = db.Column(db.Float, nullable=False)
    tx_type             = db.Column(db.String(20), nullable=False)
    status              = db.Column(db.String(30), default='completed')
    note                = db.Column(db.String(255))
    ip_address          = db.Column(db.String(50))
    anomaly_flagged     = db.Column(db.Boolean, default=False)
    guardian_hold_until = db.Column(db.DateTime)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                  self.id,
            'sender_id':           self.sender_id,
            'sender_type':         self.sender_type,
            'receiver_id':         self.receiver_id,
            'receiver_type':       self.receiver_type,
            'amount':              self.amount,
            'tx_type':             self.tx_type,
            'status':              self.status,
            'note':                self.note,
            'anomaly_flagged':     self.anomaly_flagged,
            'guardian_hold_until': (
                self.guardian_hold_until.isoformat()
                if self.guardian_hold_until else None
            ),
            'created_at':          self.created_at.isoformat(),
        }


class MoneyRequest(db.Model):
    __tablename__ = 'money_requests'
    id           = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, nullable=False)
    target_phone = db.Column(db.String(20), nullable=False)
    amount       = db.Column(db.Float, nullable=False)
    note         = db.Column(db.String(255))
    status       = db.Column(db.String(20), default='pending')
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'requester_id': self.requester_id,
            'target_phone': self.target_phone,
            'amount':       self.amount,
            'note':         self.note,
            'status':       self.status,
            'created_at':   self.created_at.isoformat(),
        }


class CashInRequest(db.Model):
    __tablename__ = 'cash_in_requests'
    id           = db.Column(db.Integer, primary_key=True)
    agent_id     = db.Column(db.Integer, db.ForeignKey('agents.id'), nullable=False)
    amount       = db.Column(db.Float, nullable=False)
    reason       = db.Column(db.String(255))
    status       = db.Column(db.String(20), default='pending')
    admin_note   = db.Column(db.String(255))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime)

    agent = db.relationship('Agent', backref='cash_in_requests')

    def to_dict(self):
        return {
            'id':           self.id,
            'agent_id':     self.agent_id,
            'agent_name':   self.agent.name  if self.agent else None,
            'agent_phone':  self.agent.phone if self.agent else None,
            'amount':       self.amount,
            'reason':       self.reason,
            'status':       self.status,
            'admin_note':   self.admin_note,
            'created_at':   self.created_at.isoformat(),
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
        }


class TrustedContact(db.Model):
    __tablename__ = 'trusted_contacts'
    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contact_phone = db.Column(db.String(20), nullable=False)
    contact_name  = db.Column(db.String(100))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':            self.id,
            'contact_phone': self.contact_phone,
            'contact_name':  self.contact_name,
            'created_at':    self.created_at.isoformat(),
        }


class GuardianLink(db.Model):
    __tablename__ = 'guardian_links'
    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    guardian_phone = db.Column(db.String(20), nullable=False)
    threshold      = db.Column(db.Float, default=500.0)
    is_active      = db.Column(db.Boolean, default=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':             self.id,
            'user_id':        self.user_id,
            'guardian_phone': self.guardian_phone,
            'threshold':      self.threshold,
            'is_active':      self.is_active,
        }


class AnomalyLog(db.Model):
    __tablename__ = 'anomaly_logs'
    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, nullable=False)
    user_type      = db.Column(db.String(10), default='user')
    rule_triggered = db.Column(db.String(50), nullable=False)
    details        = db.Column(db.String(500))
    amount         = db.Column(db.Float)
    resolved       = db.Column(db.Boolean, default=False)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':             self.id,
            'user_id':        self.user_id,
            'rule_triggered': self.rule_triggered,
            'details':        self.details,
            'amount':         self.amount,
            'resolved':       self.resolved,
            'created_at':     self.created_at.isoformat(),
        }


class FraudAlert(db.Model):
    __tablename__ = 'fraud_alerts'
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, nullable=False)
    user_type   = db.Column(db.String(10), default='user')
    alert_type  = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(500))
    severity    = db.Column(db.String(20), default='medium')
    is_resolved = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'user_id':     self.user_id,
            'user_type':   self.user_type,
            'alert_type':  self.alert_type,
            'description': self.description,
            'severity':    self.severity,
            'is_resolved': self.is_resolved,
            'created_at':  self.created_at.isoformat(),
        }


class Notification(db.Model):
    __tablename__ = 'notifications'
    id             = db.Column(db.Integer, primary_key=True)
    recipient_id   = db.Column(db.Integer, nullable=False)
    recipient_type = db.Column(db.String(10), nullable=False)
    title          = db.Column(db.String(200), nullable=False)
    message        = db.Column(db.String(500), nullable=False)
    notif_type     = db.Column(db.String(30), default='info')
    action_type    = db.Column(db.String(50))
    action_data    = db.Column(db.String(500))
    is_read        = db.Column(db.Boolean, default=False)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'title':       self.title,
            'message':     self.message,
            'notif_type':  self.notif_type,
            'action_type': self.action_type,
            'action_data': self.action_data,
            'is_read':     self.is_read,
            'created_at':  self.created_at.isoformat(),
        }


class SystemConfig(db.Model):
    __tablename__ = 'system_config'
    id         = db.Column(db.Integer, primary_key=True)
    key        = db.Column(db.String(100), unique=True, nullable=False)
    value      = db.Column(db.String(500))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LoginLocation(db.Model):
    __tablename__ = 'login_locations'
    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, nullable=False)
    user_type       = db.Column(db.String(10), nullable=False, default='user')
    ip_address      = db.Column(db.String(60))
    city            = db.Column(db.String(100))
    region          = db.Column(db.String(100))
    country         = db.Column(db.String(100), default='Bangladesh')
    latitude        = db.Column(db.Float)
    longitude       = db.Column(db.Float)
    is_new_location = db.Column(db.Boolean, default=False)
    is_flagged      = db.Column(db.Boolean, default=False)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':              self.id,
            'ip_address':      self.ip_address,
            'city':            self.city,
            'region':          self.region,
            'country':         self.country,
            'latitude':        self.latitude,
            'longitude':       self.longitude,
            'is_new_location': self.is_new_location,
            'is_flagged':      self.is_flagged,
            'created_at':      self.created_at.isoformat(),
        }


class OTPRecord(db.Model):
    __tablename__ = 'otp_records'
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, nullable=False)
    user_type  = db.Column(db.String(10), nullable=False, default='user')
    otp_code   = db.Column(db.String(6), nullable=False)
    attempts   = db.Column(db.Integer, default=0)
    is_used    = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def is_valid(self):
        return (
            not self.is_used
            and datetime.utcnow() < self.expires_at
            and self.attempts < 3
        )
