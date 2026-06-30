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
const NotificationService_1 = require("./NotificationService");
const domain_1 = require("../../domain");
const config_1 = require("../../config");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const socket_1 = require("../../config/socket");
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
            var _a, _b, _c;
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id: dto.categoriaId });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            const usuario = yield data_1.User.findOneBy({ id: dto.userId });
            if (!usuario)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            let modelo = dto.modeloMonetizacion;
            if (categoria.modeloBloqueado && categoria.modeloMonetizacionDefault) {
                modelo = categoria.modeloMonetizacionDefault;
            }
            else if (categoria.soloComision && dto.modeloMonetizacion !== data_1.ModeloMonetizacion.COMISION_SUSCRIPCION) {
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
            // Eliminamos la linea "const modelo = dto.modeloMonetizacion;" porque ya definimos 'modelo' arriba.
            let subcategoria = null;
            if (dto.subcategoriaId) {
                subcategoria = yield data_1.SubcategoriaNegocio.findOneBy({
                    id: dto.subcategoriaId,
                    categoria: { id: categoria.id }
                });
                if (!subcategoria)
                    throw domain_1.CustomError.notFound("Subcategoría no encontrada o no pertenece a la categoría");
            }
            // ⬇️ ⬇️ GUARDAMOS lat/long (y opcional direccionTexto si creas la columna)
            const negocio = new data_1.Negocio();
            negocio.nombre = dto.nombre.trim();
            negocio.descripcion = dto.descripcion.trim();
            negocio.categoria = categoria;
            negocio.subcategoria = subcategoria;
            negocio.usuario = usuario;
            negocio.imagenNegocio = key;
            negocio.modeloMonetizacion = modelo;
            negocio.latitud = dto.latitud;
            negocio.longitud = dto.longitud;
            negocio.direccionTexto = (_a = dto.direccionTexto) !== null && _a !== void 0 ? _a : null;
            negocio.banco = dto.banco;
            negocio.tipoCuenta = dto.tipoCuenta;
            negocio.numeroCuenta = dto.numeroCuenta;
            negocio.titularCuenta = dto.titularCuenta;
            negocio.identificacionCuenta = dto.identificacionCuenta;
            negocio.correoCuenta = dto.correoCuenta;
            negocio.tiempoPreparacionMin = dto.tiempoPreparacionMin;
            negocio.tiempoPreparacionMax = dto.tiempoPreparacionMax;
            negocio.permiteProductosProgramados = dto.permiteProductosProgramados;
            negocio.tiempoProgramadoMin = (_b = dto.tiempoProgramadoMin) !== null && _b !== void 0 ? _b : null;
            negocio.tiempoProgramadoMax = (_c = dto.tiempoProgramadoMax) !== null && _c !== void 0 ? _c : null;
            negocio.statusNegocio = data_1.StatusNegocio.PENDIENTE;
            try {
                const saved = yield negocio.save();
                const imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: saved.imagenNegocio,
                });
                const result = {
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
                    identificacionCuenta: saved.identificacionCuenta,
                    correoCuenta: saved.correoCuenta,
                    tiempoPreparacionMin: saved.tiempoPreparacionMin,
                    tiempoPreparacionMax: saved.tiempoPreparacionMax,
                    permiteProductosProgramados: saved.permiteProductosProgramados,
                    tiempoProgramadoMin: saved.tiempoProgramadoMin,
                    tiempoProgramadoMax: saved.tiempoProgramadoMax,
                    puedePublicarProductos: saved.puedePublicarProductos,
                    limitePublicacionesSuscripcion: saved.limitePublicacionesSuscripcion,
                    publicacionesRestantes: saved.publicacionesRestantes,
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
                // 🔔 Notificación a todos los admins
                try {
                    const admins = yield data_1.User.find({ where: { rol: data_1.UserRole.ADMIN } });
                    const notificationService = new NotificationService_1.NotificationService();
                    for (const admin of admins) {
                        yield notificationService.sendPushNotification(admin.id, "🏢 Nuevo Negocio", `Se ha registrado el negocio "${saved.nombre}". Entra al panel para revisarlo.`, { url: "/admin" });
                    }
                }
                catch (error) {
                    console.error("Error enviando notificaciones push a admins:", error);
                }
                return result;
            }
            catch (_d) {
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
            // OPTIMIZACIÓN: Delegar el orden aleatorio a PostgreSQL (ORDER BY RANDOM())
            // 1. Obtenemos los negocios activos de la categoría con QueryBuilder
            const negocios = yield data_1.Negocio.createQueryBuilder("negocio")
                .leftJoinAndSelect("negocio.categoria", "categoria")
                .leftJoinAndSelect("negocio.subcategoria", "subcategoria")
                .innerJoin("negocio.usuario", "usuario", "usuario.status = :userStatus", { userStatus: data_1.Status.ACTIVE })
                .where("negocio.categoriaId = :categoriaId", { categoriaId })
                .andWhere("negocio.statusNegocio = :status", { status: data_1.StatusNegocio.ACTIVO })
                .andWhere("negocio.estadoNegocio = :estado", { estado: data_1.EstadoNegocio.ABIERTO })
                // FILTRO AL VUELO: No mostrar si la suscripción ya venció
                .andWhere("(negocio.fechaFinSuscripcion IS NULL OR negocio.fechaFinSuscripcion > :now)", { now: new Date() })
                .orderBy("subcategoria.orden", "ASC")
                .addOrderBy("subcategoria.created_at", "ASC")
                .addOrderBy("negocio.orden", "ASC")
                .addOrderBy("RANDOM()")
                .getMany();
            const negociosConUrl = yield Promise.all(negocios.map((negocio) => __awaiter(this, void 0, void 0, function* () {
                let imagenUrl = null;
                if (negocio.imagenNegocio) {
                    try {
                        imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: negocio.imagenNegocio,
                        });
                    }
                    catch (error) {
                        console.error(`Error obteniendo imagen para negocio ${negocio.id}:`, error);
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
                    subcategoria: negocio.subcategoria ? {
                        id: negocio.subcategoria.id,
                        nombre: negocio.subcategoria.nombre,
                        orden: negocio.subcategoria.orden,
                    } : null,
                    orden: negocio.orden, // ✅ PRIORIDAD DEL NEGOCIO
                    imagenUrl,
                    ratingPromedio: Number(negocio.ratingPromedio) || 0,
                    totalResenas: Number(negocio.totalResenas) || 0,
                    tiempoPreparacionMin: negocio.tiempoPreparacionMin,
                    tiempoPreparacionMax: negocio.tiempoPreparacionMax,
                    permiteProductosProgramados: negocio.permiteProductosProgramados,
                    tiempoProgramadoMin: negocio.tiempoProgramadoMin,
                    tiempoProgramadoMax: negocio.tiempoProgramadoMax,
                };
            })));
            return negociosConUrl;
        });
    }
    toggleEstadoNegocio(negocioId) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id: negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (negocio.statusNegocio === data_1.StatusNegocio.NO_PAGADO && negocio.estadoNegocio === data_1.EstadoNegocio.CERRADO) {
                throw domain_1.CustomError.badRequest("No puedes abrir el negocio porque tienes una suscripción pendiente de pago. Recarga tu wallet para reactivarlo.");
            }
            // Cambiar el estado
            negocio.estadoNegocio =
                negocio.estadoNegocio === data_1.EstadoNegocio.ABIERTO
                    ? data_1.EstadoNegocio.CERRADO
                    : data_1.EstadoNegocio.ABIERTO;
            yield negocio.save();
            // 📡 Notificar por WebSockets
            const io = (0, socket_1.getIO)();
            const statusData = {
                businessId: negocio.id,
                newStatus: negocio.estadoNegocio, // 'ABIERTO' | 'CERRADO'
            };
            // Emitir globalmente (para las listas de categorías)
            io.emit("business_status_changed", statusData);
            // Emitir específicamente a los que están dentro del negocio
            io.to(negocio.id).emit("business_status_changed", statusData);
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
            // Para asegurar que los dueños de negocios eliminados NO aparezcan
            whereCondition.usuario = { status: data_1.Status.ACTIVE };
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
                            imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
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
                        orden: negocio.orden, // ✅ PRIORIDAD
                        ratingPromedio: Number(negocio.ratingPromedio) || 0,
                        totalResenas: Number(negocio.totalResenas) || 0,
                        tiempoPreparacionMin: negocio.tiempoPreparacionMin,
                        tiempoPreparacionMax: negocio.tiempoPreparacionMax,
                        permiteProductosProgramados: negocio.permiteProductosProgramados,
                        tiempoProgramadoMin: negocio.tiempoProgramadoMin,
                        tiempoProgramadoMax: negocio.tiempoProgramadoMax,
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
            const negocios = yield data_1.Negocio.createQueryBuilder("negocio")
                .leftJoinAndSelect("negocio.categoria", "categoria")
                .leftJoinAndSelect("negocio.subcategoria", "subcategoria")
                .loadRelationCountAndMap("negocio.productosCount", "negocio.productos")
                .where("negocio.usuarioId = :userId", { userId })
                .orderBy("negocio.created_at", "DESC")
                .getMany();
            const negociosConImagen = yield Promise.all(negocios.map((negocio) => __awaiter(this, void 0, void 0, function* () {
                let imagenUrl = null;
                try {
                    imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
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
                    identificacionCuenta: negocio.identificacionCuenta,
                    correoCuenta: negocio.correoCuenta,
                    tiempoPreparacionMin: negocio.tiempoPreparacionMin,
                    tiempoPreparacionMax: negocio.tiempoPreparacionMax,
                    permiteProductosProgramados: negocio.permiteProductosProgramados,
                    tiempoProgramadoMin: negocio.tiempoProgramadoMin,
                    tiempoProgramadoMax: negocio.tiempoProgramadoMax,
                    puedePublicarProductos: negocio.puedePublicarProductos,
                    limitePublicacionesSuscripcion: negocio.limitePublicacionesSuscripcion,
                    publicacionesRestantes: negocio.publicacionesRestantes,
                    productosCount: negocio.productosCount || 0,
                    ratingPromedio: Number(negocio.ratingPromedio) || 0,
                    totalResenas: Number(negocio.totalResenas) || 0,
                    valorSuscripcion: Number(negocio.valorSuscripcion) || 0,
                    fechaInicioSuscripcion: negocio.fechaInicioSuscripcion,
                    fechaFinSuscripcion: negocio.fechaFinSuscripcion,
                    pago_tarjeta_habilitado_admin: negocio.pago_tarjeta_habilitado_admin,
                    orden: negocio.orden, // ✅ PRIORIDAD
                    imagenUrl,
                    categoria: {
                        id: negocio.categoria.id,
                        nombre: negocio.categoria.nombre,
                        statusCategoria: negocio.categoria.statusCategoria,
                        restriccionModeloMonetizacion: negocio.categoria.restriccionModeloMonetizacion,
                    },
                    subcategoria: negocio.subcategoria ? {
                        id: negocio.subcategoria.id,
                        nombre: negocio.subcategoria.nombre
                    } : null,
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
                relations: ["categoria", "subcategoria"],
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
                if (categoria.modeloBloqueado && categoria.modeloMonetizacionDefault) {
                    negocio.modeloMonetizacion = categoria.modeloMonetizacionDefault;
                }
                else if (data.modeloMonetizacion &&
                    categoria.soloComision &&
                    data.modeloMonetizacion !== data_1.ModeloMonetizacion.COMISION_SUSCRIPCION) {
                    throw domain_1.CustomError.badRequest("Esta categoría solo permite el modelo COMISION + SUSCRIPCION");
                }
                else if (data.modeloMonetizacion) {
                    // Si no está bloqueado y enviaron modelo, lo actualizamos (respetando la nueva categoría)
                    negocio.modeloMonetizacion = data.modeloMonetizacion;
                }
            }
            if (data.modeloMonetizacion && !data.categoriaId) {
                if (negocio.categoria.modeloBloqueado) {
                    // Si está bloqueado y tratamos de cambiarlo sin cambiar categoría, rechazamos o ignoramos.
                    // Mejor rechazar para feedback claro.
                    throw domain_1.CustomError.badRequest("La categoría actual bloquea el cambio de modelo de monetización");
                }
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
            if (data.identificacionCuenta)
                negocio.identificacionCuenta = data.identificacionCuenta.trim();
            if (data.correoCuenta)
                negocio.correoCuenta = data.correoCuenta.trim();
            // 🛡️ RESTRICCIÓN: No permitir cambiar tiempos si hay pedidos activos (CRÍTICOS)
            // Solo bloqueamos si el valor enviado es REALMENTE diferente al actual
            const isChangingPrepTimes = (data.tiempoPreparacionMin !== undefined && data.tiempoPreparacionMin !== negocio.tiempoPreparacionMin) ||
                (data.tiempoPreparacionMax !== undefined && data.tiempoPreparacionMax !== negocio.tiempoPreparacionMax) ||
                (data.permiteProductosProgramados !== undefined && data.permiteProductosProgramados !== negocio.permiteProductosProgramados) ||
                (data.tiempoProgramadoMin !== undefined && data.tiempoProgramadoMin !== negocio.tiempoProgramadoMin) ||
                (data.tiempoProgramadoMax !== undefined && data.tiempoProgramadoMax !== negocio.tiempoProgramadoMax);
            if (isChangingPrepTimes) {
                const { Pedido, EstadoPedido } = yield Promise.resolve().then(() => __importStar(require("../../data")));
                const { Not, In } = yield Promise.resolve().then(() => __importStar(require("typeorm")));
                const activeOrdersCount = yield Pedido.count({
                    where: {
                        negocio: { id: id },
                        estado: Not(In([EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO]))
                    }
                });
                if (activeOrdersCount > 0) {
                    throw domain_1.CustomError.badRequest(`No puedes cambiar los tiempos de preparación o configuración de pedidos programados mientras tengas ${activeOrdersCount} pedido(s) activo(s) en curso. Finaliza tus pedidos actuales primero.`);
                }
            }
            if (data.tiempoPreparacionMin !== undefined)
                negocio.tiempoPreparacionMin = data.tiempoPreparacionMin;
            if (data.tiempoPreparacionMax !== undefined)
                negocio.tiempoPreparacionMax = data.tiempoPreparacionMax;
            if (data.permiteProductosProgramados !== undefined)
                negocio.permiteProductosProgramados = data.permiteProductosProgramados;
            if (data.tiempoProgramadoMin !== undefined)
                negocio.tiempoProgramadoMin = data.tiempoProgramadoMin;
            if (data.tiempoProgramadoMax !== undefined)
                negocio.tiempoProgramadoMax = data.tiempoProgramadoMax;
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
            const imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
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
                identificacionCuenta: saved.identificacionCuenta,
                correoCuenta: saved.correoCuenta,
                tiempoPreparacionMin: saved.tiempoPreparacionMin,
                tiempoPreparacionMax: saved.tiempoPreparacionMax,
                permiteProductosProgramados: saved.permiteProductosProgramados,
                tiempoProgramadoMin: saved.tiempoProgramadoMin,
                tiempoProgramadoMax: saved.tiempoProgramadoMax,
                puedePublicarProductos: saved.puedePublicarProductos,
                limitePublicacionesSuscripcion: saved.limitePublicacionesSuscripcion,
                publicacionesRestantes: saved.publicacionesRestantes,
                categoria: {
                    id: saved.categoria.id,
                    nombre: saved.categoria.nombre,
                    statusCategoria: saved.categoria.statusCategoria,
                    restriccionModeloMonetizacion: saved.categoria.restriccionModeloMonetizacion,
                    soloComision: saved.categoria.soloComision,
                },
                subcategoria: saved.subcategoria ? {
                    id: saved.subcategoria.id,
                    nombre: saved.subcategoria.nombre
                } : null,
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
            // Validar si tiene pedidos o historial financiero
            const hasPedidos = yield data_1.Pedido.count({ where: { negocio: { id } } });
            if (hasPedidos > 0) {
                throw domain_1.CustomError.badRequest("No se puede eliminar: El negocio tiene historial de pedidos. Por favor, cambie su estado a CERRADO o SUSPENDIDO.");
            }
            const hasBalances = yield data_1.BalanceNegocio.count({ where: { negocio: { id } } });
            if (hasBalances > 0) {
                throw domain_1.CustomError.badRequest("No se puede eliminar: El negocio tiene historial financiero. Por favor, cambie su estado a CERRADO o SUSPENDIDO.");
            }
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
            // 📡 Notificar por WebSockets (Cambio de estatus administrativo)
            (0, socket_1.getIO)().emit("business_status_changed", {
                businessId: negocio.id,
                newStatus: negocio.estadoNegocio, // ABIERTO/CERRADO
                statusNegocio: negocio.statusNegocio, // ACTIVO/PENDIENTE/SUSPENDIDO
            });
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
