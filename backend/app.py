import os
import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db, jwt, socketio


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)

    # Try to use Redis for SocketIO; fall back to in-memory if unavailable
    try:
        import redis
        r = redis.from_url(app.config['REDIS_URL'])
        r.ping()
        message_queue = app.config['REDIS_URL']
        print("[SocketIO] Redis message queue connected.")
    except Exception:
        message_queue = None
        print("[SocketIO] Redis not found — using in-memory transport (single-process only).")

    socketio.init_app(
        app,
        cors_allowed_origins=app.config['CORS_ORIGINS'],
        message_queue=message_queue,
        async_mode='eventlet',
    )

    CORS(app, origins=app.config['CORS_ORIGINS'], supports_credentials=True)

    # Register blueprints
    from routes.auth import auth_bp
    from routes.transactions import tx_bp
    from routes.agent import agent_bp
    from routes.admin import admin_bp
    from routes.notifications import notif_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(tx_bp, url_prefix='/api/transactions')
    app.register_blueprint(agent_bp, url_prefix='/api/agent')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(notif_bp, url_prefix='/api/notifications')

    # SocketIO events
    from routes import socket_events  # noqa: F401

    with app.app_context():
        db.create_all()

    @app.route('/api/health')
    def health():
        return {'status': 'SafePay API is running', 'version': '1.0.0'}

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
