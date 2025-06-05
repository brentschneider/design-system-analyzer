import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';

export function initSocketIO(httpServer: NetServer) {
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
  });

  io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('crawlProgress', (data) => {
      socket.broadcast.emit('crawlProgress', data);
    });

    socket.on('componentUpdate', (data) => {
      socket.broadcast.emit('componentUpdate', data);
    });

    socket.on('sourceUpdate', (data) => {
      socket.broadcast.emit('sourceUpdate', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  return io;
}
