#!/usr/bin/env bash
# Quick launcher for Solari Split-Flap Board

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Ensure venv exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
fi

echo "Starting Solari Split-Flap Board at http://localhost:8080 ..."
echo "Press Ctrl+C to stop."

# Open in default browser after 1 second if on macOS
(sleep 1 && open "http://localhost:8080") &

exec .venv/bin/python server.py
