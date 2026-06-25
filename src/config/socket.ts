// src/config/socket.ts
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";


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

import { redisPublisher, redisSubscriber } from "./redis";

/**
 * Conecta el adaptador Redis a Socket.IO para sincronizar eventos
 * entre múltiples instancias del servidor (escalado horizontal).
 */
export const initRedisAdapter = async (redisUrl: string): Promise<void> => {
  if (!redisUrl || !redisPublisher || !redisSubscriber) {
    console.log("⚠️  [Redis] REDIS_URL no configurada o clientes inactivos. Socket.IO en modo single-instance.");
    return;
  }

  try {
    io.adapter(createAdapter(redisPublisher, redisSubscriber));
    console.log("✅ [Redis] Adaptador Socket.IO conectado —", redisUrl.replace(/:\/\/.*@/, "://***@"));
  } catch (err: any) {
    // Si Redis falla, el servidor sigue corriendo en modo single-instance
    console.error("❌ [Redis] No se pudo conectar al adaptador. Continuando sin Redis:", err.message);
  }
};
