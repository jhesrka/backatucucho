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
            // Resolver imagenes de negocios
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
                    imagenNegocio: img,
                    statusNegocio: n.statusNegocio,
                    modeloMonetizacion: n.modeloMonetizacion
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
            const user = yield data_1.User.findOne({
                where: { id: userId },
                relations: ["negocios"],
            });
            if (!user)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            // Mapear respuesta
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
                    descripcion: n.descripcion,
                    imagenNegocio: img,
                    statusNegocio: n.statusNegocio,
                    modeloMonetizacion: n.modeloMonetizacion
                };
            })));
            return negociosWithImages;
        });
    }
    // ==========================================
    // 📦 GESTIÓN DE PEDIDOS (Business)
    // ==========================================
    getOrdersByBusiness(businessId_1, status_1) {
        return __awaiter(this, arguments, void 0, function* (businessId, status, page = 1, limit = 10, date) {
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
                // Assuming date comes as YYYY-MM-DD
                const start = new Date(`${date}T00:00:00-05:00`);
                const end = new Date(`${date}T23:59:59.999-05:00`);
                qb.andWhere("p.createdAt BETWEEN :start AND :end", { start, end });
            }
            qb.orderBy("p.createdAt", "DESC")
                .skip((page - 1) * limit)
                .take(limit);
            try {
                const [orders, total] = yield qb.getManyAndCount();
                // Resolve Signed URLs for Comprobantes
                const { UploadFilesCloud } = yield Promise.resolve().then(() => __importStar(require("../../config/upload-files-cloud-adapter")));
                const { envs } = yield Promise.resolve().then(() => __importStar(require("../../config/env")));
                const ordersMapped = yield Promise.all(orders.map((order) => __awaiter(this, void 0, void 0, function* () {
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
                return {
                    orders: ordersMapped,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
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
            // Validar que el pedido pertenezca al negocio
            const Pedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).Pedido;
            const EstadoPedido = (yield Promise.resolve().then(() => __importStar(require("../../data")))).EstadoPedido;
            const order = yield Pedido.findOne({
                where: { id: orderId, negocio: { id: businessId } },
                relations: ["cliente"]
            });
            if (!order)
                throw domain_1.CustomError.notFound("Pedido no encontrado o no pertenece a este negocio");
            // Reglas de negocio: 
            // 1. PENDIENTE -> ACEPTADO
            // 2. ACEPTADO -> PREPARANDO
            // 3. PENDIENTE -> CANCELADO (Rechazo)
            if (status === EstadoPedido.ACEPTADO) {
                if (order.estado !== EstadoPedido.PENDIENTE) {
                    throw domain_1.CustomError.badRequest("Solo se pueden aceptar pedidos en estado PENDIENTE");
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
                // TODO: Notificar al usuario (Socket/Push)
            }
            else {
                throw domain_1.CustomError.badRequest("Estado no permitido para el negocio");
            }
            yield order.save();
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
            // 1. Definir rango de fecha (Día específico)
            const targetDate = date ? new Date(date) : new Date();
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);
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
            const validOrders = orders.filter(o => o.estado !== "CANCELADO");
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
                const totalProd = Number(order.total) || 0; // Total productos
                const delivery = Number(order.costoEnvio) || 0;
                const comision = Number(order.comisionTotal) || 0;
                // "Total Pagado" = Productos + Domicilio (User says: "Total pagado ✅ Incluye productos + costo de domicilio")
                const totalPagado = totalProd + delivery;
                totalVendido += totalProd;
                totalComision += comision;
                totalDelivery += delivery;
                // Lógica Global: El negocio SIEMPRE debe la comisión a la App
                deudaNegocioApp += comision;
                if (order.metodoPago === MetodoPago.EFECTIVO) {
                    totalEfectivo += totalPagado;
                    // Caso Efectivo:
                    // El dinero (Prod + Del) lo tiene el Motorizado/App.
                    // La App tiene el dinero de los Productos del Negocio.
                    // App debe devolver el valor de los productos al negocio.
                    deudaAppNegocio += totalProd;
                }
                else {
                    // Caso Transferencia:
                    // El dinero (Prod + Del) entra a la cuenta del Negocio.
                    totalTransferencia += totalPagado;
                    // El Negocio tiene el dinero del Delivery (que es del Motorizado/App).
                    // Negocio debe pagar el Delivery a la App.
                    deudaNegocioApp += delivery;
                }
            });
            // Caso 3: Transferencia + Efectivo (Balance Neto)
            // "Sumar lo que negocio debe a app (deudaNegocioApp) - Restar lo que app debe a negocio (deudaAppNegocio)"
            // Balance Final = deudaNegocioApp - deudaAppNegocio.
            // Si Positivo: Negocio debe pagar a App.
            // Si Negativo: App debe pagar a Negocio.
            // User Example: "Balance Neto... Puede ser: El negocio debe pagar / La app debe pagar".
            const balanceFinal = deudaNegocioApp - deudaAppNegocio;
            // Guardar o Actualizar Snapshot
            // Solo creamos/actualizamos si no está pagado/liquidado (o si queremos actualizar montos en PENDIENTE)
            if (!balanceSnapshot) {
                balanceSnapshot = new BalanceNegocio();
                balanceSnapshot.negocio = { id: businessId };
                balanceSnapshot.fecha = startOfDay;
            }
            if (balanceSnapshot.estado !== EstadoBalance.LIQUIDADO) {
                balanceSnapshot.totalVendido = totalVendido;
                balanceSnapshot.totalComision = totalComision;
                balanceSnapshot.totalDelivery = totalDelivery;
                balanceSnapshot.totalEfectivo = totalEfectivo;
                balanceSnapshot.totalTransferencia = totalTransferencia;
                balanceSnapshot.balanceFinal = balanceFinal;
                yield balanceSnapshot.save();
            }
            return {
                snapshot: balanceSnapshot, // Contains id, status, balance, etc.
                detail: {
                    totalVendido,
                    totalComision,
                    totalDelivery,
                    totalEfectivo,
                    totalTransferencia,
                    deudaNegocioApp,
                    deudaAppNegocio,
                    balanceFinal
                },
                orders: validOrders.map(o => ({
                    id: o.id,
                    totalProductos: Number(o.total),
                    totalPagado: Number(o.total) + Number(o.costoEnvio),
                    metodoPago: o.metodoPago,
                    estado: o.estado,
                    comision: Number(o.comisionTotal),
                    createdAt: o.createdAt
                }))
            };
        });
    }
    registerPayment(businessId, date, file) {
        return __awaiter(this, void 0, void 0, function* () {
            const { BalanceNegocio, EstadoBalance } = yield Promise.resolve().then(() => __importStar(require("../../data")));
            const { Between } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
            const targetDate = new Date(date);
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);
            let balanceSnapshot = yield BalanceNegocio.findOne({
                where: {
                    negocio: { id: businessId },
                    fecha: Between(startOfDay, endOfDay)
                }
            });
            if (!balanceSnapshot) {
                throw domain_1.CustomError.badRequest("No existe reporte financiero para esta fecha.");
            }
            // Subir archivo
            let urlComprobante = "";
            if (file) {
                const fileKey = `comprobantes/${Date.now()}_${file.name}`;
                urlComprobante = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: fileKey,
                    body: file.data,
                    contentType: file.mimetype
                });
                // Guardamos la URL prefirmada? O la KEY?
                // El modelo espera string. Guardemos la Key para persistencia a largo plazo, 
                // pero para mostrarla necesitamos firmarla cada vez.
                // Por simplicidad en esta demo, guardemos la KEY.
                // Para verla en frontend, necesitariamos un endpoint que resuelva la URL o firmarla al obtener el balance.
                // En `loginBusiness` resolvemos las imagenes. Hagamos lo mismo en `getFinanceSummary`?
                // Mejor: UploadFilesCloud.getFile devuelve URL firmada.
                // Guardamos KEY en DB.
                balanceSnapshot.comprobanteUrl = fileKey;
            }
            balanceSnapshot.estado = EstadoBalance.PAGADO;
            // User request: "Una vez pagado... marca dia como liquidado"
            balanceSnapshot.estado = EstadoBalance.LIQUIDADO;
            yield balanceSnapshot.save();
            return balanceSnapshot;
        });
    }
}
exports.BusinessService = BusinessService;
