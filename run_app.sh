#!/bin/bash
# VeriVault Quickstart Script with Virtual Environment Support (PEP 668 compliant)

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================================="
echo "🔒 VeriVault: Secure Onboarding Monolithic Platform"
echo "========================================================="
echo "Starting installation and startup process..."

# 1. Set up Python Virtual Environment (Avoids PEP 668 externally-managed errors)
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

# 2. Install Backend Dependencies inside .venv
echo "Installing backend dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

# 3. Build Frontend
echo "Building the React frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
echo "Compiling production assets..."
npm run build
cd ..

# 4. Start the Monolithic FastAPI Application
echo "========================================================="
echo "🚀 VeriVault Monolith is ready!"
echo "Standard Live Server: http://localhost:8000"
echo "========================================================="
echo "Starting backend with Uvicorn (serving both API and React static frontend)..."
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
