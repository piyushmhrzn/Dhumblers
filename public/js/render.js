// ================================================
// ALL RENDERING FUNCTIONS
// ================================================

/**
 * Renders player selection checkboxes on game creation form
 * @param {HTMLElement} container - DOM element to insert checkboxes into
 */
function renderPlayerCheckboxes(container) {
    if (!container) return;
    container.innerHTML = '';

    users.forEach(u => {
        container.innerHTML += `
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" value="${u.id}" id="p${u.id}">
                <label class="form-check-label" for="p${u.id}">${u.name}</label>
            </div>`;
    });
}

/**
 * Renders paginated list of recent games in table
 * @param {HTMLElement} tbody - table body element
 */
function renderRecentGames(tbody) {
    if (!tbody) return;

    const totalGames = games.length;
    const startIndex = (currentPage - 1) * gamesPerPage;
    const endIndex = startIndex + gamesPerPage;

    const pageGames = games.slice(startIndex, endIndex);

    tbody.innerHTML = '';

    pageGames.forEach((g, idx) => {
        const globalSN = startIndex + idx + 1;

        const winnerPlayer = g.players.find(p => p.elimOrder === -1);
        const winnerName = winnerPlayer ? getUserById(winnerPlayer.id)?.name || 'Unknown' : 'N/A';

        const playerPoints = g.players
            .map(p => ({ name: getUserById(p.id)?.name || '?', pts: p.points || 0 }))
            .sort((a, b) => b.pts - a.pts)
            .map(pp => `${pp.name} (${pp.pts})`)
            .join(', ');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${globalSN}</td>
            <td>${formatDate(g.date)}</td>
            <td>${winnerName}</td>
            <td>${playerPoints}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePagination(totalGames);
}

/**
 * Updates pagination controls state and text
 */
function updatePagination(totalGames) {
    const totalPages = Math.ceil(totalGames / gamesPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (!prevBtn || !nextBtn || !pageInfo) return;

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage >= totalPages;

    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

/**
 * Changes current page and re-renders recent games table
 * @param {number} delta - +1 or -1
 */
function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    renderRecentGames(document.getElementById('recentGamesBody'));
}

/**
 * ---------------------- RENDERS MONTHLY LEADERBOARD ----------------------
 * Points automatically reset every month
 */
function renderLeaderboard(tbody) {
    if (!tbody) return;
    tbody.innerHTML = '';

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const monthEl = document.getElementById("leaderboardMonth");
    if (monthEl) monthEl.innerText = monthName;

    // Step 1: create entry for every user
    const stats = {};
    users.forEach(u => {
        stats[u.id] = { points: 0, games: 0, wins: 0 };
    });

    // Step 2: add only this month's game stats
    games.forEach(g => {
        const d = new Date(g.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
            getAllGamePlayers(g).forEach(p => {
                stats[p.id].points += p.points || 0;
                stats[p.id].games += 1;
                if (p.elimOrder === -1) stats[p.id].wins += 1;
            });
        }
    });

    const leaderboard = Object.entries(stats)
        .map(([id, s]) => {
            const userId = parseInt(id);
            const user = getUserById(userId);
            const name = user ? user.name : 'Unknown';

            const monthlyPoints = s.points;
            const monthlyGames = s.games;
            const monthlyWins = s.wins;
            const monthlyAvg = monthlyGames ? (monthlyPoints / monthlyGames) : 0;

            // === CRITICAL FIX ===
            // Calculate career (lifetime) stats for tier only
            let careerGames = 0;
            let careerWins = 0;
            let careerTotalPoints = 0;

            games.forEach(g => {
                const player = getAllGamePlayers(g).find(p => p.id === userId);
                if (player) {
                    careerGames++;
                    careerTotalPoints += player.points || 0;
                    if (player.elimOrder === -1) careerWins++;
                }
            });

            const careerAvg = careerGames ? (careerTotalPoints / careerGames) : 0;

            const tempCareerStats = {
                games: careerGames,
                wins: careerWins,
                currentWinStreak: 0
            };

            const fullType = determinePlayerType(tempCareerStats, careerAvg);
            const prestigeTier = fullType.split(" • ").pop() || "🪵 Wood";
            // =====================

            return {
                id: userId,
                name,
                points: monthlyPoints,     // show monthly points
                games: monthlyGames,       // show monthly games
                wins: monthlyWins,
                tier: prestigeTier         // but tier from career
            };
        })
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.games - b.games;
        });

    // Render
    leaderboard.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                ${p.name}
                <span class="tier-badge"
                    data-tier="${p.tier}"
                    onclick="showTierInfo('${p.tier}')">
                    ${p.tier}
                </span>
            </td>
            <td>${p.points}</td>
            <td>${p.games}</td>
            <td>${p.wins}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * ---------------------- SHOWS DETAILED WEEKLY LEADERBOARD HISTORY ----------------------
 */
function showWeeklyHistory() {

    const tbody = document.getElementById("weeklyHistoryBody");
    tbody.innerHTML = '';

    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1 - day);

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const stats = {};

    games.forEach(g => {
        const d = new Date(g.date);

        if (d >= monday && d <= sunday) {

            getAllGamePlayers(g).forEach(p => {

                if (!stats[p.id]) {
                    stats[p.id] = { points: 0, games: 0 };
                }

                stats[p.id].points += p.points || 0;
                stats[p.id].games += 1;
            });
        }
    });

    const leaderboard = Object.entries(stats)
        .map(([id, s]) => ({
            name: getUserById(parseInt(id))?.name || "Unknown",
            points: s.points,
            games: s.games
        }))
        .sort((a, b) => b.points - a.points || a.games - b.games);

    leaderboard.forEach((p, i) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.points}</td>
            <td>${p.games}</td>
        `;

        tbody.appendChild(tr);
    });

    const modal = new bootstrap.Modal(document.getElementById("weeklyHistoryModal"));
    modal.show();
}


/**
 * ---------------------- RENDERS CURRENT WEEKLY WINNER ----------------------
 * @param {HTMLElement} el - element to insert weekly winner HTML
 */
function renderWeeklyWinner(el) {
    if (!el) return;

    // Helper: Get Monday 00:00:00 of current week
    function getMondayOfCurrentWeek() {
        const today = new Date();
        const day = today.getDay();
        const diff = (day === 0 ? -6 : 1 - day);
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    // Helper: Get Sunday 23:59:59.999 of current week
    function getSundayEndOfWeek(monday) {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return sunday;
    }

    const weekStart = getMondayOfCurrentWeek();
    const weekEnd = getSundayEndOfWeek(weekStart);

    const endFormatted = weekEnd.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace(',', '');

    // Filter games from current week
    const weeklyGames = games.filter(g => {
        const d = new Date(g.date);
        return d >= weekStart && d <= weekEnd;
    });

    const weeklyStats = {};

    weeklyGames.forEach(g => {
        getAllGamePlayers(g).forEach(p => {
            const pts = p.points || 0;
            if (pts > 0) {
                if (!weeklyStats[p.id]) {
                    weeklyStats[p.id] = { points: 0, games: 0 };
                }
                weeklyStats[p.id].points += pts;
                weeklyStats[p.id].games += 1;
            }
        });
    });

    if (Object.keys(weeklyStats).length === 0) {
        el.innerHTML = `<br><strong>Current Week:</strong> No games played yet (Ends ${endFormatted})<br>`;
        return;
    }

    // Find top performer(s)
    let maxPoints = -1;
    let minGames = Infinity;

    Object.values(weeklyStats).forEach(stats => {
        if (stats.points > maxPoints) {
            maxPoints = stats.points;
            minGames = stats.games;
        } else if (stats.points === maxPoints && stats.games < minGames) {
            minGames = stats.games;
        }
    });

    const winners = [];
    Object.entries(weeklyStats).forEach(([id, stats]) => {
        if (stats.points === maxPoints && stats.games === minGames) {
            const name = getUserById(parseInt(id))?.name || 'Unknown';
            winners.push(name);
        }
    });

    let winnerText = winners.length === 1
        ? `${winners[0]} (${maxPoints} points, ${minGames} games)`
        : `${winners.join(' & ')} (${maxPoints} points)`;

    el.innerHTML = `
        <br>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Current Week:</strong> 
        <i class="fas fa-crown text-warning me-1"></i> ${winnerText} 
        <small><em>(Ends ${endFormatted})</em></small>

        <button class="btn btn-sm btn-outline-secondary ms-2"
            onclick="showWeeklyHistory()">
            View
        </button>
        <br>
    `;
}

/**
 * ---------------------- RENDERS MONTHLY LEADERBOARD ----------------------
 * @param {HTMLElement} container - container for monthly winners list
 */
function renderMonthlyWinners(container) {
    if (!container) return;

    const monthlyStats = {};

    games.forEach(game => {
        const d = new Date(game.date);
        const monthKey = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {};
        }

        getAllGamePlayers(game).forEach(p => {
            const pts = p.points || 0;
            if (pts > 0) {
                if (!monthlyStats[monthKey][p.id]) {
                    monthlyStats[monthKey][p.id] = { points: 0, games: 0 };
                }
                monthlyStats[monthKey][p.id].points += pts;
                monthlyStats[monthKey][p.id].games += 1;
            }
        });
    });

    const sortedMonths = Object.keys(monthlyStats)
        .sort((a, b) => new Date(b) - new Date(a)); // newest first

    const monthsToShow = sortedMonths.slice(0, 6);

    let html = '<ul class="list-group list-group-flush mt-2">';

    if (monthsToShow.length === 0) {
        html += '<li class="list-group-item">No monthly data yet</li>';
    } else {
        monthsToShow.forEach(monthKey => {
            const statsMap = monthlyStats[monthKey];

            let maxPoints = -1;
            let minGames = Infinity;

            Object.values(statsMap).forEach(stats => {
                if (stats.points > maxPoints) {
                    maxPoints = stats.points;
                    minGames = stats.games;
                } else if (stats.points === maxPoints && stats.games < minGames) {
                    minGames = stats.games;
                }
            });

            const winners = [];
            Object.entries(statsMap).forEach(([id, stats]) => {
                if (stats.points === maxPoints && stats.games === minGames) {
                    winners.push(getUserById(parseInt(id))?.name || 'Unknown');
                }
            });

            const winnerText = winners.length === 1
                ? `${winners[0]} (${maxPoints} points)`
                : `${winners.join(' & ')} (${maxPoints} points)`;

            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>
                        <strong>${monthKey}:</strong>
                        ${winners.length > 1 ? 's' : ''} ${winnerText}
                    </span>

                    <button class="btn btn-sm btn-outline-secondary"
                        onclick="showMonthHistory('${monthKey}')">
                        View
                    </button>
                </li>
                            `;
        });
    }

    html += '</ul>';
    container.innerHTML = html;
}

/**
 * ---------------------- SHOWS DETAILED MONTHLY LEADERBOARD HISTORY ----------------------
 * @param {string} monthKey - the month for which to show history
 */
function showMonthHistory(monthKey) {

    const tbody = document.getElementById("monthHistoryBody");
    const title = document.getElementById("monthHistoryTitle");

    tbody.innerHTML = '';
    title.textContent = `Leaderboard - ${monthKey}`;

    const stats = {};

    games.forEach(g => {

        const d = new Date(g.date);
        const key = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        if (key === monthKey) {

            getAllGamePlayers(g).forEach(p => {

                if (!stats[p.id]) {
                    stats[p.id] = { points: 0, games: 0, wins: 0 };
                }

                stats[p.id].points += p.points || 0;
                stats[p.id].games += 1;

                if (p.elimOrder === -1) stats[p.id].wins += 1;

            });

        }

    });

    const leaderboard = Object.entries(stats)
        .map(([id, s]) => ({
            name: getUserById(parseInt(id))?.name || "Unknown",
            points: s.points,
            games: s.games,
            wins: s.wins
        }))
        .sort((a, b) => {

            // 1. Higher points first
            if (b.points !== a.points) return b.points - a.points;

            // 2. Higher wins first
            if (b.wins !== a.wins) return b.wins - a.wins;

            // 3. Fewer games first
            return a.games - b.games;

        });

    leaderboard.forEach((p, i) => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.points}</td>
            <td>${p.games}</td>
            <td>${p.wins}</td>
        `;

        tbody.appendChild(tr);

    });

    const modal = new bootstrap.Modal(document.getElementById("monthHistoryModal"));
    modal.show();
}

/**
 * ---------------------- RENDER PLAYER CAREER STATISTICS TABLE ----------------------
 * @param {HTMLElement} tbody - the tbody element to render stats in
 */
function renderCareerStats(tbody) {

    if (!tbody) return;
    tbody.innerHTML = '';

    const userStats = users.map(u => {

        let gamesPlayed = 0;
        let wins = 0;
        let totalPoints = 0;

        games.forEach(g => {
            const player = getAllGamePlayers(g).find(p => p.id === u.id);
            if (player) {
                gamesPlayed++;
                totalPoints += player.points || 0;
                if (player.elimOrder === -1) wins++;
            }
        });

        // Calculate win rate and average points
        const winRate = gamesPlayed ? (wins / gamesPlayed) : 0;
        const winPct = gamesPlayed ? (winRate * 100).toFixed(1) : 0;
        const avgPoints = gamesPlayed ? (totalPoints / gamesPlayed) : 0;
        const avgPointsDisplay = avgPoints.toFixed(2);

        // Tier calculation
        const tempStats = {
            games: gamesPlayed,
            wins: wins,
            currentWinStreak: 0
        };

        const fullType = determinePlayerType(tempStats, avgPoints);
        const prestigeTier = fullType.split(" • ").pop() || "🪵 Wood";

        // ✅ NEW: progress object
        const progressData = getTierProgress(winRate, avgPoints);

        return {
            ...u,
            gamesPlayed,
            wins,
            totalPoints,
            winPct,
            avgPointsDisplay,
            prestigeTier,
            progressData
        };
    });

    // Sort
    userStats.sort((a, b) => b.totalPoints - a.totalPoints);

    // Render
    userStats.forEach(u => {

        const tr = document.createElement('tr');
        tr.style.cursor = "pointer";
        tr.onclick = () => showPlayerStats(u.id);
        tr.classList.add("clickable-row");

        tr.innerHTML = `
            <td>
                <div class="career-player-cell">

                <div class="career-top-row">
                    <span class="player-name">${u.name}</span>
                    <span class="tier-badge">${u.prestigeTier}</span>
                </div>

                <div class="progress mt-1" style="height:6px;">
                    <div class="progress-bar" style="width:${u.progressData.progress}%">

                    </div>
                </div>

                <div class="career-progress-text">
                    ${u.progressData.nextTier
                ? `${u.progressData.remaining}% to ${u.progressData.nextTier}`
                : "Max tier reached"
            }
                    <br>
                    <small class="text-white">
                        ${u.progressData.gapText || ""}
                    </small>
                </div>

            </div>
            </td>

            <td>${u.totalPoints}</td>

            <td>
                <div class="stat-main">${u.gamesPlayed}</div>
                <div class="stat-sub">🏆 ${u.wins}</div>
            </td>

            <td>
                <div class="stat-main">${u.winPct}%</div>
                <div class="stat-sub">⚡${u.avgPointsDisplay}</div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/**
 * Renders minimal live game view (usually on index.html)
 * @param {Object|null} game - current game object from socket
 */
function renderLiveGame(game) {

    const dot = document.getElementById("liveDot");
    const bolt = document.getElementById("liveIcon");
    const badge = document.getElementById("elimScoreBadge");
    const container = document.getElementById("liveGameContainer");
    const roundEl = document.getElementById("liveRound");

    if (!container) return;

    // ── No game active ───────────────────────────
    if (!game || game.status !== "ongoing") {

        container.innerHTML = `<p class="text-warning">No ongoing game</p>`;

        dot?.classList.add("d-none");
        bolt?.classList.remove("d-none");

        if (badge) badge.innerText = "";
        if (roundEl) roundEl.innerText = "";

        return;
    }

    // ── Live indicators ──────────────────────────
    dot?.classList.remove("d-none");
    bolt?.classList.add("d-none");

    if (badge) badge.innerText = "Elim: " + game.elimScore;

    // ── Current round display ────────────────────
    const currentRound = game.rounds.length + 1;

    if (roundEl) {
        roundEl.innerText = `Round ${currentRound}`;
    }

    // ── Previous round scores ────────────────────
    const lastRound = game.rounds[game.rounds.length - 1] || {};

    // ── Sort players by lowest total (best position) ──
    const sortedPlayers = [...game.players].sort((a, b) => (a.total || 0) - (b.total || 0));

    let html = `
        <div class="table-responsive">
        <table class="table table-bordered table-sm">
        <thead>
            <tr>
                <th>Player</th>
                <th>Total</th>
                <th>Last Round</th>
            </tr>
        </thead>
        <tbody>
    `;

    sortedPlayers.forEach(p => {

        const name = getUserById(p.id)?.name || "Unknown";
        const total = p.total || 0;

        const prevScore = lastRound[p.id] ?? null;

        const prevDisplay =
            prevScore === null
                ? ""
                : `<small>
                (${prevScore >= 0 ? "+" : ""}${prevScore})
              </small>`;

        // ── Danger thresholds ─────────────────────
        const nearDanger = total >= game.elimScore - 15;
        const extremeDanger = total > game.elimScore - 5;

        let dangerEmoji = "";
        let roundEmoji = "";
        let statusEmoji = "";

        if (p.status === "active") {
            if (extremeDanger) {
                dangerEmoji = " 💀";
            } else if (nearDanger) {
                dangerEmoji = " 🪽";
            }
        }

        // ── Round performance emoji ───────────────
        // Winner
        if (p.elimOrder === -1) {
            statusEmoji = " 👑";
        }
        // Eliminated
        else if (p.status !== "active") {
            statusEmoji = " 🪦";
        }

        if (prevScore !== null) {

            if (prevScore > 40) {
                roundEmoji = " 🤡";
            } else if (prevScore >= 40) {
                roundEmoji = " 😭";
            } else if (prevScore >= 30) {
                roundEmoji = " 😵‍💫";
            } else if (prevScore >= 20) {
                roundEmoji = " 😰";
            } else if (prevScore >= 1 && prevScore <= 4) {
                roundEmoji = " 😎";
            }
        }

        html += `
        <tr class="${p.status !== 'active' ? 'table-secondary' : ''}">
            <td>${name} ${dangerEmoji} ${roundEmoji} ${statusEmoji}</td>
            <td><strong>${total}</strong></td>
            <td>${prevDisplay} </td>
        </tr>
    `;
    });

    html += `
        </tbody>
        </table>
        </div>
    `;

    container.innerHTML = html;
}