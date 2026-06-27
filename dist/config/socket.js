"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRedisAdapter = exports.getIO = exports.setIO = void 0;
const redis_adapter_1 = require("@socket.io/redis-adapter");
let io;
const setIO = (ioInstance) => {
    io = ioInstance;
};
exports.setIO = setIO;
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io no ha sido inicializado");
    }
    return io;
};
exports.getIO = getIO;
const redis_1 = require("./redis");
/**
 * Conecta el adaptador Redis a Socket.IO para sincronizar eventos
 * entre múltiples instancias del servidor (escalado horizontal).
 */
const initRedisAdapter = (redisUrl) => __awaiter(void 0, void 0, void 0, function* () {
    if (!redisUrl || !redis_1.redisPublisher || !redis_1.redisSubscriber) {
        console.log("⚠️  [Redis] REDIS_URL no configurada o clientes inactivos. Socket.IO en modo single-instance.");
        return;
    }
    try {
        io.adapter((0, redis_adapter_1.createAdapter)(redis_1.redisPublisher, redis_1.redisSubscriber));
        console.log("✅ [Redis] Adaptador Socket.IO conectado —", redisUrl.replace(/:\/\/.*@/, "://***@"));
    }
    catch (err) {
        // Si Redis falla, el servidor sigue corriendo en modo single-instance
        console.error("❌ [Redis] No se pudo conectar al adaptador. Continuando sin Redis:", err.message);
    }
});
exports.initRedisAdapter = initRedisAdapter;
