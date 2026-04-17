// src/config/socket.ts
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

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

/**
 * Conecta el adaptador Redis a Socket.IO para sincronizar eventos
 * entre múltiples instancias del servidor (escalado horizontal).
 *
 * Si REDIS_URL no está definida, se omite silenciosamente y Socket.IO
 * funciona en modo single-instance (local / desarrollo).
 */
export const initRedisAdapter = async (redisUrl: string): Promise<void> => {
  if (!redisUrl) {
    console.log("⚠️  [Redis] REDIS_URL no configurada. Socket.IO en modo single-instance.");
    return;
  }

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    // Capturar errores de conexión sin tirar el proceso
    pubClient.on("error", (err) => console.error("❌ [Redis] pubClient error:", err.message));
    subClient.on("error", (err) => console.error("❌ [Redis] subClient error:", err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));

    console.log("✅ [Redis] Adaptador Socket.IO conectado —", redisUrl.replace(/:\/\/.*@/, "://***@"));
  } catch (err: any) {
    // Si Redis falla, el servidor sigue corriendo en modo single-instance
    console.error("❌ [Redis] No se pudo conectar al adaptador. Continuando sin Redis:", err.message);
  }
};
