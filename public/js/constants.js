// ================================================
// CONSTANTS & GLOBAL STATE
// ================================================

let users = [];           // All registered users
let games = [];           // All historical games
let currentGame = null;   // Currently viewed / ongoing game

const gamesPerPage = 5;
let currentPage = 1;
let lastProcessedRound = 0;

// TIER DEFINITIONS
const TIERS = [
    { name: "🪵 Wood", win: 0.00, avg: 0.00 },
    { name: "🟤 Bronze", win: 0.10, avg: 2.90 },
    { name: "⬜ Silver", win: 0.15, avg: 3.00 },
    { name: "🧈 Gold", win: 0.20, avg: 3.10 },
    { name: "♦️ Ruby", win: 0.24, avg: 3.20 },
    { name: "🔷 Platinum", win: 0.27, avg: 3.30 },
    { name: "💎 Diamond", win: 0.30, avg: 3.40 }
];