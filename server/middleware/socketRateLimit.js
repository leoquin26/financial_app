const rateLimitMap = new Map();

// Clean up old entries every hour
setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((value, key) => {
        if (now - value.resetTime > 3600000) { // 1 hour
            rateLimitMap.delete(key);
        }
    });
}, 3600000);

const socketRateLimit = (eventName, maxRequests = 10, windowMs = 60000) => {
    return (socket, next) => {
        const clientId = socket.id;
        const key = `${clientId}:${eventName}`;
        const now = Date.now();
        
        if (!rateLimitMap.has(key)) {
            rateLimitMap.set(key, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }
        
        const limit = rateLimitMap.get(key);
        
        if (now > limit.resetTime) {
            // Reset the window
            limit.count = 1;
            limit.resetTime = now + windowMs;
            return next();
        }
        
        if (limit.count >= maxRequests) {
            const error = new Error('Too many requests');
            error.data = { 
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Too many ${eventName} requests. Please try again later.`
            };
            return next(error);
        }
        
        limit.count++;
        next();
    };
};

module.exports = socketRateLimit;
