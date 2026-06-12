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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
// src/server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const socket_1 = require("../config/socket");
const config_1 = require("../config");
const fs_1 = __importDefault(require("fs")); // Importa el módulo fs
const path_1 = __importDefault(require("path")); // Importa el módulo path
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
const data_1 = require("../data");
// Caché en memoria para la última ubicación conocida de cada pedido
const trackingMemoria = new Map();
class Server {
    constructor(options) {
        this.app = (0, express_1.default)();
        this.acceptedOrigins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://192.168.100.19:5173",
            "http://192.168.100.19:5174",
            "https://atucuchoshop.vercel.app",
            "https://atucucho.shop"
        ];
        this.port = options.port;
        this.routes = options.routes;
        this.server = http_1.default.createServer(this.app); // Crear servidor HTTP
        this.io = new socket_io_1.Server(this.server, {
            cors: {
                origin: [
                    "http://localhost:5173",
                    "http://localhost:5174",
                    "http://192.168.100.19:5173",
                    "http://192.168.100.19:5174",
                    "https://atucuchoshop.vercel.app",
                    "https://atucucho.shop"
                ], // ✅ CORS para Socket.IO (desarrollo y producción)
                methods: ["GET", "POST"],
            },
        }); // Crear instancia de Socket.IO con configuración de CORS
        (0, socket_1.setIO)(this.io); // 🔥 Guardamos la instancia globalmente
        // 🔴 Redis adapter (activo solo si REDIS_URL está en el .env)
        (0, socket_1.initRedisAdapter)(config_1.envs.REDIS_URL);
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // Asegurarse de que el directorio "uploads" exista
            const uploadsPath = path_1.default.join(__dirname, "uploads"); // Obtiene la ruta absoluta para 'uploads'
            if (!fs_1.default.existsSync(uploadsPath)) {
                // Verifica si el directorio 'uploads' existe
                fs_1.default.mkdirSync(uploadsPath); // Si no existe, lo crea
            }
            this.app.use((0, cors_1.default)({
                origin: (origin, callback) => {
                    if (!origin) {
                        return callback(null, true);
                    }
                    if (this.acceptedOrigins.includes(origin)) {
                        return callback(null, true);
                    }
                    return callback(new Error("Not allwed by CORS"));
                },
            }));
            this.app.use(express_1.default.json());
            this.app.use(express_1.default.urlencoded({ extended: true }));
            this.app.use((0, hpp_1.default)());
            this.app.use((0, helmet_1.default)()); // esto es una seguridad
            this.app.use(this.routes);
            // Servir archivos estáticos
            this.app.use("/uploads", express_1.default.static(uploadsPath));
            this.app.use("/comprobantes", express_1.default.static(path_1.default.join(uploadsPath, "comprobantes")));
            this.io.on("connection", (socket) => {
                socket.on("join_motorizado", (motorizadoId) => __awaiter(this, void 0, void 0, function* () {
                    socket.join(motorizadoId);
                    try {
                        // Usamos query builder directo para evitar que se dispare @UpdateDateColumn
                        yield data_1.UserMotorizado.getRepository().createQueryBuilder()
                            .update()
                            .set({ lastSeenAt: new Date() })
                            .where("id = :id", { id: motorizadoId })
                            .execute();
                    }
                    catch (e) {
                        console.error("Error updating motorizado lastSeenAt", e);
                    }
                }));
                socket.on("join_business", (businessId) => {
                    console.log(`🏠 [Socket] Negocio unido a la sala: ${businessId}`);
                    socket.join(businessId);
                });
                socket.on("join_user", (userId) => {
                    socket.join(userId);
                });
                // --- TRACKING TIEMPO REAL MOTORIZADOS ---
                socket.on("join_pedido_room", (pedidoId) => {
                    socket.join(`pedido_${pedidoId}`);
                    // Si hay una última ubicación guardada en memoria, enviarla inmediatamente al cliente
                    if (trackingMemoria.has(pedidoId)) {
                        socket.emit("ubicacion_actualizada", trackingMemoria.get(pedidoId));
                    }
                });
                socket.on("leave_pedido_room", (pedidoId) => {
                    socket.leave(`pedido_${pedidoId}`);
                    // Opcional: Podríamos borrar de trackingMemoria aquí, pero mejor mantenerla 
                    // por si el cliente cierra y abre la tarjeta rápido.
                });
                socket.on("ubicacion_motorizado", (data) => {
                    // Guardar la última ubicación conocida
                    trackingMemoria.set(data.pedidoId, data);
                    // Retransmitir la ubicación a la sala
                    socket.to(`pedido_${data.pedidoId}`).emit("ubicacion_actualizada", data);
                });
                socket.on("pedir_ubicacion_forzada", (pedidoId) => {
                    // Enviar un ping silencioso a los motorizados en esta sala para que envíen sus coordenadas
                    socket.to(`pedido_${pedidoId}`).emit("forzar_gps");
                });
            });
            this.server.listen(this.port, "0.0.0.0", () => {
                console.log(`Server started on port ${this.port}`);
            });
        });
    }
}
exports.Server = Server;
