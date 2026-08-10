import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'safepay-secret-key-change-in-prod')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///safepay.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'safepay-jwt-secret')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
    ]
