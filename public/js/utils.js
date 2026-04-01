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

function getUserWins(userId) {
    return games.filter(g =>
        g.status === 'completed' &&
        g.players.some(p => p.elimOrder === -1 && p.id === userId)
    ).length;
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