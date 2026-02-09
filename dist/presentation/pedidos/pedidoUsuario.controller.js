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
exports.PedidoUsuarioController = void 0;
const domain_1 = require("../../domain");
const pedidoUsuario_service_1 = require("../services/pedidosServices/pedidoUsuario.service");
class PedidoUsuarioController {
    constructor(pedidoUsuarioService) {
        this.pedidoUsuarioService = pedidoUsuarioService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
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
                // Validar y tipar el body con tu patrón de DTO
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
    }
}
exports.PedidoUsuarioController = PedidoUsuarioController;
