// ================================================
// LIVE SOCKET.IO UPDATES
// ================================================

let socket = null;

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