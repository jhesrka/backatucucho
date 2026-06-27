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
exports.PedidoUsuarioService = void 0;
const typeorm_1 = require("typeorm");
const socket_1 = require("../../../config/socket");
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
const upload_files_cloud_adapter_1 = require("../../../config/upload-files-cloud-adapter");
const env_1 = require("../../../config/env");
const calcularEnvio_service_1 = require("./calcularEnvio.service");
const payphone_service_1 = require("../payphone.service");
const NotificationService_1 = require("../NotificationService");
const notificationService = new NotificationService_1.NotificationService();
class PedidoUsuarioService {
    static calcularEnvio(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id: dto.negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (!dto.lat || !dto.lng)
                throw domain_1.CustomError.badRequest("Coordenadas inválidas");
            const { distanciaKm, costoEnvio } = yield calcularEnvio_service_1.CalcularEnvioService.calcularParaPedido({
                negocio,
                latCliente: dto.lat,
                lngCliente: dto.lng,
            });
            return { distanciaKm, costoEnvio };
        });
    }
    confirmarPago(id, clientTxId) {
        return __awaiter(this, void 0, void 0, function* () {
            const realOrderId = clientTxId.includes('--') ? clientTxId.split('--')[0] : clientTxId;
            const pedido = yield data_1.Pedido.findOne({
                where: { id: realOrderId },
                relations: ["negocio", "cliente", "productos", "productos.producto"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (!pedido.negocio.payphone_token)
                throw domain_1.CustomError.badRequest("Negocio sin token Payphone");
            const result = yield payphone_service_1.PayphoneService.confirmPayment(id, clientTxId, pedido.negocio.payphone_token);
            if (result && (result.transactionStatus === "Approved" ||
                result.status === "Approved" ||
                result.transactionStatus === "approved" ||
                result.status === "approved" ||
                Number(result.statusCode) === 3)) {
                pedido.estado = data_1.EstadoPedido.PENDIENTE;
                pedido.estadoPago = "PAGADO";
                pedido.referenciaPago = id.toString();
                yield pedido.save();
                yield pedido.save();
                (0, socket_1.getIO)().to(pedido.negocio.id).emit("nuevo_pedido", {
                    id: pedido.id, estado: pedido.estado, total: pedido.total, productos: pedido.productos,
                    cliente: { id: pedido.cliente.id, name: pedido.cliente.name, surname: pedido.cliente.surname },
                    createdAt: pedido.createdAt,
                    notaGeneral: pedido.notaGeneral
                });
                (0, socket_1.getIO)().to(pedido.cliente.id).emit("pedido_actualizado", {
                    id: pedido.id,
                    estado: pedido.estado,
                    estadoPago: pedido.estadoPago,
                    referenciaPago: pedido.referenciaPago
                });
                // 🔔 Notificación Push al Dueño de Negocio
                if (pedido.negocio.usuario) {
                    yield notificationService.sendPushNotification(pedido.negocio.usuario.id, "¡Nuevo Pedido Recibido!", `Has recibido un nuevo pedido (#${pedido.id.split('-')[0]}) por $${pedido.total}`, { url: `/business/dashboard/${pedido.negocio.id}/orders/pending` });
                }
                return { success: true, status: result.transactionStatus || result.status };
            }
            return { success: false, status: result.transactionStatus || result.status, message: "El pago no fue aprobado por el banco." };
        });
    }
    crearPedido(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const { clienteId, negocioId, productos, ubicacionCliente, metodoPago, comprobantePagoUrl } = dto;
            const cliente = yield data_1.User.findOneBy({ id: clienteId });
            const negocio = yield data_1.Negocio.findOneBy({ id: negocioId });
            if (!cliente || !negocio)
                throw domain_1.CustomError.notFound("No encontrado");
            const config = yield data_1.PriceSettings.findOne({ where: {} });
            const percMoto = config ? Number(config.motorizadoPercentage) : 80;
            const percApp = config ? Number(config.appPercentage) : 20;
            const dbStore = yield data_1.Producto.findBy({ id: (0, typeorm_1.In)(productos.map(p => p.productoId)) });
            let totalVP = 0;
            let totalApp = 0;
            let comAppProd = 0;
            const items = productos.map(item => {
                const p = dbStore.find(db => db.id === item.productoId);
                if (!p)
                    throw domain_1.CustomError.notFound("Producto no encontrado");
                // 🛡️ Regla de Negocio: Pedidos Programados no aceptan EFECTIVO
                if (p.tipoProducto === 'PROGRAMADO' && metodoPago === 'EFECTIVO') {
                    throw domain_1.CustomError.badRequest("Los pedidos programados solo aceptan Transferencia o Tarjeta. No se permite efectivo.");
                }
                const pp = new data_1.ProductoPedido();
                pp.producto = p;
                pp.cantidad = item.cantidad;
                pp.precio_venta = p.precio_venta;
                pp.precio_app = p.precio_app;
                // ✅ Snapshot para históricos invariables
                pp.producto_nombre = p.nombre;
                pp.producto_imagen = p.imagen;
                pp.subtotal = +(pp.cantidad * p.precio_app).toFixed(2);
                totalVP += (p.precio_venta * pp.cantidad);
                totalApp += (p.precio_app * pp.cantidad);
                comAppProd += ((p.precio_venta - p.precio_app) * pp.cantidad);
                return pp;
            });
            const { costoEnvio, distanciaKm, recargoPico, isPeakHour } = yield calcularEnvio_service_1.CalcularEnvioService.calcularParaPedido({
                negocio, latCliente: ubicacionCliente.lat, lngCliente: ubicacionCliente.lng,
            });
            const costoEnvioBase = costoEnvio - (recargoPico || 0);
            const gananciaMotoBase = +(costoEnvioBase * (percMoto / 100)).toFixed(2);
            const comisionAppEnvioBase = +(costoEnvioBase - gananciaMotoBase).toFixed(2);
            let peakHourSurchargeMoto = 0;
            let peakHourSurchargeApp = 0;
            if (isPeakHour && recargoPico > 0) {
                peakHourSurchargeMoto = +(recargoPico * (percMoto / 100)).toFixed(2);
                peakHourSurchargeApp = +(recargoPico - peakHourSurchargeMoto).toFixed(2);
            }
            const gananciaMoto = +(gananciaMotoBase + peakHourSurchargeMoto).toFixed(2);
            const comisionAppEnvio = +(comisionAppEnvioBase + peakHourSurchargeApp).toFixed(2);
            const total = +(totalVP + costoEnvio).toFixed(2);
            let recargo = 0;
            if (metodoPago === "TARJETA") {
                recargo = +(total * ((Number(negocio.porcentaje_recargo_tarjeta) || 0) / 100)).toFixed(2);
            }
            const pedido = new data_1.Pedido();
            pedido.cliente = cliente;
            pedido.negocio = negocio;
            pedido.estado = metodoPago === "TARJETA" ? "PENDIENTE_PAGO" : data_1.EstadoPedido.PENDIENTE;
            pedido.total = +(total + recargo).toFixed(2);
            pedido.costoEnvio = costoEnvio;
            pedido.distanciaKm = distanciaKm;
            pedido.latCliente = ubicacionCliente.lat;
            pedido.lngCliente = ubicacionCliente.lng;
            pedido.direccionTexto = ubicacionCliente.direccionTexto || null;
            pedido.notaGeneral = dto.notaGeneral || null;
            pedido.metodoPago = metodoPago;
            pedido.comprobantePagoUrl = comprobantePagoUrl || null;
            pedido.productos = items;
            // ... audit fields
            pedido.ganancia_app_producto = comAppProd;
            pedido.totalNegocio = totalApp;
            pedido.total_precio_venta_publico = totalVP;
            pedido.total_precio_app = totalApp;
            pedido.total_comision_productos = comAppProd;
            pedido.ganancia_motorizado = gananciaMoto;
            pedido.comision_app_domicilio = comisionAppEnvio;
            pedido.isPeakHourSurchargeApplied = isPeakHour || false;
            pedido.peakHourSurchargeAmount = recargoPico || 0;
            pedido.peakHourSurchargeMoto = peakHourSurchargeMoto || 0;
            pedido.peakHourSurchargeApp = peakHourSurchargeApp || 0;
            const guardado = yield pedido.save();
            let payphone = null;
            if (metodoPago === "TARJETA") {
                const amountInCents = Math.round(pedido.total * 100);
                const generatedClientTxId = `${guardado.id}--${Math.random().toString(36).substring(7)}`;
                guardado.referenciaPago = generatedClientTxId;
                yield guardado.save();
                payphone = {
                    token: negocio.payphone_token, storeId: negocio.payphone_store_id,
                    clientTransactionId: generatedClientTxId,
                    amount: amountInCents,
                    amountWithoutTax: amountInCents,
                    amountWithTax: 0,
                    tax: 0,
                    reference: `Pedido #${guardado.id.split('-')[0]}`,
                    currency: "USD"
                };
            }
            if (metodoPago !== "TARJETA") {
                (0, socket_1.getIO)().to(negocio.id).emit("nuevo_pedido", { id: guardado.id, estado: guardado.estado, total: guardado.total, notaGeneral: guardado.notaGeneral });
                // 🔔 Notificación Push al Dueño de Negocio
                if (negocio.usuario) {
                    yield notificationService.sendPushNotification(negocio.usuario.id, "¡Nuevo Pedido Recibido!", `Has recibido un nuevo pedido (#${guardado.id.split('-')[0]}) por $${pedido.total}`, { url: `/business/dashboard/${negocio.id}/orders/pending` });
                }
            }
            return { id: guardado.id, estado: guardado.estado, total: guardado.total, payphoneConfig: payphone };
        });
    }
    obtenerPedidosCliente(clienteId_1) {
        return __awaiter(this, arguments, void 0, function* (clienteId, page = 1, limit = 5, filters = {}) {
            const skip = (page - 1) * limit;
            const query = data_1.Pedido.createQueryBuilder("pedido")
                .leftJoin("pedido.negocio", "negocio")
                .leftJoin("pedido.productos", "productos")
                .leftJoin("productos.producto", "producto")
                .leftJoin("pedido.cliente", "cliente")
                .leftJoin("pedido.motorizado", "motorizado")
                .select([
                "pedido.id", "pedido.estado", "pedido.estadoPago", "pedido.referenciaPago", "pedido.total", "pedido.costoEnvio", "pedido.createdAt", "pedido.fecha_aceptado",
                "pedido.tiempoPreparacionElegido", "pedido.latCliente", "pedido.lngCliente", "pedido.metodoPago", "pedido.comprobantePagoUrl",
                "pedido.delivery_code", "pedido.arrival_time", "pedido.pickup_code", "pedido.motivoCancelacion", "pedido.ratingNegocio", "pedido.ratingMotorizado",
                "pedido.isPeakHourSurchargeApplied", "pedido.peakHourSurchargeAmount", "pedido.peakHourSurchargeMoto", "pedido.peakHourSurchargeApp", "pedido.notaGeneral",
                "negocio.id", "negocio.nombre", "negocio.latitud", "negocio.longitud", "negocio.tiempoPreparacionMax",
                "productos.id", "productos.cantidad", "productos.subtotal", "productos.precio_venta", "productos.producto_nombre", "productos.producto_imagen",
                "producto.id", "producto.nombre", "producto.tipoProducto",
                "cliente.id", "cliente.name", "cliente.surname", "cliente.whatsapp", "cliente.cancellation_strikes",
                "motorizado.id", "motorizado.name", "motorizado.surname", "motorizado.whatsapp"
            ]);
            // 🛡️ FILTRO PRINCIPAL: CLIENTE + FECHA (Prioritario)
            query.where("pedido.clienteId = :clienteId", { clienteId });
            if (filters.startDate) {
                // 🚀 Búsqueda optimizada por rango (Index-Friendly)
                const nextDay = new Date(filters.startDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = nextDay.toISOString().split('T')[0];
                query.andWhere(`pedido.createdAt >= :startDate AND pedido.createdAt < :endDate`, {
                    startDate: `${filters.startDate} 00:00:00`,
                    endDate: `${nextDayStr} 00:00:00`
                });
            }
            if (filters.estado) {
                query.andWhere("pedido.estado = :estado", { estado: filters.estado });
            }
            query
                .orderBy("pedido.createdAt", "DESC")
                .skip(skip)
                .take(limit);
            const [pedidos, total] = yield query.getManyAndCount();
            const pedidosMapeados = yield Promise.all(pedidos.map((p) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                let resolvedComprobante = p.comprobantePagoUrl;
                if (resolvedComprobante && !resolvedComprobante.startsWith('http')) {
                    resolvedComprobante = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: env_1.envs.AWS_BUCKET_NAME, key: resolvedComprobante });
                }
                return {
                    id: p.id, estado: p.estado, total: p.total, costoEnvio: p.costoEnvio,
                    createdAt: p.createdAt, fecha: p.createdAt, fecha_aceptado: p.fecha_aceptado,
                    tiempoPreparacionElegido: p.tiempoPreparacionElegido,
                    latCliente: p.latCliente, lngCliente: p.lngCliente,
                    negocio: {
                        id: p.negocio.id,
                        nombre: p.negocio.nombre,
                        latitud: (_a = p.negocio) === null || _a === void 0 ? void 0 : _a.latitud,
                        longitud: (_b = p.negocio) === null || _b === void 0 ? void 0 : _b.longitud,
                        tiempoPreparacionMax: (_c = p.negocio) === null || _c === void 0 ? void 0 : _c.tiempoPreparacionMax
                    },
                    isProgrammed: ((_d = p.productos) === null || _d === void 0 ? void 0 : _d.some(pp => { var _a; return ((_a = pp.producto) === null || _a === void 0 ? void 0 : _a.tipoProducto) === 'PROGRAMADO'; })) || false,
                    metodoPago: p.metodoPago, comprobantePagoUrl: resolvedComprobante,
                    estadoPago: p.estadoPago, referenciaPago: p.referenciaPago,
                    delivery_code: p.delivery_code, arrival_time: p.arrival_time,
                    pickup_code: p.pickup_code,
                    motivoCancelacion: p.motivoCancelacion,
                    notaGeneral: p.notaGeneral,
                    cliente: p.cliente ? {
                        id: p.cliente.id,
                        name: p.cliente.name,
                        surname: p.cliente.surname,
                        whatsapp: p.cliente.whatsapp,
                        cancellation_strikes: p.cliente.cancellation_strikes
                    } : null,
                    motorizado: p.motorizado ? {
                        id: p.motorizado.id,
                        name: p.motorizado.name,
                        surname: p.motorizado.surname,
                        whatsapp: p.motorizado.whatsapp
                    } : null,
                    ratingNegocio: p.ratingNegocio,
                    ratingMotorizado: p.ratingMotorizado,
                    isPeakHourSurchargeApplied: p.isPeakHourSurchargeApplied,
                    peakHourSurchargeAmount: p.peakHourSurchargeAmount,
                    peakHourSurchargeMoto: p.peakHourSurchargeMoto,
                    peakHourSurchargeApp: p.peakHourSurchargeApp
                };
            })));
            return { total, page, totalPages: Math.ceil(total / limit), pedidos: pedidosMapeados };
        });
    }
    obtenerProductosPorPedido(pedidoId, clienteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.createQueryBuilder("pedido")
                .where("pedido.id = :pedidoId", { pedidoId })
                .andWhere("pedido.clienteId = :clienteId", { clienteId })
                .leftJoinAndSelect("pedido.productos", "productos")
                .leftJoinAndSelect("productos.producto", "producto")
                .getOne();
            if (!pedido) {
                throw domain_1.CustomError.notFound("Pedido no encontrado o no pertenece a este cliente");
            }
            return pedido.productos.map(pp => {
                var _a, _b;
                return ({
                    nombre: ((_a = pp.producto) === null || _a === void 0 ? void 0 : _a.nombre) || pp.producto_nombre || "Producto no disponible",
                    cantidad: pp.cantidad,
                    subtotal: pp.subtotal,
                    precio_venta: pp.precio_venta,
                    imagen: pp.producto_imagen,
                    tipoProducto: ((_b = pp.producto) === null || _b === void 0 ? void 0 : _b.tipoProducto) || 'NORMAL'
                });
            });
        });
    }
    notificarYaVoy(pedidoId, clienteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
                where: { id: pedidoId, cliente: { id: clienteId } },
                relations: ["cliente", "motorizado"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            pedido.cliente_confirmo_llegada = true;
            yield pedido.save();
            if (pedido.motorizado) {
                (0, socket_1.getIO)().to(pedido.motorizado.id).emit("cliente_ya_va", {
                    pedidoId: pedido.id,
                    mensaje: "¡El cliente ya confirmó que sale a recibirte!"
                });
            }
            return { success: true };
        });
    }
    calificarPedido(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pedidoId, ratingNegocio, ratingMotorizado } = dto;
            const pedido = yield data_1.Pedido.findOne({
                where: { id: pedidoId },
                relations: ["negocio", "motorizado"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (ratingNegocio !== undefined)
                pedido.ratingNegocio = ratingNegocio;
            if (ratingMotorizado !== undefined)
                pedido.ratingMotorizado = ratingMotorizado;
            yield pedido.save();
            return { success: true };
        });
    }
    eliminarPedidoCliente(pedidoId, clienteId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const p = yield data_1.Pedido.findOne({ where: { id: pedidoId, cliente: { id: clienteId } } });
            if (!p || p.estado !== data_1.EstadoPedido.PENDIENTE)
                throw domain_1.CustomError.notFound("No encontrado o no cancelable");
            // 🔔 Notificación Push al Negocio (Cancelación por Cliente)
            const orderWithBusiness = yield data_1.Pedido.findOne({ where: { id: pedidoId }, relations: ["negocio", "negocio.usuario"] });
            if ((_a = orderWithBusiness === null || orderWithBusiness === void 0 ? void 0 : orderWithBusiness.negocio) === null || _a === void 0 ? void 0 : _a.usuario) {
                yield notificationService.sendPushNotification(orderWithBusiness.negocio.usuario.id, "Pedido Cancelado por Cliente", `El cliente ha cancelado el pedido #${pedidoId.split('-')[0]}.`, { url: `/business/dashboard/${orderWithBusiness.negocio.id}/orders/history` });
            }
            yield data_1.Pedido.remove(p);
            return { ok: true };
        });
    }
    cancelarPedidoPorDemora(pedidoId, clienteId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const pedido = yield data_1.Pedido.findOne({
                where: { id: pedidoId, cliente: { id: clienteId } },
                relations: ["negocio", "negocio.usuario", "productos", "productos.producto"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (pedido.estado !== data_1.EstadoPedido.ACEPTADO) {
                throw domain_1.CustomError.badRequest("Solo se pueden cancelar por demora los pedidos en estado ACEPTADO");
            }
            // Validar si tiene productos programados
            const tieneProgramados = pedido.productos.some(p => { var _a; return ((_a = p.producto) === null || _a === void 0 ? void 0 : _a.tipoProducto) === 'PROGRAMADO'; });
            if (tieneProgramados) {
                throw domain_1.CustomError.badRequest("Los pedidos con productos programados no permiten cancelación por demora");
            }
            // Validar tiempo (Eliminado tiempo de gracia de 10 min a petición del usuario)
            const fechaBase = pedido.fecha_aceptado || pedido.createdAt;
            const prepTimeMax = pedido.tiempoPreparacionElegido || ((_a = pedido.negocio) === null || _a === void 0 ? void 0 : _a.tiempoPreparacionMax) || 30;
            const ahora = new Date();
            const limite = new Date(fechaBase.getTime() + prepTimeMax * 60000);
            if (ahora < limite) {
                throw domain_1.CustomError.badRequest("Aún no se ha cumplido el tiempo de gracia para cancelar por demora");
            }
            // Proceder con cancelación
            pedido.estado = data_1.EstadoPedido.CANCELADO;
            pedido.motivoCancelacion = "Cancelación por demora excesiva en la preparación";
            yield pedido.save();
            // Notificar al Negocio
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId: pedido.id,
                estado: pedido.estado,
                motivoCancelacion: pedido.motivoCancelacion,
                timestamp: ahora.toISOString()
            };
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.to(clienteId).emit("pedido_actualizado", updateData);
            if (pedido.negocio.usuario) {
                yield notificationService.sendPushNotification(pedido.negocio.usuario.id, "Pedido Cancelado por Demora", `El cliente canceló el pedido #${pedido.id.split('-')[0]} debido a demora en la preparación.`, { url: `/business/dashboard/${pedido.negocio.id}/orders/history` });
            }
            return { ok: true };
        });
    }
    refreshTimer(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, minutosExtras = 0) {
            const pedido = yield data_1.Pedido.findOne({
                where: { id },
                relations: ['negocio', 'cliente']
            });
            if (!pedido)
                return { success: false, message: "Pedido no encontrado" };
            // 1. Obtener horario de cierre global
            const { GlobalSettings } = require("../../../data");
            const settings = yield GlobalSettings.findOne({ where: {}, order: { updatedAt: 'DESC' } });
            const horaCierreStr = (settings === null || settings === void 0 ? void 0 : settings.hora_cierre) || "22:00:00"; // Fallback 10 PM
            // 2. Validar que no pase la hora de cierre
            const ahora = new Date();
            const [h, m, s] = horaCierreStr.split(':').map(Number);
            const limiteCierre = new Date();
            limiteCierre.setHours(h, m, s, 0);
            const nuevaFechaExpira = new Date(ahora.getTime() + (minutosExtras * 60000));
            if (nuevaFechaExpira > limiteCierre) {
                return {
                    success: false,
                    message: `No puedes extender el tiempo más allá de la hora de cierre (${horaCierreStr.substring(0, 5)})`
                };
            }
            // 3. Actualizar tiempos y elección del usuario
            const nuevaFechaBase = new Date();
            pedido.createdAt = nuevaFechaBase;
            pedido.fecha_aceptado = nuevaFechaBase;
            pedido.tiempoPreparacionElegido = minutosExtras; // Guardamos la elección del usuario
            yield pedido.save();
            // 4. Notificar vía Sockets
            const io = require("../../../config/socket").getIO();
            const updateData = {
                pedidoId: pedido.id,
                id: pedido.id,
                newCreatedAt: nuevaFechaBase.toISOString(),
                fecha_aceptado: nuevaFechaBase.toISOString(),
                tiempoPreparacionElegido: minutosExtras
            };
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            return {
                success: true,
                newCreatedAt: nuevaFechaBase.toISOString()
            };
        });
    }
    subirComprobante(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `comprobantes/${Date.now()}-${file.originalname}`;
            const uploaded = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                bucketName: env_1.envs.AWS_BUCKET_NAME, key, body: file.buffer, contentType: file.mimetype
            });
            const url = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: env_1.envs.AWS_BUCKET_NAME, key: uploaded });
            return { url, key: uploaded };
        });
    }
    static startMaintenanceJob() {
        console.log("🕒 [Mantenimiento] Iniciando vigilante de pedidos...");
        // Tarea 1: Auto-cancelación de pedidos (Cada 1 minuto)
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const ahora = new Date();
                const horaEcuador = ahora.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Guayaquil' });
                // --- INICIO: VERIFICADOR AUTOMÁTICO DE PAYPHONE (POLLING) ---
                try {
                    const { WalletService } = yield Promise.resolve().then(() => __importStar(require("../wallet.service")));
                    const { UserService } = yield Promise.resolve().then(() => __importStar(require("../usuario/user.service")));
                    const { EmailService } = yield Promise.resolve().then(() => __importStar(require("../email.service")));
                    const { envs } = yield Promise.resolve().then(() => __importStar(require("../../../config/env")));
                    const { GlobalSettings, RechargeRequest, StatusRecarga } = yield Promise.resolve().then(() => __importStar(require("../../../data")));
                    // 1. RECONCILIACIÓN DE PEDIDOS (TARJETA)
                    const pedidosPendientes = yield data_1.Pedido.find({
                        where: { estado: data_1.EstadoPedido.PENDIENTE_PAGO, metodoPago: 'TARJETA' },
                        relations: ["negocio"]
                    });
                    for (const pedidoPendiente of pedidosPendientes) {
                        try {
                            if ((_a = pedidoPendiente.negocio) === null || _a === void 0 ? void 0 : _a.payphone_token) {
                                const clientTxIdForSearch = pedidoPendiente.referenciaPago || pedidoPendiente.id;
                                const txInfo = yield payphone_service_1.PayphoneService.getTransactionByClientTxId(clientTxIdForSearch, pedidoPendiente.negocio.payphone_token);
                                if (txInfo && (txInfo.transactionStatus === "Approved" || txInfo.status === "Approved")) {
                                    console.log(`[Auto-Reconcile] 🔄 Pedido ${pedidoPendiente.id} rescatado y pagado en PayPhone.`);
                                    const pedidoService = new PedidoUsuarioService();
                                    yield pedidoService.confirmarPago(txInfo.transactionId || txInfo.transactionIdBase, clientTxIdForSearch);
                                }
                            }
                        }
                        catch (e) {
                            console.error(`[Auto-Reconcile] Error verificando pedido ${pedidoPendiente.id}:`, e);
                        }
                    }
                    // 2. RECONCILIACIÓN DE RECARGAS DE BILLETERA (TARJETA)
                    const recargasPendientes = yield RechargeRequest.find({
                        where: { status: StatusRecarga.PENDIENTE, payment_method: 'CARD' }
                    });
                    if (recargasPendientes.length > 0) {
                        const settings = yield GlobalSettings.findOne({ where: {} });
                        if (settings === null || settings === void 0 ? void 0 : settings.payphoneToken) {
                            const emailService = new EmailService(envs.MAILER_SERVICE, envs.MAILER_EMAIL, envs.MAILER_SECRET_KEY, envs.SEND_EMAIL);
                            const userService = new UserService(emailService);
                            const walletService = new WalletService(userService);
                            for (const recargaPend of recargasPendientes) {
                                try {
                                    const shortIdForSearch = recargaPend.id.replace(/-/g, '').slice(0, 20);
                                    let txInfo = yield payphone_service_1.PayphoneService.getTransactionByClientTxId(shortIdForSearch, settings.payphoneToken);
                                    if (!txInfo) {
                                        txInfo = yield payphone_service_1.PayphoneService.getTransactionByClientTxId(recargaPend.id, settings.payphoneToken);
                                    }
                                    if (txInfo && (txInfo.transactionStatus === "Approved" || txInfo.status === "Approved")) {
                                        console.log(`[Auto-Reconcile] 🔄 Recarga ${recargaPend.id} rescatada y cobrada en PayPhone.`);
                                        yield walletService.confirmPayphoneRecharge(recargaPend.id, txInfo.transactionId || txInfo.transactionIdBase);
                                    }
                                }
                                catch (e) {
                                    console.error(`[Auto-Reconcile] Error verificando recarga ${recargaPend.id}:`, e);
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    console.error("[Auto-Reconcile] Error general en el verificador de PayPhone:", e);
                }
                // --- FIN: VERIFICADOR AUTOMÁTICO DE PAYPHONE (POLLING) ---
                // 1. Limpieza rápida de PENDIENTE_PAGO (6 minutos)
                yield data_1.Pedido.getRepository().query(`UPDATE pedido SET estado = 'CANCELADO', "motivoCancelacion" = 'Pago no registrado en el tiempo límite.' WHERE estado = 'PENDIENTE_PAGO' AND "createdAt" < NOW() - INTERVAL '6 minutes'`);
                const { GlobalSettings } = require("../../../data");
                const settings = yield GlobalSettings.findOne({ where: {} });
                const graceMinutes = (settings === null || settings === void 0 ? void 0 : settings.acceptedOrderGraceMinutes) || 10;
                // 2. Vigilante de ACEPTADOS (Optimizado: Query Filtering + Lazy Loading)
                const pedidosExpirados = yield data_1.Pedido.createQueryBuilder('p')
                    .leftJoinAndSelect('p.negocio', 'n')
                    .leftJoinAndSelect('n.usuario', 'u')
                    .where('p.estado = :estado', { estado: data_1.EstadoPedido.ACEPTADO })
                    // 🛡️ Filtro 1: Excluir pedidos con productos PROGRAMADOS (Subquery para no cargar relaciones innecesarias)
                    .andWhere((qb) => {
                    const subQuery = qb.subQuery()
                        .select('1')
                        .from(data_1.ProductoPedido, 'pp')
                        .innerJoin('pp.producto', 'prod')
                        .where('pp."pedidoId" = p.id')
                        .andWhere('prod."tipoProducto" = :tipo', { tipo: 'PROGRAMADO' })
                        .getQuery();
                    return `NOT EXISTS ${subQuery}`;
                })
                    // 🛡️ Filtro 2: Solo pedidos cuya fecha (aceptado o creado) + tiempo de preparación + graceMinutes min sea menor a NOW()
                    .andWhere(`
            (COALESCE(p.fecha_aceptado, p.createdAt) + 
            (COALESCE(p.tiempoPreparacionElegido, n.tiempoPreparacionMax, 30) + :graceMinutes) * INTERVAL '1 minute') < NOW()
          `, { graceMinutes })
                    .getMany();
                const io = (0, socket_1.getIO)();
                const notificationService = new NotificationService_1.NotificationService();
                for (const pedido of pedidosExpirados) {
                    try {
                        // Si es medianoche (23:30 - 23:59), es un barrido nocturno
                        const isNightSweepTime = horaEcuador.startsWith("23:3") || horaEcuador.startsWith("23:4") || horaEcuador.startsWith("23:5");
                        console.log(`[Auto-Cancel] 🚨 Pedido ${pedido.id} cancelando por expiración...`);
                        pedido.estado = data_1.EstadoPedido.CANCELADO;
                        pedido.motivoCancelacion = isNightSweepTime
                            ? "Cierre operativo nocturno: Pedido expirado sin finalizar."
                            : "Cancelación automática por demora excesiva en la preparación sin respuesta del cliente.";
                        yield pedido.save();
                        io.emit("pedido_actualizado", { id: pedido.id, estado: pedido.estado });
                        io.emit("admin_live_update", { type: 'ORDER_UPDATED', pedidoId: pedido.id });
                        if ((_c = (_b = pedido.negocio) === null || _b === void 0 ? void 0 : _b.usuario) === null || _c === void 0 ? void 0 : _c.id) {
                            yield notificationService.sendPushNotification(pedido.negocio.usuario.id, "🚨 Pedido Auto-Cancelado", `El pedido #${pedido.id.substring(0, 8)} fue cancelado por demora excesiva.`, { url: `/business/dashboard/${pedido.negocio.id}/orders/history` });
                        }
                    }
                    catch (err) {
                        console.error(`[Auto-Cancel] Error procesando pedido ${pedido === null || pedido === void 0 ? void 0 : pedido.id}:`, err);
                    }
                }
            }
            catch (error) {
                console.error("❌ [Mantenimiento] Error en tarea de auto-cancelación:", error);
            }
        }), 60000);
        // Tarea 2: Cobro de Suscripciones (Cada hora)
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const { SubscriptionService } = yield Promise.resolve().then(() => __importStar(require("../subscription.service")));
                const subService = new SubscriptionService();
                const results = yield subService.processDailySubscriptions();
                if (results.totalProcessed > 0) {
                    console.log(`[Maintenance] Suscripciones procesadas: ${results.successful} exitosas, ${results.failed} fallidas.`);
                }
            }
            catch (e) {
                console.error("[Maintenance] Error procesando suscripciones:", e);
            }
        }), 3600000);
    }
    static manualCleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("🧹 [Mantenimiento] Ejecutando limpieza manual de pedidos...");
            const pedidosExpirados = yield data_1.Pedido.find({
                where: { estado: data_1.EstadoPedido.ACEPTADO },
                relations: ["negocio", "negocio.usuario", "productos", "productos.producto"]
            });
            let cancelados = 0;
            const ahora = new Date();
            const io = (0, socket_1.getIO)();
            for (const pedido of pedidosExpirados) {
                // 🛡️ Saltar pedidos programados (ellos no expiran por tiempo de aceptación normal)
                const esProgramado = (_a = pedido.productos) === null || _a === void 0 ? void 0 : _a.some(p => { var _a; return ((_a = p.producto) === null || _a === void 0 ? void 0 : _a.tipoProducto) === 'PROGRAMADO'; });
                if (esProgramado)
                    continue;
                const { GlobalSettings } = require("../../../data");
                const settings = yield GlobalSettings.findOne({ where: {} });
                const graceMinutes = (settings === null || settings === void 0 ? void 0 : settings.acceptedOrderGraceMinutes) || 10;
                const fechaBase = pedido.fecha_aceptado || pedido.createdAt;
                const prepTimeMax = Number(pedido.tiempoPreparacionElegido || ((_b = pedido.negocio) === null || _b === void 0 ? void 0 : _b.tiempoPreparacionMax) || 30);
                const totalLimitMinutes = prepTimeMax + graceMinutes;
                const limiteAutoCancel = new Date(fechaBase.getTime() + totalLimitMinutes * 60000);
                if (ahora > limiteAutoCancel) {
                    pedido.estado = data_1.EstadoPedido.CANCELADO;
                    pedido.motivoCancelacion = "Limpieza manual de pedidos expirados.";
                    yield pedido.save();
                    io.emit("pedido_actualizado", { id: pedido.id, estado: pedido.estado });
                    cancelados++;
                }
            }
            return { success: true, count: cancelados };
        });
    }
}
exports.PedidoUsuarioService = PedidoUsuarioService;
