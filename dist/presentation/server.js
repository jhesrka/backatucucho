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
const socket_1 = require("../config/socket"); // Asegúrate de que la ruta sea correcta
const fs_1 = __importDefault(require("fs")); // Importa el módulo fs
const path_1 = __importDefault(require("path")); // Importa el módulo path
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
class Server {
    constructor(options) {
        this.app = (0, express_1.default)();
        this.acceptedOrigins = ["http://localhost:5173"];
        this.port = options.port;
        this.routes = options.routes;
        this.server = http_1.default.createServer(this.app); // Crear servidor HTTP
        this.io = new socket_io_1.Server(this.server, {
            cors: {
                origin: "http://localhost:5173", // ✅ Aquí añadimos CORS para Socket.IO
                methods: ["GET", "POST"],
            },
        }); // Crear instancia de Socket.IO con configuración de CORS
        (0, socket_1.setIO)(this.io); // 🔥 Guardamos la instancia globalmente
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
            this.io.on("connection", (socket) => {
                console.log("Nuevo cliente conectado");
            });
            this.server.listen(this.port, () => {
                console.log(`Server started on port ${this.port}`);
            });
        });
    }
}
exports.Server = Server;
