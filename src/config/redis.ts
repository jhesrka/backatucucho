import Redis from "ioredis";
import { envs } from "./env";

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null; // Para socket.io-redis
let redisPublisher: Redis | null = null;

if (envs.REDIS_URL) {
  redisClient = new Redis(envs.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true, // 🔥 EVITA CONEXIÓN HASTA QUE SE USE
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisSubscriber = redisClient.duplicate();
  redisPublisher = redisClient.duplicate();

  const silenceLimitError = (err: any) => {
    if (err && err.message && err.message.includes("max requests limit exceeded")) return;
    console.error("Redis Client Error:", err.message);
  };

  redisClient.on("error", silenceLimitError);
  redisSubscriber.on("error", silenceLimitError);
  redisPublisher.on("error", silenceLimitError);

  redisClient.on("ready", () => {
    console.log("Conectado a Redis Exitosamente");
  });
} else {
  console.log("No se configuró REDIS_URL. Se usará la memoria local (Solo apto para 1 servidor).");
}

export { redisClient, redisSubscriber, redisPublisher };
