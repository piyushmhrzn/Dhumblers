// ================================================
// API ROUTES - Game & User Management
// Express Router (api.js)
// ================================================

const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Game = require('../models/Game');
const Bet = require('../models/Bet');

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
                // Same final score = same points
                if (i > 0 && rankings[i].total === rankings[i - 1].total) {
                    pointsArr.push(pointsArr[i - 1]);
                } else {
                    pointsArr.push(pts);
                }

                // Only reduce points when NOT tied
                if (i === 0 || rankings[i].total !== rankings[i - 1].total) {
                    pts -= (i === 0 ? 2 : 1);
                }
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

            //----------------------------------------------------
            // Settle Bets
            //----------------------------------------------------

            const bets = await Bet.find({
                gameId: game.id,
                status: 'pending'
            });

            for (const bet of bets) {

                const playerA = game.players.find(p => p.id === bet.playerA);
                const playerB = game.players.find(p => p.id === bet.playerB);

                if (!playerA || !playerB)
                    continue;

                bet.playerAPoints = playerA.points;
                bet.playerBPoints = playerB.points;

                const diff = Math.abs(
                    playerA.points - playerB.points
                );

                bet.difference = diff;

                if (playerA.points > playerB.points) {

                    bet.winner = playerA.id;
                    bet.payout = diff * bet.stake;
                    bet.status = 'settled';

                }
                else if (playerB.points > playerA.points) {

                    bet.winner = playerB.id;
                    bet.payout = diff * bet.stake;
                    bet.status = 'settled';

                }
                else {

                    bet.status = 'draw';
                    bet.payout = 0;

                }

                await bet.save();

            }

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

        const game = await Game.findOneAndDelete({
            status: 'ongoing'
        });

        if (!game) {
            return res.status(404).json({
                error: 'No ongoing game'
            });
        }

        // Delete ONLY pending bets belonging to this cancelled game.
        // Settled/draw bets must remain permanently in history.
        await Bet.deleteMany({
            gameId: game.id,
            status: 'pending'
        });

        // Notify clients that there is no active game.
        req.app.get('io').emit('gameUpdate', null);

        res.json({
            message: 'Game cancelled'
        });

    } catch (err) {

        console.error('CANCEL GAME ERROR:', err);

        res.status(500).json({
            error: err.message
        });

    }

});


// ────────────────────────────────────────────────
// 4. BETS
// ────────────────────────────────────────────────

/**
 * GET /api/bets/history
 * Returns settled bets with pagination
 */
router.get('/bets/history', async (req, res) => {

    try {
        const page = Number(req.query.page) || 1;
        const limit = 5;

        const total = await Bet.countDocuments({
            status: 'settled'
        });

        const bets = await Bet.find({
            status: 'settled'
        })
            .sort({ id: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            bets,
            page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (err) {

        console.error("BET HISTORY ERROR:", err);

        res.status(500).json({
            error: err.message
        });

    }

});

/**
 * GET /api/bets/:gameId
 */
router.get('/bets/:gameId', async (req, res) => {

    try {

        const bets = await Bet.find({
            gameId: req.params.gameId
        }).sort('id');

        res.json(bets);

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

/**
 * POST /api/bets
 * Create a bet for the current ongoing game
 */
router.post('/bets', async (req, res) => {

    try {

        const {
            gameId,
            playerA,
            playerB,
            stake
        } = req.body;

        // ─────────────────────────────────────────
        // Validate input
        // ─────────────────────────────────────────

        if (!gameId || !playerA || !playerB) {
            return res.status(400).json({
                error: 'Game and both players are required'
            });
        }

        if (playerA === playerB) {
            return res.status(400).json({
                error: 'Players must be different'
            });
        }

        if (!Number.isFinite(stake) || stake <= 0) {
            return res.status(400).json({
                error: 'Invalid stake'
            });
        }

        // ─────────────────────────────────────────
        // Get ONLY the ongoing game
        // ─────────────────────────────────────────

        const game = await Game.findOne({
            id: gameId,
            status: 'ongoing'
        });

        if (!game) {
            return res.status(404).json({
                error: 'Game not found or is no longer ongoing'
            });
        }

        // ─────────────────────────────────────────
        // Verify both players belong to this game
        // ─────────────────────────────────────────

        const playerAExists = game.players.some(
            p => p.id === playerA
        );

        const playerBExists = game.players.some(
            p => p.id === playerB
        );

        if (!playerAExists || !playerBExists) {
            return res.status(400).json({
                error: 'Both players must belong to the current game'
            });
        }

        // ─────────────────────────────────────────
        // Betting closes after first round
        // ─────────────────────────────────────────

        if (game.rounds.length > 0) {
            return res.status(400).json({
                error: 'Betting is closed once the game has started.'
            });
        }

        // ─────────────────────────────────────────
        // Prevent duplicate PENDING bet
        // for same player pair in THIS game
        // ─────────────────────────────────────────

        const existing = await Bet.findOne({
            gameId: game.id,
            status: 'pending',
            $or: [
                {
                    playerA: playerA,
                    playerB: playerB
                },
                {
                    playerA: playerB,
                    playerB: playerA
                }
            ]
        });

        if (existing) {
            return res.status(400).json({
                error: 'Bet already exists for these players in this game.'
            });
        }

        // ─────────────────────────────────────────
        // Create bet
        // ─────────────────────────────────────────

        const bet = new Bet({
            gameId: game.id,
            playerA,
            playerB,
            stake,
            status: 'pending'
        });

        await bet.save();

        res.json(bet);

    } catch (err) {

        console.error('CREATE BET ERROR:', err);

        res.status(500).json({
            error: err.message
        });

    }

});

/**
 * GET /api/bets/game/current
 *
 * Returns bets for the game that should currently
 * be represented in the 1 vs 1 Bets panel.
 *
 * Priority:
 *
 * 1. Ongoing game
 * 2. Otherwise most recently completed game
 * 3. Otherwise []
 */
router.get('/bets/game/current', async (req, res) => {

    try {

        // First priority: ongoing game
        let game = await Game.findOne({
            status: 'ongoing'
        });

        // If there is no ongoing game,
        // show the most recently completed game.
        if (!game) {

            game = await Game.findOne({
                status: 'completed'
            }).sort('-id');

        }

        // No games at all
        if (!game) {
            return res.json([]);
        }

        const bets = await Bet.find({
            gameId: game.id
        }).sort('id');

        res.json(bets);

    } catch (err) {

        console.error('CURRENT BETS ERROR:', err);

        res.status(500).json({
            error: err.message
        });

    }

});

/**
 * DELETE /api/bets/:id
 * Cancel a bet
 */
router.delete('/bets/:id', async (req, res) => {

    try {

        const bet = await Bet.findOneAndDelete({
            id: Number(req.params.id)
        });

        if (!bet) {
            return res.status(404).json({
                error: 'Bet not found'
            });
        }

        res.json({
            message: 'Bet cancelled'
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

module.exports = router;