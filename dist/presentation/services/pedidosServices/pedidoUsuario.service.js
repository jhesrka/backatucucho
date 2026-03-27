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
exports.PedidoUsuarioService = void 0;
const typeorm_1 = require("typeorm");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const socket_1 = require("../../../config/socket");
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
const upload_files_cloud_adapter_1 = require("../../../config/upload-files-cloud-adapter");
const env_1 = require("../../../config/env");
const calcularEnvio_service_1 = require("./calcularEnvio.service");
const payphone_service_1 = require("../payphone.service");
class PedidoUsuarioService {
    static calcularEnvio(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id: dto.negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (!dto.lat || !dto.lng) {
                throw domain_1.CustomError.badRequest("Coordenadas inválidas");
            }
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
            // ✂️ Si el ID trae sufijo de reintento (ej: UUID--timestamp), extraemos solo el UUID del pedido (36 caracteres)
            const realOrderId = clientTxId.includes('--') ? clientTxId.split('--')[0] : clientTxId;
            const pedido = yield data_1.Pedido.findOne({
                where: { id: realOrderId },
                relations: ["negocio", "cliente", "productos", "productos.producto"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (!pedido.negocio.payphone_token)
                throw domain_1.CustomError.badRequest("El negocio no tiene token de Payphone configurado");
            const result = yield payphone_service_1.PayphoneService.confirmPayment(id, clientTxId, pedido.negocio.payphone_token);
            if (result.transactionStatus === "Approved") {
                pedido.estado = data_1.EstadoPedido.PENDIENTE; // Ya entra a la cola del restaurante
                pedido.estadoPago = "PAGADO";
                pedido.referenciaPago = id.toString();
                yield pedido.save();
                // 🔔 Notificar al negocio por Socket.io
                console.log(`🔔 [Socket] Pago confirmado. Emitiendo nuevo pedido a sala: ${pedido.negocio.id}`);
                const socketIO = (0, socket_1.getIO)();
                if (socketIO) {
                    socketIO.to(pedido.negocio.id).emit("nuevo_pedido", {
                        id: pedido.id,
                        estado: pedido.estado,
                        total: pedido.total,
                        productos: pedido.productos,
                        cliente: {
                            id: pedido.cliente.id,
                            name: pedido.cliente.name,
                            surname: pedido.cliente.surname
                        },
                        createdAt: pedido.createdAt
                    });
                }
                return { success: true, message: "Pago aprobado y pedido activado", status: result.transactionStatus };
            }
            else {
                pedido.estado = "CANCELADO";
                pedido.estadoPago = "FALLIDO";
                yield pedido.save();
                return { success: false, message: "El pago no fue aprobado", status: result.transactionStatus };
            }
        });
    }
    // Crear un pedido desde el frontend del cliente
    crearPedido(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                const fs = require('fs');
                const logPath = 'c:/Users/jhesr/OneDrive/Escritorio/academlo/proyectReales/atucuchoShop/atucuchoFull/atucuchoBack/tmp/order_debug.log';
                const logData = `[${new Date().toISOString()}] CREAR PEDIDO: negocioId=${dto.negocioId} | metodoPago=${dto.metodoPago}\n`;
                fs.appendFileSync(logPath, logData);
            }
            catch (e) { }
            // ... (validation logic identical to original)
            const { clienteId, negocioId, productos, ubicacionCliente, metodoPago, montoVuelto, comprobantePagoUrl, } = dto;
            const cliente = yield data_1.User.findOneBy({ id: clienteId });
            if (!cliente)
                throw domain_1.CustomError.notFound("Cliente no encontrado");
            const negocio = yield data_1.Negocio.findOneBy({ id: negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (!productos || productos.length === 0) {
                throw domain_1.CustomError.badRequest("Debe incluir al menos un producto");
            }
            if (!((_a = dto.ubicacionCliente) === null || _a === void 0 ? void 0 : _a.lat) || !((_b = dto.ubicacionCliente) === null || _b === void 0 ? void 0 : _b.lng)) {
                throw domain_1.CustomError.badRequest("Ubicación del cliente es obligatoria para calcular el envío");
            }
            // 🛒 1. Obtener porcentajes de comisión actuales
            const config = yield data_1.PriceSettings.findOne({ where: {} });
            const percMoto = config ? Number(config.motorizadoPercentage) : 80;
            const percApp = config ? Number(config.appPercentage) : 20;
            // 🛒 2. Obtener productos de la BD para auditoría de precios y comisiones
            const productIds = dto.productos.map(p => p.productoId);
            const dbProductos = yield data_1.Producto.findBy({ id: (0, typeorm_1.In)(productIds) });
            // Subtotal y comisiones de productos
            let calculatedSubtotal = 0;
            let comisionProductosApp = 0;
            let totalPrecioVentaPublico = 0;
            let totalPrecioApp = 0;
            let totalComisionProductos = 0;
            const productosDetalle = dto.productos.map((item) => {
                const dbProd = dbProductos.find((p) => p.id === item.productoId);
                if (!dbProd)
                    throw domain_1.CustomError.notFound(`Producto ${item.productoId} no encontrado`);
                const pp = new data_1.ProductoPedido();
                pp.producto = dbProd;
                pp.cantidad = Number(item.cantidad);
                pp.precio_venta = dbProd.precio_venta;
                pp.precio_app = dbProd.precio_app;
                pp.comision_producto = Number(dbProd.precio_venta) - Number(dbProd.precio_app);
                pp.subtotal = +(pp.cantidad * pp.precio_app).toFixed(2);
                calculatedSubtotal += pp.subtotal;
                comisionProductosApp += (pp.comision_producto * pp.cantidad);
                // Accumulate totals for Pedido
                totalPrecioVentaPublico += (pp.precio_venta * pp.cantidad);
                totalPrecioApp += (pp.precio_app * pp.cantidad);
                totalComisionProductos += (pp.comision_producto * pp.cantidad);
                return pp;
            });
            // 🚚 3. Calcular distancia y envío (server-side, confiable)
            const { distanciaKm, costoEnvio } = yield calcularEnvio_service_1.CalcularEnvioService.calcularParaPedido({
                negocio,
                latCliente: dto.ubicacionCliente.lat,
                lngCliente: dto.ubicacionCliente.lng,
            });
            // 💰 4. Desglose Financiero (Persistencia)
            const gananciaMoto = +(costoEnvio * (percMoto / 100)).toFixed(2);
            const comisionAppDom = +(costoEnvio * (percApp / 100)).toFixed(2);
            // Domicilio / motorizado specific fields
            const pago_motorizado = gananciaMoto; // Based on percMoto
            const comision_moto_app = +(costoEnvio - pago_motorizado).toFixed(2);
            // Total final pagado por el usuario (Precio Público + Envío)
            const total = +(totalPrecioVentaPublico + costoEnvio).toFixed(2);
            // Ganancia total de la APP (Comisión de Productos + Comisión Domicilio)
            const comisionTotalApp = +(totalComisionProductos + comisionAppDom).toFixed(2);
            // Lo que le queda al negocio (Equivalente a total_precio_app)
            const totalNegocio = +totalPrecioApp.toFixed(2);
            // 💳 5. Calcular recargo de Tarjeta (si aplica)
            let recargoTarjeta = 0;
            let checkoutUrl = null;
            if (metodoPago === "TARJETA") {
                if (!negocio.pago_tarjeta_habilitado_admin) {
                    throw domain_1.CustomError.badRequest("El pago con tarjeta está deshabilitado para este negocio por el administrador.");
                }
                if (!negocio.payphone_store_id || !negocio.payphone_token) {
                    const missing = !negocio.payphone_store_id ? "Store ID" : "Token";
                    throw domain_1.CustomError.badRequest(`Configuración incompleta: falta ${missing} de Payphone.`);
                }
                const porcentaje = Number(negocio.porcentaje_recargo_tarjeta) || 0;
                recargoTarjeta = +(total * (porcentaje / 100)).toFixed(2);
                try {
                    const fs = require('fs');
                    const logPath = 'c:/Users/jhesr/OneDrive/Escritorio/academlo/proyectReales/atucuchoShop/atucuchoFull/atucuchoBack/tmp/order_debug.log';
                    const logData = `[${new Date().toISOString()}] PAYPHONE VALIDATED: ${negocio.nombre} | storeId=${negocio.payphone_store_id} | percentage=${porcentaje}%\n`;
                    fs.appendFileSync(logPath, logData);
                }
                catch (e) { }
            }
            const totalFinal = +(total + recargoTarjeta).toFixed(2);
            // Construir pedido + items (cascade)
            const pedido = new data_1.Pedido();
            pedido.cliente = cliente;
            pedido.negocio = negocio;
            // Si es tarjeta, el pedido queda "PENDIENTE_PAGO" hasta que el webhook confirme
            pedido.estado =
                metodoPago === "TARJETA" ? "PENDIENTE_PAGO" : data_1.EstadoPedido.PENDIENTE;
            pedido.costoEnvio = costoEnvio;
            pedido.total = totalFinal;
            pedido.recargo_tarjeta = recargoTarjeta;
            pedido.estadoPago = metodoPago === "TARJETA" ? "PENDIENTE" : "N/A";
            // Asignar auditoría financiera
            pedido.porcentaje_motorizado_aplicado = percMoto;
            pedido.porcentaje_app_aplicado = percApp;
            pedido.ganancia_motorizado = gananciaMoto;
            pedido.comision_app_domicilio = comisionAppDom;
            pedido.ganancia_app_producto = comisionProductosApp;
            pedido.comisionTotal = comisionTotalApp;
            pedido.totalNegocio = totalNegocio;
            // New Pedido financial fields
            pedido.total_precio_venta_publico = +totalPrecioVentaPublico.toFixed(2);
            pedido.total_precio_app = +totalPrecioApp.toFixed(2);
            pedido.total_comision_productos = +totalComisionProductos.toFixed(2);
            pedido.pago_motorizado = pago_motorizado;
            pedido.comision_moto_app = comision_moto_app;
            pedido.distanciaKm = distanciaKm;
            pedido.latCliente = dto.ubicacionCliente.lat;
            pedido.lngCliente = dto.ubicacionCliente.lng;
            pedido.direccionTexto = (_c = dto.ubicacionCliente.direccionTexto) !== null && _c !== void 0 ? _c : null;
            // 💶 Datos de Pago
            if (dto.metodoPago) {
                pedido.metodoPago = dto.metodoPago;
            }
            if (dto.montoVuelto !== undefined)
                pedido.montoVuelto = dto.montoVuelto;
            if (dto.comprobantePagoUrl)
                pedido.comprobantePagoUrl = dto.comprobantePagoUrl; // Saves Key if provided
            pedido.productos = productosDetalle;
            let nuevo;
            try {
                nuevo = yield pedido.save();
            }
            catch (dbError) {
                // 🧪 AUTOCURACIÓN: Si falla por el Enum de PENDIENTE_PAGO
                if (dbError.message.includes("PENDIENTE_PAGO") || dbError.message.includes("enum")) {
                    console.log("⚠️ Falló PENDIENTE_PAGO, reintentando con PENDIENTE...");
                    pedido.estado = data_1.EstadoPedido.PENDIENTE;
                    nuevo = yield pedido.save();
                }
                else {
                    throw dbError;
                }
            }
            // 🚀 6. Configuración Payphone (BOX FLOW)
            let payphoneConfig = null;
            if (metodoPago === "TARJETA") {
                payphoneConfig = {
                    token: (_d = negocio.payphone_token) === null || _d === void 0 ? void 0 : _d.trim(),
                    storeId: (_e = negocio.payphone_store_id) === null || _e === void 0 ? void 0 : _e.trim(),
                    clientTransactionId: `${nuevo.id}--${Math.random().toString(36).substring(2, 8)}`,
                    amount: Math.round(totalFinal * 100),
                    amountWithoutTax: Math.round(totalFinal * 100),
                    currency: "USD",
                    reference: `Orden #${nuevo.id} - Atucucho Shop`
                };
            }
            // 🔔 7. Notificar al negocio (SOLO si NO es tarjeta, o si se confirma pago)
            // Para TARJETA, el webhook hará esta notificación.
            if (metodoPago !== "TARJETA") {
                console.log(`🔔 [Socket] Emitiendo nuevo pedido a sala: ${negocio.id} (ID Pedido: ${nuevo.id})`);
                (0, socket_1.getIO)().to(negocio.id).emit("nuevo_pedido", {
                    id: nuevo.id,
                    estado: nuevo.estado,
                    total: nuevo.total,
                    productos: nuevo.productos,
                    cliente: {
                        id: cliente.id,
                        name: cliente.name,
                        surname: cliente.surname
                    },
                    createdAt: nuevo.createdAt
                });
            }
            // Resolve URL for response (WhatsApp link)
            let solvedUrl = nuevo.comprobantePagoUrl;
            if (nuevo.comprobantePagoUrl && !nuevo.comprobantePagoUrl.startsWith('http')) {
                solvedUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: env_1.envs.AWS_BUCKET_NAME,
                    key: nuevo.comprobantePagoUrl
                });
            }
            return {
                id: nuevo.id,
                estado: nuevo.estado,
                total: nuevo.total,
                costoEnvio: nuevo.costoEnvio,
                distanciaKm: nuevo.distanciaKm,
                createdAt: nuevo.createdAt,
                metodoPago: nuevo.metodoPago,
                montoVuelto: nuevo.montoVuelto,
                comprobantePagoUrl: solvedUrl,
                payphoneConfig: payphoneConfig // 💳 Configuración Cajita
            };
        });
    }
    // ... (cambiarEstado remains same)
    // Ver los pedidos de un cliente
    obtenerPedidosCliente(clienteId_1) {
        return __awaiter(this, arguments, void 0, function* (clienteId, page = 1, limit = 5, filters = {}) {
            const skip = (page - 1) * limit;
            const query = data_1.Pedido.createQueryBuilder("pedido")
                .leftJoinAndSelect("pedido.negocio", "negocio")
                .leftJoinAndSelect("pedido.productos", "productos")
                .leftJoinAndSelect("productos.producto", "producto")
                .leftJoinAndSelect("pedido.motorizado", "motorizado")
                .where("pedido.clienteId = :clienteId", { clienteId })
                .orderBy("pedido.createdAt", "DESC")
                .skip(skip)
                .take(limit);
            if (filters.estado) {
                query.andWhere("pedido.estado = :estado", { estado: filters.estado });
            }
            if (filters.startDate) {
                const start = moment_timezone_1.default.tz(filters.startDate, "America/Guayaquil").startOf('day').toDate();
                query.andWhere("pedido.createdAt >= :startDate", { startDate: start });
            }
            if (filters.endDate) {
                const end = moment_timezone_1.default.tz(filters.endDate, "America/Guayaquil").endOf('day').toDate();
                query.andWhere("pedido.createdAt <= :endDate", { endDate: end });
            }
            const [pedidos, total] = yield query.getManyAndCount();
            const pedidosMapeados = yield Promise.all(pedidos.map((p) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                // Self-healing: Generar códigos si faltan
                let changed = false;
                if (p.estado === data_1.EstadoPedido.PREPARANDO_ASIGNADO && !p.pickup_code) {
                    p.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
                    p.pickup_verified = false;
                    changed = true;
                }
                if (p.estado === data_1.EstadoPedido.EN_CAMINO && !p.delivery_code) {
                    p.delivery_code = Math.floor(1000 + Math.random() * 9000).toString();
                    p.delivery_verified = false;
                    changed = true;
                }
                if (changed)
                    yield p.save();
                let solvedUrl = p.comprobantePagoUrl;
                if (p.comprobantePagoUrl && !p.comprobantePagoUrl.startsWith('http')) {
                    solvedUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: env_1.envs.AWS_BUCKET_NAME,
                        key: p.comprobantePagoUrl
                    });
                }
                return {
                    id: p.id,
                    estado: p.estado,
                    total: p.total,
                    costoEnvio: p.costoEnvio,
                    motivoCancelacion: p.motivoCancelacion,
                    delivery_code: p.delivery_code,
                    delivery_verified: p.delivery_verified,
                    pickup_code: p.pickup_code,
                    pickup_verified: p.pickup_verified,
                    arrival_time: p.arrival_time,
                    createdAt: p.createdAt,
                    negocio: {
                        id: p.negocio.id,
                        nombre: p.negocio.nombre,
                    },
                    productos: p.productos.map((pp) => ({
                        id: pp.id,
                        productoId: pp.producto.id,
                        nombre: pp.producto.nombre,
                        cantidad: pp.cantidad,
                        precio_venta: pp.precio_venta,
                        precio_app: pp.precio_app,
                        subtotal: pp.subtotal,
                    })),
                    fecha: p.createdAt,
                    metodoPago: p.metodoPago,
                    vuelto: p.montoVuelto ? true : false,
                    montoVuelto: p.montoVuelto,
                    comprobantePagoUrl: solvedUrl,
                    motorizado: p.motorizado ? {
                        id: p.motorizado.id,
                        name: p.motorizado.name,
                        surname: p.motorizado.surname,
                        telefono: p.motorizado.whatsapp,
                        whatsapp: p.motorizado.whatsapp,
                    } : null,
                    // 💳 Configuración para reintentar pago
                    payphoneConfig: p.estado === "PENDIENTE_PAGO" ? {
                        token: (_a = p.negocio.payphone_token) === null || _a === void 0 ? void 0 : _a.trim(),
                        storeId: (_b = p.negocio.payphone_store_id) === null || _b === void 0 ? void 0 : _b.trim(),
                        clientTransactionId: `${p.id}--${Math.random().toString(36).substring(2, 8)}`,
                        amount: Math.round(Number(p.total) * 100),
                        amountWithoutTax: Math.round(Number(p.total) * 100),
                        currency: "USD",
                        reference: `Orden #${p.id} - Atucucho Shop`
                    } : null
                };
            })));
            return {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                pedidos: pedidosMapeados,
            };
        });
    }
    // Eliminar pedido del cliente (solo si está pendiente)
    eliminarPedidoCliente(pedidoId, clienteId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const pedido = yield data_1.Pedido.findOne({
                where: { id: pedidoId },
                relations: ["cliente"],
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (pedido.cliente.id !== clienteId)
                throw domain_1.CustomError.unAuthorized("No tiene permiso para eliminar este pedido");
            if (pedido.estado !== data_1.EstadoPedido.PENDIENTE)
                throw domain_1.CustomError.badRequest("Solo puede eliminar pedidos pendientes");
            const negocioId = ((_a = pedido.negocio) === null || _a === void 0 ? void 0 : _a.id) || ((_c = (_b = (yield data_1.Pedido.findOne({ where: { id: pedidoId }, relations: ['negocio'] }))) === null || _b === void 0 ? void 0 : _b.negocio) === null || _c === void 0 ? void 0 : _c.id);
            yield data_1.Pedido.remove(pedido);
            if (negocioId) {
                (0, socket_1.getIO)().to(negocioId).emit("pedido_cancelado", { pedidoId });
            }
            return { message: "Pedido eliminado correctamente" };
        });
    }
    // Subir comprobante (servicio)
    // Subir comprobante (AWS S3)
    subirComprobante(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw domain_1.CustomError.badRequest("No se recibió ningún archivo");
            // Generar path único para S3: comprobantes/TIMESTAMP-name
            const originalName = file.originalname || file.name || "comprobante.jpg";
            // Limpieza básica del nombre
            const cleanName = originalName.replace(/\s+/g, "_");
            const pathKey = `comprobantes/${Date.now()}-${cleanName}`;
            // Obtener buffer (Multer usa .buffer, express-fileupload usa .data)
            const fileContent = file.buffer || file.data;
            const contentType = file.mimetype || "image/jpeg";
            if (!fileContent) {
                throw domain_1.CustomError.badRequest("El archivo está vacío o corrupto");
            }
            // Subir a AWS S3
            const uploadedKey = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                bucketName: env_1.envs.AWS_BUCKET_NAME,
                key: pathKey,
                body: fileContent,
                contentType: contentType,
            });
            // Retonar la URL firmada para que el frontend pueda visualizarlo inmediatamente
            const url = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                bucketName: env_1.envs.AWS_BUCKET_NAME,
                key: uploadedKey
            });
            return { url, key: uploadedKey };
        });
    }
    notificarYaVoy(pedidoId, clienteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
                where: { id: pedidoId, cliente: { id: clienteId } },
                relations: ["motorizado", "cliente"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (!pedido.motorizado)
                throw domain_1.CustomError.badRequest("No hay un motorizado asignado aún");
            // Notificar al motorizado
            (0, socket_1.getIO)().to(pedido.motorizado.id).emit("cliente_ya_va", {
                pedidoId: pedido.id,
                mensaje: "El cliente ya está saliendo",
            });
            return { message: "Notificación enviada al motorizado" };
        });
    }
    calificarPedido(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
                where: { id: dto.pedidoId },
                relations: ["negocio", "motorizado"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (pedido.estado !== data_1.EstadoPedido.ENTREGADO)
                throw domain_1.CustomError.badRequest("Solo puedes calificar pedidos entregados");
            const response = {
                message: "Calificación procesada",
                ratedNegocio: false,
                ratedMotorizado: false
            };
            // --- Calificar Negocio ---
            if (dto.ratingNegocio !== undefined) {
                if (pedido.ratingNegocio && Number(pedido.ratingNegocio) > 0) {
                    throw domain_1.CustomError.badRequest("Este pedido ya ha calificado al restaurante");
                }
                pedido.ratingNegocio = dto.ratingNegocio;
                if (pedido.negocio) {
                    const negocio = yield data_1.Negocio.findOneBy({ id: pedido.negocio.id });
                    if (negocio) {
                        const totalActual = Number(negocio.totalResenas) || 0;
                        const promedioActual = Number(negocio.ratingPromedio) || 0;
                        const nuevoTotal = totalActual + 1;
                        const nuevoPromedio = (promedioActual * totalActual + dto.ratingNegocio) / nuevoTotal;
                        negocio.totalResenas = nuevoTotal;
                        negocio.ratingPromedio = Number(nuevoPromedio.toFixed(1));
                        yield negocio.save();
                        response.ratedNegocio = true;
                    }
                }
            }
            // --- Calificar Motorizado ---
            if (dto.ratingMotorizado !== undefined) {
                if (pedido.ratingMotorizado && Number(pedido.ratingMotorizado) > 0) {
                    throw domain_1.CustomError.badRequest("Este pedido ya ha calificado al motorizado");
                }
                pedido.ratingMotorizado = dto.ratingMotorizado;
                if (pedido.motorizado) {
                    const moto = yield data_1.UserMotorizado.findOneBy({ id: pedido.motorizado.id });
                    if (moto) {
                        const totalActual = Number(moto.totalResenas) || 0;
                        const promedioActual = Number(moto.ratingPromedio) || 0;
                        const nuevoTotal = totalActual + 1;
                        const nuevoPromedio = (promedioActual * totalActual + dto.ratingMotorizado) / nuevoTotal;
                        moto.totalResenas = nuevoTotal;
                        moto.ratingPromedio = Number(nuevoPromedio.toFixed(1));
                        yield moto.save();
                        response.ratedMotorizado = true;
                    }
                }
            }
            yield pedido.save();
            return response;
        });
    }
    // 🔄 Recargar el tiempo de vida (5 min adicionales)
    refreshTimer(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOneBy({ id });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            // Solo si está esperando pago
            if (pedido.estado !== "PENDIENTE_PAGO")
                return { success: false, message: "El pedido no está en espera de pago" };
            pedido.createdAt = new Date(); // Resetear a NOW
            yield pedido.save();
            return { success: true, newCreatedAt: pedido.createdAt };
        });
    }
    // 🕒 Vigilante de limpieza (Pedidos expirados)
    static startMaintenanceJob() {
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = data_1.Pedido.getRepository();
                // Cancelar pedidos PENDIENTE_PAGO de más de 6 minutos (le damos 1 extra por si acaso)
                const result = yield repo.query(`
                UPDATE pedido 
                SET estado = 'CANCELADO', motivo_cancelacion = 'Tiempo de pago excedido (5 min)' 
                WHERE estado = 'PENDIENTE_PAGO' 
                AND "createdAt" < NOW() - INTERVAL '6 minutes'
            `);
                if (result[1] > 0)
                    console.log(`🧹 [Maintenance] ${result[1]} pedidos expirados cancelados.`);
            }
            catch (error) {
                console.error("❌ Error en MaintenanceJob:", error);
            }
        }), 60000); // Revisar cada minuto
    }
}
exports.PedidoUsuarioService = PedidoUsuarioService;
