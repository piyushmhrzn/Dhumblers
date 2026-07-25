const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    gameId: { type: Number, required: true },
    playerA: { type: Number, required: true },
    playerB: { type: Number, required: true },
    stake: { type: Number, required: true },

    // Filled automatically when game finishes
    playerAPoints: { type: Number, default: 0 },
    playerBPoints: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    payout: { type: Number, default: 0 },
    winner: { type: Number, default: null },
    status: { type: String, enum: ['pending', 'settled', 'draw'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

// Auto Increment
betSchema.pre('save', async function () {

    if (!this.id) {

        const last = await this.constructor
            .findOne()
            .sort('-id')
            .exec();

        this.id = last ? last.id + 1 : 1;
    }

});

module.exports = mongoose.model('Bet', betSchema);