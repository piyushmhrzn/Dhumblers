// ================================================
// DATA ACCESS & UTILITY HELPERS
// ================================================

function getUserById(id) {
    return users.find(u => u.id === id);
}

function getAllGamePlayers(game) {
    const all = [...game.players];
    game.eliminated.forEach(elim => {
        if (!all.some(p => p.id === elim.id)) {
            all.push(elim);
        }
    });
    return all;
}

function getLifetimeStats(userId) {
    let gamesPlayed = 0;
    let wins = 0;
    let totalPoints = 0;

    games.forEach(g => {
        const player = getAllGamePlayers(g).find(p => p.id === userId);
        if (player) {
            gamesPlayed++;
            totalPoints += player.points || 0;
            if (player.elimOrder === -1) wins++;
        }
    });

    return {
        games: gamesPlayed,
        wins,
        avgPoints: gamesPlayed ? totalPoints / gamesPlayed : 0
    };
}

function getUserWins(userId) {
    return games.filter(g =>
        g.status === 'completed' &&
        g.players.some(p => p.elimOrder === -1 && p.id === userId)
    ).length;
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace(',', '');
}

/**
 * Returns all games that happened in a specific year
 */
function getGamesByYear(year) {
    return games.filter(g => new Date(g.date).getFullYear() === year);
}

/**
 * Returns the list of years that have at least one game (newest first)
 */
function getAvailableYears() {
    const years = new Set();
    games.forEach(g => years.add(new Date(g.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
}

/**
 * Calculates year-based stats for a player (used for tier calculation)
 */
function getYearStats(userId, year) {
    const yearGames = getGamesByYear(year);

    let gamesPlayed = 0;
    let wins = 0;
    let totalPoints = 0;

    yearGames.forEach(g => {
        const player = getAllGamePlayers(g).find(p => p.id === userId);
        if (player) {
            gamesPlayed++;
            totalPoints += player.points || 0;
            if (player.elimOrder === -1) wins++;
        }
    });

    return {
        games: gamesPlayed,
        wins,
        avgPoints: gamesPlayed ? totalPoints / gamesPlayed : 0,
        totalPoints
    };
}