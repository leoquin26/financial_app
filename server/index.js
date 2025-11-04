const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { setIo, getIo } = require('./utils/socketManager');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories');
const budgetRoutes = require('./routes/budgets');
const dashboardRoutes = require('./routes/dashboard');
const { router: notificationRoutes } = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const householdRoutes = require('./routes/households');

// Import MongoDB connection
const connectDB = require('./config/database');

// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting in development
    skip: () => process.env.NODE_ENV === 'development'
});

// Middleware
app.use(helmet());
app.use(compression());

// Trust proxy for rate limiting to work correctly
app.set('trust proxy', 1);

// CORS configuration for production and development
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.CLIENT_URL,
            'http://localhost:3000',
            'http://localhost:5000',
            'https://localhost:3000'
        ].filter(Boolean);
        
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/households', householdRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    });
}

// WebSocket connection for real-time updates
// Store io instance in manager
setIo(io);

// Export io for use in other modules (backward compatibility)
app.set('io', io);

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join user to their personal room
    socket.on('join-user-room', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined their room`);
    });
    
    // Handle transaction updates
    socket.on('transaction-update', (data) => {
        // Broadcast to all clients in the user's room
        io.to(`user-${data.userId}`).emit('transaction-updated', data);
    });
    
    // Handle budget updates
    socket.on('budget-update', (data) => {
        io.to(`user-${data.userId}`).emit('budget-updated', data);
    });
    
    // Handle category updates
    socket.on('category-update', (data) => {
        io.to(`user-${data.userId}`).emit('category-updated', data);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Initialize database
connectDB().then(() => {
    const PORT = process.env.PORT || 5000;
    
    // For Vercel, we export the app instead of listening
    if (process.env.VERCEL) {
        module.exports = app;
        console.log('Running on Vercel');
    } else {
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`WebSocket server ready for real-time updates`);
        });
    }
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    if (!process.env.VERCEL) {
        process.exit(1);
    }
});

// Export for Vercel and io instance
module.exports = app;
module.exports.getIo = getIo;

// For Vercel serverless
if (process.env.VERCEL) {
    module.exports = app;
}
