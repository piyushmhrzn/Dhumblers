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