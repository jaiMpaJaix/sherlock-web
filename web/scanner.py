"""
Sherlock Web Engine (Official Sherlock Integration)
Directly integrates with sherlock_project.sherlock.sherlock for 100% accuracy,
supporting both single-platform instant checks and multi-site real-time SSE streaming.
"""

import os
import re
import json
import time
import queue
import threading
from typing import Dict, Any, Generator, Optional, List

from sherlock_project.sherlock import sherlock
from sherlock_project.notify import QueryNotify
from sherlock_project.result import QueryStatus

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JSON_PATH = os.path.join(BASE_DIR, "sherlock_project", "resources", "data.json")

# Predefined categories for fast targeted scanning
CATEGORIES = {
    "popular": {
        "name": "Populer (Top 35)",
        "description": "Platform paling sering dicari (~3-5 detik)",
        "icon": "⚡",
        "sites": [
            "GitHub", "GitLab", "Instagram", "Twitter", "TikTok", "Reddit",
            "Telegram", "Pinterest", "Spotify", "Twitch", "YouTube", "Medium",
            "Patreon", "Discord", "HackerNews", "SoundCloud", "WordPress",
            "Blogger", "Substack", "LinkedIn", "Keybase", "Codeforces",
            "LeetCode", "Docker Hub", "Snapchat", "Roblox", "Kaggle",
            "npm", "PyPi", "Vimeo", "Behance", "Dribbble", "DEV Community",
            "Steam Community (User)", "Chess"
        ]
    },
    "dev": {
        "name": "Developer & Tech",
        "description": "Platform coding, repositori, dan komunitas developer",
        "icon": "💻",
        "sites": [
            "GitHub", "GitLab", "DEV Community", "Docker Hub", "LeetCode",
            "Codeforces", "HackerNews", "Kaggle", "npm", "PyPi", "Keybase",
            "SourceForge", "Codecademy", "Hashnode", "Replit"
        ]
    },
    "social": {
        "name": "Media Sosial & Chat",
        "description": "Jejaring sosial, microblogging, dan perpesanan",
        "icon": "💬",
        "sites": [
            "Instagram", "Twitter", "TikTok", "Reddit", "Telegram",
            "Pinterest", "Snapchat", "threads", "Tumblr", "VK",
            "Disqus", "Quora"
        ]
    },
    "creative": {
        "name": "Kreatif & Media",
        "description": "Video, streaming musik, desain, dan portofolio",
        "icon": "🎨",
        "sites": [
            "YouTube", "Spotify", "SoundCloud", "Vimeo", "Behance",
            "Dribbble", "DeviantArt", "Medium", "Substack", "WordPress",
            "Blogger", "Patreon"
        ]
    },
    "gaming": {
        "name": "Gaming",
        "description": "Komunitas gamer, streaming game, dan catur online",
        "icon": "🎮",
        "sites": [
            "Steam Community (User)", "Twitch", "Roblox", "Chess", "Lichess"
        ]
    },
    "all": {
        "name": "Semua Situs (480+)",
        "description": "Deep scan menyeluruh ke seluruh database Sherlock",
        "icon": "🌐",
        "sites": []
    }
}

_cached_sites: Optional[Dict[str, Any]] = None


def load_site_data() -> Dict[str, Any]:
    """Load sites from data.json with caching."""
    global _cached_sites
    if _cached_sites is not None:
        return _cached_sites

    if not os.path.exists(DATA_JSON_PATH):
        raise FileNotFoundError(f"data.json not found at {DATA_JSON_PATH}")

    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    data.pop("$schema", None)
    _cached_sites = data
    return _cached_sites


def get_site_by_name(site_name: str) -> Optional[tuple[str, Dict[str, Any]]]:
    """Find a site case-insensitively. Returns (exact_name, site_info) or None."""
    all_sites = load_site_data()
    site_lower = site_name.strip().lower()

    # Exact match first
    if site_name in all_sites:
        return site_name, all_sites[site_name]

    # Case-insensitive match
    for name, info in all_sites.items():
        if name.lower() == site_lower:
            return name, info

    # Partial / alias matches
    alias_map = {
        "x": "Twitter",
        "twitter": "Twitter",
        "ig": "Instagram",
        "steam": "Steam Community (User)",
        "chess.com": "Chess",
        "dev.to": "DEV Community",
        "yt": "YouTube"
    }
    if site_lower in alias_map:
        mapped_name = alias_map[site_lower]
        if mapped_name in all_sites:
            return mapped_name, all_sites[mapped_name]

    return None


def get_target_sites(
    mode: str = "popular",
    single_site: Optional[str] = None,
    custom_sites: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Retrieve filtered target sites dictionary based on mode or custom list."""
    all_sites = load_site_data()

    # 1. Single site target
    if single_site:
        match = get_site_by_name(single_site)
        if match:
            return {match[0]: match[1]}
        raise ValueError(f"Platform '{single_site}' tidak ditemukan di database.")

    # 2. Custom multi-site target
    if custom_sites and len(custom_sites) > 0:
        res = {}
        for s in custom_sites:
            m = get_site_by_name(s)
            if m:
                res[m[0]] = m[1]
        if res:
            return res

    # 3. All sites
    if mode == "all":
        return all_sites

    # 4. Predefined category
    cat_def = CATEGORIES.get(mode, CATEGORIES["popular"])
    selected = {}
    for s in cat_def["sites"]:
        if s in all_sites:
            selected[s] = all_sites[s]
    return selected


def check_single_site(username: str, site_name: str, timeout: int = 10) -> Dict[str, Any]:
    """
    Perform a synchronous, ultra-fast single-platform check using official Sherlock.
    Returns immediately in 0.5 - 2s.
    """
    username = username.strip().replace("@", "")
    match = get_site_by_name(site_name)
    if not match:
        return {
            "success": False,
            "error": f"Platform '{site_name}' tidak ditemukan dalam database Sherlock."
        }

    canonical_name, site_info = match
    target_dict = {canonical_name: site_info}

    collected = {}

    class SingleNotify(QueryNotify):
        def update(self, result):
            is_claimed = (result.status == QueryStatus.CLAIMED)
            status_name = result.status.name if hasattr(result.status, "name") else str(result.status)
            
            if is_claimed:
                label = "Ditemukan"
            elif result.status == QueryStatus.AVAILABLE:
                label = "Tidak Ada"
            elif result.status == QueryStatus.WAF:
                label = "Terproteksi (WAF)"
            else:
                label = "Error / Terputus"

            collected["result"] = {
                "site": result.site_name,
                "username": username,
                "status": status_name,
                "status_label": label,
                "is_claimed": is_claimed,
                "url_user": result.site_url_user if is_claimed else "",
                "target_url": result.site_url_user,
                "url_main": site_info.get("urlMain", ""),
                "response_time": round(result.query_time, 2) if result.query_time else None,
                "context": result.context
            }

    notify = SingleNotify()
    t0 = time.time()
    try:
        sherlock(username, target_dict, notify, timeout=timeout)
    except Exception as e:
        return {
            "success": False,
            "error": f"Gagal mengecek platform: {str(e)}"
        }

    elapsed = round(time.time() - t0, 2)
    res_data = collected.get("result", {
        "site": canonical_name,
        "username": username,
        "status": "UNKNOWN",
        "status_label": "Tidak Ada Respon",
        "is_claimed": False,
        "url_user": "",
        "target_url": "",
        "url_main": site_info.get("urlMain", ""),
        "response_time": elapsed,
        "context": "No response returned"
    })
    res_data["elapsed"] = elapsed

    return {
        "success": True,
        "data": res_data
    }


def scan_username_stream(
    username: str,
    mode: str = "popular",
    single_site: Optional[str] = None,
    custom_sites: Optional[List[str]] = None,
    timeout: int = 15,
    cancel_event: Optional[threading.Event] = None
) -> Generator[Dict[str, Any], None, None]:
    """
    Run official Sherlock scan in a background thread, streaming results in real-time
    via an internal thread-safe Queue.
    """
    username = username.strip().replace("@", "")
    start_time = time.time()

    if not username:
        yield {"type": "error", "message": "Username tidak boleh kosong."}
        return

    # Basic sanitation check
    if not re.match(r"^[a-zA-Z0-9_\-\.\+]+$", username):
        yield {"type": "error", "message": "Username mengandung karakter tidak valid."}
        return

    try:
        site_data = get_target_sites(mode=mode, single_site=single_site, custom_sites=custom_sites)
    except Exception as e:
        yield {"type": "error", "message": str(e)}
        return

    total_sites = len(site_data)
    yield {
        "type": "start",
        "username": username,
        "mode": mode,
        "total": total_sites,
        "timestamp": start_time
    }

    if total_sites == 0:
        yield {
            "type": "done",
            "stats": {"total": 0, "claimed": 0, "available": 0, "waf": 0, "error": 0, "elapsed": 0, "speed": 0}
        }
        return

    q: queue.Queue = queue.Queue()
    scanned_count = 0
    claimed_count = 0
    available_count = 0
    waf_count = 0
    error_count = 0

    class StreamNotify(QueryNotify):
        def update(self, result):
            if cancel_event and cancel_event.is_set():
                return
            q.put(result)

    notify = StreamNotify()

    def sherlock_worker():
        try:
            sherlock(username, site_data, notify, timeout=timeout)
        except Exception as ex:
            q.put({"_error": str(ex)})
        finally:
            q.put({"_done": True})

    worker_thread = threading.Thread(target=sherlock_worker, daemon=True)
    worker_thread.start()

    while True:
        if cancel_event and cancel_event.is_set():
            yield {"type": "cancelled", "message": "Pencarian dihentikan oleh pengguna."}
            break

        try:
            item = q.get(timeout=0.5)
        except queue.Empty:
            continue

        if isinstance(item, dict):
            if "_done" in item:
                break
            if "_error" in item:
                yield {"type": "error", "message": item["_error"]}
                break

        # item is QueryResult
        result = item
        scanned_count += 1
        is_claimed = (result.status == QueryStatus.CLAIMED)
        status_name = result.status.name if hasattr(result.status, "name") else str(result.status)

        if is_claimed:
            claimed_count += 1
            status_label = "Ditemukan"
        elif result.status == QueryStatus.AVAILABLE:
            available_count += 1
            status_label = "Tidak Ada"
        elif result.status == QueryStatus.WAF:
            waf_count += 1
            status_label = "Terproteksi (WAF)"
        else:
            error_count += 1
            status_label = "Error / Terputus"

        site_meta = site_data.get(result.site_name, {})
        url_main = site_meta.get("urlMain", "")

        yield {
            "type": "result",
            "data": {
                "site": result.site_name,
                "url_user": result.site_url_user if is_claimed else "",
                "target_url": result.site_url_user,
                "url_main": url_main,
                "status": status_name,
                "status_label": status_label,
                "response_time": round(result.query_time, 2) if result.query_time else None,
                "context": result.context
            },
            "progress": {
                "scanned": scanned_count,
                "total": total_sites,
                "percent": round((scanned_count / total_sites) * 100, 1),
                "claimed": claimed_count,
                "available": available_count,
                "waf": waf_count,
                "error": error_count
            }
        }

    elapsed = round(time.time() - start_time, 2)
    speed = round(scanned_count / elapsed, 1) if elapsed > 0 else scanned_count

    yield {
        "type": "done",
        "stats": {
            "total": total_sites,
            "scanned": scanned_count,
            "claimed": claimed_count,
            "available": available_count,
            "waf": waf_count,
            "error": error_count,
            "elapsed": elapsed,
            "speed": speed
        }
    }
