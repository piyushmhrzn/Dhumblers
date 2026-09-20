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