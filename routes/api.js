// ================================================
// API ROUTES - Game & User Management
// Express Router (api.js)
// ================================================

const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Game = require('../models/Game');

// ────────────────────────────────────────────────
// 1. MIDDLEWARE - Authentication / Authorization
// ────────────────────────────────────────────────

/**
 * Middleware: Check admin password sent in request body
 * Required for user management endpoints
 */
const checkAdminPassword = (req, res, next) => {
    const { password } = req.body;

    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect admin password' });
    }

    next();
};

/**
 * Middleware: Check game passcode sent in request body
 * Required for starting new games
 */
const checkGamePasscode = (req, res, next) => {
    const { password } = req.body;

    if (!password || password !== process.env.GAME_PASSCODE) {
        return res.status(401).json({ error: 'Incorrect game passcode' });
    }

    next();
};


// ────────────────────────────────────────────────
// 2. USER ENDPOINTS
// ────────────────────────────────────────────────

/**
 * GET /api/users
 * Returns all users sorted by id
 * Public endpoint
 */
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().sort('id');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/users
 * Create a new user (admin only)
 * Protected by admin password
 */
router.post('/users', checkAdminPassword, async (req, res) => {
    const { name } = req.body;

    // Basic input validation
    if (!name) {
        return res.status(400).json({ error: 'Name required' });
    }

    try {
        // Case-insensitive unique name check
        const existing = await User.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });

        if (existing) {
            return res.status(400).json({ error: 'Name must be unique' });
        }

        const user = new User({ name });
        await user.save();

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ────────────────────────────────────────────────
// 3. GAME - READ ENDPOINTS
// ────────────────────────────────────────────────

/**
 * GET /api/games
 * Returns all COMPLETED games, newest first
 * Used for recent games list & leaderboard
 * Public endpoint
 */
router.get('/games', async (req, res) => {
    try {
        const games = await Game.find({ status: 'completed' }).sort('-date');
        res.json(games);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/games/ongoing
 * Returns the current ongoing game (if any), otherwise null
 * Used by game.html and live scoreboard
 * Public endpoint
 */
router.get('/games/ongoing', async (req, res) => {
    try {
        const game = await Game.findOne({ status: 'ongoing' });
        res.json(game || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ────────────────────────────────────────────────
// 4. GAME - WRITE ENDPOINTS
// ────────────────────────────────────────────────

/**
 * POST /api/games
 * Start a new game (protected by game passcode)
 * Only allowed if no game is currently ongoing
 */
router.post('/games', checkGamePasscode, async (req, res) => {
    const { elimScore, selectedPlayerIds } = req.body;

    // Input validation
    if (!Array.isArray(selectedPlayerIds) || selectedPlayerIds.length < 2) {
        return res.status(400).json({ error: 'At least 2 players required' });
    }

    if (!elimScore || elimScore < 1) {
        return res.status(400).json({ error: 'Valid elimination score required' });
    }

    try {
        // Prevent multiple ongoing games
        const existingOngoing = await Game.findOne({ status: 'ongoing' });
        if (existingOngoing) {
            return res.status(400).json({
                error: 'An ongoing game already exists. Finish or cancel it first.'
            });
        }

        // Create minimal game document
        const game = new Game({
            elimScore,
            players: selectedPlayerIds.map(id => ({ id })),
            eliminated: [],
            rounds: []
        });

        await game.save();

        // Notify all connected clients (live scoreboard update)
        req.app.get('io').emit('gameUpdate', game);

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/games/ongoing/round
 * Submit scores for current round
 * Updates totals, eliminates players, awards points when game ends
 */
router.put('/games/ongoing/round', async (req, res) => {
    const { roundScores } = req.body; // { playerId: score, ... }

    try {
        const game = await Game.findOne({ status: 'ongoing' });
        if (!game) {
            return res.status(404).json({ error: 'No ongoing game' });
        }

        // ── Score validation ────────────────────────────────
        let allZero = true;

        for (const score of Object.values(roundScores)) {
            if (score !== 0) allZero = false;
        }

        if (allZero) {
            return res.status(400).json({ error: 'At least one score >0' });
        }

        // ── Update player totals & check eliminations ───────
        game.players.forEach(p => {
            if (p.status === 'active') {
                p.total = (p.total || 0) + (roundScores[p.id] || 0);

                if (p.total >= game.elimScore) {
                    p.status = 'eliminated';
                    p.elimOrder = game.eliminated.length + 1;

                    game.eliminated.push({
                        id: p.id,
                        total: p.total,
                        status: p.status,
                        elimOrder: p.elimOrder,
                        points: 0
                    });
                }
            }
        });

        // Save this round's scores
        game.rounds.push(roundScores);

        // ── Check if game is finished ───────────────────────
        const active = game.players.filter(p => p.status === 'active');

        if (active.length <= 1) {
            let winner;

            if (active.length === 1) {
                winner = active[0];
            } else {
                // Edge case: everyone eliminated in same round
                winner = game.eliminated[game.eliminated.length - 1];
            }

            if (winner) winner.elimOrder = -1; // -1 = winner

            // Prepare final ranking (winner first, then reverse elimination order)
            let rankings = winner ? [winner] : [];
            rankings.push(
                ...game.eliminated
                    .filter(p => p.id !== winner?.id)
                    .reverse()
            );

            // Calculate point distribution (n+1 → decreasing)
            const n = game.players.length;
            let pointsArr = [];
            let pts = n + 1;
            for (let i = 0; i < n; i++) {
                pointsArr.push(pts);
                pts -= (i === 0 ? 2 : 1); // first place gets bigger gap
            }

            // Award points & update user stats
            for (let i = 0; i < rankings.length; i++) {
                const awarded = pointsArr[i] || 0;
                const playerId = rankings[i].id;

                // Update in-game player record
                let playerInGame = game.players.find(p => p.id === playerId) ||
                    game.eliminated.find(p => p.id === playerId);

                if (playerInGame) {
                    playerInGame.points = awarded;
                }

                // Update global user stats
                const user = await User.findOne({ id: playerId });
                if (user) {
                    user.totalPoints += awarded;
                    user.gamesPlayed += 1;
                    user.maxPossible += (n + 1);
                    await user.save();
                }
            }

            // Mark modified sub-documents
            game.markModified('players');
            game.markModified('eliminated');

            game.status = 'completed';
        }

        await game.save();

        // Broadcast updated game state to all clients
        req.app.get('io').emit('gameUpdate', game);

        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/games/ongoing
 * Cancel and delete the current ongoing game
 * Resets live scoreboard
 */
router.delete('/games/ongoing', async (req, res) => {
    try {
        const game = await Game.findOneAndDelete({ status: 'ongoing' });
        if (!game) {
            return res.status(404).json({ error: 'No ongoing game' });
        }

        // Notify clients that no game is active
        req.app.get('io').emit('gameUpdate', null);

        res.json({ message: 'Game cancelled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;