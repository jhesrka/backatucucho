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
exports.ProductoServiceAdmin = void 0;
const data_1 = require("../../data");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const config_1 = require("../../config");
const typeorm_1 = require("typeorm");
const domain_1 = require("../../domain");
const socket_1 = require("../../config/socket");
const NotificationService_1 = require("./NotificationService");
const notificationService = new NotificationService_1.NotificationService();
class ProductoServiceAdmin {
    getProductosAdmin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ limit = 5, offset = 0, status, search, negocioId, tipoId, }) {
            const where = {};
            if (status && Object.values(data_1.StatusProducto).includes(status)) {
                where.statusProducto = status;
            }
            if (negocioId)
                where.negocio = { id: negocioId };
            if (tipoId)
                where.tipo = { id: tipoId };
            if (search)
                where.nombre = (0, typeorm_1.ILike)(`%${search}%`);
            const [productos, total] = yield data_1.Producto.findAndCount({
                where,
                relations: ["negocio", "negocio.categoria", "negocio.usuario", "tipo"],
                take: limit,
                skip: offset,
                order: { created_at: "DESC" },
            });
            const productosConDatos = yield Promise.all(productos.map((p) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                let imagenUrl = null;
                try {
                    imagenUrl = (yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: p.imagen,
                    }));
                }
                catch (_c) { }
                // 🔹 Contar total de unidades pedidas del producto
                const { total } = (yield data_1.ProductoPedido.createQueryBuilder("pp")
                    .select("COALESCE(SUM(pp.cantidad), 0)", "total")
                    .where("pp.productoId = :id", { id: p.id })
                    .getRawOne()) || { total: 0 };
                const vecesPedidoApp = Number(total);
                const dueño = ((_a = p.negocio) === null || _a === void 0 ? void 0 : _a.usuario)
                    ? {
                        id: p.negocio.usuario.id,
                        nombre: p.negocio.usuario.name,
                        apellido: p.negocio.usuario.surname,
                        whatsapp: p.negocio.usuario.whatsapp,
                    }
                    : null;
                return {
                    id: p.id,
                    nombre: p.nombre,
                    descripcion: p.descripcion,
                    precio_venta: p.precio_venta,
                    precio_app: (_b = p.precio_app) !== null && _b !== void 0 ? _b : null,
                    comision_producto: Number(p.precio_venta) - Number(p.precio_app || p.precio_venta),
                    disponible: p.disponible,
                    statusProducto: p.statusProducto,
                    created_at: p.created_at,
                    tipo: p.tipo ? { id: p.tipo.id, nombre: p.tipo.nombre } : null,
                    negocio: p.negocio
                        ? {
                            id: p.negocio.id,
                            nombre: p.negocio.nombre,
                            estado: p.negocio.statusNegocio || null,
                            categoria: p.negocio.categoria
                                ? {
                                    id: p.negocio.categoria.id,
                                    nombre: p.negocio.categoria.nombre,
                                }
                                : null,
                            dueño,
                        }
                        : null,
                    imagenUrl,
                    vecesPedidoApp,
                };
            })));
            const totalPages = Math.ceil(total / limit);
            const currentPage = Math.ceil((offset + 1) / limit);
            return { total, productos: productosConDatos, totalPages, currentPage };
        });
    }
    updateProductoAdmin(id_1, _a) {
        return __awaiter(this, arguments, void 0, function* (id, { nombre, descripcion, precio_venta, precio_app, disponible, statusProducto, imagen, }) {
            const producto = yield data_1.Producto.findOne({ where: { id }, relations: ["negocio", "tipo"] });
            if (!producto)
                throw new Error("Producto no encontrado");
            // 🔹 Si llega una nueva imagen, eliminar la anterior y subir la nueva
            if (imagen) {
                if (producto.imagen) {
                    yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: producto.imagen,
                    });
                }
                const key = `productos/${Date.now()}-${imagen.originalname}`;
                const savedKey = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key,
                    body: imagen.buffer,
                    contentType: imagen.mimetype,
                });
                producto.imagen = savedKey;
            }
            // 🔹 Actualizar campos opcionales
            if (nombre !== undefined)
                producto.nombre = nombre;
            if (descripcion !== undefined)
                producto.descripcion = descripcion;
            if (precio_venta !== undefined) {
                producto.precio_venta = precio_venta;
                // Auto-update comision if app price already exists
                producto.comision_producto = Number(precio_venta) - Number(producto.precio_app || precio_venta);
            }
            if (precio_app !== undefined) {
                producto.precio_app = precio_app;
                producto.comision_producto = Number(producto.precio_venta) - Number(precio_app);
            }
            if (disponible !== undefined)
                producto.disponible = disponible;
            if (statusProducto &&
                Object.values(data_1.StatusProducto).includes(statusProducto)) {
                producto.statusProducto = statusProducto;
            }
            yield producto.save();
            // 📡 Notificar por WebSockets
            yield this.emitProductUpdate(producto);
            // 🔹 Obtener la URL de la imagen actualizada (si aplica)
            let imagenUrl = null;
            if (producto.imagen) {
                try {
                    imagenUrl = (yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: producto.imagen,
                    }));
                }
                catch (_b) { }
            }
            return {
                id: producto.id,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                precio_venta: producto.precio_venta,
                precio_app: producto.precio_app,
                comision_producto: producto.comision_producto,
                disponible: producto.disponible,
                statusProducto: producto.statusProducto,
                imagenUrl,
            };
        });
    }
    // ADMIN: Change status only
    changeStatusProductoAdmin(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const producto = yield data_1.Producto.findOne({ where: { id }, relations: ["negocio", "tipo"] });
            if (!producto)
                throw new Error("Producto no encontrado");
            producto.statusProducto = status;
            if (status === data_1.StatusProducto.SUSPENDIDO || status === data_1.StatusProducto.BLOQUEADO) {
                producto.disponible = false;
            }
            const saved = yield producto.save();
            // 📡 Notificar por WebSockets
            yield this.emitProductUpdate(saved);
            return { message: `Estado cambiado a ${status}`, status: producto.statusProducto };
        });
    }
    // ADMIN: Purge definitive
    deleteProductoAdmin(id, pin) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pin)
                throw domain_1.CustomError.badRequest("El PIN maestro es obligatorio");
            // 1. Obtener validación de PIN desde settings
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!(settings === null || settings === void 0 ? void 0 : settings.masterPin)) {
                throw domain_1.CustomError.internalServer("El PIN maestro no está configurado en el sistema.");
            }
            const isPinValid = config_1.encriptAdapter.compare(pin, settings.masterPin);
            if (!isPinValid) {
                throw domain_1.CustomError.badRequest("El PIN maestro ingresado es incorrecto.");
            }
            const producto = yield data_1.Producto.findOne({ where: { id }, relations: ["negocio"] });
            if (!producto)
                throw domain_1.CustomError.notFound("Producto no encontrado");
            // 🛑 VALIDACIÓN CRÍTICA: No borrar si tiene pedidos (Integridad Referencial)
            const tienePedidos = yield data_1.ProductoPedido.count({ where: { producto: { id: producto.id } } });
            if (tienePedidos > 0) {
                throw domain_1.CustomError.badRequest("Este producto no puede eliminarse porque tiene historial de pedidos. Te sugerimos suspenderlo o marcarlo como agotado.");
            }
            const negocioId = producto.negocio.id;
            if (producto.imagen) {
                yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: producto.imagen
                }).catch(() => null);
            }
            yield data_1.Producto.remove(producto);
            // 📡 Notificar por WebSockets
            (0, socket_1.getIO)().emit("product_deleted", {
                productId: id,
                negocioId: negocioId,
            });
            return { message: "Producto eliminado definitivamente del catálogo actual" };
        });
    }
    // ========================= BULK CREATE =========================
    bulkCreateProductosAdmin(negocioId, productosData, pin) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!pin)
                throw domain_1.CustomError.badRequest("El PIN maestro es obligatorio");
            // 1. Validar PIN
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!(settings === null || settings === void 0 ? void 0 : settings.masterPin)) {
                throw domain_1.CustomError.internalServer("El PIN maestro no está configurado.");
            }
            const isPinValid = config_1.encriptAdapter.compare(pin, settings.masterPin);
            if (!isPinValid)
                throw domain_1.CustomError.badRequest("PIN maestro incorrecto.");
            // 2. Validar Negocio
            const negocio = yield data_1.Negocio.findOneBy({ id: negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            const createdProducts = [];
            const errors = [];
            // 3. Procesamiento en lote
            for (const data of productosData) {
                try {
                    if (!data.nombre)
                        throw new Error("Falta el nombre del producto");
                    // Resolver Categoría (TipoProducto)
                    let tipoId = null;
                    if (data.categoria) {
                        let tipo = yield data_1.TipoProducto.findOneBy({
                            nombre: data.categoria.trim(),
                            negocio: { id: negocioId }
                        });
                        if (!tipo) {
                            tipo = data_1.TipoProducto.create({
                                nombre: data.categoria.trim(),
                                negocio: { id: negocioId }
                            });
                            yield tipo.save();
                        }
                        tipoId = tipo;
                    }
                    const precioVenta = Number(data.precio_venta) || 0;
                    const precioApp = Number(data.precio_app) || precioVenta;
                    const product = new data_1.Producto();
                    product.nombre = data.nombre.trim();
                    product.descripcion = ((_a = data.descripcion) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                    product.precio_venta = precioVenta;
                    product.precio_app = precioApp;
                    product.comision_producto = precioVenta - precioApp;
                    product.disponible = false; // 🛑 Requisito: disponible false
                    product.statusProducto = data_1.StatusProducto.ACTIVO; // Admin lo sube directo como activo
                    product.negocio = negocio;
                    if (tipoId)
                        product.tipo = tipoId;
                    yield product.save();
                    createdProducts.push(product.nombre);
                }
                catch (err) {
                    errors.push({ nombre: data.nombre || "Desconocido", error: err.message });
                }
            }
            return {
                message: `Proceso completado. ${createdProducts.length} productos creados.`,
                created: createdProducts,
                errors: errors.length > 0 ? errors : undefined
            };
        });
    }
    // ========================= SOCKET UPDATE HELPER =========================
    emitProductUpdate(producto) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
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
                        }
                        : null,
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
            // 🔔 Notificación Push al Dueño de Negocio
            if ((_a = producto.negocio) === null || _a === void 0 ? void 0 : _a.usuario) {
                let title = "Actualización de Producto";
                let body = `El estado de tu producto '${producto.nombre}' ha cambiado a ${producto.statusProducto}.`;
                if (producto.statusProducto === data_1.StatusProducto.ACTIVO) {
                    title = "¡Producto Aprobado!";
                    body = `Tu producto '${producto.nombre}' ha sido aprobado y ya está visible en tu negocio.`;
                }
                yield notificationService.sendPushNotification(producto.negocio.usuario.id, title, body, { url: `/business/dashboard/${producto.negocio.id}/products` });
            }
        });
    }
}
exports.ProductoServiceAdmin = ProductoServiceAdmin;
