"""
Flask Web Application for Sherlock OSINT
Supports real-time SSE streaming, instant single-platform checks, and network diagnostics.
"""

import os
import sys
import json
import uuid
import threading
import requests
from flask import Flask, render_template, request, Response, jsonify, stream_with_context

# Add parent directory to path to ensure sherlock_project is importable
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from web.scanner import (
    scan_username_stream,
    check_single_site,
    load_site_data,
    CATEGORIES
)

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static")
)

# Active scan cancellation events: scan_id -> threading.Event
active_scans: dict[str, threading.Event] = {}
scans_lock = threading.Lock()


@app.route("/")
def index():
    """Render the main Sherlock Web dashboard."""
    return render_template("index.html")


@app.route("/api/categories")
def api_categories():
    """Return all available scanning categories with site counts."""
    all_sites = load_site_data()
    categories_info = {}
    for cat_id, cat_meta in CATEGORIES.items():
        if cat_id == "all":
            count = len(all_sites)
        else:
            valid_sites = [s for s in cat_meta["sites"] if s in all_sites]
            count = len(valid_sites)

        categories_info[cat_id] = {
            "id": cat_id,
            "name": cat_meta["name"],
            "description": cat_meta["description"],
            "icon": cat_meta["icon"],
            "count": count
        }

    return jsonify({
        "status": "success",
        "categories": categories_info
    })


@app.route("/api/all-sites")
def api_all_sites():
    """Return list of all supported platform names for autocomplete."""
    try:
        all_sites = load_site_data()
        sites_list = sorted(list(all_sites.keys()), key=lambda s: s.lower())
        return jsonify({
            "status": "success",
            "total": len(sites_list),
            "sites": sites_list
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/network-check")
def api_network_check():
    """Check if the server process has functional outbound internet connectivity."""
    try:
        # Fast test to check external internet connectivity
        resp = requests.get("https://www.github.com", timeout=4)
        online = (resp.status_code == 200)
        return jsonify({
            "status": "success",
            "online": online,
            "message": "Koneksi internet server aktif" if online else "Respon tidak terduga"
        })
    except Exception as e:
        return jsonify({
            "status": "warning",
            "online": False,
            "message": f"Server terisolasi atau offline: {str(e)}"
        })


@app.route("/api/check-single", methods=["POST"])
def api_check_single():
    """
    Ultra-fast single platform check.
    Request JSON: { "username": "jaidav", "site": "GitHub", "timeout": 8 }
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    site = data.get("site", "").strip()
    timeout = int(data.get("timeout", 10))

    if not username:
        return jsonify({"success": False, "error": "Username tidak boleh kosong"}), 400
    if not site:
        return jsonify({"success": False, "error": "Nama platform tidak boleh kosong"}), 400

    res = check_single_site(username=username, site_name=site, timeout=timeout)
    return jsonify(res)


@app.route("/api/scan")
def api_scan():
    """
    Server-Sent Events (SSE) streaming endpoint for multi-site scanning.
    Query params:
      - username (required)
      - mode (optional, default: 'popular', or 'all', 'dev', 'social', 'single')
      - site (optional single site)
      - sites (optional comma-separated site list)
      - timeout (optional, default: 12)
      - scan_id (optional, UUID)
    """
    username = request.args.get("username", "").strip()
    mode = request.args.get("mode", "popular")
    single_site = request.args.get("site", "").strip() or None
    raw_sites = request.args.get("sites", "").strip()
    custom_sites = [s.strip() for s in raw_sites.split(",") if s.strip()] if raw_sites else None
    timeout = int(request.args.get("timeout", 12))
    scan_id = request.args.get("scan_id") or str(uuid.uuid4())

    if not username:
        return jsonify({"status": "error", "message": "Username is required"}), 400

    cancel_event = threading.Event()
    with scans_lock:
        active_scans[scan_id] = cancel_event

    def event_stream():
        try:
            generator = scan_username_stream(
                username=username,
                mode=mode,
                single_site=single_site,
                custom_sites=custom_sites,
                timeout=timeout,
                cancel_event=cancel_event
            )
            for event in generator:
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as ex:
            error_event = {"type": "error", "message": f"Server stream error: {str(ex)}"}
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            with scans_lock:
                active_scans.pop(scan_id, None)

    response = Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream"
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Connection"] = "keep-alive"
    return response


@app.route("/api/scan/cancel", methods=["POST"])
def api_scan_cancel():
    """Cancel an active scan by scan_id."""
    data = request.get_json(silent=True) or {}
    scan_id = data.get("scan_id") or request.args.get("scan_id")

    if not scan_id:
        return jsonify({"status": "error", "message": "scan_id is required"}), 400

    with scans_lock:
        cancel_event = active_scans.get(scan_id)
        if cancel_event:
            cancel_event.set()
            return jsonify({"status": "success", "message": "Scan cancel signal sent"})

    return jsonify({"status": "warning", "message": "Scan ID not found or already completed"})


@app.route("/api/health")
def api_health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "sherlock-web",
        "version": "2.0-overhaul"
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print(f"🚀 Sherlock Web UI running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
