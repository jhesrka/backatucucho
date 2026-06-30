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
exports.ProductoService = void 0;
const typeorm_1 = require("typeorm");
const data_1 = require("../../data");
const NotificationService_1 = require("./NotificationService");
const domain_1 = require("../../domain");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const config_1 = require("../../config");
const socket_1 = require("../../config/socket");
class ProductoService {
    // ========================= CREATE =========================
    createProducto(dto, file) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!file) {
                throw domain_1.CustomError.badRequest("La imagen del producto es obligatoria");
            }
            const negocio = yield data_1.Negocio.findOneBy({ id: dto.negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            // === Verificar si ya existe un producto con el mismo nombre en este negocio ===
            const productoExistente = yield data_1.Producto.findOne({
                where: {
                    nombre: dto.nombre.trim(),
                    negocio: { id: negocio.id },
                },
            });
            if (productoExistente) {
                throw domain_1.CustomError.conflict("Ya existe un producto con ese nombre en este negocio. Usa otro nombre.");
            }
            // === Manejo de tipo de producto ===
            const tipo = yield this.resolveTipo(dto.tipoId);
            if (!tipo)
                throw domain_1.CustomError.internalServer("No se pudo asignar el tipo de producto");
            let key;
            let imageUrl;
            try {
                key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `productos/${Date.now()}-${file.originalname}`,
                    body: file.buffer,
                    contentType: file.mimetype,
                });
                imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key,
                });
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error subiendo la imagen del producto");
            }
            const producto = data_1.Producto.create({
                nombre: dto.nombre.trim(),
                descripcion: dto.descripcion.trim(),
                precio_venta: dto.precio_venta,
                precio_app: (_a = dto.precio_app) !== null && _a !== void 0 ? _a : dto.precio_venta,
                comision_producto: Number(dto.precio_venta) - Number((_b = dto.precio_app) !== null && _b !== void 0 ? _b : dto.precio_venta),
                imagen: key,
                disponible: true,
                negocio,
                tipo,
                tipoProducto: dto.tipoProducto,
            });
            try {
                const saved = yield producto.save();
                const result = {
                    id: saved.id,
                    nombre: saved.nombre,
                    descripcion: saved.descripcion,
                    precio_venta: saved.precio_venta,
                    precio_app: saved.precio_app,
                    comision_producto: saved.comision_producto,
                    imagen: imageUrl,
                    disponible: saved.disponible,
                    created_at: saved.created_at,
                    tipo: {
                        id: tipo.id,
                        nombre: tipo.nombre,
                        orden: tipo.orden,
                    },
                    tipoProducto: saved.tipoProducto,
                };
                // 🔔 Notificación a todos los admins
                try {
                    const admins = yield data_1.User.find({ where: { rol: data_1.UserRole.ADMIN } });
                    const notificationService = new NotificationService_1.NotificationService();
                    for (const admin of admins) {
                        yield notificationService.sendPushNotification(admin.id, "🍔 Nuevo Producto", `El negocio "${negocio.nombre}" ha añadido el producto "${saved.nombre}". Entra al panel para revisarlo.`, { url: "/admin/negocios" });
                    }
                }
                catch (error) {
                    console.error("Error enviando notificaciones push a admins:", error);
                }
                return result;
            }
            catch (error) {
                if (typeof error === "object" && error !== null && "code" in error) {
                    const pgError = error;
                    if (pgError.code === "23505") {
                        throw domain_1.CustomError.conflict("Ya existe un producto con ese nombre en este negocio. Usa otro nombre.");
                    }
                }
                throw domain_1.CustomError.internalServer("No se pudo guardar el producto");
            }
        });
    }
    // ========================= UPDATE =========================
    updateProducto(id, data, file) {
        return __awaiter(this, void 0, void 0, function* () {
            const producto = yield data_1.Producto.findOne({
                where: { id },
                relations: ["negocio", "tipo"],
            });
            if (!producto)
                throw domain_1.CustomError.notFound("Producto no encontrado");
            if (data.nombre)
                producto.nombre = data.nombre.trim();
            if (data.descripcion)
                producto.descripcion = data.descripcion.trim();
            if (typeof data.precio_venta === "number") {
                producto.precio_venta = data.precio_venta;
                producto.comision_producto = Number(data.precio_venta) - Number(producto.precio_app || data.precio_venta);
            }
            if (typeof data.precio_app === "number") {
                // ✅ REGLA CRÍTICA: Solo bloquear si el precio REALMENTE cambia y no está PENDIENTE
                if (producto.statusProducto !== data_1.StatusProducto.PENDIENTE && Number(data.precio_app) !== Number(producto.precio_app)) {
                    throw domain_1.CustomError.badRequest("El precio para la app solo puede modificarse mientras el producto esté en estado PENDIENTE.");
                }
                producto.precio_app = data.precio_app;
                producto.comision_producto =
                    Number(producto.precio_venta) - Number(data.precio_app);
            }
            if (data.tipoId) {
                const tipo = yield this.resolveTipo(data.tipoId);
                producto.tipo = tipo;
            }
            if (data.tipoProducto) {
                // ✅ REGLA CRÍTICA: Solo bloquear si el tipo REALMENTE cambia y no está PENDIENTE
                if (producto.statusProducto !== data_1.StatusProducto.PENDIENTE && data.tipoProducto !== producto.tipoProducto) {
                    throw domain_1.CustomError.badRequest("El tipo de despacho (Normal/Programado) solo puede modificarse mientras el producto esté en estado PENDIENTE.");
                }
                producto.tipoProducto = data.tipoProducto;
            }
            if (file) {
                try {
                    const key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: `productos/${Date.now()}-${file.originalname}`,
                        body: file.buffer,
                        contentType: file.mimetype,
                    });
                    producto.imagen = key;
                }
                catch (error) {
                    throw domain_1.CustomError.internalServer("Error subiendo la imagen del producto");
                }
            }
            yield producto.save();
            // 📡 Notificar por WebSockets (con datos completos)
            yield this.emitProductUpdate(producto);
            const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                bucketName: config_1.envs.AWS_BUCKET_NAME,
                key: producto.imagen,
            });
            return {
                id: producto.id,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                precio_venta: producto.precio_venta,
                precio_app: producto.precio_app,
                comision_producto: producto.comision_producto,
                imagen: imageUrl,
                disponible: producto.disponible,
                created_at: producto.created_at,
                tipo: producto.tipo
                    ? {
                        id: producto.tipo.id,
                        nombre: producto.tipo.nombre,
                        orden: producto.tipo.orden,
                    }
                    : null,
                tipoProducto: producto.tipoProducto,
            };
        });
    }
    // ========================= READ =========================
    getProductosByNegocio(negocioId_1) {
        return __awaiter(this, arguments, void 0, function* (negocioId, authenticatedUserId = "") {
            // 🛡️ Validar que el negocio existe y que el usuario es el dueño
            const negocio = yield data_1.Negocio.findOne({
                where: { id: negocioId },
                relations: ["usuario"]
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (negocio.usuario.id !== authenticatedUserId) {
                throw domain_1.CustomError.forbiden("No tienes permisos para ver los productos de este negocio");
            }
            const productos = yield data_1.Producto.find({
                where: { negocio: { id: negocioId } },
                relations: ["tipo"],
                order: { created_at: "DESC" },
            });
            return yield Promise.all(productos.map((p) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: p.imagen,
                });
                return {
                    id: p.id,
                    nombre: p.nombre,
                    descripcion: p.descripcion,
                    precio_venta: p.precio_venta,
                    precio_app: p.precio_app,
                    comision_producto: p.comision_producto,
                    imagen: imageUrl,
                    disponible: p.disponible,
                    orden: p.orden,
                    created_at: p.created_at,
                    statusProducto: p.statusProducto,
                    tipo: p.tipo
                        ? {
                            id: p.tipo.id,
                            nombre: p.tipo.nombre,
                            orden: p.tipo.orden,
                        }
                        : null,
                    tipoProducto: p.tipoProducto,
                };
            })));
        });
    }
    getProductosDisponiblesByNegocio(negocioId) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id: negocioId },
                relations: ["usuario", "subcategoria"], // relación con el User y subcategoría para verificar restricción de edad
            });
            if (!negocio) {
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            }
            if (negocio.statusNegocio !== data_1.StatusNegocio.ACTIVO) {
                throw domain_1.CustomError.badRequest("El negocio no está activo");
            }
            const productos = yield data_1.Producto.find({
                where: {
                    negocio: { id: negocioId },
                    disponible: true,
                    statusProducto: data_1.StatusProducto.ACTIVO,
                },
                relations: ["tipo"],
                order: { created_at: "DESC" },
            });
            const productosFormateados = yield Promise.all(productos.map((p) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: p.imagen,
                });
                return {
                    id: p.id,
                    nombre: p.nombre,
                    descripcion: p.descripcion,
                    precio_venta: p.precio_venta,
                    precio_app: p.precio_app,
                    comision_producto: p.comision_producto,
                    imagen: imageUrl,
                    disponible: p.disponible,
                    orden: p.orden,
                    created_at: p.created_at,
                    statusProducto: p.statusProducto,
                    tipo: p.tipo
                        ? {
                            id: p.tipo.id,
                            nombre: p.tipo.nombre,
                            orden: p.tipo.orden,
                        }
                        : null,
                    tipoProducto: p.tipoProducto,
                };
            })));
            // 🔧 Obtener la imagen del negocio
            const imagenNegocio = negocio.imagenNegocio
                ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: negocio.imagenNegocio,
                })
                : null;
            // ✅ Devolver datos completos del negocio
            return {
                negocio: {
                    id: negocio.id,
                    nombre: negocio.nombre,
                    imagenNegocio: imagenNegocio,
                    imagenUrl: imagenNegocio,
                    banco: negocio.banco,
                    tipoCuenta: negocio.tipoCuenta,
                    numeroCuenta: negocio.numeroCuenta,
                    titularCuenta: negocio.titularCuenta,
                    identificacionCuenta: negocio.identificacionCuenta,
                    correoCuenta: negocio.correoCuenta,
                    ratingPromedio: Number(negocio.ratingPromedio) || 0,
                    totalResenas: Number(negocio.totalResenas) || 0,
                    pago_tarjeta_habilitado_admin: negocio.pago_tarjeta_habilitado_admin,
                    pago_tarjeta_activo_negocio: negocio.pago_tarjeta_activo_negocio,
                    porcentaje_recargo_tarjeta: Number(negocio.porcentaje_recargo_tarjeta) || 0,
                    tiempoPreparacionMin: negocio.tiempoPreparacionMin,
                    tiempoPreparacionMax: negocio.tiempoPreparacionMax,
                    permiteProductosProgramados: negocio.permiteProductosProgramados,
                    tiempoProgramadoMin: negocio.tiempoProgramadoMin,
                    tiempoProgramadoMax: negocio.tiempoProgramadoMax,
                    subcategoria: negocio.subcategoria,
                },
                usuario: {
                    id: negocio.usuario.id,
                    nombre: negocio.usuario.name,
                    apellido: negocio.usuario.surname,
                },
                productos: productosFormateados,
            };
        });
    }
    // ========================= DELETE =========================
    deleteProducto(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const producto = yield data_1.Producto.findOne({ where: { id }, relations: ["negocio"] });
            if (!producto)
                throw domain_1.CustomError.notFound("Producto no encontrado");
            // ✅ REGLA: Los usuarios normales solo pueden borrar productos PENDIENTES
            if (producto.statusProducto !== data_1.StatusProducto.PENDIENTE) {
                throw domain_1.CustomError.badRequest("No puedes eliminar este producto porque ya fue procesado. Solicita al administrador su eliminación por WhatsApp.");
            }
            const negocioId = producto.negocio.id;
            if (producto.imagen) {
                yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: producto.imagen,
                }).catch(err => console.log('Error deleting s3 file', err));
            }
            yield data_1.Producto.remove(producto);
            // 📡 Notificar por WebSockets
            (0, socket_1.getIO)().emit("product_deleted", {
                productId: id,
                negocioId: negocioId,
            });
            return { message: "Producto eliminado correctamente" };
        });
    }
    // ADMIN: Cambiar status
    changeStatusProductoAdmin(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const producto = yield data_1.Producto.findOne({ where: { id }, relations: ["negocio", "tipo"] });
            if (!producto)
                throw domain_1.CustomError.notFound("Producto no encontrado");
            producto.statusProducto = status;
            // Also sync disponible if needed? Assuming status is higher level.
            if (status === data_1.StatusProducto.SUSPENDIDO || status === data_1.StatusProducto.BLOQUEADO) {
                producto.disponible = false;
            }
            const saved = yield producto.save();
            // 📡 Notificar por WebSockets
            yield this.emitProductUpdate(saved);
            return { message: `Estado cambiado a ${status}`, status: producto.statusProducto };
        });
    }
    // ADMIN: Purga definitiva
    purgeProductoAdmin(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.deleteProducto(id);
        });
    }
    // ========================= TOGGLE =========================
    toggleDisponible(id, disponible) {
        return __awaiter(this, void 0, void 0, function* () {
            const producto = yield data_1.Producto.findOne({ where: { id }, relations: ["negocio", "tipo"] });
            if (!producto)
                throw domain_1.CustomError.notFound("Producto no encontrado");
            producto.disponible = disponible;
            const saved = yield producto.save();
            // 📡 Notificar por WebSockets
            yield this.emitProductUpdate(saved);
            return saved;
        });
    }
    checkAvailability(ids) {
        return __awaiter(this, void 0, void 0, function* () {
            const products = yield data_1.Producto.find({
                where: { id: (0, typeorm_1.In)(ids) },
                select: ["id", "nombre", "disponible", "statusProducto"]
            });
            return products.map(p => ({
                id: p.id,
                nombre: p.nombre,
                disponible: p.disponible && p.statusProducto === data_1.StatusProducto.ACTIVO
            }));
        });
    }
    // ========================= REORDENAR =========================
    reordenarProductos(negocioId, ordenes, authenticatedUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id: negocioId },
                relations: ["usuario"]
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (negocio.usuario.id !== authenticatedUserId) {
                throw domain_1.CustomError.forbiden("No tienes permisos para reordenar productos de este negocio");
            }
            // Actualizar orden de cada producto masivamente o uno por uno
            for (const item of ordenes) {
                yield data_1.Producto.update({ id: item.id, negocio: { id: negocioId } }, { orden: item.orden });
            }
            return { message: "Productos reordenados correctamente" };
        });
    }
    // ========================= SOCKET UPDATE HELPER =========================
    emitProductUpdate(producto) {
        return __awaiter(this, void 0, void 0, function* () {
            let formattedProduct = null;
            if (producto.statusProducto === data_1.StatusProducto.ACTIVO) {
                const imageUrl = producto.imagen
                    ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: producto.imagen,
                    })
                    : null;
                formattedProduct = {
                    id: producto.id,
                    nombre: producto.nombre,
                    descripcion: producto.descripcion,
                    precio_venta: producto.precio_venta,
                    precio_app: producto.precio_app,
                    comision_producto: producto.comision_producto,
                    imagen: imageUrl,
                    disponible: producto.disponible,
                    created_at: producto.created_at,
                    statusProducto: producto.statusProducto,
                    tipo: producto.tipo
                        ? {
                            id: producto.tipo.id,
                            nombre: producto.tipo.nombre,
                            orden: producto.tipo.orden,
                        }
                        : null,
                    tipoProducto: producto.tipoProducto,
                    negocioId: producto.negocio.id
                };
            }
            (0, socket_1.getIO)().emit("product_status_changed", {
                productId: producto.id,
                negocioId: producto.negocio.id,
                disponible: producto.disponible,
                statusProducto: producto.statusProducto,
                product: formattedProduct, // Enviar objeto completo para inserción en vivo
            });
        });
    }
    // ========================= HELPER =========================
    resolveTipo(tipoId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!tipoId) {
                throw domain_1.CustomError.badRequest("Debe proporcionar un tipoId");
            }
            const tipoExistente = yield data_1.TipoProducto.findOneBy({ id: tipoId });
            if (!tipoExistente)
                throw domain_1.CustomError.notFound("Tipo de producto no encontrado");
            return tipoExistente;
        });
    }
}
exports.ProductoService = ProductoService;
