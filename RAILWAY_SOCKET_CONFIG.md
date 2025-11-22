# Railway Socket.IO Configuration Guide

## Problem: Too Many Requests on Railway

Railway has request limits, and Socket.IO's HTTP long-polling fallback can quickly exceed these limits when WebSocket connections fail.

## Solutions Implemented

### 1. **Server-Side Optimizations**

#### Socket Configuration (server/config/socketConfig.js)
- **Production mode**: Uses WebSocket-only transport to avoid polling
- **Increased ping intervals**: Reduces keepalive traffic
- **Message compression**: Only for messages > 1KB
- **Connection limits**: 1MB max message size

#### Rate Limiting (server/middleware/socketRateLimit.js)
- Limits socket events to 20 requests per minute per event type
- Prevents spam and reduces server load
- Automatic cleanup of old rate limit entries

### 2. **Client-Side Optimizations**

#### Socket Context (client/src/contexts/SocketContext.tsx)
- **Production mode**: WebSocket-only transport
- **Increased reconnection delays**: 2-10 seconds in production
- **Error handling**: Detects rate limits and transport errors

### 3. **Environment Variables for Railway**

Add these to your Railway environment:

```env
NODE_ENV=production
PORT=${{PORT}}
CLIENT_URL=https://your-vercel-app.vercel.app
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
```

### 4. **Additional Recommendations**

#### A. Enable WebSocket Support on Railway
1. Go to your Railway service settings
2. Under "Networking", ensure WebSocket support is enabled
3. Use the provided domain for WebSocket connections

#### B. Use a Reverse Proxy (Optional)
If WebSockets still fail, consider using a service like Cloudflare:
1. Route your Railway domain through Cloudflare
2. Enable WebSocket support in Cloudflare
3. Set up proper SSL/TLS

#### C. Implement a Redis Adapter (For Scaling)
```javascript
// In server/index.js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
    });
}
```

#### D. Monitor Socket Connections
Add logging to track connection issues:

```javascript
// In server/index.js
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}, transport: ${socket.conn.transport.name}`);
    
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
});
```

### 5. **Debugging Commands**

To check if WebSockets are working:

```bash
# In browser console when on your app
if (window.socket) {
    console.log('Transport:', window.socket.io.engine.transport.name);
    console.log('Connected:', window.socket.connected);
}
```

### 6. **Alternative: Server-Sent Events (SSE)**

If WebSockets continue to be problematic, consider implementing SSE for server-to-client communication:

```javascript
// Server
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send events
    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    // Clean up on disconnect
    req.on('close', () => {
        // cleanup
    });
});

// Client
const eventSource = new EventSource('/events');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Handle event
};
```

## Testing the Changes

1. Deploy to Railway with new configurations
2. Monitor Railway metrics for request count
3. Check browser console for WebSocket vs polling transport
4. Verify real-time features still work

## Expected Results

- **Reduced requests**: 90%+ reduction in HTTP requests
- **Better performance**: Lower latency for real-time updates
- **Cost savings**: Stay within Railway's request limits
