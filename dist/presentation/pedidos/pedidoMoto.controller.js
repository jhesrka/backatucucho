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
exports.PedidoMotoController = void 0;
const domain_1 = require("../../domain");
const pedidoMoto_service_1 = require("../services/pedidosServices/pedidoMoto.service");
const Pedido_1 = require("../../data/postgres/models/Pedido");
class PedidoMotoController {
    constructor(pedidoMotoService) {
        this.pedidoMotoService = pedidoMotoService;
        // ======================== Manejo de errores ========================
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        // ======================== Aceptar pedido ========================
        this.aceptarPedido = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { pedidoId } = req.body;
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!pedidoId) {
                    return res.status(400).json({ message: "Falta el pedidoId" });
                }
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const pedido = yield pedidoMoto_service_1.PedidoMotoService.aceptarPedido(pedidoId, motorizadoId);
                return res.status(200).json(pedido);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Rechazar pedido ========================
        this.rechazarPedido = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { pedidoId } = req.body;
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!pedidoId) {
                    return res.status(400).json({ message: "Falta el pedidoId" });
                }
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const pedido = yield pedidoMoto_service_1.PedidoMotoService.rechazarPedido(pedidoId, motorizadoId);
                return res.status(200).json(pedido);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Marcar pedido EN CAMINO ========================
        this.marcarEnCamino = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { pedidoId } = req.body;
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!pedidoId) {
                    return res.status(400).json({ message: "Falta el pedidoId" });
                }
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const pedido = yield pedidoMoto_service_1.PedidoMotoService.marcarEnCamino(pedidoId, motorizadoId);
                return res.status(200).json(pedido);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Entregar pedido ========================
        this.entregarPedido = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { pedidoId } = req.body;
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!pedidoId) {
                    return res.status(400).json({ message: "Falta el pedidoId" });
                }
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const pedido = yield pedidoMoto_service_1.PedidoMotoService.entregarPedido(pedidoId, motorizadoId);
                return res.status(200).json(pedido);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Cancelar pedido ========================
        this.cancelarPedido = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { pedidoId, motivo } = req.body;
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!pedidoId) {
                    return res.status(400).json({ message: "Falta el pedidoId" });
                }
                if (!motivo) {
                    return res.status(400).json({ message: "Falta el motivo cancelacion" });
                }
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const pedido = yield pedidoMoto_service_1.PedidoMotoService.cancelarPedido(pedidoId, motorizadoId, motivo);
                return res.status(200).json(pedido);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Historial ========================
        this.obtenerHistorial = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                const { fechaInicio, fechaFin } = req.query;
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const historial = yield pedidoMoto_service_1.PedidoMotoService.obtenerHistorial(motorizadoId, fechaInicio, fechaFin);
                return res.json(historial);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Billetera ========================
        this.obtenerBilletera = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const billetera = yield pedidoMoto_service_1.PedidoMotoService.obtenerBilletera(motorizadoId);
                return res.json(billetera);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Guardar Datos Bancarios ========================
        this.guardarDatosBancarios = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                const { banco, tipo, numero, titular, identificacion } = req.body;
                if (!motorizadoId) {
                    return res.status(401).json({ message: "No autenticado" });
                }
                const result = yield pedidoMoto_service_1.PedidoMotoService.guardarDatosBancarios(motorizadoId, { banco, tipo, numero, titular, identificacion });
                return res.json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Solicitar Retiro ========================
        this.solicitarRetiro = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                const { monto } = req.body;
                if (!motorizadoId) {
                    return res.status(401).json({ message: "No autenticado" });
                }
                if (!monto) {
                    return res.status(400).json({ message: "Monto requerido" });
                }
                const tx = yield pedidoMoto_service_1.PedidoMotoService.solicitarRetiro(motorizadoId, Number(monto));
                return res.json(tx);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ============================================================
        // 🔍 OBTENER PEDIDO PENDIENTE (refrescar pantalla del motorizado)
        // ============================================================
        this.obtenerPedidoPendiente = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const motorizadoId = ((_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id) || req.body.motorizadoId;
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no identificado" });
                }
                const pedido = yield Pedido_1.Pedido.findOne({
                    where: {
                        motorizadoEnEvaluacion: motorizadoId,
                        estado: Pedido_1.EstadoPedido.PREPARANDO,
                    },
                    relations: ["negocio", "cliente"],
                });
                if (!pedido)
                    return res.json(null);
                // ===========================
                // FIX DE SEGURIDAD (SE MANTIENE)
                // ===========================
                if (!pedido.fechaInicioRonda) {
                    pedido.fechaInicioRonda = new Date();
                    yield pedido.save();
                }
                const expiresAt = pedido.fechaInicioRonda.getTime() + 60000; // 1 minuto
                return res.json({
                    pedidoId: pedido.id,
                    total: pedido.total,
                    negocioId: ((_b = pedido.negocio) === null || _b === void 0 ? void 0 : _b.id) || null,
                    expiresAt,
                    costoEnvio: pedido.costoEnvio, // Ensure this is sent if needed
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ============================================================
        // 🚚 OBTENER PEDIDO ACTIVO (para tab "Activos")
        // ============================================================
        this.obtenerPedidoActivo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                // Usar el servicio para evitar duplicación de lógica y dependencias
                const pedido = yield pedidoMoto_service_1.PedidoMotoService.obtenerPedidoActivo(motorizadoId);
                if (!pedido)
                    return res.json(null);
                return res.json(pedido);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        this.cambiarDisponibilidad = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const motorizadoId = req.body.sessionMotorizado.id;
                const { quiereTrabajar } = req.body;
                if (typeof quiereTrabajar !== "boolean") {
                    return res.status(400).json({ message: "Valor inválido" });
                }
                const result = yield pedidoMoto_service_1.PedidoMotoService.cambiarDisponibilidad(motorizadoId, quiereTrabajar);
                return res.json(result);
            }
            catch (error) {
                if (error instanceof domain_1.CustomError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                return res.status(500).json({ message: "Error interno" });
            }
        });
        this.obtenerEstado = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
                if (!motorizadoId) {
                    return res.status(401).json({ message: "Motorizado no autenticado" });
                }
                const estado = yield pedidoMoto_service_1.PedidoMotoService.obtenerEstadoMotorizado(motorizadoId);
                return res.json(estado);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
    }
}
exports.PedidoMotoController = PedidoMotoController;
