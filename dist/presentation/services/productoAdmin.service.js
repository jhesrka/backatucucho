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
class ProductoServiceAdmin {
    getProductosAdmin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ limit = 5, offset = 0, status, search, negocioId, }) {
            const where = {};
            if (status && Object.values(data_1.StatusProducto).includes(status)) {
                where.statusProducto = status;
            }
            if (negocioId)
                where.negocio = { id: negocioId };
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
            const producto = yield data_1.Producto.findOne({ where: { id } });
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
            const producto = yield data_1.Producto.findOne({ where: { id } });
            if (!producto)
                throw new Error("Producto no encontrado");
            producto.statusProducto = status;
            if (status === data_1.StatusProducto.SUSPENDIDO || status === data_1.StatusProducto.BLOQUEADO) {
                producto.disponible = false;
            }
            yield producto.save();
            return { message: `Estado cambiado a ${status}`, status: producto.statusProducto };
        });
    }
    // ADMIN: Purge definitive
    deleteProductoAdmin(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const producto = yield data_1.Producto.findOne({ where: { id } });
            if (!producto)
                throw new Error("Producto no encontrado");
            if (producto.imagen) {
                yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: producto.imagen
                }).catch(() => null);
            }
            yield data_1.Producto.remove(producto);
            return { message: "Producto eliminado correctamente" };
        });
    }
}
exports.ProductoServiceAdmin = ProductoServiceAdmin;
