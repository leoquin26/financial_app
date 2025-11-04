const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const authMiddleware = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

const optionalAuth = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.userId;
            req.user = decoded;
        }
        next();
    } catch (error) {
        // Token is invalid but we continue anyway
        next();
    }
};

const generateToken = (userId, email, username) => {
    return jwt.sign(
        { userId, email, username },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

module.exports = {
    authMiddleware,
    optionalAuth,
    generateToken,
    JWT_SECRET
};
