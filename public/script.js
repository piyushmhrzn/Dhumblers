// ================================================
// Data & Constants
// ================================================

let users = [];
let games = [];
let currentGame = null;

const gamesPerPage = 5;
let currentPage = 1;

// ================================================
// Core shared helpers
// ================================================

async function fetchUsers() {
    const res = await fetch('/api/users');
    users = await res.json();
    return users;
}

async function fetchGames() {
    const res = await fetch('/api/games');
    games = await res.json();
    return games;
}

async function fetchOngoingGame() {
    const res = await fetch('/api/games/ongoing');
    currentGame = await res.json();
    return currentGame;
}

function getUserById(id) {
    return users.find(u => u.id === id);
}

function getAllGamePlayers(game) {
    // Return all players, whether active/winner or eliminated
    const all = [...game.players];

    // Add eliminated players (they may have been removed from players array)
    game.eliminated.forEach(elim => {
        // Avoid duplicates if someone is in both (shouldn't happen, but safe)
        if (!all.some(p => p.id === elim.id)) {
            all.push(elim);
        }
    });

    return all;
}

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

// ================================================
// Game starter
// ================================================

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

// ================================================
// Home page helpers (index.html)
// ================================================

function renderPlayerCheckboxes(container) {
    container.innerHTML = '';
    users.forEach(u => {
        container.innerHTML += `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" value="${u.id}" id="p${u.id}">
        <label class="form-check-label" for="p${u.id}">${u.name}</label>
      </div>`;
    });
}

function renderRecentGames(tbody) {
    const totalGames = games.length;
    const startIndex = (currentPage - 1) * gamesPerPage;
    const endIndex = startIndex + gamesPerPage;

    const pageGames = games.slice(startIndex, endIndex);  // Already sorted newest first from API

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

function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    renderRecentGames(document.getElementById('recentGamesBody'));
}

// Leaderboard – sorted by total points
function renderLeaderboard(tbody) {
    tbody.innerHTML = '';

    const sorted = [...users].sort((a, b) => b.totalPoints - a.totalPoints);

    sorted.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${u.name}</td>
      <td>${u.totalPoints}</td>
      <td>${u.gamesPlayed}</td>
    `;
        tbody.appendChild(tr);
    });
}

// Weekly Winner logic (client-side computation)
function renderWeeklyWinner(el) {
    if (!el) return;

    // Get Monday of current week
    function getMondayOfCurrentWeek() {
        const today = new Date();
        const day = today.getDay();
        const diff = (day === 0 ? -6 : 1 - day);
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

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

    // Filter games in current week
    const weeklyGames = games.filter(g => {
        const d = new Date(g.date);
        return d >= weekStart && d <= weekEnd;
    });

    const weeklyStats = {};

    // Count points from ALL players (players + eliminated)
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

    // Find best performer (highest points, tiebreaker = fewer games)
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

    // Collect all winners (can be multiple if perfect tie)
    const winners = [];
    Object.entries(weeklyStats).forEach(([id, stats]) => {
        if (stats.points === maxPoints && stats.games === minGames) {
            const name = getUserById(parseInt(id))?.name || 'Unknown';
            winners.push(name);
        }
    });

    let winnerText;
    if (winners.length === 1) {
        winnerText = `${winners[0]} (${maxPoints} points, ${minGames} games)`;
    } else {
        const joined = winners.length === 2
            ? winners.join(' & ')
            : winners.slice(0, -1).join(', ') + ' & ' + winners[winners.length - 1];
        winnerText = `${joined} (${maxPoints} points)`;
    }

    el.innerHTML = `
        <br>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Current Week:</strong> <i class="fas fa-crown text-warning me-1"></i> ${winnerText} 
        <small><em>(Ends ${endFormatted})</em></small><br>
    `;
}

// Monthly Winners (similar, copy from original, use 'games')
function renderMonthlyWinners(container) {
    if (!container) return;

    const monthlyStats = {};

    games.forEach(game => {
        const d = new Date(game.date);
        const monthKey = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {};
        }

        // Count points from ALL players (players + eliminated)
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
        .sort((a, b) => new Date(b) - new Date(a));  // newest first

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
                    const name = getUserById(parseInt(id))?.name || 'Unknown';
                    winners.push(name);
                }
            });

            let winnerText;
            if (winners.length === 1) {
                winnerText = `${winners[0]} (${maxPoints} points)`;
            } else {
                const joined = winners.length === 2
                    ? winners.join(' & ')
                    : winners.slice(0, -1).join(', ') + ' & ' + winners[winners.length - 1];
                winnerText = `${joined} (${maxPoints} points)`;
            }

            html += `
                <li class="list-group-item">
                    <strong>${monthKey}:</strong>
                    Winner${winners.length > 1 ? 's' : ''}: ${winnerText}
                </li>
            `;
        });
    }

    html += '</ul>';
    container.innerHTML = html;
}

// ================================================
// Game page helpers (game.html)
// ================================================

function renderGameTable() {
    const tbody = document.querySelector('#gameHistory tbody');
    if (!tbody || !currentGame) return;

    tbody.innerHTML = '';

    currentGame.players.forEach(p => {
        const user = getUserById(p.id);
        const name = user ? user.name : '?';
        const isActive = p.status === 'active';

        let history = '';
        let total = p.total || 0;
        currentGame.rounds.forEach((round, idx) => {
            const score = round[p.id] || 0;
            history += `R${idx + 1}(${score}) `;
        });

        const tr = document.createElement('tr');
        if (!isActive) {
            tr.classList.add('table-secondary');
        }

        tr.innerHTML = `
      <td>${name}</td>
      <td>${total}</td>
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

async function submitRoundScores() {
    const inputs = document.querySelectorAll('#gameHistory .score-input');
    let roundScores = {};

    inputs.forEach(inp => {
        let val = parseInt(inp.value) || 0;
        const id = parseInt(inp.dataset.id);
        roundScores[id] = val;
        inp.value = '';  // Clear
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

function showWinner() {
    const winnerPlayer = currentGame.players.find(p => p.elimOrder === -1);
    document.getElementById('winnerBanner').innerHTML = `
    <div class="alert alert-success text-center mb-4" role="alert">
      <h4 class="alert-heading">Game Over!</h4>
      <p><strong>Winner: ${getUserById(winnerPlayer?.id)?.name || 'Unknown'}</strong></p>
      <hr>
      <p class="mb-2">Final scores are shown below.</p>
      <a href="index.html" class="btn btn-success">Back to Home</a>
    </div>
  `;

    document.getElementById('gameControls').style.display = 'none';
    renderGameTable();
}

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

// ================================================
// LIVE SCOREBOARD
// ================================================

let socket = null;

function renderLiveGame(game) {
    const dot = document.getElementById("liveDot");
    const bolt = document.getElementById("liveIcon");
    const badge = document.getElementById("elimScoreBadge");
    const container = document.getElementById("liveGameContainer");

    if (!container) return;

    if (!game || game.status !== "ongoing") {

        container.innerHTML = `<p class="text-warning">No ongoing game</p>`;

        if (dot) dot.classList.add("d-none");
        if (bolt) bolt.classList.remove("d-none");
        if (badge) badge.innerText = "";

        return;
    }

    if (dot) dot.classList.remove("d-none");
    if (bolt) bolt.classList.add("d-none");

    // show elimination score
    if (badge) badge.innerText = "Elimination: " + game.elimScore;

    let html = `
        <div class="table-responsive">
        <table class="table table-bordered table-sm">
        <thead>
        <tr>
            <th>Player</th>
            <th>Total</th>
        </tr>
        </thead>
        <tbody>
    `;

    game.players.forEach(p => {

        const name = getUserById(p.id)?.name || "Unknown";

        html += `
            <tr class="${p.status !== 'active' ? 'table-secondary' : ''}">
                <td>${name}</td>
                <td>${p.total}</td>
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

function initLiveSocket() {

    socket = io();

    socket.on("gameUpdate", (game) => {

        renderLiveGame(game);

    });
}