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
exports.BusinessService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
const config_1 = require("../../config");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const socket_1 = require("../../config/socket");
const pedidoExpiration_service_1 = require("./pedidosServices/pedidoExpiration.service");
class BusinessService {
    constructor() { }
    loginBusiness(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Buscar usuario
            const user = yield data_1.User.findOne({
                where: {
                    email: credentials.email,
                    status: data_1.Status.ACTIVE,
                },
                relations: ["negocios"],
            });
            if (!user) {
                throw domain_1.CustomError.unAuthorized("Usuario o contraseña inválidos");
            }
            // 2. Validar contraseña
            const isMatching = config_1.encriptAdapter.compare(credentials.password, user.password);
            if (!isMatching)
                throw domain_1.CustomError.unAuthorized("Usuario o contraseña inválidos");
            // 3. Validar si tiene negocios
            if (!user.negocios || user.negocios.length === 0) {
                throw domain_1.CustomError.forbiden("Debes crear primero un negocio para poder ingresar al panel de negocios de Atucucho Shop");
            }
            // 4. Generar JWT (Access + Refresh)
            const token = yield config_1.JwtAdapter.generateToken({ id: user.id, role: "USER" }, config_1.envs.JWT_EXPIRE_IN);
            const refreshToken = yield config_1.JwtAdapter.generateToken({ id: user.id, role: "USER" }, config_1.envs.JWT_REFRESH_EXPIRE_IN || '7d');
            if (!token || !refreshToken)
                throw domain_1.CustomError.internalServer("Error generando Jwt");
            // Guardar sesión para validar en middleware
            user.currentSessionId = token;
            user.isLoggedIn = true;
            yield user.save();
            // 5. Preparar respuesta con foto
            let urlPhoto = "";
            if (user.photoperfil) {
                urlPhoto = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: user.photoperfil,
                });
            }
            // Resolve imagenes de negocios
            const negociosWithImages = yield Promise.all(user.negocios.map((n) => __awaiter(this, void 0, void 0, function* () {
                let img = "";
                if (n.imagenNegocio) {
                    try {
                        img = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: n.imagenNegocio,
                        });
                    }
                    catch (e) {
                        console.log("Error imagen negocio", e);
                    }
                }
                return {
                    id: n.id,
                    nombre: n.nombre,
                    imagenNegocio: img, // Legacy support
                    imagenUrl: img, // New standard
                    statusNegocio: n.statusNegocio,
                    estadoNegocio: n.estadoNegocio,
                    modeloMonetizacion: n.modeloMonetizacion,
                    ratingPromedio: Number(n.ratingPromedio) || 0,
                    totalResenas: Number(n.totalResenas) || 0,
                    pago_tarjeta_habilitado_admin: n.pago_tarjeta_habilitado_admin,
                    porcentaje_recargo_tarjeta: Number(n.porcentaje_recargo_tarjeta) || 0,
                    payphone_store_id: n.payphone_store_id,
                    payphone_token: n.payphone_token,
                };
            })));
            // Retornamos token, usuario y sus negocios (para que seleccione)
            return {
                token,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    surname: user.surname,
                    email: user.email,
                    photoperfil: urlPhoto,
                },
                negocios: negociosWithImages
            };
        });
    }
    getMyBusinesses(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Consultar Negocios directamente para evitar problemas con la hidratación de la relación en User
            const negocios = yield data_1.Negocio.find({
                where: { usuario: { id: userId } },
                order: { created_at: "DESC" }
            });
            // Mapear respuesta
            const negociosWithImages = yield Promise.all(negocios.map((n) => __awaiter(this, void 0, void 0, function* () {
                let img = "";
                if (n.imagenNegocio) {
                    try {
                        img = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: n.imagenNegocio,
                        });
                    }
                    catch (e) {
                        console.log("Error imagen negocio", e);
                    }
                }
                return {
                    id: n.id,
                    nombre: n.nombre,
                    descripcion: n.descripcion,
                    imagenNegocio: img, // Legacy support
                    imagenUrl: img, // New standard
                    statusNegocio: n.statusNegocio,
                    estadoNegocio: n.estadoNegocio,
                    modeloMonetizacion: n.modeloMonetizacion,
                    ratingPromedio: Number(n.ratingPromedio) || 0,
                    totalResenas: Number(n.totalResenas) || 0,
                    pago_tarjeta_habilitado_admin: n.pago_tarjeta_habilitado_admin,
                    porcentaje_recargo_tarjeta: Number(n.porcentaje_recargo_tarjeta) || 0,
                    payphone_store_id: n.payphone_store_id,
                    payphone_token: n.payphone_token,
                };
            })));
            return negociosWithImages;
        });
    }
    // ==========================================
    // 📦 GESTIÓN DE PEDIDOS (Business)
    // ==========================================
    getOrdersByBusiness(businessId_1) {
        return __awaiter(this, arguments, void 0, function* (businessId, status = 'PREPARANDO,EN_CAMINO,ENTREGADO,CANCELADO', page = 1, limit = 15, date, search) {
            // Validar que el negocio exista
            const Negocio = (yield Promise.resolve().then(() => __importStar(require("../../data")))).Negocio;
            const negocio = yield Negocio.findOne({ where: { id: businessId } });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            const Pedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).Pedido;
            const EstadoPedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).EstadoPedido;
            const qb = Pedido.createQueryBuilder("p") // Alias p
                .leftJoinAndSelect("p.negocio", "n") // Alias n
                .leftJoinAndSelect("p.cliente", "c")
                .leftJoinAndSelect("p.productos", "pp")
                .leftJoinAndSelect("pp.producto", "prod")
                .leftJoinAndSelect("p.motorizado", "m")
                .where("p.negocio = :businessId", { businessId });
            // Search has PRIORITY (Global search by ID)
            if (search && search.trim() !== "") {
                qb.andWhere("p.id ILIKE :search", { search: `%${search}%` });
            }
            else {
                // Normalize status to array (handling arrays, single strings, and comma-separated strings)
                let statusFilter = [];
                if (status) {
                    if (Array.isArray(status)) {
                        statusFilter = status;
                    }
                    else if (typeof status === 'string') {
                        statusFilter = status.split(',');
                    }
                }
                if (statusFilter.length > 0) {
                    qb.andWhere("p.estado::text IN (:...statuses)", { statuses: statusFilter });
                }
                // Filter by Date (Ecuador Time UTC-5 awareness)
                if (date) {
                    const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
                    const { start, end } = DateUtils.getDayRange(date);
                    qb.andWhere("p.createdAt BETWEEN :start AND :end", { start, end });
                }
            }
            qb.orderBy("p.createdAt", "DESC")
                .skip((page - 1) * limit)
                .take(limit);
            // Count cancelled orders today (Ecuador Time)
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
            const { start: startToday, end: endToday } = DateUtils.getDayRange(new Date());
            const cancelledOrdersToday = yield Pedido.createQueryBuilder("p")
                .where("p.negocio = :businessId", { businessId })
                .andWhere("p.estado = :status", { status: EstadoPedido.CANCELADO })
                .andWhere("p.createdAt BETWEEN :start AND :end", { start: startToday, end: endToday })
                .getCount();
            try {
                const [orders, total] = yield qb.getManyAndCount();
                // Resolve Signed URLs for Comprobantes
                const { UploadFilesCloud } = yield Promise.resolve().then(() => __importStar(require("../../config/upload-files-cloud-adapter")));
                const { envs } = yield Promise.resolve().then(() => __importStar(require("../../config/env")));
                const ordersMapped = yield Promise.all(orders.map((order) => __awaiter(this, void 0, void 0, function* () {
                    // Self-healing
                    let changed = false;
                    // 🕵️ AUTO-EXPIRACIÓN LAZY (Si el cron aún no lo ha capturado)
                    if (order.estado === EstadoPedido.PENDIENTE) {
                        const isExpired = yield pedidoExpiration_service_1.PedidoExpirationService.isOrderExpired(order);
                        if (isExpired) {
                            order.estado = EstadoPedido.CANCELADO;
                            order.motivoCancelacion = "El tiempo para aceptar el pedido ha expirado";
                            changed = true;
                        }
                    }
                    if (order.estado === EstadoPedido.PREPARANDO_ASIGNADO && !order.pickup_code) {
                        order.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
                        order.pickup_verified = false;
                        changed = true;
                    }
                    if (order.estado === EstadoPedido.EN_CAMINO && !order.delivery_code) {
                        order.delivery_code = Math.floor(1000 + Math.random() * 9000).toString();
                        order.delivery_verified = false;
                        changed = true;
                    }
                    if (changed)
                        yield order.save();
                    if (order.comprobantePagoUrl && !order.comprobantePagoUrl.startsWith('http')) {
                        try {
                            order.comprobantePagoUrl = yield UploadFilesCloud.getFile({
                                bucketName: envs.AWS_BUCKET_NAME,
                                key: order.comprobantePagoUrl
                            });
                        }
                        catch (error) {
                            console.error(`Error resolving URL for order ${order.id}:`, error);
                        }
                    }
                    return order;
                })));
                // 💰 Añadir Resumen Financiero DIARIO (Para unificar con Finance)
                const financialSummary = yield this.getFinanceSummary(businessId, date);
                return {
                    orders: ordersMapped,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                    cancelledOrdersToday,
                    financialSummary: financialSummary.detail,
                    financialSnapshot: financialSummary.snapshot
                };
            }
            catch (error) {
                console.error("❌ [ERROR] getOrdersByBusiness failed:", error);
                throw domain_1.CustomError.internalServer("Error al obtener pedidos");
            }
        });
    }
    updateOrderStatus(businessId, orderId, status, motivoCancelacion) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Validar que el pedido pertenezca al negocio
            const Pedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).Pedido;
            const EstadoPedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).EstadoPedido;
            const order = yield Pedido.findOne({
                where: { id: orderId, negocio: { id: businessId } },
                relations: ["cliente"]
            });
            if (!order)
                throw domain_1.CustomError.notFound("Pedido no encontrado o no pertenece a este negocio");
            // Validar si el día ya está cerrado
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
            const { start, end } = DateUtils.getDayRange(order.createdAt);
            const { BalanceNegocio } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const { Between } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
            const balance = yield BalanceNegocio.findOne({
                where: {
                    negocio: { id: businessId },
                    fecha: Between(start, end)
                }
            });
            if (balance === null || balance === void 0 ? void 0 : balance.isClosed)
                throw domain_1.CustomError.badRequest("No se puede modificar un pedido de un día ya cerrado");
            // Reglas de negocio: 
            // 1. PENDIENTE -> ACEPTADO
            // 2. ACEPTADO -> PREPARANDO
            // 3. PENDIENTE -> CANCELADO (Rechazo)
            if (status === EstadoPedido.ACEPTADO) {
                if (order.estado !== EstadoPedido.PENDIENTE) {
                    throw domain_1.CustomError.badRequest("Solo se pueden aceptar pedidos en estado PENDIENTE");
                }
                // Validar expiración antes de aceptar
                const isExpired = yield pedidoExpiration_service_1.PedidoExpirationService.isOrderExpired(order);
                if (isExpired) {
                    order.estado = EstadoPedido.CANCELADO;
                    order.motivoCancelacion = "El tiempo para aceptar el pedido ha expirado";
                    yield order.save();
                    // Notificar al cliente via socket
                    const io = (0, socket_1.getIO)();
                    if ((_a = order.cliente) === null || _a === void 0 ? void 0 : _a.id) {
                        io.to(order.cliente.id).emit("pedido_actualizado", {
                            id: order.id,
                            estado: order.estado,
                            motivoCancelacion: order.motivoCancelacion
                        });
                    }
                    throw domain_1.CustomError.badRequest("El tiempo para aceptar este pedido ha expirado y ha sido cancelado automáticamente");
                }
                order.estado = EstadoPedido.ACEPTADO;
            }
            else if (status === EstadoPedido.PREPARANDO) {
                // Permitir paso directo de PENDIENTE a PREPARANDO por compatibilidad o solo de ACEPTADO? 
                // Usuario dice: "Al presionar Listo (en estado Aceptado): El pedido pasa a PREPARANDO".
                // Asumimos flujo estricto: PENDIENTE -> ACEPTADO -> PREPARANDO.
                // Pero mantendremos PENDIENTE -> PREPARANDO por si acaso el frontend antiguo sigue enviando directo, 
                // aunque el usuario solicita el nuevo flujo.
                // Update: User request implicit "Al presionar Aceptar... pasa a ACEPTADO". 
                if (order.estado !== EstadoPedido.ACEPTADO && order.estado !== EstadoPedido.PENDIENTE) {
                    throw domain_1.CustomError.badRequest("El pedido debe estar ACEPTADO para pasar a PREPARANDO");
                }
                order.estado = EstadoPedido.PREPARANDO;
            }
            else if (status === EstadoPedido.CANCELADO) {
                // Regla 4: "Un pedido solo puede ser rechazado en estado PENDIENTE"
                if (order.estado !== EstadoPedido.PENDIENTE) {
                    throw domain_1.CustomError.badRequest("Solo se pueden rechazar pedidos en estado PENDIENTE");
                }
                if (!motivoCancelacion)
                    throw domain_1.CustomError.badRequest("Se requiere un motivo para cancelar");
                order.estado = EstadoPedido.CANCELADO;
                order.motivoCancelacion = motivoCancelacion;
            }
            else {
                throw domain_1.CustomError.badRequest("Estado no permitido para el negocio");
            }
            yield order.save();
            // Disparar socket en tiempo real al cliente y negocio
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId: order.id,
                estado: order.estado,
                timestamp: new Date().toISOString()
            };
            // Emitir al cliente
            if ((_b = order.cliente) === null || _b === void 0 ? void 0 : _b.id) {
                io.to(order.cliente.id).emit("pedido_actualizado", updateData);
            }
            // Emitir al negocio
            io.to(businessId).emit("pedido_actualizado", updateData);
            return order;
        });
    }
    // ==========================================
    // 💰 GESTIÓN FINANCIERA
    // ==========================================
    getFinanceSummary(businessId, date) {
        return __awaiter(this, void 0, void 0, function* () {
            const { Between, FindOperator } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
            const { Pedido, MetodoPago, BalanceNegocio, EstadoBalance } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const { UploadFilesCloud } = yield Promise.resolve().then(() => __importStar(require("../../config/upload-files-cloud-adapter")));
            const { envs } = yield Promise.resolve().then(() => __importStar(require("../../config/env")));
            // 1. Definir rango de fecha (Día específico)
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
            const { start: startOfDay, end: endOfDay } = DateUtils.getDayRange(date || new Date());
            // 2. Buscar si ya existe un Balance Snapshot para este día
            let balanceSnapshot = yield BalanceNegocio.findOne({
                where: {
                    negocio: { id: businessId },
                    fecha: Between(startOfDay, endOfDay)
                }
            });
            // 3. Calcular en tiempo real (siempre recalculamos para mantener consistencia hasta que esté LIQUIDADO)
            // NOTA: Si está LIQUIDADO, podríamos retornar el snapshot, pero si hay cambios en pedidos post-cierre, 
            // lo mejor es recalcular o bloquear cambios. Por ahora recalculamos para mostrar siempre la verdad.
            const orders = yield Pedido.find({
                where: {
                    negocio: { id: businessId },
                    createdAt: Between(startOfDay, endOfDay),
                },
                relations: ["productos", "productos.producto"]
            });
            // Count cancelled orders today specifically
            const cancelledOrdersToday = orders.filter(o => o.estado === "CANCELADO").length;
            const validOrders = orders.filter(o => o.estado === "ENTREGADO" || o.estado === "CANCELADO");
            let totalVendido = 0; // Productos
            let totalComision = 0;
            let totalDelivery = 0;
            let totalEfectivo = 0; // (Prod + Delivery) recibido en efectivo
            let totalTransferencia = 0; // (Prod + Delivery) recibido por transferencia
            let deudaNegocioApp = 0; // El negocio tiene el dinero (Efectivo), debe dar comisión + delivery a App (si aplica)
            // Corrección Lógica User:
            // Caso Efectivo: Negocio tiene (Productos + Domicilio).
            // App debe pagar al negocio: La comisión? No.
            // User dice: "Caso 2: Solo efectivo... La app debe pagar al negocio la comisión correspondiente". 
            // WAIT. Si es Efectivo, el CLIENTE le dio el dinero al Chofer o al Negocio?
            // En este sistema, 'Efectivo' suele ser Contraentrega. El motorizado cobra.
            // Si Motorizado cobra (es App), entonces App tiene el dinero.
            // PERO user request dice: "El negocio ya entregó: Productos, Domicilio. En este caso: La app debe pagar al negocio".
            // Esto implica que el negocio NO recibió el dinero directamente.
            let deudaAppNegocio = 0; // La app tiene el dinero, debe pagar al negocio.
            validOrders.forEach(order => {
                var _a, _b;
                const isCanceled = order.estado === "CANCELADO";
                // Usamos los mismos campos que el Historial de Pedidos (OrdersHistory.jsx)
                // para asegurar consistencia total.
                const costoEnvio = Number(order.costoEnvio || 0);
                const comisionProductos = Number(order.total_comision_productos || 0);
                const totalVentaPublico = Number(order.total_precio_venta_publico || 0); // Precio productos sin envío
                const precioParaNegocio = Number(order.total_precio_app || 0); // Lo que el negocio se queda realmente
                if (isCanceled) {
                    if (order.metodoPago === MetodoPago.TRANSFERENCIA) {
                        const isSystemCancelled = ((_a = order.motivoCancelacion) === null || _a === void 0 ? void 0 : _a.includes('nunca aceptó')) || ((_b = order.motivoCancelacion) === null || _b === void 0 ? void 0 : _b.includes('expirado'));
                        const isNotRejected = order.transferenciaCanceladaConfirmada !== false;
                        if (isSystemCancelled && isNotRejected) {
                            // En cancelado (por sistema), el negocio tiene TODO (Venta + Envío) si el cliente pagó
                            const totalPagadoPorCliente = totalVentaPublico + costoEnvio;
                            totalTransferencia += totalPagadoPorCliente;
                            deudaNegocioApp += totalPagadoPorCliente;
                        }
                    }
                    else {
                        totalEfectivo += (totalVentaPublico + costoEnvio);
                    }
                }
                else {
                    // ENTREGADO
                    totalVendido += totalVentaPublico;
                    totalComision += comisionProductos;
                    totalDelivery += costoEnvio;
                    if (order.metodoPago === MetodoPago.EFECTIVO) {
                        totalEfectivo += (totalVentaPublico + costoEnvio);
                        // App recaudó todo (vía motorizado). Debe devolver al local lo que le corresponde (total_precio_app).
                        deudaAppNegocio += precioParaNegocio;
                    }
                    else {
                        // Transferencia: Local recaudó todo. Debe devolver a la App (Comisión Productos + Delivery).
                        totalTransferencia += (totalVentaPublico + costoEnvio);
                        deudaNegocioApp += (comisionProductos + costoEnvio);
                    }
                }
            });
            // Caso 3: Transferencia + Efectivo (Balance Neto)
            // Balance Final = deudaNegocioApp - deudaAppNegocio.
            // Si Positivo: Negocio debe pagar a App (Debo).
            // Si Negativo: App debe pagar a Negocio (Me deben).
            const balanceFinal = deudaNegocioApp - deudaAppNegocio;
            // Guardar o Actualizar Snapshot
            // Solo creamos/actualizamos si no está pagado/liquidado (o si queremos actualizar montos en PENDIENTE)
            if (!balanceSnapshot) {
                balanceSnapshot = new BalanceNegocio();
                balanceSnapshot.negocio = { id: businessId };
                balanceSnapshot.fecha = startOfDay.toISOString().split('T')[0];
            }
            if (balanceSnapshot.estado !== EstadoBalance.LIQUIDADO) {
                balanceSnapshot.totalVendido = totalVendido;
                balanceSnapshot.totalComision = totalComision;
                balanceSnapshot.totalDelivery = totalDelivery;
                balanceSnapshot.totalComisionApp = totalComision + totalDelivery;
                balanceSnapshot.totalEfectivo = totalEfectivo;
                balanceSnapshot.totalTransferencia = totalTransferencia;
                balanceSnapshot.balanceFinal = balanceFinal;
                yield balanceSnapshot.save();
            }
            const ordersMapped = yield Promise.all(validOrders.map((o) => __awaiter(this, void 0, void 0, function* () {
                const isCanceled = o.estado === "CANCELADO";
                const totalProd = Number(o.total) || 0;
                const delivery = Number(o.costoEnvio) || 0;
                const comision = Number(o.comisionTotal) || 0;
                let precioParaNegocio = o.total_precio_app ? Number(o.total_precio_app) : (totalProd - comision);
                let paraLaApp = (totalProd + delivery) - precioParaNegocio;
                if (isCanceled) {
                    if (o.metodoPago === MetodoPago.TRANSFERENCIA) {
                        precioParaNegocio = 0;
                        paraLaApp = totalProd + delivery;
                    }
                    else {
                        // Canceled Cash: No money exchanged via app, so 0 for both
                        precioParaNegocio = 0;
                        paraLaApp = 0;
                    }
                }
                let resolvedComprobante = o.comprobantePagoUrl;
                if (resolvedComprobante && !resolvedComprobante.startsWith('http')) {
                    try {
                        resolvedComprobante = yield UploadFilesCloud.getFile({
                            bucketName: envs.AWS_BUCKET_NAME,
                            key: resolvedComprobante
                        });
                    }
                    catch (e) {
                        console.error("Error signing receipt for business breakdown:", e);
                    }
                }
                return {
                    id: o.id,
                    totalProductos: isCanceled ? 0 : totalProd,
                    totalPagado: totalProd + delivery, // Total paid by customer, regardless of cancellation
                    metodoPago: o.metodoPago,
                    estado: o.estado,
                    isCanceled,
                    comprobanteUrl: resolvedComprobante,
                    comision: isCanceled ? 0 : totalProd - precioParaNegocio,
                    paraElLocal: precioParaNegocio,
                    paraLaApp: paraLaApp,
                    createdAt: o.createdAt
                };
            })));
            // Resolvemos el comprobante del snapshot para el frontend SIN afectar la persistencia
            let signedUrl = balanceSnapshot === null || balanceSnapshot === void 0 ? void 0 : balanceSnapshot.comprobanteUrl;
            if (signedUrl && !signedUrl.startsWith('http')) {
                try {
                    signedUrl = yield UploadFilesCloud.getFile({
                        bucketName: envs.AWS_BUCKET_NAME,
                        key: signedUrl
                    });
                }
                catch (e) {
                    console.error("Error signing snapshot receipt:", e);
                }
            }
            else if (signedUrl && signedUrl.includes('amazonaws.com')) {
                // Reparación de emergencia: si se guardó una URL firmada previa, intentamos extraer la key
                try {
                    const urlObj = new URL(signedUrl);
                    const pathParts = urlObj.pathname.split('/');
                    // El primer slash e index 0 están vacíos, el resto es el path
                    const extractedKey = pathParts.slice(1).join('/');
                    if (extractedKey) {
                        signedUrl = yield UploadFilesCloud.getFile({
                            bucketName: envs.AWS_BUCKET_NAME,
                            key: extractedKey
                        });
                        // Opcionalmente: arreglar la DB aquí si no está cerrado
                        if (!(balanceSnapshot === null || balanceSnapshot === void 0 ? void 0 : balanceSnapshot.isClosed)) {
                            balanceSnapshot.comprobanteUrl = extractedKey;
                            yield balanceSnapshot.save();
                        }
                    }
                }
                catch (err) {
                    console.error("Error reparando URL dañada:", err);
                }
            }
            return {
                balanceEntity: balanceSnapshot, // Entidad real para uso interno (Ej: closeDay)
                snapshot: Object.assign(Object.assign({}, balanceSnapshot), { comprobanteUrl: signedUrl }),
                detail: {
                    totalVendido,
                    totalComision,
                    totalDelivery,
                    totalEfectivo,
                    totalTransferencia,
                    deudaNegocioApp,
                    deudaAppNegocio,
                    balanceFinal,
                    cancelledOrdersToday
                },
                orders: ordersMapped
            };
        });
    }
    registerPayment(businessId, date, file) {
        return __awaiter(this, void 0, void 0, function* () {
            const { BalanceNegocio, EstadoBalance } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const { Between } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
            const { start: startOfDay, end: endOfDay } = DateUtils.getDayRange(date);
            let balanceSnapshot = yield BalanceNegocio.findOne({
                where: {
                    negocio: { id: businessId },
                    fecha: Between(startOfDay, endOfDay)
                }
            });
            if (!balanceSnapshot) {
                // Si no existe, lo calculamos para asegurar veracidad
                yield this.getFinanceSummary(businessId, date);
                balanceSnapshot = yield BalanceNegocio.findOne({
                    where: {
                        negocio: { id: businessId },
                        fecha: Between(startOfDay, endOfDay)
                    }
                });
            }
            if (!balanceSnapshot)
                throw domain_1.CustomError.badRequest("No se pudo generar el resumen financiero para esta fecha.");
            if (balanceSnapshot.isClosed)
                throw domain_1.CustomError.badRequest("Este día ya está cerrado y no se puede modificar.");
            // Subir archivo (El frontend ya debería enviar la imagen optimizada)
            if (file) {
                // Adaptamos según si viene de Multer (buffer/originalname) o de express-fileupload (data/name)
                const buffer = file.buffer || file.data;
                const originalName = file.originalname || file.name || 'document.png';
                if (!buffer)
                    throw domain_1.CustomError.badRequest("El contenido del archivo es inválido.");
                const fileKey = `comprobantes_negocio/${businessId}/${Date.now()}_${originalName}`;
                const savedKey = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: fileKey,
                    body: buffer,
                    contentType: file.mimetype,
                    isReceipt: true
                });
                balanceSnapshot.comprobanteUrl = savedKey;
                balanceSnapshot.estado = EstadoBalance.PAGADO;
            }
            yield balanceSnapshot.save();
            return balanceSnapshot;
        });
    }
    closeDay(businessId, date) {
        return __awaiter(this, void 0, void 0, function* () {
            const { BalanceNegocio, Pedido, MetodoPago, EstadoPedido, EstadoBalance } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const { Between, IsNull } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
            // 1. Validar que no sea el día actual
            const { start: startOfToday } = DateUtils.getDayRange(new Date());
            const { start: startOfClosingDay, end: endOfClosingDay } = DateUtils.getDayRange(date);
            if (startOfClosingDay.getTime() === startOfToday.getTime()) {
                throw domain_1.CustomError.badRequest("No puedes cerrar el día actual");
            }
            // 2. Recalcular todo (por seguridad)
            const summary = yield this.getFinanceSummary(businessId, date);
            const balanceSnapshot = summary.balanceEntity; // USAMOS LA ENTIDAD REAL
            if (balanceSnapshot.isClosed) {
                throw domain_1.CustomError.badRequest("Este día ya está cerrado");
            }
            // 3. Validar transferencias canceladas (sin confirmar/rechazar)
            const pendingTransfers = yield Pedido.find({
                where: {
                    negocio: { id: businessId },
                    estado: EstadoPedido.CANCELADO,
                    metodoPago: MetodoPago.TRANSFERENCIA,
                    transferenciaCanceladaConfirmada: IsNull(),
                    createdAt: Between(startOfClosingDay, endOfClosingDay)
                }
            });
            if (pendingTransfers.length > 0) {
                throw domain_1.CustomError.badRequest("Tienes transferencias canceladas pendientes de validar");
            }
            // 4. Validar comprobante si balanceFinal > 0 (Negocio DEBE pagar a la app)
            if (balanceSnapshot.balanceFinal > 0 && !balanceSnapshot.comprobanteUrl) {
                throw domain_1.CustomError.badRequest("Debes subir el comprobante de pago");
            }
            // 5. Cerrar el día
            balanceSnapshot.isClosed = true;
            balanceSnapshot.estado = EstadoBalance.LIQUIDADO;
            yield balanceSnapshot.save();
            return {
                message: "Cierre realizado correctamente",
                snapshot: balanceSnapshot
            };
        });
    }
    verifyPickupCode(businessId, orderId, code) {
        return __awaiter(this, void 0, void 0, function* () {
            const Pedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).Pedido;
            const order = yield Pedido.findOne({
                where: { id: orderId, negocio: { id: businessId } },
                relations: ["motorizado"]
            });
            if (!order)
                throw domain_1.CustomError.notFound("Pedido no encontrado o no pertenece a este negocio");
            if (order.pickup_code !== code) {
                throw domain_1.CustomError.badRequest("Código incorrecto. Intente nuevamente.");
            }
            order.pickup_verified = true;
            yield order.save();
            // Disparar socket
            (0, socket_1.getIO)().emit("pedido_actualizado", {
                pedidoId: order.id,
                estado: order.estado,
                pickup_verified: order.pickup_verified,
                timestamp: new Date().toISOString()
            });
            return { message: "Código validado correctamente", pickup_verified: true };
        });
    }
    confirmTransferCancellation(businessId, orderId, confirmed) {
        return __awaiter(this, void 0, void 0, function* () {
            const Pedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).Pedido;
            const order = yield Pedido.findOne({
                where: { id: orderId, negocio: { id: businessId } }
            });
            if (!order)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            // Validar si el día ya está cerrado
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
            const { start, end } = DateUtils.getDayRange(order.createdAt);
            const { BalanceNegocio } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const { Between } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
            const balance = yield BalanceNegocio.findOne({
                where: {
                    negocio: { id: businessId },
                    fecha: Between(start, end)
                }
            });
            if (balance === null || balance === void 0 ? void 0 : balance.isClosed)
                throw domain_1.CustomError.badRequest("No se puede modificar un pedido de un día ya cerrado");
            order.transferenciaCanceladaConfirmada = confirmed;
            yield order.save();
            return order;
        });
    }
    getUnclosedDays(businessId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { Pedido, BalanceNegocio } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const { In, LessThan } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
            const { DateUtils } = yield Promise.resolve().then(() => __importStar(require("../../utils/date-utils")));
            const today = new Date();
            const { start: startOfToday } = DateUtils.getDayRange(today);
            // 1. Obtener todos los pedidos del negocio antes de hoy
            const orders = yield Pedido.find({
                where: {
                    negocio: { id: businessId },
                    createdAt: LessThan(startOfToday)
                },
                select: ["createdAt"]
            });
            if (orders.length === 0)
                return [];
            // 2. Extraer fechas únicas (YYYY-MM-DD) y ordenar descendente
            const uniqueDates = Array.from(new Set(orders.map(o => DateUtils.toLocalDateString(o.createdAt)))).sort((a, b) => b.localeCompare(a));
            // 3. Buscar balances ya cerrados para ese negocio en esas fechas
            const closedBalances = yield BalanceNegocio.find({
                where: {
                    negocio: { id: businessId },
                    isClosed: true,
                    fecha: In(uniqueDates)
                },
                select: ["fecha"]
            });
            const closedDatesSet = new Set(closedBalances.map(b => b.fecha));
            return uniqueDates.filter(d => !closedDatesSet.has(d));
        });
    }
    updateSettings(businessId, settings) {
        return __awaiter(this, void 0, void 0, function* () {
            const { Negocio } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const negocio = yield Negocio.findOne({ where: { id: businessId } });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            // Ya no permitimos al negocio cambiar el estado de pago con tarjeta (Controlado por Admin)
            // Permitir al negocio cambiar su estado (Abierto/Cerrado)
            if (settings.estadoNegocio !== undefined) {
                const { EstadoNegocio } = yield Promise.resolve().then(() => __importStar(require("../../data")));
                if (Object.values(EstadoNegocio).includes(settings.estadoNegocio)) {
                    negocio.estadoNegocio = settings.estadoNegocio;
                }
            }
            yield negocio.save();
            let img = "";
            if (negocio.imagenNegocio) {
                img = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: negocio.imagenNegocio,
                }).catch(() => "");
            }
            return {
                id: negocio.id,
                nombre: negocio.nombre,
                imagenUrl: img,
                statusNegocio: negocio.statusNegocio,
                estadoNegocio: negocio.estadoNegocio,
                pago_tarjeta_habilitado_admin: negocio.pago_tarjeta_habilitado_admin,
                porcentaje_recargo_tarjeta: Number(negocio.porcentaje_recargo_tarjeta) || 0,
            };
        });
    }
}
exports.BusinessService = BusinessService;
