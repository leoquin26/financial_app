// Socket.io instance manager
let io = null;

const setIo = (ioInstance) => {
    io = ioInstance;
    console.log('Socket.io instance set in manager');
};

const getIo = () => {
    if (!io) {
        console.warn('Socket.io instance not yet initialized');
    }
    return io;
};

module.exports = {
    setIo,
    getIo
};
