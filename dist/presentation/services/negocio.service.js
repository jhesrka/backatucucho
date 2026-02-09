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
exports.NegocioService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
const config_1 = require("../../config");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const DEFAULT_IMG_KEY = "ImgStore/imagenrota.jpg";
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
class NegocioService {
    // ========================= CREATE =========================
    createNegocio(dto, img) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id: dto.categoriaId });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            const usuario = yield data_1.User.findOneBy({ id: dto.userId });
            if (!usuario)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            if (categoria.soloComision && dto.modeloMonetizacion !== data_1.ModeloMonetizacion.COMISION_SUSCRIPCION) {
                throw domain_1.CustomError.badRequest(`La categoría '${categoria.nombre}' solo permite el modelo COMISION + SUSCRIPCION`);
            }
            const nombreExistente = yield data_1.Negocio.findOneBy({ nombre: dto.nombre });
            if (nombreExistente)
                throw domain_1.CustomError.badRequest("Ese nombre ya está en uso");
            const negociosPendientes = yield data_1.Negocio.count({
                where: {
                    usuario: { id: dto.userId },
                    statusNegocio: data_1.StatusNegocio.PENDIENTE,
                },
            });
            if (negociosPendientes >= 3) {
                throw domain_1.CustomError.badRequest("Ya tienes 3 negocios pendientes, espera aprobación");
            }
            let key = DEFAULT_IMG_KEY;
            if (img) {
                const validMimeTypes = [
                    "image/jpeg",
                    "image/jpg",
                    "image/png",
                    "image/webp",
                ];
                if (!validMimeTypes.includes(img.mimetype)) {
                    throw domain_1.CustomError.badRequest("Tipo de imagen no permitido. Usa JPG, PNG o WEBP.");
                }
                key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `negocios/${Date.now()}-${img.originalname}`,
                    body: img.buffer,
                    contentType: img.mimetype,
                });
            }
            const modelo = dto.modeloMonetizacion;
            // ⬇️ ⬇️ GUARDAMOS lat/long (y opcional direccionTexto si creas la columna)
            const negocio = data_1.Negocio.create({
                nombre: dto.nombre.trim(),
                descripcion: dto.descripcion.trim(),
                categoria,
                usuario,
                imagenNegocio: key,
                modeloMonetizacion: modelo,
                latitud: dto.latitud,
                longitud: dto.longitud,
                direccionTexto: (_a = dto.direccionTexto) !== null && _a !== void 0 ? _a : null,
                banco: dto.banco,
                tipoCuenta: dto.tipoCuenta,
                numeroCuenta: dto.numeroCuenta,
                titularCuenta: dto.titularCuenta,
                statusNegocio: data_1.StatusNegocio.PENDIENTE, // 🔒 Regla 2: SIEMPRE inicia en pendiente
            });
            try {
                const saved = yield negocio.save();
                const imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: saved.imagenNegocio,
                });
                return {
                    id: saved.id,
                    nombre: saved.nombre,
                    descripcion: saved.descripcion,
                    statusNegocio: saved.statusNegocio,
                    estadoNegocio: saved.estadoNegocio,
                    created_at: saved.created_at,
                    modeloMonetizacion: saved.modeloMonetizacion,
                    latitud: saved.latitud ? Number(saved.latitud) : null,
                    longitud: saved.longitud ? Number(saved.longitud) : null,
                    direccionTexto: saved.direccionTexto,
                    banco: saved.banco,
                    tipoCuenta: saved.tipoCuenta,
                    numeroCuenta: saved.numeroCuenta,
                    titularCuenta: saved.titularCuenta,
                    imagenUrl,
                    categoria: {
                        id: categoria.id,
                        nombre: categoria.nombre,
                        statusCategoria: categoria.statusCategoria,
                        restriccionModeloMonetizacion: categoria.restriccionModeloMonetizacion,
                        soloComision: categoria.soloComision,
                    },
                    usuario: { id: usuario.id },
                };
            }
            catch (_b) {
                throw domain_1.CustomError.internalServer("No se pudo crear el negocio");
            }
        });
    }
    // ========================= READ =========================
    // Función para barajar un array (Fisher-Yates Shuffle)
    getNegociosByCategoria(categoriaId) {
        return __awaiter(this, void 0, void 0, function* () {
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id: categoriaId });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            const negocios = yield data_1.Negocio.find({
                where: {
                    categoria: { id: categoriaId },
                    statusNegocio: data_1.StatusNegocio.ACTIVO,
                    estadoNegocio: data_1.EstadoNegocio.ABIERTO, // 🔥 Nuevo filtro
                },
                relations: ["categoria"],
                // order: { nombre: "ASC" }, // Ya no necesario si vamos a barajar
            });
            const negociosConUrl = yield Promise.all(negocios.map((negocio) => __awaiter(this, void 0, void 0, function* () {
                let imagenUrl = null;
                if (negocio.imagenNegocio) {
                    try {
                        imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: negocio.imagenNegocio,
                        });
                    }
                    catch (error) {
                        throw domain_1.CustomError.internalServer("Error obteniendo imagen del negocio");
                    }
                }
                return {
                    id: negocio.id,
                    nombre: negocio.nombre,
                    descripcion: negocio.descripcion,
                    statusNegocio: negocio.statusNegocio,
                    estadoNegocio: negocio.estadoNegocio,
                    created_at: negocio.created_at,
                    categoria: {
                        id: negocio.categoria.id,
                        nombre: negocio.categoria.nombre,
                        statusCategoria: negocio.categoria.statusCategoria,
                    },
                    imagenUrl,
                };
            })));
            // Barajar aleatoriamente antes de retornar
            return shuffleArray(negociosConUrl);
        });
    }
    toggleEstadoNegocio(negocioId) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id: negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            // Cambiar el estado
            negocio.estadoNegocio =
                negocio.estadoNegocio === data_1.EstadoNegocio.ABIERTO
                    ? data_1.EstadoNegocio.CERRADO
                    : data_1.EstadoNegocio.ABIERTO;
            yield negocio.save();
            return {
                message: `El negocio ahora está ${negocio.estadoNegocio.toLowerCase()}`,
                id: negocio.id,
                estadoNegocio: negocio.estadoNegocio,
            };
        });
    }
    getNegociosFiltrados(status) {
        return __awaiter(this, void 0, void 0, function* () {
            let whereCondition = {};
            if (status === "VISIBLES") {
                whereCondition = {
                    statusNegocio: [
                        data_1.StatusNegocio.PENDIENTE,
                        data_1.StatusNegocio.ACTIVO,
                        data_1.StatusNegocio.SUSPENDIDO,
                    ],
                };
            }
            else if (status &&
                Object.values(data_1.StatusNegocio).includes(status)) {
                whereCondition = {
                    statusNegocio: status,
                };
            }
            const negocios = yield data_1.Negocio.find({
                where: whereCondition,
                relations: ["categoria", "usuario"],
                order: { nombre: "ASC" },
            });
            try {
                const negociosConUrl = yield Promise.all(negocios.map((negocio) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    let imagenUrl = null;
                    let userProfileUrl = null;
                    if (negocio.imagenNegocio) {
                        try {
                            imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: negocio.imagenNegocio,
                            });
                        }
                        catch (error) {
                            throw domain_1.CustomError.internalServer("Error obteniendo imagen del negocio");
                        }
                    }
                    if ((_a = negocio.usuario) === null || _a === void 0 ? void 0 : _a.photoperfil) {
                        try {
                            userProfileUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: negocio.usuario.photoperfil,
                            });
                        }
                        catch (error) {
                            throw domain_1.CustomError.internalServer("Error obteniendo foto de perfil del usuario");
                        }
                    }
                    return {
                        id: negocio.id,
                        nombre: negocio.nombre,
                        descripcion: negocio.descripcion,
                        statusNegocio: negocio.statusNegocio,
                        created_at: negocio.created_at,
                        categoria: {
                            id: negocio.categoria.id,
                            nombre: negocio.categoria.nombre,
                            statusCategoria: negocio.categoria.statusCategoria,
                        },
                        usuario: {
                            id: negocio.usuario.id,
                            name: negocio.usuario.name,
                            surname: negocio.usuario.surname,
                            whatsapp: negocio.usuario.whatsapp,
                            photoperfil: userProfileUrl,
                        },
                        imagenUrl,
                    };
                })));
                return negociosConUrl;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error obteniendo datos de negocios");
            }
        });
    }
    getNegociosByUsuarioId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!config_1.regularExp.uuid.test(userId)) {
                throw domain_1.CustomError.badRequest("ID de usuario inválido");
            }
            const negocios = yield data_1.Negocio.find({
                where: { usuario: { id: userId } },
                relations: ["categoria"],
                order: { created_at: "DESC" },
            });
            const negociosConImagen = yield Promise.all(negocios.map((negocio) => __awaiter(this, void 0, void 0, function* () {
                let imagenUrl = null;
                try {
                    imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: negocio.imagenNegocio,
                    });
                }
                catch (error) {
                    throw domain_1.CustomError.internalServer("Error al obtener la imagen del negocio");
                }
                return {
                    id: negocio.id,
                    nombre: negocio.nombre,
                    descripcion: negocio.descripcion,
                    statusNegocio: negocio.statusNegocio,
                    created_at: negocio.created_at,
                    modeloMonetizacion: negocio.modeloMonetizacion,
                    estadoNegocio: negocio.estadoNegocio,
                    latitud: negocio.latitud ? Number(negocio.latitud) : null,
                    longitud: negocio.longitud ? Number(negocio.longitud) : null,
                    direccionTexto: negocio.direccionTexto,
                    banco: negocio.banco,
                    tipoCuenta: negocio.tipoCuenta,
                    numeroCuenta: negocio.numeroCuenta,
                    titularCuenta: negocio.titularCuenta,
                    imagenUrl,
                    categoria: {
                        id: negocio.categoria.id,
                        nombre: negocio.categoria.nombre,
                        statusCategoria: negocio.categoria.statusCategoria,
                        restriccionModeloMonetizacion: negocio.categoria.restriccionModeloMonetizacion,
                    },
                };
            })));
            return negociosConImagen;
        });
    }
    // ========================= UPDATE =========================
    // ✅ permitir actualizar lat/long en updateNegocio
    updateNegocio(id, data, img) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id },
                relations: ["categoria"],
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (data.nombre && data.nombre !== negocio.nombre) {
                const existe = yield data_1.Negocio.findOneBy({ nombre: data.nombre });
                if (existe)
                    throw domain_1.CustomError.badRequest("Ya existe un negocio con ese nombre");
                negocio.nombre = data.nombre.trim();
            }
            if (data.descripcion) {
                negocio.descripcion = data.descripcion.trim();
            }
            if (data.categoriaId) {
                const categoria = yield data_1.CategoriaNegocio.findOneBy({
                    id: data.categoriaId,
                });
                if (!categoria)
                    throw domain_1.CustomError.notFound("Categoría no encontrada");
                negocio.categoria = categoria;
                if (data.modeloMonetizacion &&
                    categoria.soloComision &&
                    data.modeloMonetizacion !== data_1.ModeloMonetizacion.COMISION_SUSCRIPCION) {
                    throw domain_1.CustomError.badRequest("Esta categoría solo permite el modelo COMISION + SUSCRIPCION");
                }
            }
            if (data.modeloMonetizacion) {
                if (negocio.categoria.soloComision &&
                    data.modeloMonetizacion !== data_1.ModeloMonetizacion.COMISION_SUSCRIPCION) {
                    throw domain_1.CustomError.badRequest("Esta categoría solo permite el modelo COMISION + SUSCRIPCION");
                }
                negocio.modeloMonetizacion = data.modeloMonetizacion;
            }
            // ⬇️ ⬇️ NUEVO: lat/long opcionales en update
            if (typeof data.latitud !== "undefined") {
                const lat = Number(data.latitud);
                if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
                    throw domain_1.CustomError.badRequest("Latitud inválida");
                }
                negocio.latitud = lat;
            }
            if (typeof data.longitud !== "undefined") {
                const lng = Number(data.longitud);
                if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
                    throw domain_1.CustomError.badRequest("Longitud inválida");
                }
                negocio.longitud = lng;
            }
            if (typeof data.direccionTexto !== "undefined") {
                const dir = String(data.direccionTexto || "").trim();
                negocio.direccionTexto = dir.length ? dir.slice(0, 200) : null;
            }
            // ⬇️ Actualizar Datos Bancarios
            if (data.banco)
                negocio.banco = data.banco.trim();
            if (data.tipoCuenta)
                negocio.tipoCuenta = data.tipoCuenta.trim();
            if (data.numeroCuenta)
                negocio.numeroCuenta = data.numeroCuenta.trim();
            if (data.titularCuenta)
                negocio.titularCuenta = data.titularCuenta.trim();
            if (img) {
                const validMimeTypes = [
                    "image/jpeg",
                    "image/jpg",
                    "image/png",
                    "image/webp",
                ];
                if (!validMimeTypes.includes(img.mimetype)) {
                    throw domain_1.CustomError.badRequest("Tipo de imagen no permitido. Usa JPG, PNG o WEBP.");
                }
                if (negocio.imagenNegocio !== DEFAULT_IMG_KEY) {
                    yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: negocio.imagenNegocio,
                    });
                }
                negocio.imagenNegocio = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `negocios/${Date.now()}-${img.originalname}`,
                    body: img.buffer,
                    contentType: img.mimetype,
                });
            }
            const saved = yield negocio.save();
            const imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                bucketName: config_1.envs.AWS_BUCKET_NAME,
                key: saved.imagenNegocio,
            });
            return {
                id: saved.id,
                nombre: saved.nombre,
                descripcion: saved.descripcion,
                statusNegocio: saved.statusNegocio,
                estadoNegocio: saved.estadoNegocio,
                modeloMonetizacion: saved.modeloMonetizacion,
                created_at: saved.created_at,
                latitud: saved.latitud ? Number(saved.latitud) : null,
                longitud: saved.longitud ? Number(saved.longitud) : null,
                direccionTexto: saved.direccionTexto,
                banco: saved.banco,
                tipoCuenta: saved.tipoCuenta,
                numeroCuenta: saved.numeroCuenta,
                titularCuenta: saved.titularCuenta,
                categoria: {
                    id: saved.categoria.id,
                    nombre: saved.categoria.nombre,
                    statusCategoria: saved.categoria.statusCategoria,
                    restriccionModeloMonetizacion: saved.categoria.restriccionModeloMonetizacion,
                    soloComision: saved.categoria.soloComision,
                },
                imagenUrl,
            };
        });
    }
    // ========================= DELETE =========================
    deleteIfNotActivo(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (negocio.statusNegocio === data_1.StatusNegocio.ACTIVO) {
                throw domain_1.CustomError.badRequest("No puedes eliminar un negocio ACTIVO");
            }
            if (negocio.imagenNegocio && negocio.imagenNegocio !== DEFAULT_IMG_KEY) {
                yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: negocio.imagenNegocio,
                });
            }
            yield negocio.remove();
            return { message: "Negocio eliminado correctamente" };
        });
    }
    deleteNegocio(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (negocio.imagenNegocio && negocio.imagenNegocio !== DEFAULT_IMG_KEY) {
                yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: negocio.imagenNegocio,
                });
            }
            yield negocio.remove();
            return {
                message: "Negocio eliminado correctamente. Mensaje desde el backend",
            };
        });
    }
    // ========================= TOGGLE STATUS =========================
    // ADMIN: Cambiar estado
    changeStatusNegocioAdmin(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            negocio.statusNegocio = status;
            yield negocio.save();
            return { message: `Estado cambiado a ${status}`, status: negocio.statusNegocio };
        });
    }
    // ADMIN: Purga definitiva
    purgeNegocioAdmin(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.deleteNegocio(id);
        });
    }
    // ========================= SUBSCRIPTION =========================
    paySubscription(negocioId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { SubscriptionService } = yield Promise.resolve().then(() => __importStar(require("./subscription.service")));
            const subService = new SubscriptionService();
            return yield subService.payBusinessSubscription(negocioId, userId);
        });
    }
}
exports.NegocioService = NegocioService;
