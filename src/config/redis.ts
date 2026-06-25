import Redis from "ioredis";
import { envs } from "./env";

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null; // Para socket.io-redis
let redisPublisher: Redis | null = null;

if (envs.REDIS_URL) {
  redisClient = new Redis(envs.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisSubscriber = redisClient.duplicate();
  redisPublisher = redisClient.duplicate();

  redisClient.on("error", (err: any) => {
    console.error("Redis Client Error:", err);
  });

  redisClient.on("ready", () => {
    console.log("Conectado a Redis Exitosamente");
  });
} else {
  console.log("No se configuró REDIS_URL. Se usará la memoria local (Solo apto para 1 servidor).");
}

export { redisClient, redisSubscriber, redisPublisher };
