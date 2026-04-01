// ================================================
// API FETCH HELPERS
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