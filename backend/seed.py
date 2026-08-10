"""
Fresh seed — wipes all existing data and rebuilds from scratch.
Run:  python seed.py
"""
import sys, os, random
sys.path.insert(0, os.path.dirname(__file__))

import bcrypt
from datetime import datetime, timedelta
from app import app
from extensions import db


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


BD_CITIES = [
    {'city': 'Dhaka',      'region': 'Dhaka Division',      'lat': 23.8103, 'lon': 90.4125},
    {'city': 'Chittagong', 'region': 'Chittagong Division', 'lat': 22.3569, 'lon': 91.7832},
    {'city': 'Sylhet',     'region': 'Sylhet Division',     'lat': 24.8949, 'lon': 91.8687},
    {'city': 'Rajshahi',   'region': 'Rajshahi Division',   'lat': 24.3745, 'lon': 88.6042},
    {'city': 'Khulna',     'region': 'Khulna Division',     'lat': 22.8456, 'lon': 89.5403},
]


def seed():
    with app.app_context():

        # ── Import all models inside app context ───────────────────────────
        from models import (
            User, Agent, Admin, Wallet, Transaction,
            LoginLocation, OTPRecord, Notification,
            FraudAlert, AnomalyLog, TrustedContact,
            GuardianLink, CashInRequest, MoneyRequest,
            SystemConfig,
        )

        print("\n🗑️  Dropping all tables...")
        db.drop_all()
        print("✅ All tables dropped.")

        print("🔨 Creating all tables fresh...")
        db.create_all()
        print("✅ All tables created.\n")

        # ── Admin ──────────────────────────────────────────────────────────
        admin = Admin(username='admin', password_hash=hash_pw('admin123'))
        db.session.add(admin)
        db.session.commit()
        print("✅ Admin        →  username: admin  |  password: admin123")

        # ── Users ──────────────────────────────────────────────────────────
        users_data = [
            {
                'phone': '01711111111', 'name': 'Rahim Hossain',
                'pin': '1234', 'balance': 5000.0,
                'email': '',   # add a real email here to test OTP
            },
            {
                'phone': '01722222222', 'name': 'Karim Uddin',
                'pin': '1234', 'balance': 3500.0,
                'email': '',
            },
            {
                'phone': '01733333333', 'name': 'Nasrin Begum',
                'pin': '1234', 'balance': 2000.0,
                'email': '',
            },
        ]

        created_users = []
        for ud in users_data:
            u = User(
                phone=ud['phone'], name=ud['name'],
                pin_hash=hash_pw(ud['pin']),
                email=ud['email'] or None,
                is_approved=True,   # pre-approved test accounts
            )
            db.session.add(u)
            db.session.flush()
            db.session.add(Wallet(owner_id=u.id, owner_type='user', balance=ud['balance']))
            created_users.append(u)
            print(f"✅ User         →  {ud['name']} | {ud['phone']} | PIN: {ud['pin']} | ৳{ud['balance']}")

        db.session.commit()

        # ── Agents ─────────────────────────────────────────────────────────
        agents_data = [
            {
                'phone': '01811111111', 'name': 'Jalal Agent',
                'business': 'Jalal Mobile Banking', 'pin': '5678', 'balance': 20000.0,
            },
            {
                'phone': '01822222222', 'name': 'Ruma Agent',
                'business': 'Ruma Cash Point', 'pin': '5678', 'balance': 15000.0,
            },
        ]

        created_agents = []
        for ad in agents_data:
            a = Agent(
                phone=ad['phone'], name=ad['name'],
                pin_hash=hash_pw(ad['pin']),
                business_name=ad['business'],
                is_approved=True,
            )
            db.session.add(a)
            db.session.flush()
            db.session.add(Wallet(owner_id=a.id, owner_type='agent', balance=ad['balance']))
            created_agents.append(a)
            print(f"✅ Agent        →  {ad['name']} | {ad['phone']} | PIN: {ad['pin']} | ৳{ad['balance']}")

        db.session.commit()

        # ── Sample Transactions ────────────────────────────────────────────
        u1, u2, u3 = created_users
        a1 = created_agents[0]
        now = datetime.utcnow()

        transactions = [
            # user-to-user transfers
            dict(sender_id=u1.id, sender_type='user',
                 receiver_id=u2.id, receiver_type='user',
                 amount=500.0,  tx_type='transfer', status='completed',
                 note='Lunch money', created_at=now - timedelta(days=6)),
            dict(sender_id=u1.id, sender_type='user',
                 receiver_id=u2.id, receiver_type='user',
                 amount=1000.0, tx_type='transfer', status='completed',
                 note='Rent share', created_at=now - timedelta(days=4)),
            dict(sender_id=u2.id, sender_type='user',
                 receiver_id=u1.id, receiver_type='user',
                 amount=250.0,  tx_type='transfer', status='completed',
                 note='Bus fare', created_at=now - timedelta(days=3)),
            dict(sender_id=u3.id, sender_type='user',
                 receiver_id=u1.id, receiver_type='user',
                 amount=800.0,  tx_type='transfer', status='completed',
                 note='Gift', created_at=now - timedelta(days=2)),
            dict(sender_id=u1.id, sender_type='user',
                 receiver_id=u3.id, receiver_type='user',
                 amount=300.0,  tx_type='transfer', status='completed',
                 note='Groceries', created_at=now - timedelta(days=1)),
            # cash-out (user → agent)
            dict(sender_id=u1.id, sender_type='user',
                 receiver_id=a1.id, receiver_type='agent',
                 amount=2000.0, tx_type='cash_out', status='completed',
                 note='Cash-out via Jalal', created_at=now - timedelta(days=5)),
        ]

        for t in transactions:
            db.session.add(__import__('models', fromlist=['Transaction']).Transaction(**t))
        db.session.commit()
        print(f"✅ Transactions →  {len(transactions)} sample transactions created")

        # ── Trusted Contacts ───────────────────────────────────────────────
        tc1 = TrustedContact(user_id=u1.id, contact_phone=u2.phone, contact_name='Karim')
        tc2 = TrustedContact(user_id=u1.id, contact_phone=u3.phone, contact_name='Nasrin')
        db.session.add_all([tc1, tc2])
        db.session.commit()
        print("✅ Trusted contacts seeded for Rahim")

        # ── Guardian Link ──────────────────────────────────────────────────
        gl = GuardianLink(user_id=u3.id, guardian_phone=u1.phone, threshold=500.0, is_active=True)
        db.session.add(gl)
        db.session.commit()
        print("✅ Guardian link →  Nasrin's guardian is Rahim (threshold ৳500)")

        # ── Demo Login Locations ───────────────────────────────────────────
        login_history = [
            # (user, days_ago, city_idx, is_new, is_flagged)
            (u1, 14, 0, False, False),   # Dhaka — first ever
            (u1, 10, 0, False, False),   # Dhaka — normal
            (u1,  7, 1, True,  False),   # Chittagong — new city (travelling)
            (u1,  5, 0, True,  False),   # back to Dhaka
            (u1,  2, 2, True,  True),    # Sylhet — flagged as suspicious
            (u1,  0, 0, True,  False),   # latest: Dhaka
            (u2,  3, 0, False, False),
            (u2,  0, 0, False, False),
        ]

        for user, days_ago, city_idx, is_new, is_flagged in login_history:
            c = BD_CITIES[city_idx]
            loc = LoginLocation(
                user_id=user.id, user_type='user',
                ip_address=f"103.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}",
                city=c['city'], region=c['region'], country='Bangladesh',
                latitude=c['lat']  + random.uniform(-0.01, 0.01),
                longitude=c['lon'] + random.uniform(-0.01, 0.01),
                is_new_location=is_new,
                is_flagged=is_flagged,
                created_at=now - timedelta(days=days_ago, hours=random.randint(0, 12)),
            )
            db.session.add(loc)

        db.session.commit()
        print("✅ Login locations seeded (8 entries including 1 flagged)")

        # ── Sample Fraud Alert ─────────────────────────────────────────────
        fa = FraudAlert(
            user_id=u1.id, user_type='user',
            alert_type='suspicious_login_location',
            description='User flagged a login from Sylhet as suspicious.',
            severity='high', is_resolved=False,
        )
        db.session.add(fa)
        db.session.commit()
        print("✅ Sample fraud alert created (Sylhet login)")

        print("\n══════════════════════════════════════════════════════")
        print("  SafePay database seeded fresh! 🎉")
        print("══════════════════════════════════════════════════════")
        print()
        print("  ADMIN     →  http://localhost:3002")
        print("             username: admin  |  password: admin123")
        print()
        print("  USERS     →  http://localhost:3000")
        print("             01711111111  PIN: 1234  (Rahim)  ৳5000")
        print("             01722222222  PIN: 1234  (Karim)  ৳3500")
        print("             01733333333  PIN: 1234  (Nasrin) ৳2000")
        print()
        print("  AGENTS    →  http://localhost:3001")
        print("             01811111111  PIN: 5678  (Jalal)  ৳20000")
        print("             01822222222  PIN: 5678  (Ruma)   ৳15000")
        print()
        print("  BACKEND   →  http://localhost:5000")
        print("══════════════════════════════════════════════════════\n")


if __name__ == '__main__':
    seed()
