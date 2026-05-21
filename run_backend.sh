#!/bin/bash

# ChangeSense Backend Startup Script
# This script sets up and runs the FastAPI backend server

set -e  # Exit on error

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "🚀 Starting ChangeSense Backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Navigate to backend directory
cd "$BACKEND_DIR"

# Minimum Python needed by backend source.
MIN_MAJOR=3
MIN_MINOR=10

pick_python() {
    local candidates=(
        "/opt/homebrew/bin/python3"
        "/opt/homebrew/Caskroom/miniforge/base/bin/python3"
        "$(command -v python3 2>/dev/null)"
        "/usr/bin/python3"
    )

    for candidate in "${candidates[@]}"; do
        if [ -z "$candidate" ] || [ ! -x "$candidate" ]; then
            continue
        fi

        local version
        version=$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        local major="${version%%.*}"
        local minor="${version##*.}"

        if [ "$major" -gt "$MIN_MAJOR" ] || { [ "$major" -eq "$MIN_MAJOR" ] && [ "$minor" -ge "$MIN_MINOR" ]; }; then
            echo "$candidate"
            return 0
        fi
    done

    return 1
}

needs_recreate_venv() {
    if [ ! -x ".venv/bin/python" ]; then
        return 0
    fi

    local venv_version
    venv_version=$(".venv/bin/python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    local v_major="${venv_version%%.*}"
    local v_minor="${venv_version##*.}"

    if [ "$v_major" -lt "$MIN_MAJOR" ]; then
        return 0
    fi
    if [ "$v_major" -eq "$MIN_MAJOR" ] && [ "$v_minor" -lt "$MIN_MINOR" ]; then
        return 0
    fi
    return 1
}

PYTHON_BIN="$(pick_python)"
if [ -z "$PYTHON_BIN" ]; then
    echo "❌ Could not find Python ${MIN_MAJOR}.${MIN_MINOR}+ on this machine."
    exit 1
fi

echo "🐍 Using Python: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    "$PYTHON_BIN" -m venv .venv
elif needs_recreate_venv; then
    echo "♻️  Recreating virtual environment (existing .venv uses Python < ${MIN_MAJOR}.${MIN_MINOR})..."
    rm -rf .venv
    "$PYTHON_BIN" -m venv .venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt

# Optional: Check for Gemini API key
if [ -z "$GEMINI_API_KEY" ]; then
    echo "ℹ️  Note: GEMINI_API_KEY not set (AI features will be disabled)"
    echo "   To enable: export GEMINI_API_KEY='your-key-here'"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend starting on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the server
uvicorn app.main:app --reload --port 8000
