#!/usr/bin/env bash
# build.sh

set -e  # Exit on error

echo "=========================================="
echo "Starting build process..."
echo "=========================================="

# Install dependencies
echo "→ Installing Python dependencies..."
pip install -r requirements.txt

# Run migrations
echo "→ Running database migrations..."
python add_phone_verified.py

echo "=========================================="
echo "Build completed successfully!"
echo "=========================================="
