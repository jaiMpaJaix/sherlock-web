#!/usr/bin/env python3
"""
Sherlock Web UI Runner
Entrypoint to launch the Sherlock OSINT Web Application.
"""

import os
import sys

# Ensure current repository root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from web.app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print("=" * 60)
    print("🔍 Sherlock OSINT Web Interface")
    print(f"🌐 Server berjalan di: http://127.0.0.1:{port}")
    print("Tekan Ctrl+C untuk menghentikan server.")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
