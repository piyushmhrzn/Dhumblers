// ================================================
// 5. HOME PAGE RENDERING (index.html)
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
 * Points still reset every month
 * Tier badge is calculated from the CURRENT YEAR only
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

    // Calculate monthly stats
    const stats = {};

    // Step 1: create entry for every user
    users.forEach(u => {
        stats[u.id] = { points: 0, games: 0, wins: 0 };
    });

    // Step 2: add monthly game stats
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
        .filter(([_, s]) => s.games > 0)
        .map(([id, s]) => {
            const userId = parseInt(id);
            const name = getUserById(userId)?.name || 'Unknown';

            // === NEW: Tier is calculated from CURRENT YEAR ===
            const yearStats = getYearStats(userId, year);
            const tempStats = {
                games: yearStats.games,
                wins: yearStats.wins,
                currentWinStreak: 0
            };
            const fullType = determinePlayerType(tempStats, yearStats.avgPoints);
            const prestigeTier = fullType.split(" • ").pop() || "🪵 Wood";

            return {
                id: userId,
                name,
                points: s.points,
                games: s.games,
                wins: s.wins,
                tier: prestigeTier
            };
        })
        .sort((a, b) => {
            // 1. Higher points first
            if (b.points !== a.points) return b.points - a.points;
            // 2. Higher wins first
            if (b.wins !== a.wins) return b.wins - a.wins;
            // 3. Fewer games first
            return a.games - b.games;
        });

    // If no games this month
    if (leaderboard.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-white">
                    No games played this month
                </td>
            </tr>
        `;
        return;
    }

    // Render leaderboard
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
                    stats[p.id] = {
                        points: 0,
                        games: 0,
                        wins: 0
                    };
                }

                stats[p.id].points += p.points || 0;
                stats[p.id].games += 1;

                // Count wins
                if (p.elimOrder === -1) {
                    stats[p.id].wins += 1;
                }
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
            if (b.points !== a.points) {
                return b.points - a.points;
            }

            // 2. Higher wins first
            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }

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

    const modal = new bootstrap.Modal(
        document.getElementById("weeklyHistoryModal")
    );

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

            // KEEP EXISTING FUNCTIONALITY
            if (pts > 0) {

                if (!weeklyStats[p.id]) {
                    weeklyStats[p.id] = {
                        points: 0,
                        games: 0,
                        wins: 0
                    };
                }

                weeklyStats[p.id].points += pts;
                weeklyStats[p.id].games += 1;

                // Count wins
                if (p.elimOrder === -1) {
                    weeklyStats[p.id].wins += 1;
                }
            }
        });
    });

    if (Object.keys(weeklyStats).length === 0) {
        el.innerHTML = `
            <br>
            <strong>Current Week:</strong>
            No games played yet (Ends ${endFormatted})
            <br>
        `;
        return;
    }

    // Find top performer(s)
    let maxPoints = -1;
    let maxWins = -1;
    let minGames = Infinity;

    Object.values(weeklyStats).forEach(stats => {

        // 1. Higher points
        if (stats.points > maxPoints) {
            maxPoints = stats.points;
            maxWins = stats.wins;
            minGames = stats.games;
        }

        // 2. Same points -> higher wins
        else if (
            stats.points === maxPoints &&
            stats.wins > maxWins
        ) {
            maxWins = stats.wins;
            minGames = stats.games;
        }

        // 3. Same points + wins -> fewer games
        else if (
            stats.points === maxPoints &&
            stats.wins === maxWins &&
            stats.games < minGames
        ) {
            minGames = stats.games;
        }
    });

    const winners = [];

    Object.entries(weeklyStats).forEach(([id, stats]) => {

        if (
            stats.points === maxPoints &&
            stats.wins === maxWins &&
            stats.games === minGames
        ) {
            const name = getUserById(parseInt(id))?.name || 'Unknown';
            winners.push(name);
        }
    });

    const winnerText = winners.length === 1
        ? `${winners[0]} (${maxPoints} points)`
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
        const monthKey = d.toLocaleString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {};
        }

        getAllGamePlayers(game).forEach(p => {
            if (!monthlyStats[monthKey][p.id]) {
                monthlyStats[monthKey][p.id] = {
                    points: 0,
                    games: 0,
                    wins: 0
                };
            }

            // Count every game played
            monthlyStats[monthKey][p.id].points += p.points || 0;
            monthlyStats[monthKey][p.id].games += 1;

            // Count wins
            if (p.elimOrder === -1) {
                monthlyStats[monthKey][p.id].wins += 1;
            }
        });
    });

    const sortedMonths = Object.keys(monthlyStats)
        .sort((a, b) => new Date(b) - new Date(a));

    // ── Pagination ───────────────────────────────
    const totalPages = Math.max(
        1,
        Math.ceil(sortedMonths.length / MONTHS_PER_PAGE)
    );

    // Make sure page is still valid if data changes
    monthlyWinnersPage = Math.min(monthlyWinnersPage, totalPages);
    monthlyWinnersPage = Math.max(monthlyWinnersPage, 1);

    const startIndex =
        (monthlyWinnersPage - 1) * MONTHS_PER_PAGE;

    const monthsToShow = sortedMonths.slice(
        startIndex,
        startIndex + MONTHS_PER_PAGE
    );

    let html = '<ul class="list-group list-group-flush mt-2">';

    if (monthsToShow.length === 0) {
        html += '<li class="list-group-item">No monthly data yet</li>';
    } else {
        monthsToShow.forEach(monthKey => {
            const statsMap = monthlyStats[monthKey];

            // Find the best ranking
            const rankedPlayers = Object.entries(statsMap)
                .sort(([, a], [, b]) => {
                    // 1. Higher points first
                    if (b.points !== a.points) {
                        return b.points - a.points;
                    }

                    // 2. Higher wins first
                    if (b.wins !== a.wins) {
                        return b.wins - a.wins;
                    }

                    // 3. Fewer games first
                    return a.games - b.games;
                });

            const best = rankedPlayers[0][1];

            // Include everyone who is tied on ALL three criteria
            const winners = rankedPlayers
                .filter(([, stats]) =>
                    stats.points === best.points &&
                    stats.wins === best.wins &&
                    stats.games === best.games
                )
                .map(([id]) =>
                    getUserById(parseInt(id))?.name || 'Unknown'
                );

            const winnerText = winners.length === 1
                ? `${winners[0]} (${best.points} points)`
                : `${winners.join(' & ')} (${best.points} points)`;

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

    // ── Pagination controls ──────────────────────
    if (sortedMonths.length > MONTHS_PER_PAGE) {
        html += `
            <div class="d-flex justify-content-between align-items-center mt-3">

                <button
                    class="btn btn-sm btn-outline-secondary"
                    onclick="changeMonthlyWinnersPage(-1)"
                    ${monthlyWinnersPage === 1 ? 'disabled' : ''}>
                    ← New
                </button>

                <span class="small text-secondary">
                    Page ${monthlyWinnersPage} of ${totalPages}
                </span>

                <button
                    class="btn btn-sm btn-outline-secondary"
                    onclick="changeMonthlyWinnersPage(1)"
                    ${monthlyWinnersPage === totalPages ? 'disabled' : ''}>
                    Old →
                </button>

            </div>
        `;
    }

    container.innerHTML = html;
}


/**
 * ---------------------- CHANGES MONTHLY WINNERS PAGE ----------------------
 */
function changeMonthlyWinnersPage(direction) {

    monthlyWinnersPage += direction;

    // Keep page within valid range
    if (monthlyWinnersPage < 1) {
        monthlyWinnersPage = 1;
    }

    // Re-render the monthly winners
    const container = document.getElementById("monthlyWinners");

    if (container) {
        renderMonthlyWinners(container);
    }
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
        const key = d.toLocaleString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        if (key === monthKey) {

            getAllGamePlayers(g).forEach(p => {

                if (!stats[p.id]) {
                    stats[p.id] = {
                        points: 0,
                        games: 0,
                        wins: 0
                    };
                }

                stats[p.id].points += p.points || 0;
                stats[p.id].games += 1;

                if (p.elimOrder === -1) {
                    stats[p.id].wins += 1;
                }

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
            if (b.points !== a.points) {
                return b.points - a.points;
            }

            // 2. Higher wins first
            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }

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

    const modal = new bootstrap.Modal(
        document.getElementById("monthHistoryModal")
    );

    modal.show();
}


/**
 * ---------------------- RENDER PLAYER CAREER STATISTICS TABLE ----------------------
 * Now uses CURRENT YEAR data only (resets every January)
 */
function renderCareerStats(tbody) {

    if (!tbody) return;
    tbody.innerHTML = '';

    const currentYear = new Date().getFullYear();

    const userStats = users.map(u => {

        // === NEW: Only count games from current year ===
        const yearStats = getYearStats(u.id, currentYear);

        const gamesPlayed = yearStats.games;
        const wins = yearStats.wins;
        const totalPoints = yearStats.totalPoints;
        const avgPoints = yearStats.avgPoints;

        const winRate = gamesPlayed ? (wins / gamesPlayed) : 0;
        const winPct = gamesPlayed ? (winRate * 100).toFixed(1) : 0;
        const avgPointsDisplay = avgPoints.toFixed(2);

        // Tier calculation (current year)
        const tempStats = {
            games: gamesPlayed,
            wins: wins,
            currentWinStreak: 0
        };

        const fullType = determinePlayerType(tempStats, avgPoints);
        const prestigeTier = fullType.split(" • ").pop() || "🪵 Wood";

        // Progress towards next tier (current year)
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

    // Sort by total points this year
    userStats.sort((a, b) => b.totalPoints - a.totalPoints);

    // Render
    userStats.forEach(u => {

        const tr = document.createElement('tr');
        tr.style.cursor = "pointer";
        tr.onclick = () => showPlayerStats(u.id);   // still opens ALL-TIME popup
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
 * Fills the year dropdown and renders the first (newest) year
 */
function initYearlyHistory() {
    const select = document.getElementById("yearSelect");
    if (!select) return;

    const years = getAvailableYears();
    select.innerHTML = '';

    if (years.length === 0) {
        select.innerHTML = `<option>No data yet</option>`;
        return;
    }

    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });

    // Render the newest year by default
    renderYearlyHistory();
}

/**
 * Main function that builds the Yearly History table
 */
function renderYearlyHistory() {
    const tbody = document.getElementById("yearlyHistoryBody");
    const select = document.getElementById("yearSelect");
    if (!tbody || !select) return;

    const year = parseInt(select.value);
    tbody.innerHTML = '';

    // Collect stats for every player in that year
    const statsMap = {};

    users.forEach(u => {
        statsMap[u.id] = {
            id: u.id,
            name: u.name,
            points: 0,
            games: 0,
            wins: 0,      // 1st places
            seconds: 0,   // 2nd places
            thirds: 0,    // 3rd places
            totalPoints: 0
        };
    });

    const yearGames = getGamesByYear(year);

    yearGames.forEach(g => {
        const players = getAllGamePlayers(g);
        const totalPlayers = players.length;

        players.forEach(p => {
            if (!statsMap[p.id]) return;

            statsMap[p.id].games++;
            statsMap[p.id].points += p.points || 0;
            statsMap[p.id].totalPoints += p.points || 0;

            // Calculate finish position
            const finish = p.elimOrder === -1
                ? 1
                : totalPlayers - p.elimOrder + 1;

            if (finish === 1) statsMap[p.id].wins++;
            if (finish === 2) statsMap[p.id].seconds++;
            if (finish === 3) statsMap[p.id].thirds++;
        });
    });

    // Convert to array and calculate extra fields
    const leaderboard = Object.values(statsMap)
        .filter(s => s.games > 0)
        .map(s => {
            const avg = s.games ? (s.totalPoints / s.games) : 0;
            const winRate = s.games ? (s.wins / s.games) : 0;

            // Tier for this year
            const tempStats = {
                games: s.games,
                wins: s.wins,
                currentWinStreak: 0
            };
            const fullType = determinePlayerType(tempStats, avg);
            const tier = fullType.split(" • ").pop() || "🪵 Wood";

            // Rival & Nemesis for this specific year
            const rivalry = getRivalryForYear(s.id, year);
            const nemesis = getNemesisForYear(s.id, year);

            return {
                ...s,
                avg: avg.toFixed(2),
                winPct: (winRate * 100).toFixed(1),
                tier,
                rival: rivalry.rival || "—",
                nemesis: nemesis.nemesis || "—"
            };
        })
        .sort((a, b) => {
            // Same sorting as other leaderboards
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.games - b.games;
        });

    // Render rows
    if (leaderboard.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted py-4">
                    No games played in ${year}
                </td>
            </tr>
        `;
        return;
    }

    leaderboard.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <strong>${p.name}</strong>
                <span class="tier-badge ms-1">${p.tier}</span>
            </td>
            <td>${p.points}</td>
            <td>${p.games}</td>
            <td>${p.avg}</td>
            <td>${p.wins}</td>
            <td>${p.seconds}</td>
            <td>${p.thirds}</td>
            <td>${p.winPct}%</td>
            <td>${p.rival}</td>
            <td>${p.nemesis}</td>
        `;
        tbody.appendChild(tr);
    });
}