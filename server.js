const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const apiRoutes = require('./routes/api');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());  // Parse JSON bodies
app.use(cors());  // Allow cross-origin (for local testing)

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Serve static files FIRST (important order: static → API → catch-all)
app.use(express.static(path.join(__dirname, 'public')));

// API routes (already mounted at /api)
app.use('/api', apiRoutes);

// Catch-all route: serve index.html for any non-API path
// This makes client-side routing / direct links to game.html, admin.html work
app.get('/*path', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Global error handler - must be last
app.use((err, req, res, next) => {
    console.error('Global error handler caught:', err.stack || err);

    // Force JSON response for API calls
    if (req.originalUrl.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Internal Server Error',
            // stack: err.stack  // uncomment only in dev, remove in production
        });
    }

    // For non-API, fall back to default (HTML) or custom error page
    res.status(err.status || 500).send('Something broke!');
});