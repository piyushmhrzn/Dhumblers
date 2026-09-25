// ================================================
// PLAYER TYPE / TIER / CAREER STATS / RIVALRY
// ================================================

function determinePlayerType(stats, avgPoints) {
    const types = [];

    const winRate = stats.games > 0
        ? stats.wins / stats.games
        : 0;

    const hasGames = stats.games >= 10;

    // 1. PRIMARY IDENTITY
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

    // 2. SCORING STYLE
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

    // 3. PRESTIGE TIER
    if (hasGames) {
        const tier = [...TIERS]
            .reverse()
            .find(t =>
                winRate >= t.win &&
                Number(avgPoints) >= t.avg
            );

        types.push(tier ? tier.name : "🪱 Compost");
    }

    // 4. STREAK ENERGY
    if (stats.currentWinStreak >= 3) {
        types.push("⚡ Unstoppable");
    }
    else if (stats.currentWinStreak === 2) {
        types.push("🔥 On Fire");
    }

    // 5. SPECIAL FUN TAGS
    if (stats.games <= 10) {
        types.push("🎮 Rookie");
    }

    // FALLBACK
    if (types.length === 0) {
        return hasGames ? "🌀 Casual" : "🎮 Rookie";
    }

    return types.slice(0, 3).join(" • ");
}


// ================================================
// GET TIER PROGRESS
// ================================================
function getTierProgress(winRate, avgPoints) {
    winRate = Number(winRate) || 0;
    avgPoints = Number(avgPoints) || 0;

    let currentIndex = 0;

    // Find the highest tier the player qualifies for
    for (let i = TIERS.length - 1; i >= 0; i--) {
        if (
            winRate >= TIERS[i].win &&
            avgPoints >= TIERS[i].avg
        ) {
            currentIndex = i;
            break;
        }
    }

    const current = TIERS[currentIndex];

    // Maximum rank
    if (currentIndex === TIERS.length - 1) {
        return {
            currentTier: current.name,
            progress: 100,
            remaining: 0,
            nextTier: null,
            gapText: "You reached Conqueror! 🗿"
        };
    }

    const next = TIERS[currentIndex + 1];

    const winRange = next.win - current.win;
    const avgRange = next.avg - current.avg;

    const winProgress = winRange > 0
        ? (winRate - current.win) / winRange
        : 1;

    const avgProgress = avgRange > 0
        ? (avgPoints - current.avg) / avgRange
        : 1;

    // Both requirements must be met
    let progressRaw = Math.min(winProgress, avgProgress);

    progressRaw = Math.max(0, Math.min(1, progressRaw));

    const qualifiesForNext =
        winRate >= next.win &&
        avgPoints >= next.avg;

    if (!qualifiesForNext && progressRaw >= 1) {
        progressRaw = 0.99;
    }

    const progressPercent = Math.floor(progressRaw * 100);

    let remainingPercent = Math.ceil((1 - progressRaw) * 100);

    if (!qualifiesForNext && remainingPercent === 0) {
        remainingPercent = 1;
    }

    // Calculate remaining requirements
    const winGap = Math.max(0, next.win - winRate);
    const avgGap = Math.max(0, next.avg - avgPoints);

    const gapParts = [];

    if (winGap > 0) {
        gapParts.push(`+${(winGap * 100).toFixed(2)}% win rate`);
    }

    if (avgGap > 0) {
        gapParts.push(`+${avgGap.toFixed(2)} avg points`);
    }

    const gapText = qualifiesForNext
        ? "Ready to rank up! 🔥"
        : `Needs ${gapParts.join(" + ")}`;

    return {
        currentTier: current.name,
        progress: progressPercent,
        remaining: remainingPercent,
        nextTier: next.name,
        gapText
    };
}


// ================================================
// SHOW TIER INFO
// ================================================
function showTierInfo(tierText) {
    const title = document.getElementById("tierDetailTitle");
    const body = document.getElementById("tierDetailBody");

    if (!title || !body) return;

    // Match the exact tier, including sub-tier I / II / III
    const tier = [...TIERS]
        .sort((a, b) => b.name.length - a.name.length)
        .find(t => tierText.includes(t.name));

    if (!tier) {
        title.innerText = tierText || "New Player";

        body.innerHTML = `
            <div class="mb-2" style="font-size: 1.8rem;">
                ${tierText || "🎮 Rookie"}
            </div>
            <p>Play at least 10 games to unlock your prestige rank.</p>
        `;

        new bootstrap.Modal(
            document.getElementById("tierDetailModal")
        ).show();

        return;
    }

    const index = TIERS.findIndex(t => t.name === tier.name);

    const nextTier = TIERS[index + 1];

    const rangeText = `
        Win Rate: ≥ ${(tier.win * 100).toFixed(1)}%
        &nbsp; | &nbsp;
        Avg Points: ≥ ${tier.avg.toFixed(2)}
    `;

    let content = "";

    if (tier.name.includes("Compost")) {
        content = "The bottom of the ladder. Time to get those wins!";
    }
    else if (tier.name.includes("Wood")) {
        content = "Your ranking journey begins here.";
    }
    else if (tier.name.includes("Bronze")) {
        content = "You're building consistency and climbing the ranks.";
    }
    else if (tier.name.includes("Silver")) {
        content = "A solid player with improving performance.";
    }
    else if (tier.name.includes("Gold")) {
        content = "A reliable competitor with strong results.";
    }
    else if (tier.name.includes("Ruby")) {
        content = "A skilled player with competitive performance.";
    }
    else if (tier.name.includes("Platinum")) {
        content = "A high-level player approaching Diamond.";
    }
    else if (tier.name.includes("Diamond")) {
        content = "Elite performance. You've reached the High tier.";
    }
    else if (tier.name.includes("Master")) {
        content = "An exceptional player among the top competitors.";
    }
    else if (tier.name.includes("Grandmaster")) {
        content = "A rare rank for consistently dominant players.";
    }
    else if (tier.name.includes("Conqueror")) {
        content = "The highest prestige rank in Dhumble! 🗿";
    }

    let nextText = "";

    if (nextTier) {
        nextText = `
            <div class="mt-3">
                <strong>Next Rank:</strong><br>
                ${nextTier.name}
            </div>
        `;
    }

    title.innerText = `${tier.name} Tier`;

    body.innerHTML = `
        <div class="mb-2" style="font-size: 1.8rem;">
            ${tier.name}
        </div>

        <div class="mb-2">
            <strong style="color: #ffd700;">Requirements:</strong><br>
            <span style="font-size: .90rem;">${rangeText}</span>
        </div>

        <p class="mb-3">${content}</p>

        ${nextText}
    `;

    const modal = new bootstrap.Modal(
        document.getElementById("tierDetailModal")
    );

    modal.show();
}



// ================================================
// SHOW PLAYER STATS
// ================================================
function showPlayerStats(userId) {
    const user = getUserById(userId);

    if (!user) return;

    // Only stats used in the Career Stats HTML
    const stats = {
        games: 0,
        wins: 0,
        seconds: 0,
        thirds: 0,
        totalPoints: 0,
        longestWinStreak: 0,
        currentWinStreak: 0,
        tempWinStreak: 0
    };

    // Sort games chronologically
    const sortedGames = [...games].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );

    sortedGames.forEach(g => {
        const players = getAllGamePlayers(g);

        const player = players.find(p => p.id === userId);

        if (!player) return;

        stats.games++;
        stats.totalPoints += player.points || 0;

        const numPlayers = players.length;

        const finish = player.elimOrder === -1
            ? 1
            : numPlayers - player.elimOrder + 1;

        // Wins and win streaks
        if (finish === 1) {
            stats.wins++;
            stats.tempWinStreak++;
        } else {
            stats.longestWinStreak = Math.max(
                stats.longestWinStreak,
                stats.tempWinStreak
            );

            stats.tempWinStreak = 0;
        }

        // Second and third places
        if (finish === 2) {
            stats.seconds++;
        }

        if (finish === 3) {
            stats.thirds++;
        }
    });

    // Finalize streaks
    stats.longestWinStreak = Math.max(
        stats.longestWinStreak,
        stats.tempWinStreak
    );

    stats.currentWinStreak = stats.tempWinStreak;

    // Career calculations
    const winPct = stats.games
        ? ((stats.wins / stats.games) * 100).toFixed(1)
        : "0.0";

    const avgPoints = stats.games
        ? (stats.totalPoints / stats.games).toFixed(2)
        : "0.00";

    const playerType = determinePlayerType(stats, avgPoints);

    const rivalry = getRivalry(userId);
    const nemesis = getNemesis(userId);

    // Career Stats HTML
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
                <h6>⭐ Points per Game</h6>
                <p class="fw-bold">${avgPoints}</p>
            </div>

        </div>

        <hr>

        <div class="row text-center mb-3">

            <div class="col-6 col-md-6 mb-2">
                <h6>🥈 2nd Places</h6>
                <p class="fw-bold">${stats.seconds}</p>
            </div>

            <div class="col-6 col-md-6 mb-2">
                <h6>🥉 3rd Places</h6>
                <p class="fw-bold">${stats.thirds}</p>
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
                <p class="font-weight-bold">
                    ${stats.longestWinStreak}
                </p>
            </div>

            <div class="col-6 col-md-6 mb-2">
                <h6>⚡ Current Win Streak</h6>
                <p class="font-weight-bold">
                    ${stats.currentWinStreak}
                </p>
            </div>

        </div>
    `;

    document.getElementById("playerStatsTitle").innerText =
        `${user.name} - Career Stats`;

    document.getElementById("playerStatsContent").innerHTML = html;

    const modal = new bootstrap.Modal(
        document.getElementById("playerStatsModal")
    );

    modal.show();
}

/* Get rivalry stats */
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

/**
 * Rival calculated only from games of a specific year
 */
function getRivalryForYear(userId, year) {
    const yearGames = getGamesByYear(year);
    const record = {};

    yearGames.forEach(g => {
        const players = getAllGamePlayers(g);
        const me = players.find(p => p.id === userId);
        if (!me) return;

        const totalPlayers = players.length;
        const myRank = me.elimOrder === -1 ? 1 : totalPlayers - me.elimOrder + 1;

        players.forEach(op => {
            if (op.id === userId) return;

            if (!record[op.id]) {
                record[op.id] = { finalsPlayed: 0, wins: 0, losses: 0 };
            }

            const r = record[op.id];

            // Only count completed games for finals
            if (g.status === "completed") {
                const finalists = players
                    .map(p => ({
                        ...p,
                        rank: p.elimOrder === -1 ? 1 : totalPlayers - p.elimOrder + 1
                    }))
                    .sort((a, b) => a.rank - b.rank)
                    .slice(0, 2);

                if (finalists.length === 2 &&
                    finalists.some(p => p.id === userId) &&
                    finalists.some(p => p.id === op.id)) {

                    r.finalsPlayed++;
                    const meFinal = finalists.find(p => p.id === userId);
                    const opFinal = finalists.find(p => p.id === op.id);

                    if (meFinal.rank < opFinal.rank) r.wins++;
                    else r.losses++;
                }
            }
        });
    });

    // Find the closest rival (most balanced finals)
    let bestId = null;
    let bestScore = -Infinity;

    Object.entries(record).forEach(([id, r]) => {
        const total = r.wins + r.losses;
        if (total < 1) return;

        const balance = 1 - Math.abs(r.wins - r.losses) / total;
        const score = balance * r.finalsPlayed;

        if (score > bestScore) {
            bestScore = score;
            bestId = id;
        }
    });

    return {
        rival: bestId ? getUserById(parseInt(bestId))?.name : null
    };
}

/**
 * Nemesis calculated only from games of a specific year
 */
function getNemesisForYear(userId, year) {
    const yearGames = getGamesByYear(year);
    const record = {};

    yearGames.forEach(g => {
        if (g.status !== "completed") return;

        const players = getAllGamePlayers(g);
        const finalists = players
            .map(p => ({
                ...p,
                rank: p.elimOrder === -1 ? 1 : players.length - p.elimOrder + 1
            }))
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 2);

        if (finalists.length < 2) return;

        const me = finalists.find(p => p.id === userId);
        if (!me) return;

        const opponent = finalists.find(p => p.id !== userId);
        if (!opponent) return;

        if (!record[opponent.id]) {
            record[opponent.id] = { losses: 0 };
        }

        if (me.rank > opponent.rank) {
            record[opponent.id].losses++;
        }
    });

    let nemesisId = null;
    let maxLosses = -1;

    Object.entries(record).forEach(([id, r]) => {
        if (r.losses > maxLosses) {
            maxLosses = r.losses;
            nemesisId = id;
        }
    });

    return {
        nemesis: nemesisId ? getUserById(parseInt(nemesisId))?.name : null
    };
}