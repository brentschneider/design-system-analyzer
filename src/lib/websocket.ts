import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, CrawlProgress, Component, DesignSystemSource } from '../types/types';

class WebSocketClient {
  private socket: Socket | null = null;
  private static instance: WebSocketClient;

  private constructor() {}

  static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io({
          path: '/api/ws',
          transports: ['websocket'],
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', () => {
          console.log('WebSocket disconnected');
        });

      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onProgress(callback: (data: CrawlProgress) => void) {
    this.socket?.on('crawlProgress', (msg: WebSocketMessage) => {
      if (msg.type === 'progress' && msg.progress) {
        callback(msg.progress);
      }
    });
  }

  onStatus(callback: (data: { sourceId: string; status: DesignSystemSource['status']; error?: string }) => void) {
    this.socket?.on('sourceUpdate', (msg: WebSocketMessage) => {
      if (msg.type === 'status' && msg.sourceId && msg.status) {
        callback({
          sourceId: msg.sourceId,
          status: msg.status as DesignSystemSource['status'],
          error: msg.error
        });
      }
    });
  }

  onComponent(callback: (data: Component) => void) {
    this.socket?.on('componentUpdate', (msg: WebSocketMessage) => {
      if (msg.type === 'component' && msg.component) {
        callback(msg.component);
      }
    });
  }

  emit(event: string, data: WebSocketMessage) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.error('WebSocket not connected');
    }
  }
}

export default WebSocketClient.getInstance();
