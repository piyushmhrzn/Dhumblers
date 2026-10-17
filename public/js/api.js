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

    // Clear cached yearly statistics after refreshing game history
    yearStatsCache.clear();

    return games;
}

let ongoingGameRequest = null;

function fetchOngoingGame() {
    // Reuse an existing request while it is still running.
    if (ongoingGameRequest) {
        return ongoingGameRequest;
    }

    ongoingGameRequest = (async () => {
        const res = await fetch('/api/games/ongoing');

        if (!res.ok) {
            throw new Error('Failed to fetch ongoing game');
        }

        const game = await res.json();

        currentGame = game;

        return game;
    })();

    // Clear the request after completion so future
    // calls always fetch the latest game state.
    const request = ongoingGameRequest;

    void request.then(
        () => {
            if (ongoingGameRequest === request) {
                ongoingGameRequest = null;
            }
        },
        () => {
            if (ongoingGameRequest === request) {
                ongoingGameRequest = null;
            }
        }
    );

    return request;
}

async function fetchBets() {
    const res = await fetch('/api/bets/game/current');
    return await res.json();
}