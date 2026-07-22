import { redisClient } from "../config/redis";

/**
 * Adquiere un candado (lock) en Redis para ejecutar una tarea.
 * Garantiza que en un entorno multi-instancia, solo un servidor ejecute el cron.
 * 
 * @param lockName Nombre único para identificar el candado del cron
 * @param lockTTLSeconds Tiempo máximo (en segundos) que durará el candado (ej: 55 segundos para un cron que corre cada minuto)
 * @param callback Función a ejecutar si se obtiene el candado
 */
export const withRedisLock = async (lockName: string, lockTTLSeconds: number, callback: () => Promise<void>) => {
  if (!redisClient) {
    // Si no hay redis configurado a nivel de conexión, corremos local
    await callback();
    return;
  }

  // Leer configuración global
  try {
    const { GlobalSettings } = require("../data");
    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: 'DESC' } });
    if (settings && settings.useRedisLockForCrons === false) {
      // Si el administrador apagó el switch, ejecutamos localmente sin tocar Redis
      await callback();
      return;
    }
  } catch (error) {
    console.error("[CronLock] Error al leer GlobalSettings:", error);
    // Fallback: si hay error, ejecutamos local para no bloquear los procesos críticos
    await callback();
    return;
  }

  const key = `cron_lock:${lockName}`;
  const now = Date.now();
  
  // SET key value NX EX seconds
  // NX = Solo establecer si no existe
  // EX = Expirar en X segundos
  const acquired = await redisClient.set(key, now.toString(), "EX", lockTTLSeconds, "NX");

  if (acquired) {
    console.log(`[CronLock] 🔒 Candado adquirido para '${lockName}'`);
    try {
      await callback();
    } catch (err) {
      console.error(`[CronLock] ❌ Error ejecutando '${lockName}':`, err);
    } finally {
      // Opcional: Podríamos liberar el lock aquí con DEL, pero en crons frecuentes
      // a veces es mejor dejar que expire por el TTL para evitar que otro nodo lo tome muy pronto.
      // Lo dejaremos expirar según el TTL para asegurar una ejecución única en el ciclo.
    }
  } else {
    // Otro servidor ya está ejecutando el cron
    console.log(`[CronLock] 🚫 '${lockName}' ya está siendo ejecutado por otra instancia.`);
  }
};
