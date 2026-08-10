"""
OTP Service
-----------
Generates a 6-digit OTP, stores it in the DB (expires in 5 min),
and sends it to the user's email via Gmail SMTP.

Dev mode (SMTP not configured):
  The OTP is still generated and stored. It is returned in the API
  response AND printed to the backend console so the demo works without
  any email setup.

Gmail setup (to send real emails):
  1. Go to https://myaccount.google.com/apppasswords
  2. Generate an App Password for "Mail"
  3. Add to .env:
       MAIL_USERNAME=your.email@gmail.com
       MAIL_PASSWORD=xxxx xxxx xxxx xxxx   (the 16-char app password)
"""
import os
import random
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

from extensions import db
from models import OTPRecord

OTP_EXPIRY_MINUTES = 5
OTP_LENGTH         = 6


def _generate_code() -> str:
    return str(random.randint(100000, 999999))


def create_otp(user_id: int, user_type: str = 'user') -> str:
    """
    Invalidate any previous OTPs for this user, create a fresh one,
    and return the 6-digit code.
    """
    # Invalidate old OTPs
    OTPRecord.query.filter_by(
        user_id=user_id, user_type=user_type, is_used=False
    ).update({'is_used': True})
    db.session.flush()

    code    = _generate_code()
    expires = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    record = OTPRecord(
        user_id=user_id, user_type=user_type,
        otp_code=code, expires_at=expires,
    )
    db.session.add(record)
    db.session.commit()
    return code


def verify_otp(user_id: int, user_type: str, code: str) -> tuple[bool, str]:
    """
    Returns (True, 'ok') on success.
    Returns (False, reason) on failure.
    Increments attempt counter; marks as used on success.
    """
    record = OTPRecord.query.filter_by(
        user_id=user_id, user_type=user_type, is_used=False
    ).order_by(OTPRecord.created_at.desc()).first()

    if not record:
        return False, 'No OTP found. Please request a new one.'

    from datetime import datetime
    if datetime.utcnow() > record.expires_at:
        record.is_used = True
        db.session.commit()
        return False, f'OTP expired. It is valid for {OTP_EXPIRY_MINUTES} minutes only.'

    if record.attempts >= 3:
        record.is_used = True
        db.session.commit()
        return False, 'Too many wrong attempts. Please request a new OTP.'

    if record.otp_code != code.strip():
        record.attempts += 1
        db.session.commit()
        remaining = 3 - record.attempts
        return False, f'Incorrect OTP. {remaining} attempt(s) remaining.'

    record.is_used = True
    db.session.commit()
    return True, 'ok'


def send_otp_email(to_email: str, code: str, user_name: str = 'User') -> bool:
    """
    Send the OTP via Gmail SMTP.
    Returns True if sent, False if SMTP not configured (dev mode).
    """
    username = os.getenv('MAIL_USERNAME', '').strip()
    password = os.getenv('MAIL_PASSWORD', '').strip()

    # ── DEV MODE: SMTP not configured ────────────────────────────────────
    if not username or not password:
        print(f"\n{'='*50}")
        print(f"  📧  OTP FOR {user_name} ({to_email or 'no email'})")
        print(f"  🔑  CODE: {code}")
        print(f"  ⏰  Expires in {OTP_EXPIRY_MINUTES} minutes")
        print(f"{'='*50}\n")
        return False   # signals dev mode to caller

    # ── PRODUCTION: Send real email ───────────────────────────────────────
    subject = "Your SafePay Login OTP"
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;
                border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#10B981;margin-bottom:4px">SafePay</h2>
      <p style="color:#6b7280;margin-top:0">Fraud-Resistant Digital Wallet</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
      <p>Hi <strong>{user_name}</strong>,</p>
      <p>Your one-time login code is:</p>
      <div style="font-size:40px;font-weight:900;letter-spacing:12px;
                  color:#10B981;text-align:center;padding:20px;
                  background:#f0fdf4;border-radius:10px;margin:16px 0">
        {code}
      </div>
      <p style="color:#6b7280;font-size:13px">
        This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.
        Do not share it with anyone — SafePay will never ask for your OTP.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
      <p style="color:#9ca3af;font-size:11px">
        If you didn't request this, ignore this email.
      </p>
    </div>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From']    = f"SafePay <{username}>"
    msg['To']      = to_email
    msg.attach(MIMEText(html_body, 'html'))

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ctx) as server:
            server.login(username, password)
            server.sendmail(username, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[OTP] Email send failed: {e}")
        # Fall back to console output so login still works
        print(f"\n{'='*50}")
        print(f"  📧  OTP FOR {user_name} — EMAIL FAILED, CONSOLE FALLBACK")
        print(f"  🔑  CODE: {code}")
        print(f"{'='*50}\n")
        return False
