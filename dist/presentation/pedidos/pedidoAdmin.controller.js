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
exports.PedidoAdminController = void 0;
const domain_1 = require("../../domain");
const data_1 = require("../../data");
const pedidoUsuario_service_1 = require("../services/pedidosServices/pedidoUsuario.service");
const data_2 = require("../../data");
class PedidoAdminController {
    constructor(pedidoAdminService) {
        this.pedidoAdminService = pedidoAdminService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            const message = error instanceof Error ? error.message : "Error interno en pedidos admin";
            console.error("Orders Admin Error:", error);
            return res.status(500).json({
                message: `Error de Pedidos (Admin): ${message}`
            });
        };
        // ======================== 1. Obtener pedidos con filtros ========================
        this.obtenerPedidosAdmin = (req, res) => {
            try {
                const { estado, negocioId, motorizadoId, clienteId, desde, hasta, search, limit, offset, } = req.query;
                // Parsear fechas si vienen como string
                const desdeDate = desde ? new Date(desde) : undefined;
                const hastaDate = hasta ? new Date(hasta) : undefined;
                // Validar estado si existe y convertir a enum
                let estadoEnum = undefined;
                if (estado && typeof estado === "string") {
                    if (Object.values(data_1.EstadoPedido).includes(estado)) {
                        estadoEnum = estado;
                    }
                    else {
                        return res.status(400).json({ message: "Estado inválido" });
                    }
                }
                this.pedidoAdminService
                    .getPedidosAdmin({
                    estado: estadoEnum,
                    negocioId: negocioId,
                    motorizadoId: motorizadoId,
                    clienteId: clienteId,
                    desde: desdeDate,
                    hasta: hastaDate,
                    search: search,
                    limit: limit ? parseInt(limit, 10) : 10,
                    offset: offset ? parseInt(offset, 10) : 0,
                })
                    .then(({ total, pedidos }) => {
                    const safePedidos = pedidos.map((p) => ({
                        id: p.id,
                        estado: p.estado,
                        total: p.total,
                        costoEnvio: p.costoEnvio,
                        total_negocio: p.totalNegocio,
                        comision_app_ganancia: p.ganancia_app_producto,
                        ganancia_motorizado: p.ganancia_motorizado,
                        comision_app_domicilio: p.comision_app_domicilio,
                        metodoPago: p.metodoPago,
                        comprobantePagoUrl: p.comprobantePagoUrl,
                        direccionEntrega: p.direccionTexto,
                        referencia: null, // No hay campo de referencia en el modelo actual
                        createdAt: p.createdAt,
                        updatedAt: p.updatedAt,
                        cliente: {
                            id: p.cliente.id,
                            name: p.cliente.name,
                            surname: p.cliente.surname,
                            phone: p.cliente.whatsapp,
                            whatsapp: p.cliente.whatsapp,
                            email: p.cliente.email,
                        },
                        motorizado: p.motorizado
                            ? {
                                id: p.motorizado.id,
                                name: p.motorizado.name,
                                surname: p.motorizado.surname,
                                whatsapp: p.motorizado.whatsapp,
                            }
                            : null,
                        negocio: {
                            id: p.negocio.id,
                            nombre: p.negocio.nombre,
                            direccion: null, // No hay dirección en el modelo abreviado del negocio aquí
                            statusNegocio: p.negocio.statusNegocio,
                            modeloMonetizacion: p.negocio.modeloMonetizacion,
                        },
                        productos: p.productos.map((prod) => {
                            var _a;
                            return ({
                                id: prod.id,
                                nombre: ((_a = prod.producto) === null || _a === void 0 ? void 0 : _a.nombre) || prod.producto_nombre,
                                cantidad: prod.cantidad,
                                precio_unitario: prod.precio_venta,
                                precio_venta: prod.precio_venta,
                                precio_app: prod.precio_app,
                                subtotal: prod.subtotal,
                            });
                        }),
                    }));
                    return res.status(200).json({ total, pedidos: safePedidos });
                })
                    .catch((error) => this.handleError(error, res));
            }
            catch (error) {
                this.handleError(error, res);
            }
        };
        // ======================== 2. Obtener pedido por ID ========================
        this.obtenerPedidoById = (req, res) => {
            const { id } = req.params;
            if (!id)
                return res.status(400).json({ message: "Falta el ID del pedido" });
            this.pedidoAdminService
                .getPedidoById(id)
                .then((pedido) => res.status(200).json(pedido))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 3. Cambiar estado de pedido ========================
        this.cambiarEstadoPedido = (req, res) => {
            const { pedidoId, nuevoEstado } = req.body;
            if (!pedidoId || !nuevoEstado) {
                return res
                    .status(400)
                    .json({ message: "Faltan parámetros: pedidoId o nuevoEstado" });
            }
            if (!Object.values(data_1.EstadoPedido).includes(nuevoEstado)) {
                return res.status(400).json({ message: "Estado inválido" });
            }
            this.pedidoAdminService
                .cambiarEstado({
                pedidoId,
                nuevoEstado,
                userId: req.body.sessionAdmin.id,
            })
                .then((pedido) => res.status(200).json(pedido))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 4. Asignar motorizado ========================
        this.asignarMotorizado = (req, res) => {
            var _a;
            const { pedidoId, motorizadoId } = req.body;
            const adminId = (_a = req.body.sessionAdmin) === null || _a === void 0 ? void 0 : _a.id;
            if (!pedidoId || !motorizadoId) {
                return res
                    .status(400)
                    .json({ message: "Faltan parámetros: pedidoId o motorizadoId" });
            }
            this.pedidoAdminService
                .asignarMotorizado({ pedidoId, motorizadoId }, adminId)
                .then((pedido) => res.status(200).json(pedido))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 4.5. Entregar pedido (EMERGENCIA ADMIN) ========================
        this.entregarPedidoEmergencia = (req, res) => {
            var _a;
            const { pedidoId } = req.body;
            const adminId = (_a = req.body.sessionAdmin) === null || _a === void 0 ? void 0 : _a.id;
            if (!pedidoId) {
                return res.status(400).json({ message: "Falta el parámetro: pedidoId" });
            }
            this.pedidoAdminService
                .entregarPedidoEmergencia(pedidoId, adminId)
                .then((pedido) => res.status(200).json(pedido))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 8. Centro Operativo en Vivo ========================
        this.getLiveControlData = (req, res) => {
            this.pedidoAdminService
                .getLiveControlData()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.liberarMotorizado = (req, res) => {
            var _a;
            const { motorizadoId, comment } = req.body;
            const adminId = (_a = req.body.sessionAdmin) === null || _a === void 0 ? void 0 : _a.id;
            if (!motorizadoId) {
                return res.status(400).json({ message: "Falta motorizadoId" });
            }
            this.pedidoAdminService
                .liberarMotorizado(motorizadoId, adminId, comment || "Acción manual desde Centro Operativo")
                .then((resp) => res.status(200).json(resp))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 5. Eliminar pedidos antiguos ========================
        this.eliminarPedidosAntiguos = (req, res) => {
            const { masterPin } = req.body;
            this.pedidoAdminService
                .purgeOldOrders(masterPin)
                .then(({ deletedCount }) => res.status(200).json({ message: `Purga completada. Pedidos eliminados: ${deletedCount}` }))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 7. Configurar días de retención ========================
        this.configureRetentionDays = (req, res) => {
            const { days, masterPin } = req.body;
            if (!days || isNaN(days)) {
                return res.status(400).json({ message: "Debe proporcionar un número válido de días" });
            }
            if (!masterPin) {
                return res.status(400).json({ message: "Falta el PIN Maestro" });
            }
            this.pedidoAdminService
                .updateRetentionDays(Number(days), masterPin)
                .then((settings) => res.status(200).json(settings))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 6. Motorizado cambia estado a ENTREGADO o CANCELADO ========================
        this.cambiarEstadoPorMotorizado = (req, res) => {
            var _a;
            const { pedidoId, nuevoEstado } = req.body;
            const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
            if (!pedidoId || !nuevoEstado) {
                return res
                    .status(400)
                    .json({ message: "Faltan parámetros: pedidoId o nuevoEstado" });
            }
            if (!motorizadoId) {
                return res.status(401).json({ message: "No autorizado" });
            }
            if (![data_1.EstadoPedido.ENTREGADO, data_1.EstadoPedido.CANCELADO].includes(nuevoEstado)) {
                return res
                    .status(400)
                    .json({ message: "Estado inválido para motorizado" });
            }
            this.pedidoAdminService
                .actualizarEstadoPorMotorizado({
                pedidoId,
                nuevoEstado,
                motorizadoId,
                userId: req.body.sessionMotorizado.id,
            })
                .then((pedido) => res.status(200).json(pedido))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== 7. Estadísticas Admin ========================
        this.getStatsAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield data_2.Pedido.createQueryBuilder("pedido")
                    .select("estado")
                    .addSelect("COUNT(*)", "count")
                    .groupBy("estado")
                    .getRawMany();
                const totalPedidos = yield data_2.Pedido.count();
                return res.status(200).json({
                    total: totalPedidos,
                    byStatus: stats
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ======================== 8. Limpieza Manual ========================
        this.manualCleanup = (req, res) => {
            pedidoUsuario_service_1.PedidoUsuarioService.manualCleanup()
                .then(result => res.json(result))
                .catch(error => this.handleError(error, res));
        };
    }
}
exports.PedidoAdminController = PedidoAdminController;
