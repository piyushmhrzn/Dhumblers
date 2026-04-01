// ================================================
// PLAYER STATS, TIERS, RIVALRY & NEMESIS
// ================================================

function determinePlayerType(stats, avgPoints) {
    const types = [];
    const winRate = stats.games > 0 ? stats.wins / stats.games : 0;
    const hasGames = stats.games >= 10;

    // 1. PRIMARY IDENTITY
    if (winRate >= 0.30 && hasGames) types.push("👑 Sab ka Baap");
    else if (winRate >= 0.25 && hasGames) types.push("🔥 Baazigarr");
    else if (winRate >= 0.20 && hasGames) types.push("⚔️ Don");
    else if (winRate >= 0.15 && hasGames) types.push("🗡️ Striker");
    else if (winRate >= 0.10 && hasGames) types.push("😂 Tapari");
    else if (winRate < 0.10 && hasGames) types.push("🤡 Pataki");

    // 2. SCORING STYLE
    if (avgPoints >= 3.40 && hasGames) types.push("💣 Dangdung Khiladi");
    else if (avgPoints >= 3.30 && hasGames) types.push("💥 Khiladi 420");
    else if (avgPoints >= 3.20 && hasGames) types.push("🎯 Shooter Honi");
    else if (avgPoints >= 3.05 && hasGames) types.push("⚖️ Balance Khiladi");
    else if (avgPoints >= 2.90 && hasGames) types.push("🛡️ Bhagwan Bharosa");
    else if (avgPoints < 2.90 && hasGames) types.push("🐸 Lute");

    // 3. PRESTIGE TIER
    if (winRate >= 0.30 && avgPoints >= 3.40 && hasGames) types.push("💎 Diamond");
    else if (winRate >= 0.27 && avgPoints >= 3.30 && hasGames) types.push("🔷 Platinum");
    else if (winRate >= 0.24 && avgPoints >= 3.20 && hasGames) types.push("♦️ Ruby");
    else if (winRate >= 0.20 && avgPoints >= 3.10 && hasGames) types.push("🧈 Gold");
    else if (winRate >= 0.15 && avgPoints >= 3.00 && hasGames) types.push("⬜ Silver");
    else if (winRate >= 0.10 && avgPoints >= 2.90 && hasGames) types.push("🟤 Bronze");
    else if (hasGames) types.push("🪵 Wood");

    // 4. STREAK ENERGY
    if (stats.currentWinStreak >= 3) types.push("⚡ Unstoppable");
    else if (stats.currentWinStreak === 2) types.push("🔥 On Fire");

    // 5. SPECIAL
    if (stats.games <= 10) types.push("🎮 Rookie");

    if (types.length === 0) {
        return hasGames ? "🌀 Casual" : "🎮 Rookie";
    }

    return types.slice(0, 3).join(" • ");
}

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

    if (currentIndex === TIERS.length - 1) {
        return { progress: 100, remaining: 0, nextTier: null, gapText: "" };
    }

    const current = TIERS[currentIndex];
    const next = TIERS[currentIndex + 1];
    const winRange = (next.win - current.win) || 1;
    const avgRange = (next.avg - current.avg) || 1;

    const winProgress = (winRate - current.win) / winRange;
    const avgProgress = (avgPoints - current.avg) / avgRange;
    let progressRaw = Math.min(winProgress, avgProgress);
    progressRaw = Math.max(0, Math.min(1, progressRaw));

    const qualifiesForNext = winRate >= next.win && avgPoints >= next.avg;
    if (!qualifiesForNext && progressRaw >= 1) progressRaw = 0.99;

    let progressPercent = Math.floor(progressRaw * 100);
    let remainingPercent = Math.ceil((1 - progressRaw) * 100);

    if (!qualifiesForNext && remainingPercent === 0) remainingPercent = 1;

    const winGap = Math.max(0, next.win - winRate);
    const avgGap = Math.max(0, next.avg - avgPoints);
    let gapParts = [];
    if (winGap > 0) gapParts.push(`+${(winGap * 100).toFixed(1)}% win`);
    if (avgGap > 0) gapParts.push(`+${avgGap.toFixed(2)} avg`);

    const gapText = gapParts.length > 0
        ? `Needs ${gapParts.join(" + ")}`
        : "Ready to rank up! 🔥";

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