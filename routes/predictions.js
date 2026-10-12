
const express = require('express');
const router = express.Router();

const Game = require('../models/Game');
const User = require('../models/User');
const Prediction = require('../models/Prediction');

const FIELDS = [
    'winner',
    'dhumbleVictim',
    'highestScorer',
    'firstEliminated'
];


function getBadge(score) {
    if (score === 4) return {
        name: 'Dhumble Baba',
        icon: '🧿',
        level: 4
    };

    if (score === 3) return {
        name: 'Naag Jyotishi',
        icon: '🐍',
        level: 3
    };

    if (score === 2) return {
        name: 'Tukke Baaz',
        icon: '🦜',
        level: 2
    };

    return null;
}


function getActualResults(game) {
    const players = game.players || [];
    const rounds = game.rounds || [];
    const dhumbles = game.dhumbles || [];
    const eliminated = game.eliminated || [];

    // The official winner is identified by elimOrder = -1.
    const winner = players.find(
        p => p.elimOrder === -1
    );

    // Earliest recorded Dhumble.
    const firstDhumble = [...dhumbles]
        .sort((a, b) => a.round - b.round)[0];

    // Find the highest individual score in any round.
    let highestScore = -Infinity;
    let highestScorers = [];

    rounds.forEach(round => {
        Object.entries(round).forEach(([id, rawScore]) => {
            const score = Number(rawScore);
            const playerId = Number(id);

            if (!Number.isFinite(score)) return;

            if (score > highestScore) {
                highestScore = score;
                highestScorers = [playerId];
            } else if (
                score === highestScore &&
                !highestScorers.includes(playerId)
            ) {
                highestScorers.push(playerId);
            }
        });
    });

    // Lowest positive elimination order = first eliminated.
    const orders = eliminated
        .map(p => Number(p.elimOrder))
        .filter(n => Number.isFinite(n) && n > 0);

    const firstOrder = orders.length
        ? Math.min(...orders)
        : null;

    const firstEliminated = firstOrder === null
        ? []
        : eliminated
            .filter(p => Number(p.elimOrder) === firstOrder)
            .map(p => Number(p.id));

    return {
        winner: winner ? Number(winner.id) : null,
        dhumbleVictim: firstDhumble
            ? Number(firstDhumble.victim)
            : null,
        highestScorers,
        firstEliminated
    };
}

function gradePrediction(prediction, actual) {
    const correct = {
        winner:
            actual.winner !== null &&
            prediction.winner === actual.winner,

        dhumbleVictim:
            actual.dhumbleVictim !== null &&
            prediction.dhumbleVictim === actual.dhumbleVictim,

        highestScorer:
            actual.highestScorers.includes(
                prediction.highestScorer
            ),

        firstEliminated:
            actual.firstEliminated.includes(
                prediction.firstEliminated
            )
    };

    const score = Object.values(correct)
        .filter(Boolean).length;

    return {
        score,
        correct,
        badge: getBadge(score)
    };
}

// GET /api/predictions/ongoing
// Public voting status and poll totals.
router.get('/ongoing', async (req, res) => {
    try {
        const game = await Game.findOne({
            status: 'ongoing'
        }).lean();

        if (!game) {
            return res.json({ game: null });
        }

        const open = game.rounds.length === 0;

        const ballots = await Prediction.find({
            gameId: game.id
        }).lean();

        const totals = {};

        FIELDS.forEach(field => {
            totals[field] = {};

            ballots.forEach(ballot => {
                const id = ballot[field];

                totals[field][id] =
                    (totals[field][id] || 0) + 1;
            });
        });

        res.json({
            game: {
                id: game.id,
                status: game.status,
                players: game.players.map(p => ({
                    id: p.id
                })),
                roundsPlayed: game.rounds.length
            },
            open,
            voteCount: ballots.length,
            totals
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// GET /api/predictions/ongoing/voter/:voterId
// Load a selected player's existing ballot.
router.get('/ongoing/voter/:voterId', async (req, res) => {
    try {
        const voterId = Number(req.params.voterId);

        if (!Number.isSafeInteger(voterId)) {
            return res.status(400).json({
                error: 'Invalid voter'
            });
        }

        const game = await Game.findOne({
            status: 'ongoing'
        }).lean();

        if (!game) {
            return res.json({ prediction: null });
        }

        const prediction = await Prediction.findOne({
            gameId: game.id,
            voterId
        }).lean();

        res.json({
            prediction,
            open: game.rounds.length === 0
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// POST /api/predictions/ongoing
// Create or update one ballot before Round 1.
router.post('/ongoing', async (req, res) => {
    try {
        const {
            voterId,
            winner,
            dhumbleVictim,
            highestScorer,
            firstEliminated
        } = req.body;

        const values = {
            voterId,
            winner,
            dhumbleVictim,
            highestScorer,
            firstEliminated
        };

        // Validate actual integer IDs.
        for (const [field, value] of Object.entries(values)) {
            if (
                value === null ||
                value === undefined ||
                value === '' ||
                !Number.isSafeInteger(Number(value))
            ) {
                return res.status(400).json({
                    error: `Invalid ${field}`
                });
            }
        }

        const numeric = Object.fromEntries(
            Object.entries(values).map(
                ([key, value]) => [key, Number(value)]
            )
        );

        const voter = await User.findOne({
            id: numeric.voterId
        }).lean();

        if (!voter) {
            return res.status(400).json({
                error: 'Select a registered player'
            });
        }

        const game = await Game.findOne({
            status: 'ongoing'
        }).lean();

        if (!game) {
            return res.status(404).json({
                error: 'No ongoing game'
            });
        }

        if (game.rounds.length > 0) {
            return res.status(403).json({
                error: 'Voting closed after Round 1'
            });
        }

        const validPlayerIds = new Set(
            game.players.map(p => Number(p.id))
        );

        for (const field of FIELDS) {
            if (!validPlayerIds.has(numeric[field])) {
                return res.status(400).json({
                    error: `Invalid selection for ${field}`
                });
            }
        }

        const prediction = await Prediction.findOneAndUpdate(
            {
                gameId: game.id,
                voterId: numeric.voterId
            },
            {
                $set: {
                    winner: numeric.winner,
                    dhumbleVictim: numeric.dhumbleVictim,
                    highestScorer: numeric.highestScorer,
                    firstEliminated: numeric.firstEliminated,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    gameId: game.id,
                    voterId: numeric.voterId
                }
            },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );

        // Refresh the voting card on connected homepages.
        req.app.get('io')?.emit('predictionUpdate', {
            gameId: game.id
        });

        res.json({
            success: true,
            prediction
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                error: 'Ballot conflict. Please try again.'
            });
        }

        res.status(500).json({
            error: err.message
        });
    }
});

// GET /api/predictions/results/:gameId
// Grade all ballots from a completed game.
router.get('/results/:gameId', async (req, res) => {
    try {
        const gameId = Number(req.params.gameId);

        if (!Number.isSafeInteger(gameId)) {
            return res.status(400).json({
                error: 'Invalid game ID'
            });
        }

        const game = await Game.findOne({
            id: gameId,
            status: 'completed'
        }).lean();

        if (!game) {
            return res.status(404).json({
                error: 'Completed game not found'
            });
        }

        const predictions = await Prediction.find({
            gameId
        }).lean();

        const actual = getActualResults(game);

        const results = predictions.map(prediction => ({
            voterId: prediction.voterId,
            picks: {
                winner: prediction.winner,
                dhumbleVictim: prediction.dhumbleVictim,
                highestScorer: prediction.highestScorer,
                firstEliminated: prediction.firstEliminated
            },
            ...gradePrediction(prediction, actual)
        }));

        results.sort((a, b) => b.score - a.score);

        res.json({
            gameId,
            actual,
            results
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// GET /api/predictions/badges/monthly
// Best badge earned by each voter this month.
router.get('/badges/monthly', async (req, res) => {
    try {
        const now = new Date();
        const year = Number(req.query.year ?? now.getFullYear());
        const month = Number(req.query.month ?? now.getMonth() + 1);

        if (
            !Number.isInteger(year) ||
            !Number.isInteger(month) ||
            year < 2000 ||
            year > 9999 ||
            month < 1 ||
            month > 12
        ) {
            return res.status(400).json({
                error: 'Invalid year or month'
            });
        }

        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));

        const games = await Game.find({
            status: 'completed',
            date: {
                $gte: start,
                $lt: end
            }
        }).lean();

        const gameIds = games.map(g => g.id);

        const predictions = await Prediction.find({
            gameId: { $in: gameIds }
        }).lean();

        const gamesById = new Map(
            games.map(g => [g.id, g])
        );

        const actualByGame = new Map();
        const badges = {};

        predictions.forEach(prediction => {
            const game = gamesById.get(prediction.gameId);
            if (!game) return;

            if (!actualByGame.has(game.id)) {
                actualByGame.set(
                    game.id,
                    getActualResults(game)
                );
            }

            const graded = gradePrediction(
                prediction,
                actualByGame.get(game.id)
            );

            const id = prediction.voterId;
            const previous = badges[id];

            if (!previous || graded.score > previous.score) {
                badges[id] = {
                    score: graded.score,
                    badge: graded.badge,
                    gameId: game.id
                };
            }
        });

        res.json({
            year,
            month,
            badges
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

module.exports = router;
