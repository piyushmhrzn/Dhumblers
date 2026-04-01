// ================================================
// GAME CREATION, ROUND SUBMISSION, CANCEL
// ================================================

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