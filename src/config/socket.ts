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
import { Adapter } from "socket.io-adapter";

// Estado global para saber si Redis está activo para Socket.IO y caché local
export let isRedisGloballyEnabled = false;

export const setRedisGlobalState = (enabled: boolean) => {
  isRedisGloballyEnabled = enabled;
};

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
    console.error("❌ [Redis] Error conectando adaptador. Forzando a Local Memory:", err.message);
    setRedisGlobalState(false);
    removeRedisAdapter();
  }
};

/**
 * Restaura el adaptador original en memoria de Socket.IO, apagando la sincronización multi-servidor
 */
export const removeRedisAdapter = (): void => {
  try {
    // Usar el adapter por defecto en memoria
    io.adapter(Adapter);
    console.log("🛑 [Redis] Adaptador Socket.IO desconectado. Servidor operando en modo Single-Instance (Memoria Local).");
  } catch (err: any) {
    console.error("❌ [Redis] Error al intentar remover el adaptador:", err.message);
  }
};
