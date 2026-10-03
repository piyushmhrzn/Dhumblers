// ================================================
// 6. GAME PAGE RENDERING & INTERACTION (game.html)
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
            const roundNumber = idx + 1;

            // Check whether this player caused a Dhumble
            // during this specific round.
            const causedDhumble = (currentGame.dhumbles || []).some(d =>
                d.round === roundNumber &&
                Array.isArray(d.causedBy) &&
                d.causedBy.map(Number).includes(p.id)
            );

            if (causedDhumble) {
                history += `R${roundNumber}(${score} - 2) `;
            } else {
                history += `R${roundNumber}(${score}) `;
            }
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
 * HELPER FUNCTION
 * Displays a modal to ask for Dhumble causers and returns the selected IDs
 * --------------------------------------------------------------------------------------------------------------------------------
 */
function askDhumbleCausers(victimId, possibleCausers) {

    return new Promise(resolve => {

        const modalElement =
            document.getElementById("dhumbleModal");

        const victimElement =
            document.getElementById("dhumbleVictimName");

        const causerList =
            document.getElementById("dhumbleCauserList");

        const errorElement =
            document.getElementById("dhumbleError");

        const confirmButton =
            document.getElementById("confirmDhumbleBtn");

        const victimName =
            getUserById(victimId)?.name ||
            `Player ${victimId}`;

        victimElement.textContent = victimName;

        errorElement.style.display = "none";

        // Build checkbox list
        causerList.innerHTML = possibleCausers
            .map(player => `
                <div class="form-check mb-2">

                    <input
                        class="form-check-input dhumble-causer-checkbox"
                        type="checkbox"
                        value="${player.id}"
                        id="dhumbleCauser${player.id}"
                    >

                    <label
                        class="form-check-label"
                        for="dhumbleCauser${player.id}"
                    >
                        ${player.name}
                    </label>

                </div>
            `)
            .join("");

        const modal =
            bootstrap.Modal.getOrCreateInstance(modalElement);

        let finished = false;

        const finish = result => {

            if (finished) return;

            finished = true;

            confirmButton.removeEventListener(
                "click",
                handleConfirm
            );

            modalElement.removeEventListener(
                "hidden.bs.modal",
                handleHidden
            );

            resolve(result);
        };

        const handleConfirm = () => {

            const selectedIds = [
                ...modalElement.querySelectorAll(
                    ".dhumble-causer-checkbox:checked"
                )
            ].map(input => Number(input.value));

            if (selectedIds.length === 0) {
                errorElement.style.display = "block";
                return;
            }

            errorElement.style.display = "none";

            finish(selectedIds);

            modal.hide();
        };

        const handleHidden = () => {

            // Closing/cancelling without confirming
            finish(null);
        };

        confirmButton.addEventListener(
            "click",
            handleConfirm
        );

        modalElement.addEventListener(
            "hidden.bs.modal",
            handleHidden
        );

        modal.show();
    });
}

/**
 * --------------------------------------------------------------------------------------------------------------------------------
 * COLLECTS CURRENT ROUND SCORES FROM INPUTS, SENDS TO BACKEND, AND UPDATES GAME STATE
 * Also contains simple sound logic based on round outcomes (elimination or 40/0 scenario)
 * --------------------------------------------------------------------------------------------------------------------------------
 */
async function submitRoundScores() {

    const inputs =
        document.querySelectorAll(
            '#gameHistory .score-input'
        );

    let roundScores = {};

    inputs.forEach(inp => {

        const val =
            parseInt(inp.value) || 0;

        const id =
            parseInt(inp.dataset.id);

        roundScores[id] = val;
    });


    // ─────────────────────────────────────────────
    // DHUMBLE DETECTION
    // ─────────────────────────────────────────────

    let dhumble = null;

    const scoreEntries =
        Object.entries(roundScores);

    const fortyPlayers =
        scoreEntries.filter(
            ([_, score]) =>
                Number(score) === 40
        );

    const zeroPlayers =
        scoreEntries.filter(
            ([_, score]) =>
                Number(score) === 0
        );

    const isDhumbleRound =
        fortyPlayers.length === 1 &&
        zeroPlayers.length ===
        scoreEntries.length - 1;


    // ─────────────────────────────────────────────
    // DHUMBLE ATTRIBUTION
    // ─────────────────────────────────────────────

    if (isDhumbleRound) {

        const victimId =
            Number(fortyPlayers[0][0]);

        const possibleCausers =
            zeroPlayers.map(([id]) => {

                const playerId =
                    Number(id);

                return {
                    id: playerId,

                    name:
                        getUserById(playerId)?.name ||
                        `Player ${playerId}`
                };
            });


        const selectedCauserIds =
            await askDhumbleCausers(
                victimId,
                possibleCausers
            );


        // User cancelled modal.
        // Do NOT submit the round.
        if (selectedCauserIds === null) {
            return;
        }


        dhumble = {
            victim: victimId,
            causedBy: selectedCauserIds
        };
    }


    // Clear inputs only AFTER Dhumble
    // attribution has successfully finished.
    inputs.forEach(inp => {
        inp.value = '';
    });


    try {
        const res = await fetch('/api/games/ongoing/round', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roundScores,
                dhumble
            })
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

        // --------------------------------------------------------------------------------
        // 2. ELIMINATION
        // --------------------------------------------------------------------------------
        const newlyEliminated = updatedGame.players.filter(p => {
            const oldP = oldGame.players.find(o => o.id === p.id);
            return oldP && oldP.status === 'active' && p.status === 'eliminated';
        });

        // --------------------------------------------------------------------------------
        // 3. FUNNY (40-0)
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
        // 4. HIGH SCORE (40+) Players scoring more than 40 in the round
        // --------------------------------------------------------------------------------
        const highScorers = Object.entries(lastRound)
            .filter(([_, score]) => score > 40)
            .map(([id]) => getUserById(parseInt(id))?.name || "Legend");

        const highScorerIds = Object.entries(lastRound)
            .filter(([_, score]) => score > 40)
            .map(([id]) => parseInt(id));

        // --------------------------------------------------------------------------------
        // 5. NEAR ELIMINATION (within 15 points of elimScore)
        // --------------------------------------------------------------------------------
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
                ? `${highScorers[0]} jji wah ultra-legend khiladi 😂`
                : `${highScorers.join(" & ")} jji wah ultra-legend khiladi 😂`;

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

    // Winner bonus details
    const bonusPoints = winnerPlayer?.bonusPoints || 0;
    const bonusName = winnerPlayer?.bonusName || '';

    // 🔊 Winner celebration
    playSound("winnerSound");

    document.getElementById('winnerBanner').innerHTML = `
        <div class="alert alert-success text-center mb-4" role="alert">
            <h4 class="alert-heading">Game Over!</h4>
            <p><strong>Winner: ${winnerName}</strong></p>

            ${bonusPoints > 0 ? `
                <p class="mb-2">
                    <strong>${bonusName} (+${bonusPoints} points)</strong>
                </p>
            ` : ''}

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