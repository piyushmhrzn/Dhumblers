// ================================================
// GAME DASHBOARD / LEADERBOARD / LIVE SCORES
// Client-side JavaScript (script.js)
// ================================================

// ────────────────────────────────────────────────
// 1. GLOBAL STATE & CONSTANTS
// ────────────────────────────────────────────────

let users = [];                    // All registered users from /api/users
let games = [];                    // All historical games from /api/games
let currentGame = null;            // Currently viewed / ongoing game

const gamesPerPage = 5;            // How many games shown per page in recent games table
let currentPage = 1;               // Current pagination page for recent games


// ────────────────────────────────────────────────
// 2. API FETCH HELPERS
// ────────────────────────────────────────────────

/**
 * Fetches all users from backend and stores them in global `users` array
 * @returns {Promise<Array>} users array
 */
async function fetchUsers() {
    const res = await fetch('/api/users');
    users = await res.json();
    return users;
}

/**
 * Fetches all historical games and stores them in global `games` array
 * @returns {Promise<Array>} games array
 */
async function fetchGames() {
    const res = await fetch('/api/games');
    games = await res.json();
    return games;
}

/**
 * Fetches the currently ongoing game (if any)
 * @returns {Promise<Object|null>} current game object or null
 */
async function fetchOngoingGame() {
    const res = await fetch('/api/games/ongoing');
    currentGame = await res.json();
    return currentGame;
}


// ────────────────────────────────────────────────
// 3. DATA ACCESS & UTILITY HELPERS
// ────────────────────────────────────────────────

/**
 * Find user object by ID from the global users array
 * @param {number} id - user ID
 * @returns {Object|undefined} user object or undefined
 */
function getUserById(id) {
    return users.find(u => u.id === id);
}

/**
 * Returns ALL players who participated in a game (active + eliminated)
 * @param {Object} game - game object
 * @returns {Array} array of all player objects
 */
function getAllGamePlayers(game) {
    const all = [...game.players];

    // Add eliminated players (they might have been removed from players array)
    game.eliminated.forEach(elim => {
        if (!all.some(p => p.id === elim.id)) {
            all.push(elim);
        }
    });

    return all;
}

/**
 * Count how many games the user has **won** (elimOrder === -1 in completed games)
 * @param {number} userId
 * @returns {number} number of wins
 */
function getUserWins(userId) {
    return games.filter(g =>
        g.status === 'completed' &&
        g.players.some(p => p.elimOrder === -1 && p.id === userId)
    ).length;
}

/**
 * Formats ISO date string into nice readable format (e.g. "Mar 7, 2026 3:45 PM")
 * @param {string} dateStr - ISO date string
 * @returns {string} formatted date
 */
function formatDate(dateStr) {
    const d = new Date(dateStr);
    const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    return d.toLocaleString('en-US', options).replace(',', '');
}

/**
 * Determine player playstyle based on stats - more nuanced & fun version
 */
function determinePlayerType(stats, avgRoundScore, avgFinish) {

    const types = [];
    const triggers = [];

    // ─────────────────────────────────────────────
    // Helper values (normalized / relative)
    // ─────────────────────────────────────────────
    const winRate = stats.games > 0 ? stats.wins / stats.games : 0;
    const avgFinishNum = avgFinish !== "-" ? parseFloat(avgFinish) : 99;

    const hasManyGames = stats.games >= 8;
    const hasDecentSample = stats.games >= 5;

    // ─────────────────────────────────────────────
    // 1. Win power & streaks
    // ─────────────────────────────────────────────
    if (stats.longestWinStreak >= 4) {
        types.push("🔥 Warlord");
        triggers.push("very long streaks");
    } else if (stats.longestWinStreak >= 3) {
        types.push("🔥 Dominant");
    } else if (stats.currentWinStreak >= 3 && hasDecentSample) {
        types.push("😈 On Fire");
    }

    // ─────────────────────────────────────────────
    // 2. High scoring rounds vs safe/consistent scoring
    // ─────────────────────────────────────────────
    if (stats.highestRoundScore >= 28 && hasManyGames) {
        types.push("💥 Nuke");
    } else if (stats.highestRoundScore >= 22) {
        types.push("🎯 Sniper");
    } else if (avgRoundScore >= 9.5 && hasManyGames) {
        types.push("📈 Steady Farmer");
    } else if (avgRoundScore <= 4.8 && hasManyGames) {
        types.push("🐢 Turtle");
    }

    // ─────────────────────────────────────────────
    // 3. Finishing position personality
    // ─────────────────────────────────────────────
    if (avgFinishNum <= 2.1 && hasDecentSample) {
        types.push("👑 Dominator");
    } else if (avgFinishNum <= 2.6) {
        types.push("🧠 Consistent");
    } else if (avgFinishNum >= 4.2 && hasManyGames) {
        types.push("💀 Early Exit Specialist");
    } else if (stats.seconds + stats.thirds >= stats.wins * 1.8 && hasDecentSample) {
        types.push("🥈 Silver Collector");  // always 2nd/3rd more than wins
    }

    // ─────────────────────────────────────────────
    // 4. Win efficiency (low points to win)
    // ─────────────────────────────────────────────
    // Note: you need to actually compute & pass bestGameWinPoints
    //       (currently missing from your stats object)
    if (stats.bestGameWinPoints !== undefined && stats.bestGameWinPoints <= 18 && hasDecentSample) {
        types.push("⚡ Ghost Winner");
    } else if (stats.bestGameWinPoints !== undefined && stats.bestGameWinPoints >= 35) {
        types.push("🪖 Attrition Master");
    }

    // ─────────────────────────────────────────────
    // 5. Risk profiles
    // ─────────────────────────────────────────────
    if (stats.fastestEliminationRounds <= 3 && hasManyGames) {
        types.push("🎲 YOLO");
    } else if (stats.fastestEliminationRounds <= 6) {
        types.push("💣 Speedrun Elim");
    }

    // ─────────────────────────────────────────────
    // 6. Special rare / meme styles
    // ─────────────────────────────────────────────
    if (winRate >= 0.50 && hasManyGames) {
        types.push("🪄 Cheater Allegations");
    } else if (winRate <= 0.10 && hasManyGames) {
        types.push("🪦 Eternal 4th");
    }

    if (stats.games >= 12 && stats.wins === 0) {
        types.push("😂 Professional Participant");
    }

    // ─────────────────────────────────────────────
    // Fallbacks / default personality
    // ─────────────────────────────────────────────
    if (types.length === 0) {
        if (hasManyGames) {
            types.push("🌀 Chaos Agent");
        } else {
            types.push("🎮 New Blood");
        }
    }

    // ─────────────────────────────────────────────
    // Pick 1–2 most representative (or just join all for fun)
    // ─────────────────────────────────────────────
    // Option A: show all (chaotic & funny)
    // return types.join(" • ");

    // Option B: prefer 1 strong + 1 flavor (cleaner UI)
    if (types.length >= 2) {
        // Put the "strongest" first, then a fun one
        return `${types[0]} • ${types[types.length - 1]}`;
    }

    return types[0] || "🎮 Rookie Energy";
}

/**
 * Show detailed career statistics for a player
 */
function showPlayerStats(userId) {

    const user = getUserById(userId);

    const stats = {
        games: 0,
        wins: 0,
        seconds: 0,
        thirds: 0,
        totalPoints: 0,
        roundsPlayed: 0,
        totalScore: 0,

        longestWinStreak: 0,
        currentWinStreak: 0,
        tempWinStreak: 0,

        highestRoundScore: 0,
        fastestEliminationRounds: Infinity, // updated
        finishingSum: 0,

        bestWinningGameRounds: Infinity // updated
    };

    // Sort games chronologically
    const sortedGames = [...games].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedGames.forEach(g => {

        const players = getAllGamePlayers(g);
        const player = players.find(p => p.id === userId);

        if (!player) return;

        stats.games++;
        stats.totalPoints += player.points || 0;

        const numPlayers = players.length;
        let finish = player.elimOrder === -1 ? 1 : numPlayers - player.elimOrder + 1;

        stats.finishingSum += finish;

        if (finish === 1) {
            stats.wins++;
            stats.tempWinStreak++;
        } else {
            if (stats.tempWinStreak > stats.longestWinStreak)
                stats.longestWinStreak = stats.tempWinStreak;

            stats.tempWinStreak = 0;
        }

        if (finish === 2) stats.seconds++;
        if (finish === 3) stats.thirds++;

        // --- Calculate fastest elimination ---
        if (player.status === 'eliminated') {
            let cumulative = 0;
            let roundsToElim = 0;
            for (let i = 0; i < g.rounds.length; i++) {
                cumulative += g.rounds[i][player.id] || 0;
                roundsToElim++;
                if (cumulative >= g.elimScore) break;
            }
            if (roundsToElim < stats.fastestEliminationRounds)
                stats.fastestEliminationRounds = roundsToElim;
        }

        // --- Calculate best winning game ---
        if (finish === 1) {
            // Track cumulative points of all other players
            const otherPlayers = players.filter(p => p.id !== userId);
            const cumTotals = {};
            otherPlayers.forEach(p => cumTotals[p.id] = 0);

            let roundsToEliminateAll = 0;

            for (let i = 0; i < g.rounds.length; i++) {
                g.rounds[i] && otherPlayers.forEach(p => {
                    cumTotals[p.id] += g.rounds[i][p.id] || 0;
                });

                roundsToEliminateAll = i + 1;

                // Check if all other players eliminated
                const allElim = Object.values(cumTotals).every(t => t >= g.elimScore);
                if (allElim) break; // Stop at round when last player eliminated
            }

            if (roundsToEliminateAll < stats.bestWinningGameRounds)
                stats.bestWinningGameRounds = roundsToEliminateAll;
        }

        // round statistics
        g.rounds.forEach(r => {
            const score = r[userId] || 0;

            stats.roundsPlayed++;
            stats.totalScore += score;

            if (score > stats.highestRoundScore)
                stats.highestRoundScore = score;
        });

    });

    // finalize streaks
    stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.tempWinStreak);
    stats.currentWinStreak = stats.tempWinStreak;

    const winPct = stats.games ? ((stats.wins / stats.games) * 100).toFixed(1) : 0;
    const avgPoints = stats.games ? (stats.totalPoints / stats.games).toFixed(2) : 0;
    const avgRoundScore = stats.roundsPlayed ? (stats.totalScore / stats.roundsPlayed).toFixed(2) : 0;
    const avgFinish = stats.games ? (stats.finishingSum / stats.games).toFixed(2) : "-";
    const playerType = determinePlayerType(stats, avgRoundScore, avgFinish);

    const html = `
        <div class="alert alert-secondary text-center mb-4">
            <strong>Style:</strong> ${playerType}
        </div>
        
        <div class="row text-center mb-3">

            <div class="col-6 col-md-3 mb-2">
                <h6>🎮 Games</h6>
                <p class="fw-bold">${stats.games}</p>
            </div>

            <div class="col-6 col-md-3 mb-2">
                <h6>🏆 Wins</h6>
                <p class="fw-bold">${stats.wins}</p>
            </div>

            <div class="col-6 col-md-3 mb-2">
                <h6>📊 Win Rate</h6>
                <p class="fw-bold">${winPct}%</p>
            </div>

            <div class="col-6 col-md-3 mb-2">
                <h6>⭐ Total Points</h6>
                <p class="fw-bold">${stats.totalPoints}</p>
            </div>

        </div>

        <div class="row text-center mb-3">

            <div class="col-6 col-md-3 mb-2">
                <h6>🥈 2nd Places</h6>
                <p class="fw-bold">${stats.seconds}</p>
            </div>

            <div class="col-6 col-md-3 mb-2">
                <h6>🥉 3rd Places</h6>
                <p class="fw-bold">${stats.thirds}</p>
            </div>

            <div class="col-6 col-md-3 mb-2">
                <h6>📊 Avg Finish</h6>
                <p class="fw-bold">${avgFinish}</p>
            </div>

            <div class="col-6 col-md-3 mb-2">
                <h6>🎯 Avg Points/Game</h6>
                <p class="fw-bold">${avgPoints}</p>
            </div>

        </div>


        <hr>


        <div class="row text-center mb-3">

            <div class="col-md-4 mb-2">
                <h6>🔥 Longest Win Streak</h6>
                <p class="font-weight-bold">${stats.longestWinStreak}</p>
            </div>

            <div class="col-md-4 mb-2">
                <h6>⚡ Current Win Streak</h6>
                <p class="font-weight-bold">${stats.currentWinStreak}</p>
            </div>

            <div class="col-md-4 mb-2">
                <h6>🎯 Highest Round Score</h6>
                <p class="font-weight-bold">${stats.highestRoundScore}</p>
            </div>

        </div>

    `;

    /*
    // Career Stats last row
          <div class="row text-center">

            <div class="col-md-4">
                <h6>💀 Fastest Elimination</h6>
                <h4>${stats.fastestEliminationRounds === Infinity ? "-" : stats.fastestEliminationRounds} rounds</h4>
            </div>

            <div class="col-md-4">
                <h6>🏆 Best Winning Game</h6>
                <h4>${stats.bestWinningGameRounds === Infinity ? "-" : stats.bestWinningGameRounds} rounds</h4>
            </div>

            <div class="col-md-4">
                <h6>🎯 Avg Round Score</h6>
                <h4>${avgRoundScore}</h4>
            </div>

        </div>
    */

    document.getElementById("playerStatsTitle").innerText =
        `${user.name} - Career Stats`;

    document.getElementById("playerStatsContent").innerHTML = html;

    const modal = new bootstrap.Modal(document.getElementById("playerStatsModal"));
    modal.show();
}

// ────────────────────────────────────────────────
// 4. GAME CREATION / START
// ────────────────────────────────────────────────

/**
 * Starts a new game by sending data to backend
 * Redirects to game.html on success
 * @param {number} elimScore - score at which player is eliminated
 * @param {number[]} selectedPlayerIds - array of participating user IDs
 * @param {string} password - optional game password
 */
async function startNewGame(elimScore, selectedPlayerIds, password) {
    if (!Array.isArray(selectedPlayerIds) || selectedPlayerIds.length < 2) {
        alert('Please select at least 2 players.');
        document.getElementById('loadingOverlay')?.classList.add('d-none');
        document.getElementById('homeContent')?.classList.remove('d-none');
        return;
    }

    if (isNaN(elimScore) || elimScore < 1) {
        alert('Please enter a valid elimination score (≥ 1).');
        document.getElementById('loadingOverlay')?.classList.add('d-none');
        document.getElementById('homeContent')?.classList.remove('d-none');
        return;
    }

    try {
        const res = await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ elimScore, selectedPlayerIds, password })
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error);
            document.getElementById('loadingOverlay')?.classList.add('d-none');
            document.getElementById('homeContent')?.classList.remove('d-none');
            return;
        }

        currentGame = await res.json();
        window.location.href = 'game.html';

    } catch (err) {
        alert('Error starting game: ' + err.message);
    }
}


// ────────────────────────────────────────────────
// 5. HOME PAGE RENDERING (index.html)
// ────────────────────────────────────────────────

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
 * Renders leaderboard for CURRENT MONTH only
 * Points automatically reset every month
 */
function renderLeaderboard(tbody) {
    if (!tbody) return;
    tbody.innerHTML = '';

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    // Calculate monthly stats
    const stats = {};

    /*
    // Only consider players who participated in games this month
        games.forEach(g => {
            const d = new Date(g.date);

            if (d.getMonth() === month && d.getFullYear() === year) {

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
    */

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
        .map(([id, s]) => ({
            id: parseInt(id),
            name: getUserById(parseInt(id))?.name || 'Unknown',
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

    // Render leaderboard
    leaderboard.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.name}</td>
            <td>${p.points}</td>
            <td>${p.games}</td>
            <td>${p.wins}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Renders current weekly winner(s) based on points (tiebreaker: fewer games)
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
        el.innerHTML = `<br><strong>Current Week:</strong> No games with points awarded yet (Ends ${endFormatted})<br>`;
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
        <small><em>(Ends ${endFormatted})</em></small><br>
    `;
}

/**
 * Renders last 6 months winners (points-based, tiebreaker fewer games)
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
 * Shows leaderboard history for a specific month
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
 * Render player career statistics table
 */
function renderCareerStats(tbody) {

    if (!tbody) return;
    tbody.innerHTML = '';

    // Compute stats for all users first
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

        const winPct = gamesPlayed ? ((wins / gamesPlayed) * 100).toFixed(1) : 0;
        const avgPoints = gamesPlayed ? (totalPoints / gamesPlayed).toFixed(2) : 0;

        return { ...u, gamesPlayed, wins, totalPoints, winPct, avgPoints };
    });

    // Sort by totalPoints descending
    userStats.sort((a, b) => b.totalPoints - a.totalPoints);

    // Render rows
    userStats.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.name}</td>
            <td>${u.gamesPlayed}</td>
            <td>${u.wins}</td>
            <td>${u.winPct}%</td>
            <td>${u.totalPoints}</td>
            <td>${u.avgPoints}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary"
                    onclick="showPlayerStats(${u.id})">
                    Details
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ────────────────────────────────────────────────
// 6. GAME PAGE RENDERING & INTERACTION (game.html)
// ────────────────────────────────────────────────

/**
 * Renders current game state table (players, totals, round history)
 */
function renderGameTable() {
    const tbody = document.querySelector('#gameHistory tbody');
    if (!tbody || !currentGame) return;

    tbody.innerHTML = '';

    // Lowest total first (ascending order)
    const sortedPlayers = [...currentGame.players].sort((a, b) => a.total - b.total);

    sortedPlayers.forEach(p => {
        const user = getUserById(p.id);
        const name = user ? user.name : '?';
        const isActive = p.status === 'active';

        let history = '';
        currentGame.rounds.forEach((round, idx) => {
            const score = round[p.id] || 0;
            history += `R${idx + 1}(${score}) `;
        });

        const tr = document.createElement('tr');
        if (!isActive) tr.classList.add('table-secondary');

        tr.innerHTML = `
            <td>${name}</td>
            <td>${p.total || 0}</td>
            <td>${history.trim() || '—'}</td>
            <td>
                ${isActive ? `
                    <input class="form-control text-center score-input" type="number" 
                           data-id="${p.id}" min="0" 
                           placeholder="" style="width: 100px; margin: 0 auto;">
                ` : 'Eliminated'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Collects current round scores from inputs and sends them to server
 */
async function submitRoundScores() {
    const inputs = document.querySelectorAll('#gameHistory .score-input');
    let roundScores = {};

    inputs.forEach(inp => {
        let val = parseInt(inp.value) || 0;
        const id = parseInt(inp.dataset.id);
        roundScores[id] = val;
        inp.value = ''; // clear input after submit
    });

    try {
        const res = await fetch('/api/games/ongoing/round', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundScores })
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error);
            return;
        }

        currentGame = await res.json();

        if (currentGame.status === 'completed') {
            showWinner();
        } else {
            renderGameTable();
        }

    } catch (err) {
        alert('Error submitting round: ' + err.message);
    }
}

/**
 * Shows winner announcement when game completes
 */
function showWinner() {
    const winnerPlayer = currentGame.players.find(p => p.elimOrder === -1);
    const winnerName = getUserById(winnerPlayer?.id)?.name || 'Unknown';

    document.getElementById('winnerBanner').innerHTML = `
        <div class="alert alert-success text-center mb-4" role="alert">
            <h4 class="alert-heading">Game Over!</h4>
            <p><strong>Winner: ${winnerName}</strong></p>
            <hr>
            <p class="mb-2">Final scores are shown below.</p>
            <a href="index.html" class="btn btn-success">Back to Home</a>
        </div>
    `;

    document.getElementById('gameControls').style.display = 'none';
    renderGameTable();
}

/**
 * Cancels the current ongoing game (admin/host only presumably)
 */
async function cancelGame() {
    if (!confirm("Cancel game and lose all points?")) return;

    try {
        const res = await fetch('/api/games/ongoing', {
            method: 'DELETE'
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error);
            return;
        }

        window.location.href = "index.html";

    } catch (err) {
        alert("Error cancelling game: " + err.message);
    }
}


// ────────────────────────────────────────────────
// 7. LIVE SCOREBOARD (SOCKET.IO)
// ────────────────────────────────────────────────

let socket = null;

/**
 * Renders minimal live game view (usually on index.html)
 * @param {Object|null} game - current game object from socket
 */
function renderLiveGame(game) {
    const dot = document.getElementById("liveDot");
    const bolt = document.getElementById("liveIcon");
    const badge = document.getElementById("elimScoreBadge");
    const container = document.getElementById("liveGameContainer");

    if (!container) return;

    if (!game || game.status !== "ongoing") {
        container.innerHTML = `<p class="text-warning">No ongoing game</p>`;

        dot?.classList.add("d-none");
        bolt?.classList.remove("d-none");
        badge && (badge.innerText = "");
        return;
    }

    dot?.classList.remove("d-none");
    bolt?.classList.add("d-none");
    badge && (badge.innerText = "Elimination: " + game.elimScore);

    let html = `
        <div class="table-responsive">
        <table class="table table-bordered table-sm">
        <thead>
            <tr>
                <th>Player</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>`;

    const sortedPlayers = [...game.players].sort((a, b) => a.total - b.total);

    sortedPlayers.forEach(p => {
        const name = getUserById(p.id)?.name || "Unknown";
        html += `
            <tr class="${p.status !== 'active' ? 'table-secondary' : ''}">
                <td>${name}</td>
                <td>${p.total}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

/**
 * Initializes Socket.IO connection and sets up real-time game updates
 */
function initLiveSocket() {
    socket = io();

    socket.on("gameUpdate", (game) => {
        renderLiveGame(game);

        // If we're on game.html, also update local game state and table
        if (window.location.pathname.includes("game.html")) {
            currentGame = game;
            renderGameTable();
        }
    });
}