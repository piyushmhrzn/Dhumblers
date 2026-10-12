
const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
    gameId: {
        type: Number,
        required: true,
        index: true
    },

    voterId: {
        type: Number,
        required: true
    },

    winner: {
        type: Number,
        required: true
    },

    dhumbleVictim: {
        type: Number,
        required: true
    },

    highestScorer: {
        type: Number,
        required: true
    },

    firstEliminated: {
        type: Number,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// One ballot per registered player per game.
predictionSchema.index(
    { gameId: 1, voterId: 1 },
    { unique: true }
);

module.exports = mongoose.model('Prediction', predictionSchema);
