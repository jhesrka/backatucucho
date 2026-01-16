// src/config/socket.ts
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer;

export const setIO = (ioInstance: SocketIOServer) => {
  io = ioInstance;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error("Socket.io no ha sido inicializado");
  }
  return io;
};
