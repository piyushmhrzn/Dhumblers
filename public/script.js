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
let lastProcessedRound = 0;


// ────────────────────────────────────────────────
// 🔊 SOUND SYSTEM
// ────────────────────────────────────────────────

function playSound(id) {
    const audio = document.getElementById(id);
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => { });
}


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

/* Player lifetime stats calculator - total games, wins, average points */
function getLifetimeStats(userId) {
    let gamesPlayed = 0;
    let wins = 0;
    let totalPoints = 0;

    games.forEach(g => {
        const player = getAllGamePlayers(g).find(p => p.id === userId);
        if (player) {
            gamesPlayed++;
            totalPoints += player.points || 0;
            if (player.elimOrder === -1) wins++;
        }
    });

    const avgPoints = gamesPlayed ? (totalPoints / gamesPlayed) : 0;

    return {
        games: gamesPlayed,
        wins: wins,
        avgPoints
    };
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
 * Gif display helper function to show a gif for a certain duration (used for sound effects on index page)
 * @param {string} id - the DOM element ID of the gif to show
 * @param {number} duration - how long to show the gif in milliseconds (default 13000ms = 13s)
 */
/**
 * Shows GIF + plays sound for dramatic moments
 * Different durations based on event importance
 */
function showGif(type, playerName = "", customDuration = null) {

    const overlay = document.getElementById("gifOverlay");
    const text = document.getElementById("gifText");

    const elimGif = document.getElementById("elimGif");
    const funnyGif = document.getElementById("funnyGif");
    const highGif = document.getElementById("highGif");
    const nearElimGif = document.getElementById("nearElimGif");
    const winnerGif = document.getElementById("winnerGif");

    if (!overlay) return;

    // Reset all GIFs
    [elimGif, funnyGif, highGif, nearElimGif, winnerGif].forEach(gif => {
        gif.style.display = "none";
        gif.classList.remove("gif-show");
    });

    text.innerText = playerName || "";

    overlay.classList.remove("d-none");

    let activeGif = null;
    let duration = customDuration;

    switch (type) {
        case "elim":
            activeGif = elimGif;
            duration = duration || 15000;
            break;
        case "funny":
            activeGif = funnyGif;
            duration = duration || 14000;
            break;
        case "high":
            activeGif = highGif;
            duration = duration || 10000;
            break;
        case "nearElim":
            activeGif = nearElimGif;
            duration = duration || 10000;
            break;
        case "winner":
            activeGif = winnerGif;
            duration = duration || 14000;
            break;
        default:
            duration = duration || 10000;
    }

    if (activeGif) {
        activeGif.style.display = "block";
        setTimeout(() => {
            activeGif.classList.add("gif-show");
        }, 50);
    }

    // Auto hide after specified duration
    setTimeout(() => {
        overlay.classList.add("d-none");
    }, duration);
}

/**
 * Determine player playstyle based on stats 
 * Now with 3 separate systems: Win Identity + Scoring Style + Prestige Tier
 */
function determinePlayerType(stats, avgPoints) {

    const types = [];

    const winRate = stats.games > 0 ? stats.wins / stats.games : 0;
    const hasGames = stats.games >= 10;

    // ─────────────────────────────────────────────
    // 1. PRIMARY IDENTITY (WIN BASED) - Original Style
    // ─────────────────────────────────────────────
    if (winRate >= 0.30 && hasGames) {
        types.push("👑 Sab ka Baap");
    }
    else if (winRate >= 0.25 && hasGames) {
        types.push("🔥 Baazigarr");
    }
    else if (winRate >= 0.20 && hasGames) {
        types.push("⚔️ Don");
    }
    else if (winRate >= 0.15 && hasGames) {
        types.push("🗡️ Striker");
    }
    else if (winRate >= 0.10 && hasGames) {
        types.push("😂 Tapari");
    }
    else if (winRate < 0.10 && hasGames) {
        types.push("🤡 Pataki");
    }

    // ─────────────────────────────────────────────
    // 2. SCORING STYLE (Avg Points Based) - Original Style
    // ─────────────────────────────────────────────
    if (avgPoints >= 3.40 && hasGames) {
        types.push("💣 Dangdung Khiladi");
    }
    else if (avgPoints >= 3.30 && hasGames) {
        types.push("💥 Khiladi 420");
    }
    else if (avgPoints >= 3.20 && hasGames) {
        types.push("🎯 Shooter Honi");
    }
    else if (avgPoints >= 3.05 && hasGames) {
        types.push("⚖️ Balance Khiladi");
    }
    else if (avgPoints >= 2.90 && hasGames) {
        types.push("🛡️ Bhagwan Bharosa");
    }
    else if (avgPoints < 2.90 && hasGames) {
        types.push("🐸 Lute");
    }

    // ─────────────────────────────────────────────
    // 3. PRESTIGE TIER (Expanded Version)
    // ─────────────────────────────────────────────
    if (winRate >= 0.30 && avgPoints >= 3.40 && hasGames) {
        types.push("💎 Diamond");
    }
    else if (winRate >= 0.27 && avgPoints >= 3.30 && hasGames) {
        types.push("🔷 Platinum");
    }
    else if (winRate >= 0.24 && avgPoints >= 3.20 && hasGames) {
        types.push("♦️ Ruby");
    }
    else if (winRate >= 0.20 && avgPoints >= 3.10 && hasGames) {
        types.push("🧈 Gold");
    }
    else if (winRate >= 0.15 && avgPoints >= 3.00 && hasGames) {
        types.push("⬜ Silver");
    }
    else if (winRate >= 0.10 && avgPoints >= 2.90 && hasGames) {
        types.push("🟤 Bronze");
    }
    else if (hasGames) {
        types.push("🪵 Wood");
    }

    // ─────────────────────────────────────────────
    // 4. STREAK ENERGY
    // ─────────────────────────────────────────────
    if (stats.currentWinStreak >= 3) {
        types.push("⚡ Unstoppable");
    }
    else if (stats.currentWinStreak === 2) {
        types.push("🔥 On Fire");
    }

    // ─────────────────────────────────────────────
    // 5. SPECIAL FUN TAGS
    // ─────────────────────────────────────────────
    if (stats.games <= 10) {
        types.push("🎮 Rookie");
    }

    // ─────────────────────────────────────────────
    // FALLBACK
    // ─────────────────────────────────────────────
    if (types.length === 0) {
        return hasGames ? "🌀 Casual" : "🎮 Rookie";
    }

    // ─────────────────────────────────────────────
    // RETURN UP TO 3 BEST TAGS
    // ─────────────────────────────────────────────
    return types.slice(0, 3).join(" • ");
}

/* Tier info modal display helper - shows fun descriptions for each tier when badge is clicked */
function showTierInfo(tierText) {
    const title = document.getElementById("tierDetailTitle");
    const body = document.getElementById("tierDetailBody");
    if (!title || !body) return;

    let tierName = "";
    let content = "";
    let rangeText = "";

    if (tierText.includes("Diamond")) {
        tierName = "💎 Diamond Tier";
        rangeText = "Win Rate: ≥ 30% &nbsp; | &nbsp; Avg Points: ≥ 3.40";
        content = "Top of the game. Elite win rate + insane consistency.";
    }
    else if (tierText.includes("Platinum")) {
        tierName = "🔷 Platinum Tier";
        rangeText = "Win Rate: 27% - 29.99% &nbsp; | &nbsp; Avg Points: 3.30 - 3.39";
        content = "Highly skilled player with strong performance..";
    }
    else if (tierText.includes("Ruby")) {
        tierName = "♦️ Ruby Tier";
        rangeText = "Win Rate: 24% - 26.99% &nbsp; | &nbsp; Avg Points: 3.20 - 3.29";
        content = "Very competitive. Strong scoring and wins.";
    }
    else if (tierText.includes("Gold")) {
        tierName = "🧈 Gold Tier";
        rangeText = "Win Rate: 20% - 23.99% &nbsp; | &nbsp; Avg Points: 3.10 - 3.19";
        content = "Reliable player with solid gameplay.";
    }
    else if (tierText.includes("Silver")) {
        tierName = "⬜ Silver Tier";
        rangeText = "Win Rate: 15% - 19.99% &nbsp; | &nbsp; Avg Points: 3.00 - 3.09";
        content = "Decent player, still improving.";
    }
    else if (tierText.includes("Bronze")) {
        tierName = "🟤 Bronze Tier";
        rangeText = "Win Rate: 10% - 14.99% &nbsp; | &nbsp; Avg Points: 2.90 - 2.99";
        content = "Needs improvement. Focus on consistency.";
    }
    else if (tierText.includes("Wood")) {
        tierName = "🪵 Wood Tier";
        rangeText = "Win Rate: < 10% &nbsp; | &nbsp; Avg Points: < 2.90";
        content = "Welcome to Dhumble 😂";
    }
    else {
        tierName = tierText || "New Player";
        rangeText = "New to the game";
        content = "Welcome! Play more games to unlock your tier.";
    }

    body.innerHTML = `
        <div class="mb-2" style="font-size: 1.8rem;">${tierText}</div>
        <div class="mb-2">
            <strong style="color: #ffd700;">Requirements:</strong><br>
            <span style="font-size: .90rem;">${rangeText}</span>
        </div>
        <p class="mb-3">${content}</p>
    `;

    title.innerText = tierName;

    const modal = new bootstrap.Modal(document.getElementById("tierDetailModal"));
    modal.show();
}

// TIER DEFINITIONS 
const TIERS = [
    { name: "🪵 Wood", win: 0.00, avg: 0.00 },
    { name: "🟤 Bronze", win: 0.10, avg: 2.90 },
    { name: "⬜ Silver", win: 0.15, avg: 3.00 },
    { name: "🧈 Gold", win: 0.20, avg: 3.10 },
    { name: "♦️ Ruby", win: 0.24, avg: 3.20 },
    { name: "🔷 Platinum", win: 0.27, avg: 3.30 },
    { name: "💎 Diamond", win: 0.30, avg: 3.40 }
];


/* Calculates progress towards next prestige tier based on win rate and average points */
function getTierProgress(winRate, avgPoints) {

    winRate = Number(winRate) || 0;
    avgPoints = Number(avgPoints) || 0;

    let currentIndex = 0;

    for (let i = TIERS.length - 1; i >= 0; i--) {
        if (winRate >= TIERS[i].win && avgPoints >= TIERS[i].avg) {
            currentIndex = i;
            break;
        }
    }

    // Max tier
    if (currentIndex === TIERS.length - 1) {
        return {
            progress: 100,
            remaining: 0,
            nextTier: null,
            gapText: ""
        };
    }

    const current = TIERS[currentIndex];
    const next = TIERS[currentIndex + 1];

    const winRange = (next.win - current.win) || 1;
    const avgRange = (next.avg - current.avg) || 1;

    const winProgress = (winRate - current.win) / winRange;
    const avgProgress = (avgPoints - current.avg) / avgRange;

    let progressRaw = Math.min(winProgress, avgProgress);

    // Clamp
    progressRaw = Math.max(0, Math.min(1, progressRaw));

    // 🔥 CRITICAL FIX:
    // If player hasn't reached next tier yet → NEVER allow 100%
    const qualifiesForNext =
        winRate >= next.win && avgPoints >= next.avg;

    if (!qualifiesForNext && progressRaw >= 1) {
        progressRaw = 0.99;
    }

    let progressPercent = Math.floor(progressRaw * 100);
    let remainingPercent = Math.ceil((1 - progressRaw) * 100);

    // 🔥 FORCE minimum 1% remaining if not promoted
    if (!qualifiesForNext && remainingPercent === 0) {
        remainingPercent = 1;
    }

    // ✅ BONUS UPGRADE (THIS IS THE NEW PART)
    const winGap = Math.max(0, next.win - winRate);
    const avgGap = Math.max(0, next.avg - avgPoints);

    let gapParts = [];

    if (winGap > 0) {
        gapParts.push(`+${(winGap * 100).toFixed(1)}% win`);
    }

    if (avgGap > 0) {
        gapParts.push(`+${avgGap.toFixed(2)} avg`);
    }

    let gapText = "";

    if (gapParts.length > 0) {
        gapText = `Needs ${gapParts.join(" + ")}`;
    } else {
        gapText = "Ready to rank up! 🔥";
    }

    return {
        progress: progressPercent,
        remaining: remainingPercent,
        nextTier: next.name,
        gapText
    };
}


/**
 * DETAILED PLAYER STATS CALCULATOR
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
    const playerType = determinePlayerType(stats, avgPoints);
    const rivalry = getRivalry(userId);
    const nemesis = getNemesis(userId);

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
                <h6>🚨 Highest Score</h6>
                <p class="font-weight-bold">${stats.highestRoundScore}</p>
            </div>

            <div class="col-6 col-md-3 mb-2">
                <h6>🎯 Avg Points/Game</h6>
                <p class="fw-bold">${avgPoints}</p>
            </div>

        </div>

        <hr>

        <div class="row text-center mb-3">
            <div class="col-6 col-md-6 mb-2">
                <h6>🤜 Rival</h6>
                <p class="fw-bold">${rivalry.rival || "—"}</p>
                <small class="text-white-50">
                    ${rivalry.rivalStats || "Your closest competitor"}
                </small>
            </div>

            <div class="col-6 col-md-6 mb-2">
                <h6>💀 Nemesis</h6>
                <p class="fw-bold">${nemesis.nemesis || "—"}</p>
                <small class="text-white-50">
                    ${nemesis.nemesisStats || "Beats you most in finals"}
                </small>
            </div>
        </div>

        <hr>

        <div class="row text-center mb-3">
            <div class="col-6 col-md-6 mb-2">
                <h6>🔥 Longest Win Streak</h6>
                <p class="font-weight-bold">${stats.longestWinStreak}</p>
            </div>

            <div class="col-6 col-md-6 mb-2">
                <h6>⚡ Current Win Streak</h6>
                <p class="font-weight-bold">${stats.currentWinStreak}</p>
            </div>
        </div>

    `;

    document.getElementById("playerStatsTitle").innerText =
        `${user.name} - Career Stats`;

    document.getElementById("playerStatsContent").innerHTML = html;

    const modal = new bootstrap.Modal(document.getElementById("playerStatsModal"));
    modal.show();
}

/* Rivalry stats calculator - finds the player you have the best and worst record against (min 5 games together) */
function getRivalry(userId) {

    const record = {};

    let myStats = {
        wins: 0,
        games: 0,
        avg: 0,
        totalPoints: 0
    };

    // ---------------------------
    // STEP 1: COLLECT DATA
    // ---------------------------
    games.forEach(g => {

        const players = getAllGamePlayers(g);
        const me = players.find(p => p.id === userId);

        if (!me) return;

        const totalPlayers = players.length;

        const myRank = me.elimOrder === -1
            ? 1
            : totalPlayers - me.elimOrder + 1;

        myStats.games++;
        myStats.totalPoints += me.avgPoints || 0;
        if (myRank === 1) myStats.wins++;

        players.forEach(op => {

            if (op.id === userId) return;

            const opRank = op.elimOrder === -1
                ? 1
                : totalPlayers - op.elimOrder + 1;

            if (!record[op.id]) {
                record[op.id] = {
                    finalsPlayed: 0,
                    wins: 0,
                    losses: 0,
                    nearEncounters: 0,
                    totalGamesTogether: 0,
                    rankDistanceSum: 0,
                    opWins: 0,
                    opGames: 0,
                    opAvgPoints: 0
                };
            }

            const r = record[op.id];

            r.totalGamesTogether++;

            // ---------------------------
            // FINALS TRACKING (TOP 2 ONLY)
            // ---------------------------
            if (g.status === "completed") {

                const finalists = players
                    .map(p => ({
                        ...p,
                        rank: p.elimOrder === -1
                            ? 1
                            : totalPlayers - p.elimOrder + 1
                    }))
                    .sort((a, b) => a.rank - b.rank)
                    .slice(0, 2);

                if (finalists.length === 2 &&
                    finalists.some(p => p.id === userId) &&
                    finalists.some(p => p.id === op.id)
                ) {
                    r.finalsPlayed++;

                    const meFinal = finalists.find(p => p.id === userId);
                    const opFinal = finalists.find(p => p.id === op.id);

                    if (meFinal.rank < opFinal.rank) {
                        r.wins++;
                    } else {
                        r.losses++;
                    }
                }
            }

            // ---------------------------
            // RANK CLOSENESS
            // ---------------------------
            const diff = Math.abs(myRank - opRank);
            r.rankDistanceSum += diff;

            if (diff <= 1) {
                r.nearEncounters++;
            }

            // ---------------------------
            // OPPONENT STATS (SKILL MATCHING)
            // ---------------------------
            r.opGames++;
            r.opAvgPoints += op.avgPoints || 0;

        });

    });

    myStats.avg = myStats.games
        ? myStats.totalPoints / myStats.games
        : 0;

    // ---------------------------
    // STEP 2: FIND RIVAL SCORE
    // ---------------------------
    let bestId = null;
    let bestScore = -Infinity;

    Object.entries(record).forEach(([id, r]) => {

        const totalMatches = r.wins + r.losses;

        if (totalMatches < 2) return;

        // ---------------------------
        // FACTOR 1: FINAL BALANCE
        // ---------------------------
        const finalBalance = totalMatches
            ? 1 - Math.abs(r.wins - r.losses) / totalMatches
            : 0;

        // ---------------------------
        // FACTOR 2: FREQUENCY IN FINALS
        // ---------------------------
        const finalFrequency = Math.min(r.finalsPlayed / 5, 1);

        // ---------------------------
        // FACTOR 3: RANK CLOSENESS
        // ---------------------------
        const avgRankDiff = r.rankDistanceSum / r.totalGamesTogether;
        const closenessScore = Math.max(0, 1 - avgRankDiff / 5);

        // ---------------------------
        // FACTOR 4: NEAR ENCOUNTERS
        // ---------------------------
        const nearScore = Math.min(r.nearEncounters / r.totalGamesTogether, 1);

        // ---------------------------
        // FACTOR 5: SKILL SIMILARITY
        // ---------------------------
        const opAvg = r.opGames ? r.opAvgPoints / r.opGames : 0;
        const skillDiff = Math.abs(myStats.avg - opAvg);
        const skillScore = Math.max(0, 1 - skillDiff / 20);

        // ---------------------------
        // FINAL SCORE (WEIGHTED MODEL)
        // ---------------------------
        const score =
            finalBalance * 0.30 +
            finalFrequency * 0.20 +
            closenessScore * 0.20 +
            nearScore * 0.15 +
            skillScore * 0.15;

        if (score > bestScore) {
            bestScore = score;
            bestId = id;
        }

    });

    const rivalData = bestId ? record[bestId] : null;

    return {
        rival: bestId ? getUserById(parseInt(bestId))?.name : null,

        rivalStats: rivalData
            ? `${rivalData.finalsPlayed} finals • ${rivalData.wins}W-${rivalData.losses}L • ${rivalData.nearEncounters} close fights`
            : null,

        rivalScore: bestScore ? bestScore.toFixed(2) : null
    };
}

/* Get nemesis stats */
function getNemesis(userId) {

    const record = {};

    games.forEach(g => {

        const players = getAllGamePlayers(g);

        // Only consider completed games
        if (g.status !== "completed") return;

        // Get top 2 players (finalists)
        const finalists = players
            .map(p => ({
                ...p,
                rank: p.elimOrder === -1
                    ? 1
                    : players.length - p.elimOrder + 1
            }))
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 2);

        if (finalists.length < 2) return;

        const me = finalists.find(p => p.id === userId);
        if (!me) return;

        const opponent = finalists.find(p => p.id !== userId);
        if (!opponent) return;

        if (!record[opponent.id]) {
            record[opponent.id] = {
                finalsPlayed: 0,
                wins: 0,
                losses: 0
            };
        }

        record[opponent.id].finalsPlayed++;

        if (me.rank < opponent.rank) {
            record[opponent.id].wins++;
        } else {
            record[opponent.id].losses++;
        }

    });

    let nemesis = null;
    let maxLosses = -1;

    Object.entries(record).forEach(([id, r]) => {

        // 💀 Nemesis → most losses in finals
        if (r.losses > maxLosses) {
            maxLosses = r.losses;
            nemesis = {
                id,
                ...r
            };
        }

    });

    return {
        nemesis: nemesis ? getUserById(parseInt(nemesis.id))?.name : null,
        nemesisStats: nemesis
            ? `${nemesis.losses} losses in ${nemesis.finalsPlayed} finals`
            : null
    };
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
        .map(([id, s]) => {
            const userId = parseInt(id);
            const name = getUserById(userId)?.name || 'Unknown';

            const lifetime = getLifetimeStats(userId);

            const tempStats = {
                games: lifetime.games,
                wins: lifetime.wins,
                currentWinStreak: 0
            };

            const avgPoints = lifetime.avgPoints;

            const fullType = determinePlayerType(tempStats, avgPoints);
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
 * --------------------------------------------------------------------------------------------------------------------------------
 * COLLECTS CURRENT ROUND SCORES FROM INPUTS, SENDS TO BACKEND, AND UPDATES GAME STATE
 * Also contains simple sound logic based on round outcomes (elimination or 40/0 scenario)
 * --------------------------------------------------------------------------------------------------------------------------------
 */
async function submitRoundScores() {
    const inputs = document.querySelectorAll('#gameHistory .score-input');
    let roundScores = {};

    inputs.forEach(inp => {
        const val = parseInt(inp.value) || 0;
        const id = parseInt(inp.dataset.id);
        roundScores[id] = val;
        inp.value = '';
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

        const updatedGame = await res.json();

        // ─────────────────────────────
        // 🔊 PRIORITY-BASED SOUND SYSTEM
        // ─────────────────────────────

        const oldGame = { ...currentGame };

        // Detect events
        const lastRound = updatedGame.rounds[updatedGame.rounds.length - 1] || {};

        // 1. WINNER
        const isWinner = updatedGame.status === "completed";

        // 2. ELIMINATION
        const newlyEliminated = updatedGame.players.filter(p => {
            const oldP = oldGame.players.find(o => o.id === p.id);
            return oldP && oldP.status === 'active' && p.status === 'eliminated';
        });

        // 3. FUNNY (40-0)
        let fortyCount = 0;
        let zeroCount = 0;

        Object.values(lastRound).forEach(score => {
            if (score === 40) fortyCount++;
            if (score === 0) zeroCount++;
        });

        const totalPlayers = Object.keys(lastRound).length;
        const isFunny = (fortyCount === 1 && zeroCount === totalPlayers - 1);

        // 4. THUKKA (>40)
        const highScorers = Object.entries(lastRound)
            .filter(([_, score]) => score > 40)
            .map(([id]) => getUserById(parseInt(id))?.name || "Legend");

        // 5. NEAR ELIMINATION
        const highScorerIds = Object.entries(lastRound)
            .filter(([_, score]) => score > 40)
            .map(([id]) => parseInt(id));

        const nearElimPlayers = updatedGame.players.filter(p => {
            if (p.status !== 'active') return false;
            if (highScorerIds.includes(p.id)) return false;
            return p.total >= (updatedGame.elimScore - 15);
        });

        const justEnteredDanger = nearElimPlayers.some(p => {
            const oldP = oldGame.players.find(o => o.id === p.id);
            return oldP && oldP.total < (updatedGame.elimScore - 15);
        });


        // ─────────────────────────────
        // 🎯 APPLY PRIORITY
        // ─────────────────────────────

        if (isWinner) {
            const winner = updatedGame.players.find(p => p.elimOrder === -1);
            const name = getUserById(winner?.id)?.name || "Champion";

            playSound("winnerSound");
            showGif("winner", `${name} is the WINNER 👑🔥`, 14000);
        }

        else if (newlyEliminated.length > 0) {
            playSound("elimSound");

            const names = newlyEliminated.map(p => getUserById(p.id)?.name || "Unknown");
            const text = names.length === 1
                ? `${names[0]} ji TATA BYE BYE! 👋`
                : `${names.join(" & ")} ji TATA BYE BYE! 👋`;

            showGif("elim", text);
        }

        else if (isFunny) {
            playSound("funnySound");

            const scorerId = Object.keys(lastRound).find(id => lastRound[id] === 40);
            const name = getUserById(parseInt(scorerId))?.name || "Legend";

            showGif("funny", `${name} ji wah kya khela! 😂`);
        }

        else if (highScorers.length > 0) {
            playSound("highScoreSound");

            const text = highScorers.length === 1
                ? `${highScorers[0]} ji wah ultra-legend honi 😂`
                : `${highScorers.join(" & ")} ji wah ultra-legend honi 😂`;

            showGif("high", text);
        }

        else if (justEnteredDanger) {
            playSound("nearElimSound");

            const names = nearElimPlayers.map(p => getUserById(p.id)?.name || "Player");
            const text = names.length === 1
                ? `${names[0]} ji udaan tayari hudai 🚀`
                : `${names.join(" & ")} ji udaan tayari hudai 🚀`;

            showGif("nearElim", text, 10000);
        }


        // Update current game state
        currentGame = updatedGame;

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

    // 🔊 NEW: Winner celebration
    playSound("winnerSound");
    // showGif("winner", `${winnerName} is the WINNER 👑🔥`, 13000);

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

// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 7. LIVE SCOREBOARD (SOCKET.IO)
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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


/**
 * Initializes Socket.IO connection and sets up real-time game updates
 */
function initLiveSocket() {
    socket = io();

    socket.on("gameUpdate", (game) => {

        // ─────────────────────────────
        // 🧹 HANDLE GAME END / NO GAME
        // ─────────────────────────────
        if (!game || game.status !== "ongoing") {

            if (game && game.status === "completed" && currentGame) {
                const winner = game.players.find(p => p.elimOrder === -1);
                const name = getUserById(winner?.id)?.name || "Champion";

                playSound("winnerSound");
                showGif("winner", `${name} is the WINNER 👑🔥`, 13000);
            }

            currentGame = null;
            renderLiveGame(null);
            return;
        }

        const oldGame = currentGame ? { ...currentGame } : null;

        // ─────────────────────────────
        // 🧠 ONLY PROCESS IF NEW ROUND
        // ─────────────────────────────
        if (oldGame && game.rounds.length > oldGame.rounds.length) {

            const lastRound = game.rounds[game.rounds.length - 1] || {};

            // ───────── DETECTIONS ─────────

            // 1. ELIMINATION
            const newlyEliminated = game.players.filter(p => {
                const oldP = oldGame.players.find(o => o.id === p.id);
                return oldP && oldP.status === "active" && p.status === "eliminated";
            });

            // 2. FUNNY (40-0)
            let fortyCount = 0;
            let zeroCount = 0;

            Object.values(lastRound).forEach(score => {
                if (score === 40) fortyCount++;
                if (score === 0) zeroCount++;
            });

            const totalPlayers = Object.keys(lastRound).length;
            const isFunny = (fortyCount === 1 && zeroCount === totalPlayers - 1);

            // 3. THUKKA (>40)
            const highScorers = Object.entries(lastRound)
                .filter(([_, score]) => score > 40)
                .map(([id]) => getUserById(parseInt(id))?.name || "Legend");

            // 4. NEAR ELIMINATION
            const highScorerIds = Object.entries(lastRound)
                .filter(([_, score]) => score > 40)
                .map(([id]) => parseInt(id));

            const nearElimPlayers = game.players.filter(p => {
                if (p.status !== 'active') return false;
                if (highScorerIds.includes(p.id)) return false;
                return p.total >= (game.elimScore - 15);
            });

            const justEnteredDanger = nearElimPlayers.some(p => {
                const oldP = oldGame.players.find(o => o.id === p.id);
                return oldP && oldP.total < (game.elimScore - 15);
            });

            // ───────── PRIORITY SYSTEM ─────────

            if (newlyEliminated.length > 0) {
                playSound("elimSound");

                const names = newlyEliminated.map(p => getUserById(p.id)?.name || "Unknown");
                const text = names.length === 1
                    ? `${names[0]} ji TATA BYE BYE! 👋`
                    : `${names.join(" & ")} ji TATA BYE BYE! 👋`;

                showGif("elim", text);
            }

            else if (isFunny) {
                playSound("funnySound");

                const scorerId = Object.keys(lastRound).find(id => lastRound[id] === 40);
                const name = getUserById(parseInt(scorerId))?.name || "Legend";

                showGif("funny", `${name} ji wah kya khela! 😂`);
            }

            else if (highScorers.length > 0) {
                playSound("highScoreSound");

                const text = highScorers.length === 1
                    ? `${highScorers[0]} ji wah ultra-legend khiladi 😂`
                    : `${highScorers.join(" & ")} ji wah ultra-legend khiladi 😂`;

                showGif("high", text);
            }

            else if (justEnteredDanger) {
                playSound("nearElimSound");

                const names = nearElimPlayers.map(p => getUserById(p.id)?.name || "Player");
                const text = names.length === 1
                    ? `${names[0]} ji udaan tayari hudai 🚀`
                    : `${names.join(" & ")} ji udaan tayari hudai 🚀`;

                showGif("nearElim", text, 10000);
            }
        }

        // ─────────────────────────────
        // 🔄 UPDATE UI
        // ─────────────────────────────
        currentGame = game;
        renderLiveGame(game);
    });
}


// ────────────────────────────────────────────────
// 🔊 UNLOCK AUDIO (REQUIRED FOR INDEX PAGE)
// ────────────────────────────────────────────────

let audioUnlocked = false;

document.addEventListener("click", () => {
    if (audioUnlocked) return;

    ["elimSound", "funnySound", "highScoreSound", "nearElimSound"].forEach(id => {
        const audio = document.getElementById(id);
        if (audio) {
            audio.muted = true;
            audio.play().then(() => {
                audio.pause();
                audio.muted = false;
            }).catch(() => { });
        }
    });

    audioUnlocked = true;
    console.log("🔊 All audio unlocked!");
});
