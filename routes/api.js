const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Game = require('../models/Game');

// Middleware to check admin password (sent in request body as { password: '...' })
const checkAdminPassword = (req, res, next) => {
    const { password } = req.body;
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect admin password' });
    }
    next();
};

const checkGamePasscode = (req, res, next) => {
    const { password } = req.body;
    if (!password || password !== process.env.GAME_PASSCODE) {
        return res.status(401).json({ error: 'Incorrect game passcode' });
    }
    next();
};

// GET all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().sort('id');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add user (protected)
router.post('/users', checkAdminPassword, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    try {
        const existing = await User.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) return res.status(400).json({ error: 'Name must be unique' });

        const user = new User({ name });
        await user.save();
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all completed games (for recent games, leaderboard)
router.get('/games', async (req, res) => {
    try {
        const games = await Game.find({ status: 'completed' }).sort('-date');
        res.json(games);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ongoing game (for game.html)
router.get('/games/ongoing', async (req, res) => {
    try {
        const game = await Game.findOne({ status: 'ongoing' });
        res.json(game || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST start new game (protected)
router.post('/games', checkGamePasscode, async (req, res) => {
    const { elimScore, selectedPlayerIds } = req.body;
    if (!Array.isArray(selectedPlayerIds) || selectedPlayerIds.length < 2) {
        return res.status(400).json({ error: 'At least 2 players required' });
    }
    if (!elimScore || elimScore < 1) {
        return res.status(400).json({ error: 'Valid elimination score required' });
    }

    try {
        // Check if ongoing game exists
        const existingOngoing = await Game.findOne({ status: 'ongoing' });
        if (existingOngoing) {
            return res.status(400).json({ error: 'An ongoing game already exists. Finish or cancel it first.' });
        }

        const game = new Game({
            elimScore,
            players: selectedPlayerIds.map(id => ({ id })),
            eliminated: [],
            rounds: []
        });
        await game.save();
        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT submit round scores 
router.put('/games/ongoing/round', async (req, res) => {
    const { roundScores } = req.body;  // { playerId: score, ... }
    try {
        const game = await Game.findOne({ status: 'ongoing' });
        if (!game) return res.status(404).json({ error: 'No ongoing game' });

        // Validate scores (no negatives, at least one >0)
        let allZero = true;
        for (let score of Object.values(roundScores)) {
            if (score < 0) return res.status(400).json({ error: 'Scores cannot be negative' });
            if (score > 0) allZero = false;
        }
        if (allZero) return res.status(400).json({ error: 'At least one score >0' });

        // Update players' totals
        game.players.forEach(p => {
            if (p.status === 'active') {
                p.total += roundScores[p.id] || 0;
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

        game.rounds.push(roundScores);

        // Check if game over
        const active = game.players.filter(p => p.status === 'active');
        if (active.length <= 1) {
            let winner;

            if (active.length === 1) {
                winner = active[0];
            } else {
                // If no active left, winner is last eliminated
                winner = game.eliminated[game.eliminated.length - 1];
            }

            if (winner) winner.elimOrder = -1;

            // Build rankings without mutating eliminated array
            let rankings = winner ? [winner] : [];

            // Add eliminated players except winner
            rankings.push(
                ...game.eliminated
                    .filter(p => p.id !== winner?.id)
                    .reverse()
            );

            const n = game.players.length;
            let pointsArr = [];
            let pts = n + 1;
            for (let i = 0; i < n; i++) {
                pointsArr.push(pts);
                pts -= (i === 0 ? 2 : 1);
            }

            for (let i = 0; i < rankings.length; i++) {
                const awarded = pointsArr[i] || 0;

                // Update the game document player
                let playerInGame;
                if (rankings[i].id === winner?.id) {
                    playerInGame = winner;
                } else {
                    playerInGame = game.players.find(p => p.id === rankings[i].id) ||
                        game.eliminated.find(p => p.id === rankings[i].id);
                }

                if (playerInGame) {
                    playerInGame.points = awarded;
                }

                // Update user stats
                const user = await User.findOne({ id: rankings[i].id });
                if (user) {
                    user.totalPoints += awarded;
                    user.gamesPlayed += 1;
                    user.maxPossible += (n + 1);
                    await user.save();
                }
            }

            // Tell Mongoose the arrays changed
            game.markModified('players');
            game.markModified('eliminated');

            game.status = 'completed';
        }

        await game.save();
        res.json(game);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE cancel ongoing game
router.delete('/games/ongoing', async (req, res) => {
    try {
        const game = await Game.findOneAndDelete({ status: 'ongoing' });
        if (!game) return res.status(404).json({ error: 'No ongoing game' });
        res.json({ message: 'Game cancelled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;