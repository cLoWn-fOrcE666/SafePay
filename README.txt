══════════════════════════════════════════════════════════════════
  SafePay — Fraud-Resistant Digital Wallet
  Final Year Project | CSE | Full Stack (Flask + React)
══════════════════════════════════════════════════════════════════

WHAT IS SAFEPAY?
─────────────────
SafePay is a mobile-style digital wallet with three separate portals:
  - User Portal    (http://localhost:3000)  — Regular users: send/receive/request money
  - Agent Portal   (http://localhost:3001)  — Agents: cash-in/cash-out processing
  - Admin Portal   (http://localhost:3002)  — Admin: approve requests, manage users, view fraud alerts
  - Backend API    (http://localhost:5000)  — Flask REST API + Socket.IO

──────────────────────────────────────────────────────────────────
FOLDER STRUCTURE
──────────────────────────────────────────────────────────────────
safepay/
├── backend/              Python Flask API
│   ├── app.py            Main app entry point
│   ├── config.py         Configuration (reads .env)
│   ├── extensions.py     Flask extensions (db, jwt, socketio)
│   ├── models.py         All database models (SQLite via SQLAlchemy)
│   ├── seed.py           Creates admin + test data
│   ├── requirements.txt  Python dependencies
│   ├── routes/           API route blueprints
│   │   ├── auth.py       Register/Login for all roles + JWT
│   │   ├── transactions.py  Send, request, history, stats
│   │   ├── agent.py      Cash-out, cash-in requests, send
│   │   ├── admin.py      Approvals, freeze, stats, balance adjust
│   │   ├── notifications.py  Notifications, trusted contacts, guardian
│   │   └── socket_events.py  Real-time Socket.IO event handlers
│   └── services/
│       ├── wallet.py     ACID wallet operations
│       ├── anomaly.py    Fraud detection engine
│       └── socket_service.py  Real-time push helpers
├── frontend-user/        React app — port 3000
├── frontend-agent/       React app — port 3001
├── frontend-admin/       React app — port 3002
└── .env                  Environment variables


══════════════════════════════════════════════════════════════════
PREREQUISITES  (install these first)
══════════════════════════════════════════════════════════════════

1. PYTHON 3.10 or newer
   Download: https://www.python.org/downloads/
   ✅ Check "Add Python to PATH" during install
   Verify: python --version

2. NODE.JS 18 or newer
   Download: https://nodejs.org/  (choose LTS)
   Verify: node --version && npm --version

3. REDIS (optional but recommended for real-time features)
   Windows:  Download from https://github.com/tporadowski/redis/releases
             Run redis-server.exe
   OR use Docker: docker run -d -p 6379:6379 redis
   ✅ If Redis is NOT running, the backend still works — it falls back
      to in-memory Socket.IO (works for single-process testing).


══════════════════════════════════════════════════════════════════
STEP-BY-STEP SETUP
══════════════════════════════════════════════════════════════════

You need 4 terminal windows (or tabs) open at the same time.

──────────────────────────────────────────────────────────────────
TERMINAL 1 — Backend Setup & Run
──────────────────────────────────────────────────────────────────

  cd safepay/backend

  # Create Python virtual environment
  python -m venv venv

  # Activate it (Windows CMD)
  venv\Scripts\activate

  # Activate it (Windows PowerShell)
  venv\Scripts\Activate.ps1

  # Activate it (Mac/Linux)
  source venv/bin/activate

  # Install all Python packages
  pip install -r requirements.txt

  # Seed the database (creates admin + test users + test agent)
  python seed.py

  # Start the Flask backend
  python app.py

  ✅ You should see: "SafePay API is running" at http://localhost:5000/api/health


──────────────────────────────────────────────────────────────────
TERMINAL 2 — User Portal (React)
──────────────────────────────────────────────────────────────────

  cd safepay/frontend-user
  npm install
  npm run dev

  ✅ Opens at http://localhost:3000


──────────────────────────────────────────────────────────────────
TERMINAL 3 — Agent Portal (React)
──────────────────────────────────────────────────────────────────

  cd safepay/frontend-agent
  npm install
  npm run dev

  ✅ Opens at http://localhost:3001


──────────────────────────────────────────────────────────────────
TERMINAL 4 — Admin Portal (React)
──────────────────────────────────────────────────────────────────

  cd safepay/frontend-admin
  npm install
  npm run dev

  ✅ Opens at http://localhost:3002


══════════════════════════════════════════════════════════════════
TEST CREDENTIALS (created by seed.py)
══════════════════════════════════════════════════════════════════

ADMIN  (http://localhost:3002)
  Username : admin
  Password : admin123

AGENTS  (http://localhost:3001)
  Phone: 01811111111  |  PIN: 5678  |  Business: Jalal Mobile Banking
  Phone: 01822222222  |  PIN: 5678  |  Business: Ruma Cash Point

USERS  (http://localhost:3000)
  Phone: 01711111111  |  PIN: 1234  |  Balance: ৳5000  |  Name: Rahim Hossain
  Phone: 01722222222  |  PIN: 1234  |  Balance: ৳3500  |  Name: Karim Uddin
  Phone: 01733333333  |  PIN: 1234  |  Balance: ৳2000  |  Name: Nasrin Begum


══════════════════════════════════════════════════════════════════
HOW TO TEST KEY FEATURES
══════════════════════════════════════════════════════════════════

TEST MONEY TRANSFER (User → User):
  1. Login as Rahim (01711111111 / 1234) at localhost:3000
  2. Click "Send Money"
  3. Enter receiver: 01722222222
  4. Check the trust score — it shows send history
  5. Enter amount and PIN, click send
  6. Open another browser tab, login as Karim
  7. See real-time notification and balance update

TEST ANOMALY DETECTION:
  1. Login as Rahim
  2. Send money 3 times to the same person in quick succession
  3. On the 4th attempt, the system shows a 30-second hold alert

TEST CASH-IN FLOW:
  1. Login as admin at localhost:3002
  2. Login as Jalal agent at localhost:3001
  3. Agent: go to "Cash-In Request", submit a request for ৳5000
  4. Admin: go to "Cash-In Requests", approve it
  5. Agent balance automatically increases by ৳5000

TEST CASH-OUT FLOW:
  1. Login as Agent at localhost:3001
  2. Go to "Cash Out"
  3. Enter user phone (01711111111) and amount
  4. Enter agent PIN, process
  5. User's wallet is credited (they hand agent physical cash)

TEST AGENT APPROVAL:
  1. Register a new agent at localhost:3001/register
  2. Login as admin at localhost:3002
  3. Go to "Agent Approvals"
  4. Approve the new agent
  5. Agent can now log in

TEST GUARDIAN MODE:
  1. Login as Rahim, go to "Guardian Mode"
  2. Set guardian phone to 01722222222, threshold ৳500
  3. Send ৳600 to someone
  4. Login as Karim — he gets a guardian alert notification

TEST FREEZE ACCOUNT:
  1. Admin → "All Users" → Freeze Rahim's account
  2. Try to login as Rahim → blocked with "Account is frozen"
  3. Admin → Unfreeze → login works again


══════════════════════════════════════════════════════════════════
COMMON ERRORS & FIXES
══════════════════════════════════════════════════════════════════

❌ "ModuleNotFoundError: No module named 'flask'"
   Fix: Make sure virtual environment is activated (see setup above)

❌ "Address already in use" on port 5000
   Fix: Another app is using port 5000.
   Change port: python app.py  →  PORT=5001 python app.py
   Then update frontend proxy in vite.config.js

❌ npm install fails
   Fix: Make sure Node.js 18+ is installed. Run: node --version

❌ Redis connection error in console
   Fix: This is just a warning — the app still works without Redis.
   To use Redis: install and start redis-server first.

❌ CORS errors in browser
   Fix: Make sure backend is running on port 5000 BEFORE starting React apps

❌ PowerShell "cannot run scripts" error
   Fix: Run PowerShell as Administrator and run:
   Set-ExecutionPolicy RemoteSigned

❌ "venv\Scripts\activate" not found
   Fix: Run:  python -m venv venv  first


══════════════════════════════════════════════════════════════════
TECH STACK SUMMARY
══════════════════════════════════════════════════════════════════

Backend:
  - Python 3.10+ with Flask 3.0
  - SQLite database (via SQLAlchemy ORM)
  - JWT authentication (Flask-JWT-Extended)
  - bcrypt password hashing
  - Redis + Flask-SocketIO for real-time events
  - eventlet for async Socket.IO

Frontend (×3 portals):
  - React 18 + Vite
  - React Router v6 for navigation
  - Axios for API calls with auto token refresh
  - Socket.IO client for real-time updates
  - Tailwind CSS for styling
  - Recharts for charts
  - react-hot-toast for notifications

Fraud Prevention:
  - 4-rule anomaly detection engine
  - Trusted contacts whitelist
  - Guardian mode notifications
  - 30-second confirmation hold on flagged transactions
  - Admin fraud alert dashboard


══════════════════════════════════════════════════════════════════
API ENDPOINTS REFERENCE
══════════════════════════════════════════════════════════════════

AUTH
  POST /api/auth/user/register     Register new user
  POST /api/auth/user/login        User login
  POST /api/auth/agent/register    Register agent (pending approval)
  POST /api/auth/agent/login       Agent login
  POST /api/auth/admin/login       Admin login
  POST /api/auth/refresh           Refresh access token
  GET  /api/auth/me                Get current user info

TRANSACTIONS (User)
  POST /api/transactions/send         Send money
  POST /api/transactions/lookup       Look up receiver info + trust score
  POST /api/transactions/request      Request money from someone
  GET  /api/transactions/requests/incoming   Incoming money requests
  POST /api/transactions/requests/:id/respond  Accept or reject request
  GET  /api/transactions/history      Paginated transaction history
  GET  /api/transactions/stats        Spending stats + charts data

AGENT
  GET  /api/agent/dashboard          Agent dashboard stats
  POST /api/agent/cashout            Process cash-out for user
  POST /api/agent/cashin/request     Submit cash-in request to admin
  GET  /api/agent/cashin/requests    List own cash-in requests
  POST /api/agent/send               Send money to user

ADMIN
  GET  /api/admin/stats              System-wide statistics
  GET  /api/admin/agents/pending     Pending agent approvals
  POST /api/admin/agents/:id/approve Approve or reject agent
  GET  /api/admin/agents             List all agents
  GET  /api/admin/cashin/requests    List cash-in requests
  POST /api/admin/cashin/:id/process Approve or reject cash-in
  GET  /api/admin/users              List all users
  POST /api/admin/users/:id/freeze   Freeze/unfreeze user
  POST /api/admin/agents/:id/freeze  Freeze/unfreeze agent
  POST /api/admin/balance/adjust     Emergency balance adjustment
  GET  /api/admin/transactions       All system transactions
  GET  /api/admin/fraud-alerts       Fraud alert log
  POST /api/admin/fraud-alerts/:id/resolve  Mark alert resolved

NOTIFICATIONS
  GET  /api/notifications/           Get notifications + unread count
  POST /api/notifications/:id/read   Mark notification read
  POST /api/notifications/read-all   Mark all as read
  GET  /api/notifications/trusted-contacts    List trusted contacts
  POST /api/notifications/trusted-contacts    Add trusted contact
  DELETE /api/notifications/trusted-contacts/:id  Remove trusted contact
  GET  /api/notifications/guardian    Get guardian settings
  POST /api/notifications/guardian    Set guardian
  POST /api/notifications/guardian/disable  Disable guardian mode

══════════════════════════════════════════════════════════════════
