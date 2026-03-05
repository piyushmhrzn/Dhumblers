const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    id: { type: Number, required: true },  // User ID
    total: { type: Number, default: 0 },
    status: { type: String, default: 'active' },  // 'active' or 'eliminated'
    elimOrder: { type: Number, default: null },
    points: { type: Number, default: 0 }  // Awarded at end
});

const gameSchema = new mongoose.Schema({
    id: { type: Number, unique: true },  // Auto-incremented
    date: { type: Date, default: Date.now },
    elimScore: { type: Number, required: true },
    players: [playerSchema],
    eliminated: [playerSchema],  // Array of eliminated players
    rounds: [{ type: Object }],  // Array of round score objects {playerId: score}
    status: { type: String, default: 'ongoing' }  // 'ongoing' or 'completed'
});

// Auto-increment ID
gameSchema.pre('save', async function () {
    if (!this.id) {
        const lastGame = await this.constructor.findOne().sort('-id').exec();
        this.id = lastGame ? lastGame.id + 1 : 1;
    }
});

module.exports = mongoose.model('Game', gameSchema);