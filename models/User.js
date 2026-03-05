const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id: { type: Number, unique: true },  // Auto-incremented ID
    name: { type: String, required: true, unique: true },
    totalPoints: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    maxPossible: { type: Number, default: 0 }
});

// Auto-increment ID before saving
userSchema.pre('save', async function () {
    if (!this.id) {
        const lastUser = await this.constructor.findOne().sort('-id').exec();
        this.id = lastUser ? lastUser.id + 1 : 1;
    }
});

module.exports = mongoose.model('User', userSchema);