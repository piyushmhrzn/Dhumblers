// ================================================
// 8. Betting System (game.html)
// ================================================

/**
 * Creates a new bet for the current ongoing game
 */
async function createBet() {

    const game = await fetchOngoingGame();

    if (!game) {

        alert('No active game');

        return;

    }

    const body = {

        gameId: game.id,

        playerA: Number(
            document.getElementById('betPlayerA').value
        ),

        playerB: Number(
            document.getElementById('betPlayerB').value
        ),

        stake: Number(
            document.getElementById('betStake').value
        )

    };

    const res = await fetch('/api/bets', {

        method: 'POST',

        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify(body)

    });

    const data = await res.json();

    if (data.error) {

        alert(data.error);

        return;

    }

    bootstrap.Modal
        .getInstance(document.getElementById('betModal'))
        .hide();

    renderBets();

}

/**
 * Deletes a bet by ID after user confirmation
 */
async function deleteBet(id) {

    if (!confirm("Cancel this bet?"))
        return;

    const res = await fetch(`/api/bets/${id}`, {

        method: "DELETE"

    });

    const data = await res.json();

    if (data.error) {

        alert(data.error);
        return;

    }

    renderBets();

}

/**
 * Populates the player selection dropdowns for betting based on the current ongoing game
 */
async function populateBetPlayers() {

    const game = await fetchOngoingGame();

    if (!game)
        return;

    const a = document.getElementById('betPlayerA');
    const b = document.getElementById('betPlayerB');

    a.innerHTML = '';
    b.innerHTML = '';

    game.players.forEach(player => {

        const user = users.find(u => u.id === player.id);

        const option1 = document.createElement('option');
        option1.value = player.id;
        option1.textContent = user.name;

        const option2 = option1.cloneNode(true);

        a.appendChild(option1);
        b.appendChild(option2);

    });

}

/**
 * Renders the list of active bets in the UI, showing player names, stakes, and status, with options to cancel pending bets
 */
async function renderBets() {

    const bets = await fetchBets();

    const container = document.getElementById("betContainer");

    if (!container)
        return;

    if (!bets.length) {

        container.innerHTML =
            '<p class="text-secondary">No bets available.</p>';

        return;
    }

    container.innerHTML = "";

    bets.forEach(bet => {

        const playerA = users.find(u => u.id === bet.playerA);
        const playerB = users.find(u => u.id === bet.playerB);

        let html = `
            <div class="card mt-2">
                <div class="card-body">

                    <h6>
                        💰 ${playerA?.name} vs ${playerB?.name}
                    </h6>

                    <p class="mb-1">
                        <strong>Stake:</strong>
                        $${bet.stake} / point
                    </p>
        `;

        // -------------------------------
        // Pending bet
        // -------------------------------

        if (bet.status === "pending") {

            if (currentGame) {

                const a = currentGame.players.find(p => p.id === bet.playerA);
                const b = currentGame.players.find(p => p.id === bet.playerB);

                html += `
                    <p class="mb-1">
                        <strong>Current Score:</strong>
                        ${a?.total ?? 0} - ${b?.total ?? 0}
                    </p>
                `;
            }

            html += `
                <p class="mb-2">
                    <span class="badge bg-warning">
                        Pending
                    </span>
                </p>

                <button
                    class="btn btn-sm btn-danger"
                    onclick="deleteBet(${bet.id})">

                    Cancel Bet

                </button>
            `;
        }

        // -------------------------------
        // Settled bet
        // -------------------------------

        else {

            const winner =
                users.find(u => u.id === bet.winner)?.name || "Unknown";

            html += `

                <p class="mb-1">
                    🏆 <strong>Winner:</strong> ${winner}
                </p>

                <p class="mb-1">
                    <strong>Final Score:</strong>
                    ${bet.playerAPoints}
                    -
                    ${bet.playerBPoints}
                </p>

                <p class="mb-1">
                    <strong>Difference:</strong>
                    ${bet.difference}
                </p>

                <p class="mb-2">
                    <strong>Payout:</strong>

                    <span class="text-success fw-bold">

                        $${bet.payout}

                    </span>
                </p>

                <span class="badge bg-success">

                    Settled

                </span>
            `;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML += html;

    });

}

/**
 * Bet history pagination variables
 */
async function fetchBetHistory(page = 1) {

    try {

        const res = await fetch(`/api/bets/history?page=${page}`);

        if (!res.ok) {
            throw new Error("Failed to load bet history");
        }

        const data = await res.json();

        betHistory = data.bets || [];
        betCurrentPage = data.page || 1;
        betTotalPages = data.totalPages || 1;

    }
    catch (err) {

        console.error(err);

        betHistory = [];
        betCurrentPage = 1;
        betTotalPages = 1;

    }

}


/**
 * Renders the bet history table with pagination controls, showing past bets, their outcomes, and payouts
 */
function renderBetHistory() {

    const body =
        document.getElementById("betHistoryBody");

    if (!body)
        return;

    body.innerHTML = "";

    (betHistory || []).forEach((bet, index) => {

        const playerA =
            getUserById(bet.playerA);

        const playerB =
            getUserById(bet.playerB);

        const winner =
            getUserById(bet.winner);

        body.innerHTML += `

        <tr>

            <td>

                ${(betCurrentPage - 1) * 5 + index + 1}

            </td>

            <td>

                ${new Date(bet.createdAt || bet.updatedAt).toLocaleDateString()}

            </td>

            <td>

                ${playerA?.name}
                (${bet.playerAPoints})

                vs

                ${playerB?.name}
                (${bet.playerBPoints})

            </td>

            <td>

                ${winner?.name}

            </td>

            <td>

                $${bet.stake}/pt

            </td>

            <td class="fw-bold text-success">

                $${bet.payout}

            </td>

        </tr>

        `;

    });

    document.getElementById("betPageInfo").textContent =
        `Page ${betCurrentPage} of ${betTotalPages}`;

    document.getElementById("betPrevPage").disabled =
        betCurrentPage === 1;

    document.getElementById("betNextPage").disabled =
        betCurrentPage === betTotalPages;

}


/**
 * Bet history pagination handler, allowing users to navigate through pages of past bets
 * @param {number} direction - +1 for next page, -1 for previous page
 */
async function changeBetPage(direction) {

    const next = betCurrentPage + direction;

    if (next < 1 || next > betTotalPages)
        return;

    await fetchBetHistory(next);

    renderBetHistory();

}