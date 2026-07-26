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
exports.removeRedisAdapter = exports.initRedisAdapter = exports.setRedisGlobalState = exports.isRedisGloballyEnabled = exports.getIO = exports.setIO = void 0;
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
const socket_io_adapter_1 = require("socket.io-adapter");
// Estado global para saber si Redis está activo para Socket.IO y caché local
exports.isRedisGloballyEnabled = false;
const setRedisGlobalState = (enabled) => {
    exports.isRedisGloballyEnabled = enabled;
};
exports.setRedisGlobalState = setRedisGlobalState;
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
        console.error("❌ [Redis] Error conectando adaptador. Forzando a Local Memory:", err.message);
        (0, exports.setRedisGlobalState)(false);
        (0, exports.removeRedisAdapter)();
    }
});
exports.initRedisAdapter = initRedisAdapter;
/**
 * Restaura el adaptador original en memoria de Socket.IO, apagando la sincronización multi-servidor
 */
const removeRedisAdapter = () => {
    try {
        // Usar el adapter por defecto en memoria
        io.adapter(socket_io_adapter_1.Adapter);
        console.log("🛑 [Redis] Adaptador Socket.IO desconectado. Servidor operando en modo Single-Instance (Memoria Local).");
    }
    catch (err) {
        console.error("❌ [Redis] Error al intentar remover el adaptador:", err.message);
    }
};
exports.removeRedisAdapter = removeRedisAdapter;
