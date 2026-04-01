// ================================================
// MAIN ENTRY POINT - GAME DASHBOARD
// ================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Dhumble Game Dashboard Initialized");

    try {
        await fetchUsers();
        await fetchGames();

        // Render components if elements exist
        if (document.getElementById('recentGamesBody')) {
            renderRecentGames(document.getElementById('recentGamesBody'));
        }
        if (document.getElementById('leaderboardBody')) {
            renderLeaderboard(document.getElementById('leaderboardBody'));
        }
        if (document.getElementById('careerStatsBody')) {
            renderCareerStats(document.getElementById('careerStatsBody'));
        }
        if (document.getElementById('weeklyWinner')) {
            renderWeeklyWinner(document.getElementById('weeklyWinner'));
        }
        if (document.getElementById('monthlyWinners')) {
            renderMonthlyWinners(document.getElementById('monthlyWinners'));
        }

        initLiveSocket();

        // Player selection on home page
        const playerContainer = document.getElementById('playerCheckboxes');
        if (playerContainer) renderPlayerCheckboxes(playerContainer);

    } catch (err) {
        console.error("Failed to initialize dashboard:", err);
    }
});