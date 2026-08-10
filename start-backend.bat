@echo off
echo ========================================
echo   SafePay Backend — Starting...
echo ========================================
cd /d "%~dp0backend"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo Seeding database...
python seed.py

echo.
echo Starting Flask server on http://localhost:5000
echo Press Ctrl+C to stop.
echo.
python app.py
pause
