module.exports = {
    // Production optimizations for Railway
    production: {
        // Connection settings
        pingTimeout: 60000, // 60 seconds (increase for poor connections)
        pingInterval: 25000, // 25 seconds
        transports: ['websocket'], // Prefer websocket only in production
        allowUpgrades: false, // Don't upgrade from polling to websocket
        
        // Performance settings
        perMessageDeflate: {
            threshold: 1024, // Only compress messages larger than 1KB
            zlibDeflateOptions: {
                level: 6 // Compression level (1-9)
            }
        },
        httpCompression: true,
        
        // Security and limits
        maxHttpBufferSize: 1e6, // 1MB max message size
        connectTimeout: 45000, // 45 seconds to establish connection
        
        // CORS settings
        cors: {
            origin: process.env.CLIENT_URL || "https://your-app.vercel.app",
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            credentials: true
        }
    },
    
    // Development settings
    development: {
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
        allowUpgrades: true,
        
        perMessageDeflate: false, // Disable compression in dev for better debugging
        httpCompression: false,
        
        maxHttpBufferSize: 1e7, // 10MB in development
        connectTimeout: 10000,
        
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            credentials: true
        }
    }
};
