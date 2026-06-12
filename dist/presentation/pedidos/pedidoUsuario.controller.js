"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.PedidoUsuarioController = void 0;
const domain_1 = require("../../domain");
const pedidoUsuario_service_1 = require("../services/pedidosServices/pedidoUsuario.service");
const data_1 = require("../../data");
class PedidoUsuarioController {
    constructor(pedidoUsuarioService) {
        this.pedidoUsuarioService = pedidoUsuarioService;
        this.handleError = (error, res) => {
            var _a;
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            // Capture axios (Payphone) error body
            const axiosError = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data;
            if (axiosError) {
                return res.status(400).json({
                    message: axiosError.message || JSON.stringify(axiosError)
                });
            }
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message
            });
        };
        // ======================== Calcular envío ========================
        this.calcularEnvio = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { negocioId, lat, lng } = req.body;
                if (!negocioId || !lat || !lng) {
                    return res
                        .status(400)
                        .json({ message: "Faltan datos: negocioId, lat o lng" });
                }
                const result = yield pedidoUsuario_service_1.PedidoUsuarioService.calcularEnvio({
                    negocioId,
                    lat,
                    lng,
                });
                return res.status(200).json(result); // { distanciaKm, costoEnvio }
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Subir Comprobante ========================
        this.subirComprobante = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const file = req.file;
                if (!file) {
                    return res.status(400).json({ message: "No se subió ningún archivo" });
                }
                const result = yield this.pedidoUsuarioService.subirComprobante(file);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Crear pedido ========================
        this.crearPedido = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                // 🥈 BACKEND – VALIDAR AUTH
                if (!req.body.sessionUser) {
                    return res.status(401).json({ message: "No autenticado" });
                }
                // Inyectar clienteId de la sesión si falta
                if (!req.body.clienteId)
                    req.body.clienteId = req.body.sessionUser.id;
                const [err, dto] = domain_1.CreatePedidoDTO.create(req.body);
                if (err)
                    return res.status(400).json({ message: err });
                const pedido = yield this.pedidoUsuarioService.crearPedido(dto);
                return res.status(201).json(pedido);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Obtener pedidos de un cliente ========================
        this.obtenerPedidosCliente = (req, res) => {
            const clienteId = req.params.clienteId;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 5;
            const filters = {
                estado: req.query.estado,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
            };
            if (!clienteId) {
                return res.status(400).json({ message: "Falta el ID del cliente" });
            }
            this.pedidoUsuarioService
                .obtenerPedidosCliente(clienteId, page, limit, filters)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== Obtener productos de un pedido ========================
        this.obtenerProductosPorPedido = (req, res) => {
            const pedidoId = req.params.pedidoId;
            const clienteId = req.params.clienteId;
            if (!pedidoId) {
                return res.status(400).json({ message: "Falta el ID del pedido" });
            }
            if (!clienteId) {
                return res.status(400).json({ message: "Falta el ID del cliente" });
            }
            this.pedidoUsuarioService
                .obtenerProductosPorPedido(pedidoId, clienteId)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== Eliminar pedido del cliente ========================
        this.eliminarPedidoCliente = (req, res) => {
            const pedidoId = req.params.pedidoId;
            const clienteId = req.params.clienteId; // 👈 igual que en obtenerPedidosCliente
            if (!pedidoId) {
                return res.status(400).json({ message: "Falta el ID del pedido" });
            }
            if (!clienteId) {
                return res.status(400).json({ message: "Falta el ID del cliente" });
            }
            this.pedidoUsuarioService
                .eliminarPedidoCliente(pedidoId, clienteId)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.notificarYaVoy = (req, res) => {
            const { pedidoId, clienteId } = req.body;
            if (!pedidoId || !clienteId) {
                return res.status(400).json({ message: "Faltan datos: pedidoId o clienteId" });
            }
            this.pedidoUsuarioService
                .notificarYaVoy(pedidoId, clienteId)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.calificarPedido = (req, res) => {
            const [err, dto] = domain_1.CalificarPedidoDTO.create(req.body);
            if (err)
                return res.status(400).json({ message: err });
            this.pedidoUsuarioService
                .calificarPedido(dto)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.cancelarPedidoPorDemora = (req, res) => {
            var _a;
            const { pedidoId } = req.body;
            const clienteId = (_a = req.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
            if (!pedidoId)
                return res.status(400).json({ message: "Falta pedidoId" });
            if (!clienteId)
                return res.status(401).json({ message: "No autenticado" });
            this.pedidoUsuarioService
                .cancelarPedidoPorDemora(pedidoId, clienteId)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.confirmarPago = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, clientTransactionId } = req.body;
                if (!id || !clientTransactionId) {
                    return res.status(400).json({ message: "Faltan id o clientTransactionId" });
                }
                const result = yield this.pedidoUsuarioService.confirmarPago(id, clientTransactionId);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        this.refreshTimer = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, minutosExtras } = req.body;
                const result = yield this.pedidoUsuarioService.refreshTimer(id, minutosExtras);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        this.processSubscriptions = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { SubscriptionService } = yield Promise.resolve().then(() => __importStar(require("../services/subscription.service")));
                const subService = new SubscriptionService();
                const result = yield subService.processDailySubscriptions();
                return res.status(200).json({
                    success: true,
                    message: "Proceso de suscripciones ejecutado",
                    detail: result
                });
            }
            catch (error) {
                return res.status(500).json({ message: "Error", error: error.message });
            }
        });
        this.runSqlUpdate = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = data_1.Pedido.getRepository();
                // 1. Limpiar espacios traicioneros en la BD
                yield repo.query("UPDATE negocio SET payphone_store_id = TRIM(payphone_store_id), payphone_token = TRIM(payphone_token)");
                // 2. Intentar forzar los valores
                try {
                    yield repo.query("ALTER TYPE pedido_metodopago_enum ADD VALUE IF NOT EXISTS 'TARJETA'");
                }
                catch (e) { }
                try {
                    yield repo.query("ALTER TYPE pedido_estado_enum ADD VALUE IF NOT EXISTS 'PENDIENTE_PAGO'");
                }
                catch (e) { }
                // 3. Agregar columnas faltantes si no existen
                yield repo.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "tiempoPreparacionMin" INT DEFAULT 15`);
                yield repo.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "tiempoPreparacionMax" INT DEFAULT 30`);
                yield repo.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "permiteProductosProgramados" BOOLEAN DEFAULT false`);
                yield repo.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "tiempoProgramadoMin" INT DEFAULT NULL`);
                yield repo.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "tiempoProgramadoMax" INT DEFAULT NULL`);
                yield repo.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "fecha_aceptado" TIMESTAMPTZ DEFAULT NULL`);
                yield repo.query(`ALTER TABLE "pedido" ALTER COLUMN "fecha_aceptado" TYPE TIMESTAMPTZ`);
                yield repo.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "tiempoPreparacionElegido" INT DEFAULT NULL`);
                yield repo.query(`ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "tipoProducto" VARCHAR DEFAULT 'NORMAL'`);
                // 4. Llenar fecha_aceptado para pedidos existentes (Self-healing)
                yield repo.query(`UPDATE "pedido" SET "fecha_aceptado" = "createdAt" WHERE "fecha_aceptado" IS NULL AND "estado" IN ('ACEPTADO', 'PREPARANDO', 'PREPARANDO_ASIGNADO', 'PREPARANDO_NO_ASIGNADO', 'EN_CAMINO', 'ENTREGADO')`);
                // 5. Consultar valores REALES del negocio específico
                const business = yield repo.query("SELECT id, nombre, payphone_store_id, " + '"pago_tarjeta_habilitado_admin"' + " as enabled FROM negocio WHERE id = '36a53408-4d75-4f96-928b-a8ffb840e753'");
                return res.status(200).json({
                    success: true,
                    status: "DB UPDATED & CLEANED",
                    business: business[0]
                });
            }
            catch (error) {
                return res.status(500).json({ message: "Error", error: error.message });
            }
        });
    }
}
exports.PedidoUsuarioController = PedidoUsuarioController;
