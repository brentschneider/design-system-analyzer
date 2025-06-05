import { NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';

export const dynamic = 'force-dynamic';

let io: SocketIOServer | null = null;

export async function GET(req: Request) {
  const upgrade = req.headers.get('upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return new NextResponse('Expected WebSocket connection', { status: 426 });
  }

  if (!io) {
    // Create a new Socket.IO server if one doesn't exist
    io = new SocketIOServer({
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      addTrailingSlash: false
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

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
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  return new NextResponse(null, {
    headers: {
      'content-type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
    },
    status: 101, // Switching Protocols
  });
}
