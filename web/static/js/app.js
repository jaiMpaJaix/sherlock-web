/**
 * Sherlock Web 2.0 - Core Application Logic
 * Supports:
 * 1. Single Platform Instant Check (Ultra-fast direct response)
 * 2. Multi-Platform Real-time SSE Streaming
 * 3. Network Connectivity Diagnostics
 * 4. Filters, Exports, & Responsive UI
 */

(function () {
    "use strict";

    const state = {
        theme: localStorage.getItem("sherlock_theme") || "dark",
        activeTab: "single", // 'single' | 'multi'
        singleSite: "GitHub",
        multiCategory: "popular",
        isScanningMulti: false,
        activeScanId: null,
        eventSource: null,
        timerInterval: null,
        startTime: null,
        allPlatforms: [],
        multiResults: [],
        filter: "all",
        searchFilter: "",
        viewMode: "cards",
        stats: {
            total: 0,
            scanned: 0,
            claimed: 0,
            available: 0,
            waf: 0,
            error: 0,
            elapsed: 0,
            speed: 0
        }
    };

    const elements = {
        html: document.documentElement,
        themeToggle: document.getElementById("theme-toggle"),
        networkBadge: document.getElementById("network-badge"),
        networkText: document.getElementById("network-text"),
        networkWarning: document.getElementById("network-warning"),
        recheckNetBtn: document.getElementById("recheck-net-btn"),
        headerDbCount: document.getElementById("header-db-count"),

        // Mode Switcher
        tabModeSingle: document.getElementById("tab-mode-single"),
        tabModeMulti: document.getElementById("tab-mode-multi"),
        panelModeSingle: document.getElementById("panel-mode-single"),
        panelModeMulti: document.getElementById("panel-mode-multi"),

        // Single Mode Elements
        quickPlatforms: document.getElementById("quick-platforms"),
        customPlatformInput: document.getElementById("custom-platform-input"),
        allPlatformsDatalist: document.getElementById("all-platforms-datalist"),
        singleSearchForm: document.getElementById("single-search-form"),
        singleUsernameInput: document.getElementById("single-username-input"),
        singleSubmitBtn: document.getElementById("single-submit-btn"),
        singleBtnText: document.getElementById("single-btn-text"),
        singleResultSpotlight: document.getElementById("single-result-spotlight"),

        // Multi Mode Elements
        categoryChips: document.getElementById("category-chips"),
        multiSearchForm: document.getElementById("multi-search-form"),
        multiUsernameInput: document.getElementById("multi-username-input"),
        multiSubmitBtn: document.getElementById("multi-submit-btn"),
        multiBtnText: document.getElementById("multi-btn-text"),
        cancelScanBtn: document.getElementById("cancel-scan-btn"),

        // Telemetry
        telemetrySection: document.getElementById("telemetry-section"),
        scanTargetDisplay: document.getElementById("scan-target-display"),
        progressBar: document.getElementById("progress-bar"),
        progressPercent: document.getElementById("progress-percent"),
        scannedNum: document.getElementById("scanned-num"),
        totalNum: document.getElementById("total-num"),
        statClaimed: document.getElementById("stat-claimed-val"),
        statAvailable: document.getElementById("stat-available-val"),
        statTime: document.getElementById("stat-time-val"),
        statSpeed: document.getElementById("stat-speed-val"),
        statOther: document.getElementById("stat-other-val"),

        // Results Toolbar & Containers
        resultsSection: document.getElementById("results-section"),
        filterTabs: document.querySelectorAll(".filter-tab"),
        filterSearchInput: document.getElementById("filter-search-input"),
        countFilterAll: document.getElementById("count-filter-all"),
        countFilterClaimed: document.getElementById("count-filter-claimed"),
        countFilterAvailable: document.getElementById("count-filter-available"),
        countFilterOther: document.getElementById("count-filter-other"),
        cardsContainer: document.getElementById("cards-container"),
        tableContainer: document.getElementById("table-container"),
        tableBody: document.getElementById("table-body"),
        emptyFilterMsg: document.getElementById("empty-filter-msg"),

        viewCardsBtn: document.getElementById("view-cards-btn"),
        viewTableBtn: document.getElementById("view-table-btn"),
        exportToggleBtn: document.getElementById("export-toggle-btn"),
        exportMenu: document.getElementById("export-menu"),
        exportCopyLinks: document.getElementById("export-copy-links"),
        exportJson: document.getElementById("export-json"),
        exportCsv: document.getElementById("export-csv"),
        exportTxt: document.getElementById("export-txt"),

        exampleChips: document.querySelectorAll(".example-chip"),
        toast: document.getElementById("toast")
    };

    // --------------------------------------------------------------------------
    // 1. Theme Management
    // --------------------------------------------------------------------------
    function initTheme() {
        elements.html.setAttribute("data-theme", state.theme);
        elements.themeToggle.addEventListener("click", () => {
            state.theme = state.theme === "dark" ? "light" : "dark";
            elements.html.setAttribute("data-theme", state.theme);
            localStorage.setItem("sherlock_theme", state.theme);
        });
    }

    // --------------------------------------------------------------------------
    // 2. Network Diagnostics Check
    // --------------------------------------------------------------------------
    async function checkNetworkStatus() {
        elements.networkBadge.className = "network-badge status-checking";
        elements.networkText.textContent = "Cek Jaringan...";

        try {
            const res = await fetch("/api/network-check");
            const data = await res.json();
            if (data.online) {
                elements.networkBadge.className = "network-badge status-online";
                elements.networkText.textContent = "Online";
                elements.networkWarning.classList.add("hidden");
            } else {
                elements.networkBadge.className = "network-badge status-offline";
                elements.networkText.textContent = "Offline/Terisolasi";
                elements.networkWarning.classList.remove("hidden");
            }
        } catch (e) {
            elements.networkBadge.className = "network-badge status-offline";
            elements.networkText.textContent = "Offline";
            elements.networkWarning.classList.remove("hidden");
        }
    }

    // --------------------------------------------------------------------------
    // 3. Load All Platforms Database
    // --------------------------------------------------------------------------
    async function loadPlatformsData() {
        try {
            const res = await fetch("/api/all-sites");
            const data = await res.json();
            if (data.status === "success" && data.sites) {
                state.allPlatforms = data.sites;
                elements.allPlatformsDatalist.innerHTML = "";
                data.sites.forEach(site => {
                    const opt = document.createElement("option");
                    opt.value = site;
                    elements.allPlatformsDatalist.appendChild(opt);
                });
                elements.headerDbCount.textContent = `${data.total} Platform`;
            }
        } catch (e) {
            console.warn("Could not load platforms datalist:", e);
        }
    }

    // --------------------------------------------------------------------------
    // 4. Mode Switcher (Single vs Multi)
    // --------------------------------------------------------------------------
    function initModeSwitcher() {
        elements.tabModeSingle.addEventListener("click", () => {
            switchMode("single");
        });

        elements.tabModeMulti.addEventListener("click", () => {
            switchMode("multi");
        });
    }

    function switchMode(mode) {
        state.activeTab = mode;
        if (mode === "single") {
            elements.tabModeSingle.classList.add("active");
            elements.tabModeSingle.setAttribute("aria-selected", "true");
            elements.tabModeMulti.classList.remove("active");
            elements.tabModeMulti.setAttribute("aria-selected", "false");

            elements.panelModeSingle.classList.remove("hidden");
            elements.panelModeMulti.classList.add("hidden");

            // Sync username if available
            if (elements.multiUsernameInput.value && !elements.singleUsernameInput.value) {
                elements.singleUsernameInput.value = elements.multiUsernameInput.value;
            }
        } else {
            elements.tabModeMulti.classList.add("active");
            elements.tabModeMulti.setAttribute("aria-selected", "true");
            elements.tabModeSingle.classList.remove("active");
            elements.tabModeSingle.setAttribute("aria-selected", "false");

            elements.panelModeMulti.classList.remove("hidden");
            elements.panelModeSingle.classList.add("hidden");

            if (elements.singleUsernameInput.value && !elements.multiUsernameInput.value) {
                elements.multiUsernameInput.value = elements.singleUsernameInput.value;
            }
        }
    }

    // --------------------------------------------------------------------------
    // 5. Single Platform Mode Logic (Instant Hit)
    // --------------------------------------------------------------------------
    function initSingleMode() {
        // Platform Quick Chips
        elements.quickPlatforms.addEventListener("click", (e) => {
            const chip = e.target.closest(".p-chip");
            if (!chip) return;

            document.querySelectorAll(".p-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            state.singleSite = chip.getAttribute("data-site");
            elements.customPlatformInput.value = "";
        });

        // Custom Platform input
        elements.customPlatformInput.addEventListener("input", (e) => {
            const val = e.target.value.trim();
            if (val) {
                document.querySelectorAll(".p-chip").forEach(c => c.classList.remove("active"));
                state.singleSite = val;
            }
        });

        // Form Submit
        elements.singleSearchForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = elements.singleUsernameInput.value.trim().replace(/^@+/, "");
            if (!username) {
                showToast("⚠️ Masukkan username terlebih dahulu");
                elements.singleUsernameInput.focus();
                return;
            }

            const site = state.singleSite || "GitHub";
            await executeSingleCheck(username, site);
        });
    }

    async function executeSingleCheck(username, site) {
        elements.singleSubmitBtn.disabled = true;
        elements.singleBtnText.textContent = `Mengecek ${site}...`;

        // Loading card
        elements.singleResultSpotlight.classList.remove("hidden");
        elements.singleResultSpotlight.innerHTML = `
            <div class="spotlight-card">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <div class="scan-pulse"></div>
                    <div>Mengecek username <strong>@${escapeHtml(username)}</strong> di <strong>${escapeHtml(site)}</strong>...</div>
                </div>
            </div>
        `;

        const t0 = Date.now();
        try {
            const res = await fetch("/api/check-single", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, site, timeout: 10 })
            });

            const data = await res.json();
            const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

            if (data.success && data.data) {
                renderSingleResultCard(data.data, elapsed);
            } else {
                renderSingleErrorCard(site, username, data.error || "Gagal memproses permintaan.");
            }
        } catch (err) {
            renderSingleErrorCard(site, username, `Koneksi gagal atau terputus: ${err.message}`);
        } finally {
            elements.singleSubmitBtn.disabled = false;
            elements.singleBtnText.textContent = "Cek Sekarang (Kilat)";
        }
    }

    function renderSingleResultCard(item, elapsed) {
        const isClaimed = item.is_claimed;
        const cardClass = isClaimed ? "hit-found" : "hit-not-found";
        const badgeClass = isClaimed ? "badge-success" : "badge-neutral";
        const badgeText = isClaimed ? "✓ AKUN DITEMUKAN" : "✕ TIDAK DITEMUKAN";
        const avatar = (item.site || "?").substring(0, 2).toUpperCase();

        elements.singleResultSpotlight.innerHTML = `
            <div class="spotlight-card ${cardClass}">
                <div class="spotlight-header">
                    <div class="spotlight-site-info">
                        <div class="spotlight-avatar">${escapeHtml(avatar)}</div>
                        <div class="spotlight-title">
                            <h3>${escapeHtml(item.site)}</h3>
                            <span>Target: @${escapeHtml(item.username)}</span>
                        </div>
                    </div>
                    <span class="spotlight-badge ${badgeClass}">${badgeText}</span>
                </div>

                <div class="spotlight-body">
                    ${isClaimed && item.url_user ? `
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">URL PROFIL RESMI:</div>
                        <a href="${escapeHtml(item.url_user)}" target="_blank" rel="noopener noreferrer" class="spotlight-url-link">
                            ${escapeHtml(item.url_user)}
                        </a>
                    ` : `
                        <div style="font-size:0.9rem;color:var(--text-secondary);">
                            Username <strong>@${escapeHtml(item.username)}</strong> belum terdaftar atau tidak ditemukan di ${escapeHtml(item.site)}.
                        </div>
                    `}
                    <div class="spotlight-meta">
                        <span>⏱ Respon: ${item.response_time || elapsed}s</span>
                        ${item.context ? `<span> • Info: ${escapeHtml(item.context)}</span>` : ""}
                    </div>
                </div>

                <div class="spotlight-actions">
                    ${isClaimed && item.url_user ? `
                        <button type="button" class="btn btn-secondary btn-sm copy-btn" data-url="${escapeHtml(item.url_user)}">
                            📋 Salin Link
                        </button>
                        <a href="${escapeHtml(item.url_user)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                            Buka Profil ↗
                        </a>
                    ` : `
                        <a href="${escapeHtml(item.url_main || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                            Kunjungi Situs ${escapeHtml(item.site)} ↗
                        </a>
                    `}
                </div>
            </div>
        `;

        const copyBtn = elements.singleResultSpotlight.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                copyToClipboard(item.url_user);
                showToast(`📋 URL ${item.site} berhasil disalin!`);
            });
        }
    }

    function renderSingleErrorCard(site, username, errorMsg) {
        elements.singleResultSpotlight.innerHTML = `
            <div class="spotlight-card" style="border-color:var(--color-error);background-color:rgba(244,63,94,0.08);">
                <div class="spotlight-header">
                    <div class="spotlight-site-info">
                        <div class="spotlight-avatar" style="background-color:var(--color-error);color:#fff;">!</div>
                        <div class="spotlight-title">
                            <h3>${escapeHtml(site)}</h3>
                            <span>Target: @${escapeHtml(username)}</span>
                        </div>
                    </div>
                    <span class="spotlight-badge" style="background-color:var(--color-error);color:#fff;">ERROR KONEKSI</span>
                </div>
                <div class="spotlight-body">
                    <div style="color:var(--color-error);font-weight:600;font-size:0.9rem;">
                        ${escapeHtml(errorMsg)}
                    </div>
                    <p style="font-size:0.8125rem;color:var(--text-secondary);margin-top:0.35rem;">
                        Jika server Anda berjalan di lingkungan terbatas (sandbox AI), jalankan langsung di terminal Mac dengan perintah:
                        <code>cd /Users/mac/sherlock-web &amp;&amp; python3 run_web.py</code>
                    </p>
                </div>
            </div>
        `;
    }

    // --------------------------------------------------------------------------
    // 6. Multi-Platform Streaming Scan Logic (SSE)
    // --------------------------------------------------------------------------
    function initMultiMode() {
        elements.categoryChips.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip) return;

            document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            state.multiCategory = chip.getAttribute("data-category");
        });

        elements.multiSearchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = elements.multiUsernameInput.value.trim().replace(/^@+/, "");
            if (!username) {
                showToast("⚠️ Masukkan username terlebih dahulu");
                elements.multiUsernameInput.focus();
                return;
            }
            startMultiScan(username, state.multiCategory);
        });

        elements.cancelScanBtn.addEventListener("click", () => {
            cancelMultiScan();
        });
    }

    function startMultiScan(username, category) {
        if (state.isScanningMulti) {
            cancelMultiScan();
        }

        state.isScanningMulti = true;
        state.multiResults = [];
        state.activeScanId = "scan-" + Math.random().toString(36).substring(2, 9);
        state.startTime = Date.now();
        state.stats = { total: 0, scanned: 0, claimed: 0, available: 0, waf: 0, error: 0, elapsed: 0, speed: 0 };

        elements.cardsContainer.innerHTML = "";
        elements.tableBody.innerHTML = "";
        elements.telemetrySection.classList.remove("hidden");
        elements.resultsSection.classList.remove("hidden");

        elements.scanTargetDisplay.innerHTML = `Memindai target: <strong>@${escapeHtml(username)}</strong> (${category})`;
        elements.progressBar.style.width = "0%";
        elements.progressPercent.textContent = "0%";
        elements.scannedNum.textContent = "0";
        elements.totalNum.textContent = "...";

        updateMultiCountersUI();

        elements.multiSubmitBtn.disabled = true;
        elements.multiBtnText.textContent = "Sedang Memindai...";
        elements.cancelScanBtn.classList.remove("hidden");

        // Live timer
        clearInterval(state.timerInterval);
        state.timerInterval = setInterval(() => {
            if (!state.isScanningMulti) return;
            const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
            elements.statTime.textContent = elapsed;
            const speed = elapsed > 0 ? (state.stats.scanned / elapsed).toFixed(1) : 0;
            elements.statSpeed.textContent = speed;
        }, 200);

        const url = `/api/scan?username=${encodeURIComponent(username)}&mode=${encodeURIComponent(category)}&scan_id=${encodeURIComponent(state.activeScanId)}&timeout=12`;
        state.eventSource = new EventSource(url);

        state.eventSource.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                handleSSEEvent(event);
            } catch (err) {
                console.error("SSE parse error:", err);
            }
        };

        state.eventSource.onerror = () => {
            finishMultiScan("Selesai (Koneksi berakhir)");
        };
    }

    function handleSSEEvent(event) {
        if (event.type === "start") {
            state.stats.total = event.total;
            elements.totalNum.textContent = event.total;
        } else if (event.type === "result") {
            const item = event.data;
            state.multiResults.push(item);

            state.stats.scanned = event.progress.scanned;
            if (item.status === "CLAIMED") {
                state.stats.claimed++;
            } else if (item.status === "AVAILABLE") {
                state.stats.available++;
            } else if (item.status === "WAF") {
                state.stats.waf++;
            } else {
                state.stats.error++;
            }

            elements.progressBar.style.width = `${event.progress.percent}%`;
            elements.progressPercent.textContent = `${event.progress.percent}%`;
            elements.scannedNum.textContent = event.progress.scanned;

            updateMultiCountersUI();

            if (matchesFilter(item)) {
                appendMultiResultItem(item, state.multiResults.length);
            }
        } else if (event.type === "done") {
            finishMultiScan("Selesai");
            if (event.stats) {
                elements.statTime.textContent = event.stats.elapsed;
                elements.statSpeed.textContent = event.stats.speed;
            }
            showToast(`🎉 Pemindaian selesai! ${state.stats.claimed} akun aktif ditemukan.`);
        } else if (event.type === "cancelled") {
            finishMultiScan("Dibatalkan");
            showToast("⏹ Pemindaian dihentikan oleh pengguna.");
        } else if (event.type === "error") {
            finishMultiScan("Error");
            showToast(`❌ Error: ${event.message || "Gagal memindai"}`);
        }
    }

    function cancelMultiScan() {
        if (!state.isScanningMulti) return;
        if (state.activeScanId) {
            fetch("/api/scan/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scan_id: state.activeScanId })
            }).catch(() => {});
        }
        finishMultiScan("Dibatalkan");
    }

    function finishMultiScan(statusMsg = "Selesai") {
        state.isScanningMulti = false;
        clearInterval(state.timerInterval);

        if (state.eventSource) {
            state.eventSource.close();
            state.eventSource = null;
        }

        elements.multiSubmitBtn.disabled = false;
        elements.multiBtnText.textContent = "Mulai Scan Massal";
        elements.cancelScanBtn.classList.add("hidden");

        if (state.stats.total > 0 && statusMsg.includes("Selesai")) {
            elements.progressBar.style.width = "100%";
            elements.progressPercent.textContent = "100%";
            elements.scannedNum.textContent = state.stats.total;
        }
    }

    function updateMultiCountersUI() {
        elements.statClaimed.textContent = state.stats.claimed;
        elements.statAvailable.textContent = state.stats.available;
        elements.statOther.textContent = state.stats.waf + state.stats.error;

        elements.countFilterAll.textContent = state.multiResults.length;
        elements.countFilterClaimed.textContent = state.stats.claimed;
        elements.countFilterAvailable.textContent = state.stats.available;
        elements.countFilterOther.textContent = state.stats.waf + state.stats.error;
    }

    function matchesFilter(item) {
        if (state.filter === "claimed" && item.status !== "CLAIMED") return false;
        if (state.filter === "available" && item.status !== "AVAILABLE") return false;
        if (state.filter === "other" && (item.status === "CLAIMED" || item.status === "AVAILABLE")) return false;

        if (state.searchFilter) {
            const q = state.searchFilter.toLowerCase();
            const nameMatch = item.site && item.site.toLowerCase().includes(q);
            const urlMatch = item.url_user && item.url_user.toLowerCase().includes(q);
            if (!nameMatch && !urlMatch) return false;
        }
        return true;
    }

    function renderFilteredMultiResults() {
        elements.cardsContainer.innerHTML = "";
        elements.tableBody.innerHTML = "";

        const filtered = state.multiResults.filter(matchesFilter);
        if (filtered.length === 0) {
            elements.emptyFilterMsg.classList.remove("hidden");
        } else {
            elements.emptyFilterMsg.classList.add("hidden");
            filtered.forEach((item, idx) => {
                appendMultiResultItem(item, idx + 1);
            });
        }
    }

    function appendMultiResultItem(item, index) {
        const isClaimed = item.status === "CLAIMED";
        const avatar = (item.site || "?").substring(0, 2).toUpperCase();
        let badgeClass = "badge-available";
        let statusLabel = item.status_label || "Tidak Ada";

        if (isClaimed) {
            badgeClass = "badge-claimed";
            statusLabel = "✓ Ditemukan";
        } else if (item.status === "WAF") {
            badgeClass = "badge-waf";
            statusLabel = "🛡️ Terproteksi";
        } else if (item.status === "ERROR" || item.status === "UNKNOWN") {
            badgeClass = "badge-error";
            statusLabel = "✕ Error";
        }

        const userUrl = item.url_user || item.target_url || item.url_main || "";

        // 1. Card Element
        const card = document.createElement("div");
        card.className = `result-card ${isClaimed ? "status-claimed" : ""}`;
        card.innerHTML = `
            <div class="result-card-header">
                <div class="site-identity">
                    <div class="site-avatar">${escapeHtml(avatar)}</div>
                    <div class="site-name">${escapeHtml(item.site)}</div>
                </div>
                <span class="status-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
            </div>

            <div class="result-card-body">
                ${isClaimed && userUrl ? `
                    <a href="${escapeHtml(userUrl)}" target="_blank" rel="noopener noreferrer" class="result-url link-active">
                        ${escapeHtml(userUrl)}
                    </a>
                ` : `
                    <div class="result-url">${escapeHtml(userUrl || "Tidak ditemukan profil aktif")}</div>
                `}
                <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:0.25rem;">
                    ⏱ ${item.response_time ? item.response_time + "s" : "-"}
                </div>
            </div>

            <div class="result-card-actions">
                ${isClaimed && userUrl ? `
                    <button type="button" class="card-action-btn copy-btn" data-url="${escapeHtml(userUrl)}">📋 Salin</button>
                    <a href="${escapeHtml(userUrl)}" target="_blank" rel="noopener noreferrer" class="card-action-btn btn-open">Buka ↗</a>
                ` : `
                    <a href="${escapeHtml(item.url_main || '#')}" target="_blank" rel="noopener noreferrer" class="card-action-btn">Situs Utama ↗</a>
                `}
            </div>
        `;
        const cardCopyBtn = card.querySelector(".copy-btn");
        if (cardCopyBtn) {
            cardCopyBtn.addEventListener("click", () => {
                copyToClipboard(userUrl);
                showToast(`📋 URL ${item.site} disalin!`);
            });
        }
        elements.cardsContainer.appendChild(card);

        // 2. Table Row Element
        const tr = document.createElement("tr");
        if (isClaimed) tr.className = "table-row-claimed";
        tr.innerHTML = `
            <td>${index}</td>
            <td><strong>${escapeHtml(item.site)}</strong></td>
            <td><span class="status-badge ${badgeClass}">${escapeHtml(statusLabel)}</span></td>
            <td><code>${item.response_time ? item.response_time + "s" : "-"}</code></td>
            <td>
                ${isClaimed && userUrl ? `
                    <a href="${escapeHtml(userUrl)}" target="_blank" rel="noopener noreferrer" class="result-url link-active">
                        ${escapeHtml(userUrl)}
                    </a>
                ` : `<span style="color:var(--text-muted);font-size:0.8125rem;">-</span>`}
            </td>
            <td>
                ${isClaimed && userUrl ? `
                    <div style="display:flex;gap:0.35rem;">
                        <button type="button" class="card-action-btn copy-btn" data-url="${escapeHtml(userUrl)}">📋</button>
                        <a href="${escapeHtml(userUrl)}" target="_blank" rel="noopener noreferrer" class="card-action-btn btn-open">↗</a>
                    </div>
                ` : `<a href="${escapeHtml(item.url_main || '#')}" target="_blank" rel="noopener noreferrer" class="card-action-btn">↗</a>`}
            </td>
        `;
        const trCopyBtn = tr.querySelector(".copy-btn");
        if (trCopyBtn) {
            trCopyBtn.addEventListener("click", () => {
                copyToClipboard(userUrl);
                showToast(`📋 URL ${item.site} disalin!`);
            });
        }
        elements.tableBody.appendChild(tr);
    }

    // --------------------------------------------------------------------------
    // 7. Exports & Toolbar Binding
    // --------------------------------------------------------------------------
    function initToolbarAndExports() {
        // Filter tabs
        elements.filterTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                elements.filterTabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                state.filter = tab.getAttribute("data-filter");
                renderFilteredMultiResults();
            });
        });

        // Search in results
        elements.filterSearchInput.addEventListener("input", (e) => {
            state.searchFilter = e.target.value.trim();
            renderFilteredMultiResults();
        });

        // View toggle
        elements.viewCardsBtn.addEventListener("click", () => {
            elements.viewCardsBtn.classList.add("active");
            elements.viewTableBtn.classList.remove("active");
            elements.cardsContainer.classList.remove("hidden");
            elements.tableContainer.classList.add("hidden");
        });

        elements.viewTableBtn.addEventListener("click", () => {
            elements.viewTableBtn.classList.add("active");
            elements.viewCardsBtn.classList.remove("active");
            elements.cardsContainer.classList.add("hidden");
            elements.tableContainer.classList.remove("hidden");
        });

        // Export dropdown toggle
        elements.exportToggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            elements.exportMenu.classList.toggle("hidden");
        });
        document.addEventListener("click", () => {
            elements.exportMenu.classList.add("hidden");
        });

        // Export actions
        elements.exportCopyLinks.addEventListener("click", () => {
            const claimed = state.multiResults.filter(r => r.status === "CLAIMED" && r.url_user);
            if (claimed.length === 0) {
                showToast("⚠️ Belum ada akun ditemukan");
                return;
            }
            const txt = claimed.map(r => `${r.site}: ${r.url_user}`).join("\n");
            copyToClipboard(txt);
            showToast(`📋 ${claimed.length} link berhasil disalin!`);
        });

        elements.exportJson.addEventListener("click", () => {
            if (state.multiResults.length === 0) return;
            downloadFile(JSON.stringify(state.multiResults, null, 2), "sherlock_results.json", "application/json");
            showToast("📄 File JSON diunduh!");
        });

        elements.exportCsv.addEventListener("click", () => {
            if (state.multiResults.length === 0) return;
            const headers = ["Platform", "Status", "URL", "Response Time (s)", "Context"];
            const rows = state.multiResults.map(r => [
                `"${r.site}"`, `"${r.status}"`, `"${r.url_user || r.target_url || ''}"`, `"${r.response_time || ''}"`, `"${r.context || ''}"`
            ]);
            const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            downloadFile(csv, "sherlock_results.csv", "text/csv");
            showToast("📊 File CSV diunduh!");
        });

        elements.exportTxt.addEventListener("click", () => {
            const claimed = state.multiResults.filter(r => r.status === "CLAIMED" && r.url_user);
            const txt = claimed.map(r => `${r.site}: ${r.url_user}`).join("\n");
            downloadFile(txt, "sherlock_links.txt", "text/plain");
            showToast("📝 File TXT diunduh!");
        });

        // Quick example chips
        elements.exampleChips.forEach(chip => {
            chip.addEventListener("click", () => {
                const u = chip.getAttribute("data-user");
                if (state.activeTab === "single") {
                    elements.singleUsernameInput.value = u;
                    executeSingleCheck(u, state.singleSite);
                } else {
                    elements.multiUsernameInput.value = u;
                    startMultiScan(u, state.multiCategory);
                }
            });
        });

        // Recheck network button
        elements.recheckNetBtn.addEventListener("click", () => {
            checkNetworkStatus();
        });
    }

    // --------------------------------------------------------------------------
    // Utilities
    // --------------------------------------------------------------------------
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    let toastTimer = null;
    function showToast(msg, duration = 3000) {
        if (!elements.toast) return;
        clearTimeout(toastTimer);
        elements.toast.textContent = msg;
        elements.toast.classList.remove("hidden");
        elements.toast.style.opacity = "1";

        toastTimer = setTimeout(() => {
            elements.toast.style.opacity = "0";
            setTimeout(() => elements.toast.classList.add("hidden"), 200);
        }, duration);
    }

    // --------------------------------------------------------------------------
    // Initialization
    // --------------------------------------------------------------------------
    function init() {
        initTheme();
        initModeSwitcher();
        initSingleMode();
        initMultiMode();
        initToolbarAndExports();
        loadPlatformsData();
        checkNetworkStatus();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
