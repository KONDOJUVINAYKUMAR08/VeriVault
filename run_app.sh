#!/bin/bash
# VeriVault Quickstart Script

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================================="
echo "🔒 VeriVault: Secure Onboarding Monolithic Platform"
echo "========================================================="
echo "Starting installation and startup process..."

# 1. Install Backend Dependencies
echo "Installing backend dependencies..."
python3 -m pip install -r backend/requirements.txt

# 2. Build Frontend
echo "Building the React frontend..."
cd frontend
npm install
npm run build
cd ..

# 3. Start the Monolithic FastAPI Application
echo "========================================================="
echo "🚀 VeriVault Monolith is ready!"
echo "Standard Live Server: http://localhost:8000"
echo "========================================================="
echo "Starting backend with Uvicorn (serving both API and React static frontend)..."
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
