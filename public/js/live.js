// ================================================
// 7. LIVE SCOREBOARD (SOCKET.IO)
// ================================================

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

    // ─────────────────────────────────────
    // No active game
    // ─────────────────────────────────────
    if (!game || game.status !== "ongoing") {

        container.innerHTML = `
            <p class="text-warning">No ongoing game</p>
        `;

        dot?.classList.add("d-none");
        bolt?.classList.remove("d-none");

        if (badge) badge.innerText = "";
        if (roundEl) roundEl.innerText = "";

        return;
    }

    // ─────────────────────────────────────
    // Live Indicators
    // ─────────────────────────────────────
    dot?.classList.remove("d-none");
    bolt?.classList.add("d-none");

    if (badge)
        badge.innerText = "Elim: " + game.elimScore;

    const currentRound = game.rounds.length + 1;

    if (roundEl)
        roundEl.innerText = `Round ${currentRound}`;

    const lastRound = game.rounds[game.rounds.length - 1] || {};

    // Sort by lowest total
    const sortedPlayers = [...game.players].sort(
        (a, b) => (a.total || 0) - (b.total || 0)
    );

    // ─────────────────────────────────────
    // Calculate Streaks
    // ─────────────────────────────────────

    let hotText = "Loading...";
    let coldText = "Loading...";

    if (game.rounds.length >= 3) {

        const last3 = game.rounds.slice(-3);

        const totals = {};

        game.players.forEach(p => totals[p.id] = 0);

        last3.forEach(round => {

            Object.entries(round).forEach(([id, score]) => {

                totals[id] += score;

            });

        });

        let hottest = null;
        let coldest = null;

        Object.entries(totals).forEach(([id, total]) => {

            id = Number(id);

            if (!hottest || total > hottest.total)
                hottest = { id, total };

            if (!coldest || total < coldest.total)
                coldest = { id, total };

        });

        hotText =
            `${getUserById(hottest.id)?.name || "Unknown"} (${hottest.total})`;

        coldText =
            `${getUserById(coldest.id)?.name || "Unknown"} (${coldest.total})`;

    }

    // ─────────────────────────────────────
    // HTML
    // ─────────────────────────────────────

    let html = `

    <div class="d-flex justify-content-between mb-3">

        <span class="badge bg-danger fs-6">
            🤡 Panauti Streak: ${hotText}
        </span>

    </div>

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
                : `<small>(${prevScore >= 0 ? "+" : ""}${prevScore})</small>`;

        const nearDanger = total >= game.elimScore - 15;
        const extremeDanger = total > game.elimScore - 5;

        let dangerEmoji = "";
        let roundEmoji = "";
        let statusEmoji = "";

        if (p.status === "active") {

            if (extremeDanger)
                dangerEmoji = " 💀";

            else if (nearDanger)
                dangerEmoji = " 🪽";
        }

        if (p.elimOrder === -1)
            statusEmoji = " 👑";

        else if (p.status !== "active")
            statusEmoji = " 🪦";

        if (prevScore !== null) {

            if (prevScore > 40)
                roundEmoji = " 🤡";

            else if (prevScore >= 40)
                roundEmoji = " 😭";

            else if (prevScore >= 30)
                roundEmoji = " 😵‍💫";

            else if (prevScore >= 20)
                roundEmoji = " 😰";

            else if (prevScore >= 1 && prevScore <= 4)
                roundEmoji = " 😎";
        }

        html += `

        <tr class="${p.status !== "active" ? "table-secondary" : ""}">

            <td>

                ${name}
                ${dangerEmoji}
                ${roundEmoji}
                ${statusEmoji}

            </td>

            <td>
                <strong>${total}</strong>
            </td>

            <td>
                ${prevDisplay}
            </td>

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
 * Update streaks (hot/cold players) based on the last 3 rounds of the current game
 */
function updateStreaks(game) {

    if (!game || game.rounds.length === 0)
        return;

    const hotEl = document.getElementById("hotPlayer");
    const coldEl = document.getElementById("coldPlayer");

    if (!hotEl || !coldEl)
        return;

    // Last 3 rounds (or fewer if game just started)
    const lastRounds = game.rounds.slice(-3);

    const totals = {};

    game.players.forEach(player => {
        totals[player.id] = 0;
    });

    lastRounds.forEach(round => {

        Object.entries(round).forEach(([id, score]) => {

            totals[id] += score;

        });

    });

    let hottest = null;
    let coldest = null;

    Object.entries(totals).forEach(([id, total]) => {

        id = Number(id);

        if (!hottest || total > hottest.total) {
            hottest = {
                id,
                total
            };
        }

        if (!coldest || total < coldest.total) {
            coldest = {
                id,
                total
            };
        }

    });

    hotEl.innerHTML =
        `🤡 <strong>${getUserById(hottest.id).name}</strong> (${hottest.total})`;

    coldEl.innerHTML =
        `🍸 <strong>${getUserById(coldest.id).name}</strong> (${coldest.total})`;

}


/**
 * Build monthly stats from a specific set of completed games
 */
function getLastGameMonthlyStats(completedGames) {
    const stats = {};

    completedGames.forEach(g => {
        if (!g || g.status !== "completed") return;

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
    });

    return stats;
}


/**
 * Build ranking using the SAME monthly leaderboard rules:
 *
 * 1. Higher points
 * 2. Higher wins
 * 3. Fewer games
 */
function getLastGameMonthlyRanking(stats) {

    return Object.entries(stats)
        .filter(([_, s]) => s.games > 0)
        .map(([id, s]) => ({
            id: Number(id),
            points: s.points,
            games: s.games,
            wins: s.wins
        }))
        .sort((a, b) => {

            if (b.points !== a.points) {
                return b.points - a.points;
            }

            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }

            return a.games - b.games;
        })
        .map((player, index) => ({
            ...player,
            rank: index + 1
        }));
}


/**
 * Get year-to-date stats for one player.
 *
 * includeGame = false:
 *     stats immediately BEFORE the last completed game
 *
 * includeGame = true:
 *     stats immediately AFTER the last completed game
 */
function getLastGameYearStats(userId, completedGames, lastGameIndex, includeGame) {

    const lastGame = completedGames[lastGameIndex];

    if (!lastGame) {
        return {
            games: 0,
            wins: 0,
            totalPoints: 0,
            avgPoints: 0
        };
    }

    const lastDate = new Date(lastGame.date);
    const targetYear = lastDate.getFullYear();

    let gamesPlayed = 0;
    let wins = 0;
    let totalPoints = 0;

    completedGames.forEach((g, index) => {

        if (!g || g.status !== "completed") return;

        const gameDate = new Date(g.date);

        if (gameDate.getFullYear() !== targetYear) {
            return;
        }

        // completedGames is ordered newest -> oldest.
        // Games with a larger index happened before the last game.
        const isLastGame = index === lastGameIndex;

        if (isLastGame && !includeGame) {
            return;
        }

        if (index < lastGameIndex) {
            return;
        }

        const player = getAllGamePlayers(g)
            .find(p => p.id === userId);

        if (!player) {
            return;
        }

        gamesPlayed += 1;
        totalPoints += player.points || 0;

        if (player.elimOrder === -1) {
            wins += 1;
        }
    });

    return {
        games: gamesPlayed,
        wins,
        totalPoints,
        avgPoints: gamesPlayed
            ? totalPoints / gamesPlayed
            : 0
    };
}


/**
 * Get the current prestige tier from the existing
 * determinePlayerType() / TIERS system.
 *
 * Prestige ranks unlock after 10 games.
 */
function getLastGamePrestigeTier(stats) {

    const tempStats = {
        games: stats.games,
        wins: stats.wins,
        currentWinStreak: 0
    };

    const fullType = determinePlayerType(
        tempStats,
        stats.avgPoints
    );

    // The current determinePlayerType() does not add
    // a prestige tier until 10 games have been played.
    if (stats.games < 10) {
        return "🎮 Rookie";
    }

    const tier = TIERS
        .slice()
        .reverse()
        .find(tier =>
            (stats.wins / stats.games) >= tier.win &&
            Number(stats.avgPoints) >= tier.avg
        );

    return tier
        ? tier.name
        : "🪱 Compost";
}


/**
 * Find tier position inside the CURRENT TIERS array.
 */
function getLastGameTierIndex(tierName) {

    const index = TIERS.findIndex(
        tier => tier.name === tierName
    );

    return index >= 0 ? index : null;
}


/**
 * Render statistics for the most recently completed game
 */
function renderLastGameStats(game, completedGames = []) {

    const card =
        document.getElementById("lastGameStatsCard");

    const container =
        document.getElementById("lastGameStatsContent");

    if (
        !card ||
        !container ||
        !game ||
        game.status !== "completed"
    ) {
        return;
    }

    const players = [...(game.players || [])];

    // ------------------------------------------------
    // WINNER
    // ------------------------------------------------

    const winner =
        players.find(p => p.elimOrder === -1);

    if (!winner) {
        return;
    }

    const winnerName =
        getUserById(winner.id)?.name || "Unknown";

    const winnerScore =
        winner.total || 0;

    const winnerWinStreak =
        getWinnerWinStreak(winner.id, completedGames);


    // ------------------------------------------------
    // HIGHEST SINGLE-ROUND SCORE
    // ------------------------------------------------

    let highestRoundScore = -1;
    let highestRoundPlayers = [];

    (game.rounds || []).forEach((round, roundIndex) => {

        Object.entries(round || {}).forEach(([id, score]) => {

            const numericScore =
                Number(score) || 0;

            if (numericScore > highestRoundScore) {

                highestRoundScore =
                    numericScore;

                highestRoundPlayers = [{
                    id: Number(id),
                    round: roundIndex + 1
                }];

            } else if (
                numericScore === highestRoundScore
            ) {

                highestRoundPlayers.push({
                    id: Number(id),
                    round: roundIndex + 1
                });
            }
        });
    });


    const highestScoreText =
        highestRoundPlayers.length

            ? highestRoundPlayers
                .map(item => {

                    const name =
                        getUserById(item.id)?.name ||
                        "Unknown";

                    return `${name} (Round ${item.round})`;
                })
                .join(", ")

            : "N/A";


    // ------------------------------------------------
    // WINNER BONUS
    // ------------------------------------------------

    const bonusPoints =
        winner.bonusPoints || 0;

    const bonusName =
        winner.bonusName || "";

    // ------------------------------------------------
    // TOTAL ROUNDS
    // ------------------------------------------------
    const totalRounds = (game.rounds || []).length;

    // ------------------------------------------------
    // BUILD MONTHLY BEFORE / AFTER SNAPSHOTS
    // ------------------------------------------------

    /*
     * renderLastGameStats() can also be called directly
     * from the socket, so find this exact game.
     */
    let lastGameIndex =
        completedGames.indexOf(game);

    /*
     * Fallback for cases where the socket object and
     * historical object are different JS objects.
     */
    if (lastGameIndex === -1 && game.id != null) {

        lastGameIndex =
            completedGames.findIndex(
                g => g.id === game.id
            );
    }

    /*
     * If this exact game cannot be found in history,
     * we can still render the normal game information,
     * but there is no reliable before/after comparison.
     */
    let beforeRanking = [];
    let afterRanking = [];

    let beforeRankMap = {};
    let afterRankMap = {};

    let tierChanges = {};


    if (lastGameIndex !== -1) {

        /*
         * The existing application uses completedGames[0]
         * as the most recently completed game.
         *
         * Everything AFTER lastGameIndex is older.
         */
        const olderCompletedGames =
            completedGames.slice(lastGameIndex + 1);


        const lastGameDate =
            new Date(game.date);

        const targetMonth =
            lastGameDate.getMonth();

        const targetYear =
            lastGameDate.getFullYear();


        // --------------------------------------------
        // BEFORE:
        // All completed games from the SAME MONTH
        // that happened before this game.
        // --------------------------------------------

        const beforeMonthGames =
            olderCompletedGames.filter(g => {

                const d = new Date(g.date);

                return (
                    d.getMonth() === targetMonth &&
                    d.getFullYear() === targetYear
                );
            });


        // --------------------------------------------
        // AFTER:
        // Before-month games + the current game.
        // --------------------------------------------

        const afterMonthGames = [
            ...beforeMonthGames,
            game
        ];


        const beforeMonthlyStats =
            getLastGameMonthlyStats(
                beforeMonthGames
            );

        const afterMonthlyStats =
            getLastGameMonthlyStats(
                afterMonthGames
            );


        beforeRanking =
            getLastGameMonthlyRanking(
                beforeMonthlyStats
            );

        afterRanking =
            getLastGameMonthlyRanking(
                afterMonthlyStats
            );


        beforeRanking.forEach(player => {
            beforeRankMap[player.id] =
                player.rank;
        });

        afterRanking.forEach(player => {
            afterRankMap[player.id] =
                player.rank;
        });


        // --------------------------------------------
        // TIER SNAPSHOTS
        // --------------------------------------------

        const playerIds = new Set();

        afterRanking.forEach(p =>
            playerIds.add(p.id)
        );

        beforeRanking.forEach(p =>
            playerIds.add(p.id)
        );

        players.forEach(p =>
            playerIds.add(p.id)
        );


        playerIds.forEach(userId => {

            const beforeStats =
                getLastGameYearStats(
                    userId,
                    completedGames,
                    lastGameIndex,
                    false
                );

            const afterStats =
                getLastGameYearStats(
                    userId,
                    completedGames,
                    lastGameIndex,
                    true
                );


            const beforeTier =
                getLastGamePrestigeTier(
                    beforeStats
                );

            const afterTier =
                getLastGamePrestigeTier(
                    afterStats
                );


            tierChanges[userId] = {
                before: beforeTier,
                after: afterTier,
                beforeStats,
                afterStats
            };
        });
    }


    // ------------------------------------------------
    // CREATE PLAYER CHANGE LIST
    // ------------------------------------------------
    // ------------------------------------------------
    // BUILD PLAYER LIST
    //
    // Show EVERY player from the last completed game.
    // Do not hide players whose rank/tier did not change.
    // ------------------------------------------------

    const changes = players
        .map(player => {

            const userId = player.id;

            const rankBefore =
                beforeRankMap[userId] ?? null;

            const rankAfter =
                afterRankMap[userId] ?? null;

            const tierBefore =
                tierChanges[userId]?.before ||
                "🎮 Rookie";

            const tierAfter =
                tierChanges[userId]?.after ||
                "🎮 Rookie";

            const tierBeforeIndex =
                getLastGameTierIndex(tierBefore);

            const tierAfterIndex =
                getLastGameTierIndex(tierAfter);

            return {
                id: userId,

                name:
                    getUserById(userId)?.name ||
                    "Unknown",

                rankBefore,
                rankAfter,

                tierBefore,
                tierAfter,

                tierBeforeIndex,
                tierAfterIndex,

                rankChanged:
                    rankBefore !== rankAfter,

                tierChanged:
                    tierBefore !== tierAfter,

                finalScore:
                    player.total || 0,

                pointsEarned:
                    player.points || 0
            };
        })
        .sort((a, b) => b.pointsEarned - a.pointsEarned);


    // ------------------------------------------------
    // MAIN CARD HTML
    // ------------------------------------------------

    let html = `

        <div class="row g-3 mb-4">

            <!-- Winner -->
            <div class="col-md-3 col-sm-6">
                <div class="border rounded p-3 h-100 text-center">

                    <div class="text-warning fs-4">
                        🏆
                    </div>

                    <div class="text-secondary small">
                        WINNER
                    </div>

                    <div class="fw-bold fs-5">
                        ${winnerName}
                    </div>

                    <div>
                        ${winnerScore} points
                    </div>

                    <div class="small text-warning mt-1">
                        🔥 ${winnerWinStreak} IN A ROW
                    </div>
                </div>
            </div>


            <!-- Winner Bonus -->
            <div class="col-md-3 col-sm-6">
                <div class="border rounded p-3 h-100 text-center">

                    <div class="text-success fs-4">
                        🎁
                    </div>

                    <div class="text-secondary small">
                        WINNER BONUS
                    </div>

                    <div class="fw-bold">
                        ${bonusPoints > 0
            ? `${bonusName} <br>(+${bonusPoints})`
            : "No Bonus"
        }
                    </div>

                </div>
            </div>


            <!-- Highest Round Score -->
            <div class="col-md-3 col-sm-6">
                <div class="border rounded p-3 h-100 text-center">

                    <div class="text-danger fs-4">
                        💀
                    </div>

                    <div class="text-secondary small">
                        HIGHEST ROUND SCORE
                    </div>

                    <div class="fw-bold fs-5">
                        ${highestRoundScore >= 0
            ? highestRoundScore
            : "N/A"
        }
                    </div>

                    <div class="small text-secondary">
                        ${highestScoreText}
                    </div>

                </div>
            </div>

            <!-- Number of Rounds -->
            <div class="col-md-3 col-sm-6">
                <div class="border rounded p-3 h-100 text-center">
                    <div class="text-primary fs-4">🎯</div>
                    <div class="text-secondary small">
                        ROUNDS PLAYED
                    </div>
                    <div class="fw-bold fs-5">
                        ${totalRounds}
                    </div>
                </div>
            </div>

        </div>


        <h6 class="mb-2">
            <i class="fas fa-arrow-trend-up me-2"></i>
            Ranking & Tier Changes
        </h6>

    `;


    // ------------------------------------------------
    // NO CHANGES
    // ------------------------------------------------

    if (changes.length === 0) {

        html += `

            <div class="border rounded p-3 text-center text-secondary">

                No ranking or tier changes from the last game.

            </div>

        `;

    } else {

        html += `

            <div class="table-responsive">

                <table class="table table-sm table-striped mb-0">

                    <thead>
                        <tr>

                            <th>Player</th>

                            <th>Rank</th>

                            <th>Rank Change</th>

                            <th>Tier</th>

                            <th>Tier Change</th>

                            <th>Final Score</th>

                            <th>Points Earned</th>

                        </tr>
                    </thead>

                    <tbody>

        `;


        changes.forEach(player => {

            // ----------------------------------------
            // RANK DISPLAY
            // ----------------------------------------

            const rankBefore =
                player.rankBefore == null
                    ? "—"
                    : player.rankBefore;

            const rankAfter =
                player.rankAfter == null
                    ? "—"
                    : player.rankAfter;


            let rankChangeText = "";

            if (player.rankBefore == null) {

                rankChangeText =
                    `<span class="text-info">NEW</span>`;

            } else if (player.rankAfter == null) {

                rankChangeText =
                    `<span class="text-secondary">—</span>`;

            } else {

                const rankDelta =
                    player.rankBefore -
                    player.rankAfter;

                if (rankDelta > 0) {

                    rankChangeText =
                        `<span class="text-success">
                            ↑ ${rankDelta}
                        </span>`;

                } else if (rankDelta < 0) {

                    rankChangeText =
                        `<span class="text-danger">
                            ↓ ${Math.abs(rankDelta)}
                        </span>`;

                } else {

                    rankChangeText =
                        `<span class="text-secondary">
                            —
                        </span>`;
                }
            }


            // ----------------------------------------
            // TIER DISPLAY
            // ----------------------------------------

            const tierBefore =
                player.tierBefore;

            const tierAfter =
                player.tierAfter;


            let tierChangeText =
                `<span class="text-secondary">—</span>`;


            if (
                player.tierBeforeIndex != null &&
                player.tierAfterIndex != null
            ) {

                const tierDelta =
                    player.tierAfterIndex -
                    player.tierBeforeIndex;


                if (tierDelta > 0) {

                    tierChangeText =
                        `<span class="text-success">
                            ↑ ${tierDelta} tier
                            ${tierDelta > 1 ? "s" : ""}
                        </span>`;

                } else if (tierDelta < 0) {

                    tierChangeText =
                        `<span class="text-danger">
                            ↓ ${Math.abs(tierDelta)} tier
                            ${Math.abs(tierDelta) > 1 ? "s" : ""}
                        </span>`;

                }
            }


            // ----------------------------------------
            // PLAYER ROW
            // ----------------------------------------

            html += `

                <tr>

                    <td>
                        <strong>
                            ${player.name}
                        </strong>
                    </td>

                    <td>
                        ${rankBefore}
                        <span class="text-secondary">
                            →
                        </span>
                        ${rankAfter}
                    </td>

                    <td>
                        ${rankChangeText}
                    </td>

                    <td>
                        <span class="tier-badge">
                            ${tierBefore}
                        </span>

                        <span class="text-secondary mx-1">
                            →
                        </span>

                        <span class="tier-badge">
                            ${tierAfter}
                        </span>
                    </td>

                    <td>
                        ${tierChangeText}
                    </td>

                    <td>
                        ${player.finalScore}
                    </td>

                    <td>
                        <strong>${player.pointsEarned}</strong>
                    </td>

                </tr>

            `;
        });


        html += `

                    </tbody>

                </table>

            </div>

        `;
    }


    container.innerHTML = html;
    card.style.display = "block";
}


/**
 * Render Last Game Stats from historical games.
 *
 * The existing application treats completedGames[0]
 * as the most recently completed game.
 */
function renderLastGameStatsFromHistory() {

    const completedGames =
        games.filter(
            g => g.status === "completed"
        );

    if (completedGames.length === 0) {
        return;
    }

    const lastCompletedGame =
        completedGames[0];

    renderLastGameStats(
        lastCompletedGame,
        completedGames
    );
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

            if (game && game.status === "completed") {

                // Refresh historical games first so Last Game Stats
                // uses the newly completed game in monthly/yearly calculations.
                fetchGames()
                    .then(() => {
                        renderLastGameStatsFromHistory();
                    })
                    .catch(err => {
                        console.error("Error refreshing game history:", err);

                        // Fallback: still render the completed game.
                        renderLastGameStats(game);
                    });

                const winner = game.players.find(
                    p => p.elimOrder === -1
                );

                const name =
                    getUserById(winner?.id)?.name || "Champion";

                playSound("winnerSound");

                showGif(
                    "winner",
                    `${name} is the WINNER 👑🔥`,
                    11000
                );
            }

            currentGame = null;
            renderLiveGame(null);
            renderBets();
            fetchBetHistory().then(renderBetHistory);

            return;
        }

        const oldGame = currentGame ? { ...currentGame } : null;

        // ─────────────────────────────
        // 🧠 ONLY PROCESS IF NEW ROUND
        // ─────────────────────────────
        if (oldGame && game.rounds.length > oldGame.rounds.length) {

            const lastRound = game.rounds[game.rounds.length - 1] || {};

            // ───────── DETECTIONS ─────────

            // --------------------------------------------------------------------------------
            // 1. ELIMINATION
            // --------------------------------------------------------------------------------
            const newlyEliminated = game.players.filter(p => {
                const oldP = oldGame.players.find(o => o.id === p.id);
                return oldP && oldP.status === "active" && p.status === "eliminated";
            });

            // --------------------------------------------------------------------------------
            // 2. FUNNY (40-0)
            // --------------------------------------------------------------------------------
            let fortyCount = 0;
            let zeroCount = 0;

            Object.values(lastRound).forEach(score => {
                if (score === 40) fortyCount++;
                if (score === 0) zeroCount++;
            });

            const totalPlayers = Object.keys(lastRound).length;
            const isFunny = (fortyCount === 1 && zeroCount === totalPlayers - 1);

            // --------------------------------------------------------------------------------
            // 3. HIGH SCORE (40+) Players scoring more than 40 in the round
            // --------------------------------------------------------------------------------
            const highScorers = Object.entries(lastRound)
                .filter(([_, score]) => score > 40)
                .map(([id]) => getUserById(parseInt(id))?.name || "Legend");

            const highScorerIds = Object.entries(lastRound)
                .filter(([_, score]) => score > 40)
                .map(([id]) => parseInt(id));

            // --------------------------------------------------------------------------------
            // 4. NEAR ELIMINATION (within 15 points of elimScore)
            // --------------------------------------------------------------------------------
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
        renderBets();
        fetchBetHistory().then(renderBetHistory);
    });
}