# 🛡️ SafePay: A Fraud-Resistant Digital Wallet

> *What if the people who love you could stop a scammer before the money leaves your account?*

SafePay is a full-stack mobile-wallet prototype I built as my final-year Computer Science & Engineering project. It is inspired by the mobile financial services (MFS) that millions of people in Bangladesh use every day, such as bKash and Nagad, but it is designed around one question: **how do we make digital money harder to steal from the people who are easiest to scam?**

> ⚠️ **Academic prototype.** SafePay runs entirely on localhost with test data. It does not move real money and is not connected to any bank or payment network.

---

## 📖 Why I built this

Mobile financial services have changed life in Bangladesh. People who never had a bank account can now send money to family in seconds. That is a real achievement.

But I kept hearing the same stories from people around me: a grandparent tricked by a phone call into sending their savings, a student who mistyped one digit and sent money to a stranger, an account emptied because someone learned a four-digit PIN. In each case, the money was gone within seconds and could not be recovered.

When I looked at how these apps work, I noticed a pattern. They are built to be **fast**, and speed is exactly what a scammer needs. A PIN is often the only barrier. Nothing pauses to ask, *"Does this transfer look unusual?"* Nothing lets a trusted family member say, *"Wait, that doesn't look right."*

SafePay is my attempt to explore what a safer design could look like, without making the app so slow or complicated that ordinary people would stop using it.

---

## ✨ What makes it different

| Problem in typical MFS apps | What SafePay does about it |
|---|---|
| A 4-digit PIN is the only login barrier | **Two-factor login**: PIN, then a one-time code (6 digits, valid for 5 minutes, 3 attempts) |
| Elderly or vulnerable users get tricked into sending money | **Guardian Mode**: a trusted person is alerted in real time and has **60 seconds to block** a large transfer |
| A mistyped number sends money to a stranger | **Confirm-before-send**: the receiver's registered name, trust status, and your history with them are shown before you enter your PIN |
| Fraud is detected after the money is gone | **Anomaly engine**: four rules run on every transaction *before* it settles |
| You never know if someone else is using your account | **Login Location Map**: every login is mapped, new cities trigger a warning, and one tap reports "this wasn't me" |
| Anonymous or fake accounts | **KYC review**: NID front, NID back, and a selfie are reviewed by an admin before any account can be used |
| Rejected with no explanation | Admins must write a **reason** for every rejection, and the applicant can see it |

---

## 🧠 The fraud-prevention features, explained simply

### 1. Anomaly Detection Engine
Before any transfer is processed, SafePay asks four questions:

| Rule | It triggers when... |
|---|---|
| **Rapid-Fire** | the sender makes 3 or more transactions within 5 minutes |
| **Large Amount** | the amount is more than 5× the sender's own historical average |
| **Unusual Hour** | the transfer is attempted between 1:00 AM and 5:00 AM (Bangladesh time) |
| **Fan-Out** | the sender pays 5 or more different people within 10 minutes |

If any rule fires, the transfer is held for 30 seconds, the user must re-enter their PIN to continue, and a fraud alert is logged for the admin.

I chose a *relative* threshold (5× your own average) over a fixed amount on purpose. ৳5,000 is suspicious for someone who usually sends ৳300, and perfectly normal for someone who sends ৳4,000 every week.

### 2. Guardian Mode
A user can name a guardian (a parent, a child, a trusted friend) and set an amount threshold. When a transfer goes above it:

1. The transfer is **paused**. No money has moved yet.
2. The guardian instantly sees who is sending, to whom, and how much, with a live 60-second countdown.
3. If the guardian **rejects**, the transfer is cancelled and a high-severity fraud alert goes to the admin.
4. If the guardian allows it or lets the timer run out, the **sender must re-enter their PIN** to finish the transfer.

The aim is a safety net that helps without taking control away from the account owner.

### 3. Login Location Map
Every login is recorded with an approximate location and drawn on an interactive map. If a login comes from a city the user doesn't normally log in from, they see a warning right away and can report it with one tap. The report becomes a fraud alert for the admin.

### 4. Trusted Contacts & Confirm-Before-Send
Users keep a list of trusted numbers. Sending to anyone else shows a clear warning, along with the receiver's registered name, so a single wrong digit is much more likely to be noticed before the money is gone.

---

## 👥 Three portals, three roles

SafePay is split into three separate React apps, each built for one kind of user.

| Portal | Who it's for | What they can do | Port |
|---|---|---|---|
| **User** | everyday customers | send money, cash out, request money, set a guardian, manage trusted contacts, view the login map, see spending charts | `3000` |
| **Agent** | local cash points | submit cash-in requests to the admin, receive cash-outs, send money to users | `3001` |
| **Admin** | the platform's oversight team | review KYC documents, approve or reject accounts and cash-in requests, freeze accounts, view all transactions and fraud alerts | `3002` |

### How money moves
- **Cash-in:** an agent collects physical cash → submits a request → the admin approves → the agent's wallet is credited.
- **Cash-out:** a user sends money to an agent from the app → the agent hands over physical cash.
- **Transfers:** user to user, protected by all the checks above.

---

## 🏗️ Architecture

```
   User Portal         Agent Portal         Admin Portal
   (React :3000)       (React :3001)        (React :3002)
         │                   │                    │
         └───────────────────┼────────────────────┘
                             │   REST (JWT) + WebSocket
                    ┌────────▼─────────┐
                    │   Flask API      │
                    │  auth · wallet   │
                    │  anomaly engine  │
                    │  OTP · guardian  │
                    └────────┬─────────┘
                             │  SQLAlchemy ORM
                    ┌────────▼─────────┐
                    │     SQLite       │
                    │ row-level locks  │
                    └──────────────────┘
```

**Design choices worth mentioning**
- **Atomic transfers.** Balance changes use row-level locking (`with_for_update()`) inside a single database transaction, so two simultaneous transfers cannot spend the same money twice.
- **Real-time updates.** Socket.IO delivers notifications, live balance updates and the guardian alert the moment they happen.
- **Role separation.** Each role has its own portal and its own checks on the backend, so a user token can never be used to reach admin routes.

---

## 🧰 Tech stack

**Backend:** Python 3.10+ · Flask · SQLAlchemy · SQLite · Flask-JWT-Extended · bcrypt · Flask-SocketIO · eventlet · Redis (optional)
**Frontend:** React 18 · Vite · Tailwind CSS · React Router · Axios · Socket.IO client · Recharts · Leaflet
**Services:** Gmail SMTP (OTP email) · ip-api.com (IP geolocation)

---

## 🚀 Getting started

### Prerequisites
- Python 3.10+
- Node.js 18+
- *(Optional)* Redis, which the app falls back from gracefully if it isn't running

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
python seed.py                 # creates the admin, test users, test agents and sample data
python app.py                  # API on http://localhost:5000
```

### 2. Frontends (one terminal each)

```bash
cd frontend-user  && npm install && npm run dev    # http://localhost:3000
cd frontend-agent && npm install && npm run dev    # http://localhost:3001
cd frontend-admin && npm install && npm run dev    # http://localhost:3002
```

### 3. Environment file
Create `backend/.env` (never commit this file):

```env
SECRET_KEY=change-me
JWT_SECRET_KEY=change-me-too
DATABASE_URL=sqlite:///safepay.db
REDIS_URL=redis://localhost:6379/0

# Optional: leave empty to run OTP in dev mode (code shown on screen)
MAIL_USERNAME=
MAIL_PASSWORD=
```

> **About OTP in dev mode:** if `MAIL_USERNAME` is empty, the one-time code is displayed on the login screen so the app can be demonstrated without an email account. To send real emails, add a Gmail address and an [App Password](https://myaccount.google.com/apppasswords).

---

## 🎬 A 5-minute tour for reviewers

**Test accounts (created by `seed.py`):**

| Role | Login | Secret |
|---|---|---|
| Admin | `admin` | `admin123` |
| User (Rahim) | `01711111111` | PIN `1234` |
| User (Karim) | `01722222222` | PIN `1234` |
| Agent (Jalal) | `01811111111` | PIN `5678` |

**Try this:**

1. **Two-factor login.** Log in as Rahim. After the PIN, enter the OTP shown on screen.
2. **Login map.** Open **Login Map** in the sidebar and see the seeded login history, including one flagged login.
3. **Guardian Mode.** As Rahim, open **Guardian Mode** and set Karim (`01722222222`) as guardian with a low threshold. In a second browser window, log in as Karim. Then, as Rahim, send a larger amount. Watch Karim's alert appear with a live countdown, and try rejecting it.
4. **Anomaly engine.** Send three small transfers quickly, then a fourth. The hold-and-confirm screen appears.
5. **Cash-in flow.** As the agent, submit a cash-in request. As the admin, approve it. The agent's balance updates live.
6. **KYC review.** Register a new user with three photos, then approve or reject it as admin (a rejection requires a written reason).

---

## 🔍 Honest limitations

I'd rather be upfront about what this project is and isn't.

- **It is a prototype, not production software.** SQLite and a single Flask process are fine for a demo but not for real financial traffic.
- **KYC is manual.** An admin reviews the documents by eye. There is no automated OCR or face matching yet, and that would not scale to large numbers of users.
- **Anomaly rules are rule-based.** They are transparent and easy to explain, but a determined attacker who stays just under the thresholds could avoid them.
- **Balances are stored as floating-point numbers.** A production system should use fixed-precision decimals for money.
- **OTP goes to email, not SMS.** This is deliberate (SMS gateways cost money), but local users would expect SMS.
- **Locations on localhost are simulated.** On `127.0.0.1` there is no real IP to look up, so the app picks a demo city. With a real public IP it uses ip-api.com.
- **No automated test suite yet.** Features were verified manually.

---

## 🗺️ What's next

- Automated KYC pre-screening (OCR plus face-embedding comparison) to reduce admin workload
- An AI financial assistant that explains spending patterns and flags suspicious activity in plain language
- QR-code payments, savings goals, split bills and scheduled payments
- Bangla language support
- Device fingerprinting and graph-based detection for multi-hop mule networks
- SMS OTP through a local gateway
- Automated tests and a PostgreSQL migration

---

## 🎓 What I learned

Building SafePay taught me much more than a feature list suggests:

- **Security is a design problem, not an add-on.** Every protection adds friction, and finding the point where it protects people without annoying them was the hardest part.
- **Concurrency is easy to get wrong.** Handling money forced me to think carefully about locking, rollbacks and what "atomic" really means.
- **Real-time features need care.** Several of my bugs came from timing: a guardian's alert expiring before it was seen, or a rejection arriving after a confirmation. Fixing them taught me to design state transitions deliberately.
- **Honesty matters in engineering.** Knowing and documenting what a system *doesn't* do is as important as showing what it does.

---

## 📁 Project structure

```
safepay/
├── backend/
│   ├── app.py              # application factory
│   ├── models.py           # database models
│   ├── seed.py             # test data
│   ├── routes/             # auth · transactions · agent · admin · notifications
│   └── services/           # wallet · anomaly · otp · socket
├── frontend-user/          # React app for customers
├── frontend-agent/         # React app for agents
└── frontend-admin/         # React app for administrators
```

---

## 🔐 A note on privacy

KYC uploads (NID and selfie images) are stored locally in `backend/uploads/` and are **excluded from this repository**. Only synthetic test data is used in the demo. Please never commit real identity documents.

---

## 👤 About me

**[Your Full Name]**
Final-year B.Sc. in Computer Science & Engineering, [Your University], Bangladesh

📧 [your.email@example.com] · 💼 [LinkedIn URL] · 🐙 [GitHub URL]

I'm interested in secure systems, fintech and applied machine learning, and I'm applying for [Scholarship / Programme name] to continue my studies in this area. I'd welcome feedback on this project, so feel free to open an issue or get in touch.

---

## 📄 License

Released under the [MIT License](LICENSE) for academic and educational use.

---

<p align="center"><i>Built with care, so that sending money feels safer for everyone.</i></p>
