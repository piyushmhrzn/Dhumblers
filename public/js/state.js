// ================================================
// GLOBAL STATE & CONSTANTS
// ================================================

let users = [];
let games = [];
let currentGame = null;

const gamesPerPage = 5;
let currentPage = 1;
let lastProcessedRound = 0;

// Betting
let betHistory = [];
let betCurrentPage = 1;
let betTotalPages = 1;

// Monthly winners pagination
let monthlyWinnersPage = 1;
const MONTHS_PER_PAGE = 5;

const TIERS = [
    { name: "🪱 Compost", win: 0.00, avg: 0.00 },

    { name: "🪵 Wood III", win: 0.09, avg: 2.90 },
    { name: "🪵 Wood II", win: 0.10, avg: 2.93 },
    { name: "🪵 Wood I", win: 0.11, avg: 2.96 },

    { name: "🟤 Bronze III", win: 0.12, avg: 2.99 },
    { name: "🟤 Bronze II", win: 0.13, avg: 3.02 },
    { name: "🟤 Bronze I", win: 0.14, avg: 3.05 },

    { name: "⬜ Silver III", win: 0.15, avg: 3.08 },
    { name: "⬜ Silver II", win: 0.16, avg: 3.11 },
    { name: "⬜ Silver I", win: 0.17, avg: 3.15 },

    { name: "🧈 Gold III", win: 0.18, avg: 3.18 },
    { name: "🧈 Gold II", win: 0.19, avg: 3.21 },
    { name: "🧈 Gold I", win: 0.20, avg: 3.24 },

    { name: "♦️ Ruby III", win: 0.21, avg: 3.27 },
    { name: "♦️ Ruby II", win: 0.22, avg: 3.30 },
    { name: "♦️ Ruby I", win: 0.23, avg: 3.33 },

    { name: "🔷 Platinum III", win: 0.24, avg: 3.36 },
    { name: "🔷 Platinum II", win: 0.25, avg: 3.38 },
    { name: "🔷 Platinum I", win: 0.26, avg: 3.40 },

    { name: "💎 Diamond III", win: 0.270, avg: 3.43 },
    { name: "💎 Diamond II", win: 0.277, avg: 3.45 },
    { name: "💎 Diamond I", win: 0.285, avg: 3.47 },

    { name: "👑 Master", win: 0.290, avg: 3.48 },
    { name: "👹 Grandmaster", win: 0.295, avg: 3.49 },
    { name: "🗿 Conqueror", win: 0.30, avg: 3.50 }
];