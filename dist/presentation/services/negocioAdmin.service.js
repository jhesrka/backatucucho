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
exports.NegocioAdminService = void 0;
// src/services/admin/NegocioAdminService.ts
const data_1 = require("../../data");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const bcrypt_adapter_1 = require("../../config/bcrypt.adapter");
const domain_1 = require("../../domain");
const config_1 = require("../../config");
const typeorm_1 = require("typeorm");
const json2csv_1 = require("json2csv");
class NegocioAdminService {
    constructor(subscriptionService) {
        this.subscriptionService = subscriptionService;
    }
    // ========================= READ =========================
    getNegociosAdmin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ limit = 4, offset = 0, status, categoriaId, usuarioId, search, }) {
            const where = {};
            if (status && Object.values(data_1.StatusNegocio).includes(status)) {
                where.statusNegocio = status;
            }
            if (categoriaId) {
                where.categoria = { id: categoriaId };
            }
            if (usuarioId) {
                where.usuario = { id: usuarioId };
            }
            if (search) {
                where.nombre = (0, typeorm_1.ILike)(`%${search}%`);
            }
            const [negocios, total] = yield data_1.Negocio.findAndCount({
                where,
                relations: ["categoria", "usuario", "usuario.wallet"],
                take: limit,
                skip: offset,
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
                catch (error) { }
                // 🔒 Filtrar datos del usuario
                const usuarioSeguro = negocio.usuario
                    ? {
                        id: negocio.usuario.id,
                        name: negocio.usuario.name,
                        surname: negocio.usuario.surname,
                        email: negocio.usuario.email,
                        whatsapp: negocio.usuario.whatsapp,
                        balance: negocio.usuario.wallet ? Number(negocio.usuario.wallet.balance) : 0,
                    }
                    : null;
                return Object.assign(Object.assign({}, negocio), { usuario: usuarioSeguro, imagenUrl });
            })));
            return {
                total,
                negocios: negociosConImagen,
            };
        });
    }
    getNegocioByIdAdmin(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id },
                relations: ["categoria", "usuario", "usuario.wallet", "productos"],
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            const imagenUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                bucketName: config_1.envs.AWS_BUCKET_NAME,
                key: negocio.imagenNegocio,
            });
            const usuarioSeguro = negocio.usuario
                ? {
                    id: negocio.usuario.id,
                    name: negocio.usuario.name,
                    surname: negocio.usuario.surname,
                    email: negocio.usuario.email,
                    whatsapp: negocio.usuario.whatsapp,
                    balance: negocio.usuario.wallet ? Number(negocio.usuario.wallet.balance) : 0,
                }
                : null;
            return Object.assign(Object.assign({}, negocio), { usuario: usuarioSeguro, imagenUrl });
        });
    }
    // ========================= CREATE =========================
    createNegocioAdmin(dto, img) {
        return __awaiter(this, void 0, void 0, function* () {
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id: dto.categoriaId });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            const usuario = yield data_1.User.findOneBy({ id: dto.userId });
            if (!usuario)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            const nombreExistente = yield data_1.Negocio.findOneBy({ nombre: dto.nombre });
            if (nombreExistente)
                throw domain_1.CustomError.badRequest("Nombre ya en uso");
            let key = "ImgStore/imagenrota.jpg";
            if (img) {
                key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `negocios/${Date.now()}-${img.originalname}`,
                    body: img.buffer,
                    contentType: img.mimetype,
                });
            }
            const negocio = data_1.Negocio.create({
                nombre: dto.nombre,
                descripcion: dto.descripcion,
                categoria,
                usuario,
                imagenNegocio: key,
                modeloMonetizacion: dto.modeloMonetizacion,
                valorSuscripcion: dto.valorSuscripcion,
                diaPago: dto.diaPago,
            });
            const saved = yield negocio.save();
            return saved;
        });
    }
    toggleEstadoNegocioAdmin(negocioId) {
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
    // ========================= UPDATE =========================
    updateNegocioAdmin(id, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id },
                relations: ["categoria", "usuario"],
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            // ========================= ACTUALIZAR CATEGORÍA =========================
            if (dto.categoriaId) {
                const categoria = yield data_1.CategoriaNegocio.findOneBy({
                    id: dto.categoriaId,
                });
                if (!categoria)
                    throw domain_1.CustomError.notFound("Categoría no encontrada");
                negocio.categoria = categoria;
            }
            // ========================= ACTUALIZAR MODELO DE MONETIZACIÓN =========================
            if (dto.modeloMonetizacion) {
                if (!negocio.categoria)
                    throw domain_1.CustomError.badRequest("Negocio sin categoría asignada");
                // Validar restricciones de la categoría si existen
                if (negocio.categoria.soloComision && dto.modeloMonetizacion !== data_1.ModeloMonetizacion.COMISION_SUSCRIPCION) {
                    throw domain_1.CustomError.badRequest(`La categoría '${negocio.categoria.nombre}' solo permite el modelo COMISION + SUSCRIPCION`);
                }
                if (negocio.categoria.restriccionModeloMonetizacion && negocio.categoria.restriccionModeloMonetizacion !== dto.modeloMonetizacion) {
                    throw domain_1.CustomError.badRequest(`La categoría '${negocio.categoria.nombre}' tiene restricción a: ${negocio.categoria.restriccionModeloMonetizacion}`);
                }
                negocio.modeloMonetizacion = dto.modeloMonetizacion;
            }
            // ========================= ACTUALIZAR SUBSCRIPCIÓN =========================
            if (dto.valorSuscripcion !== undefined) {
                // 🔒 REGLA DE SEGURIDAD: Modificar precio en estado NO PENDIENTE requiere PIN Maestro.
                // Solo si el precio realmente cambió (evitar falsos positivos si el frontend manda el mismo precio)
                const currentPrice = Number(negocio.valorSuscripcion) || 0;
                const newPrice = Number(dto.valorSuscripcion) || 0;
                const hasPriceChanged = Math.abs(currentPrice - newPrice) > 0.01;
                if (negocio.statusNegocio !== data_1.StatusNegocio.PENDIENTE && hasPriceChanged) {
                    const settings = yield data_1.GlobalSettings.findOne({ where: {} });
                    const realMasterPin = settings === null || settings === void 0 ? void 0 : settings.masterPin;
                    if (realMasterPin) {
                        const isValid = bcrypt_adapter_1.encriptAdapter.compare(dto.masterPin || "", realMasterPin);
                        if (!isValid) {
                            throw domain_1.CustomError.unAuthorized("Para modificar el precio de un negocio activo se requiere el PIN Maestro.");
                        }
                    }
                }
                negocio.valorSuscripcion = dto.valorSuscripcion;
            }
            if (dto.diaPago !== undefined) {
                negocio.diaPago = dto.diaPago;
            }
            // ========================= ACTUALIZAR STATUS =========================
            if (dto.statusNegocio) {
                if (!Object.values(data_1.StatusNegocio).includes(dto.statusNegocio)) {
                    throw domain_1.CustomError.badRequest("Estado de negocio inválido");
                }
                // 🔒 REGLA DE SEGURIDAD: No se puede volver a PENDIENTE si ya está ACTIVO (o en otro estado avanzado)
                if (dto.statusNegocio === data_1.StatusNegocio.PENDIENTE && negocio.statusNegocio !== data_1.StatusNegocio.PENDIENTE) {
                    throw domain_1.CustomError.badRequest("No se puede revertir un negocio a estado PENDIENTE");
                }
                // 🔒 REGLA DE FLUJO: Si está PENDIENTE, solo puede pasar a ACTIVO (o quedarse en PENDIENTE si solo actualizo datos)
                if (negocio.statusNegocio === data_1.StatusNegocio.PENDIENTE && dto.statusNegocio !== data_1.StatusNegocio.ACTIVO && dto.statusNegocio !== data_1.StatusNegocio.PENDIENTE) {
                    throw domain_1.CustomError.badRequest("Un negocio PENDIENTE solo puede pasar a ACTIVO");
                }
                // 🔒 REGLA DE SEGURIDAD (PIN MAESTRO):
                // Para activar un negocio nuevo (PENDIENTE -> ACTIVO), se requiere PIN Maestro.
                if (negocio.statusNegocio === data_1.StatusNegocio.PENDIENTE && dto.statusNegocio === data_1.StatusNegocio.ACTIVO) {
                    // Obtener PIN real de la base de datos
                    const settings = yield data_1.GlobalSettings.findOne({ where: {} });
                    const realMasterPin = settings === null || settings === void 0 ? void 0 : settings.masterPin;
                    if (!realMasterPin) {
                        console.warn("⚠️ ADVERTENCIA DE SEGURIDAD: No hay PIN Maestro configurado en GlobalSettings. Se permite activación.");
                        // Opcional: throw Error si quieres obligar a configurar uno.
                    }
                    else {
                        // Validar hash si está encriptado o comparación directa si no (por compatibilidad, aunque debería ser siempre hash)
                        const isValid = bcrypt_adapter_1.encriptAdapter.compare(dto.masterPin || "", realMasterPin);
                        if (!isValid) {
                            throw domain_1.CustomError.unAuthorized("El PIN Maestro es incorrecto.");
                        }
                    }
                }
                // 🔄 FLUJO ATÓMICO: Si el admin intenta poner ACTIVO y se requiere cobro:
                // (needsCharge se calcula después de haber actualizado valorSuscripcion arriba)
                const needsCharge = Number(negocio.valorSuscripcion) > 0 && (negocio.statusNegocio === data_1.StatusNegocio.NO_PAGADO ||
                    negocio.statusNegocio === data_1.StatusNegocio.PENDIENTE ||
                    !negocio.fechaFinSuscripcion ||
                    new Date(negocio.fechaFinSuscripcion) <= new Date());
                if (dto.statusNegocio === data_1.StatusNegocio.ACTIVO && needsCharge) {
                    // CASO 1: Activación desde PENDIENTE -> OBLIGATORIO COBRAR
                    // Si no cobra, no se activa.
                    if (negocio.statusNegocio === data_1.StatusNegocio.PENDIENTE) {
                        if (!this.subscriptionService) {
                            throw domain_1.CustomError.internalServer("Servicio de suscripción no inicializado");
                        }
                        try {
                            yield this.subscriptionService.chargeSubscription(negocio, false);
                        }
                        catch (error) {
                            throw error;
                        }
                    }
                    // CASO 2: Reactivación desde BLOQUEADO/SUSPENDIDO con suscripción vencida
                    // No cobramos automático (podría no tener saldo), lo pasamos a NO_PAGADO para que pague manual.
                    else {
                        negocio.statusNegocio = data_1.StatusNegocio.NO_PAGADO;
                        // Opcional: Podríamos mostrar un mensaje, pero aquí solo actualizamos el estado.
                    }
                }
                else if (dto.statusNegocio === data_1.StatusNegocio.ACTIVO && !needsCharge) {
                    // CASO 3: Reactivación con suscripción vigente -> Pasa a ACTIVO directo
                    negocio.statusNegocio = data_1.StatusNegocio.ACTIVO;
                }
                else if (dto.statusNegocio === data_1.StatusNegocio.NO_PAGADO) {
                    // REGLA: No pasar a NO_PAGADO si aún tiene periodo vigente
                    if (negocio.fechaFinSuscripcion && new Date(negocio.fechaFinSuscripcion) > new Date()) {
                        throw domain_1.CustomError.badRequest(`El negocio aún tiene una suscripción vigente hasta el ${new Date(negocio.fechaFinSuscripcion).toLocaleDateString()}. No se puede pasar a NO_PAGADO prematuramente.`);
                    }
                    negocio.statusNegocio = data_1.StatusNegocio.NO_PAGADO;
                }
                else {
                    // Si no necesita cobro (es de $0 o ya tiene período activo), simplemente actualizamos el estado
                    negocio.statusNegocio = dto.statusNegocio;
                }
            }
            // Asegurarnos de que el valorSuscripcion se persista incluso si chargeSubscription hizo save
            if (dto.valorSuscripcion !== undefined) {
                negocio.valorSuscripcion = dto.valorSuscripcion;
            }
            const saved = yield negocio.save();
            return {
                id: saved.id,
                nombre: saved.nombre,
                statusNegocio: saved.statusNegocio,
                modeloMonetizacion: saved.modeloMonetizacion,
                valorSuscripcion: saved.valorSuscripcion,
                diaPago: saved.diaPago,
                categoria: {
                    id: saved.categoria.id,
                    nombre: saved.categoria.nombre,
                    statusCategoria: saved.categoria.statusCategoria,
                    soloComision: saved.categoria.soloComision,
                },
                updated_at: saved.updated_at,
                fechaInicioSuscripcion: saved.fechaInicioSuscripcion,
                fechaFinSuscripcion: saved.fechaFinSuscripcion,
                fechaUltimoCobro: saved.fechaUltimoCobro,
                intentosCobro: saved.intentosCobro,
            };
        });
    }
    // ========================= DELETE =========================
    deleteNegocioAdmin(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOneBy({ id });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (negocio.imagenNegocio &&
                negocio.imagenNegocio !== "ImgStore/imagenrota.jpg") {
                yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: negocio.imagenNegocio,
                });
            }
            yield negocio.remove();
            return { message: "Negocio eliminado correctamente" };
        });
    }
    // ========================= EXPORTACIÓN =========================
    exportNegociosToCSV(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            // Reutiliza el método de paginación pero sin límite
            const { negocios } = yield this.getNegociosAdmin(Object.assign(Object.assign({}, filters), { limit: 10000, offset: 0 }));
            if (!negocios || negocios.length === 0) {
                throw domain_1.CustomError.notFound("No hay negocios para exportar");
            }
            // Preparamos campos para exportar
            const fields = [
                { label: "ID", value: "id" },
                { label: "Nombre", value: "nombre" },
                { label: "Descripción", value: "descripcion" },
                { label: "Estado", value: "statusNegocio" },
                { label: "Modelo Monetización", value: "modeloMonetizacion" },
                { label: "Fecha Creación", value: "created_at" },
                { label: "Categoría", value: (row) => { var _a; return ((_a = row.categoria) === null || _a === void 0 ? void 0 : _a.nombre) || ""; } },
                {
                    label: "Usuario",
                    value: (row) => { var _a, _b; return `${((_a = row.usuario) === null || _a === void 0 ? void 0 : _a.name) || ""} ${((_b = row.usuario) === null || _b === void 0 ? void 0 : _b.surname) || ""}`; },
                },
                { label: "WhatsApp", value: (row) => { var _a; return ((_a = row.usuario) === null || _a === void 0 ? void 0 : _a.whatsapp) || ""; } },
            ];
            const parser = new json2csv_1.Parser({ fields });
            const csv = parser.parse(negocios);
            return Buffer.from(csv); // se puede devolver como archivo en rutas
        });
    }
    // ========================= ESTADÍSTICAS =========================
    getNegociosStatsAdmin() {
        return __awaiter(this, void 0, void 0, function* () {
            // Contar negocios activos
            const activos = yield data_1.Negocio.count({
                where: { statusNegocio: data_1.StatusNegocio.ACTIVO },
            });
            // Contar negocios pendientes
            const pendientes = yield data_1.Negocio.count({
                where: { statusNegocio: data_1.StatusNegocio.PENDIENTE },
            });
            // Calcular fecha de hace 24 horas
            const hace24h = new Date();
            hace24h.setHours(hace24h.getHours() - 24);
            // Contar negocios pendientes creados en las últimas 24 horas
            const pendientesUltimas24h = yield data_1.Negocio.count({
                where: {
                    statusNegocio: data_1.StatusNegocio.PENDIENTE,
                    created_at: (0, typeorm_1.MoreThan)(hace24h),
                },
            });
            return {
                activos,
                pendientes,
                pendientesUltimas24h,
            };
        });
    }
    ;
    // Wrappers for consistent Admin Panel actions
    changeStatusNegocioAdmin(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id },
                relations: ["usuario"]
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            const needsCharge = Number(negocio.valorSuscripcion) > 0 && (negocio.statusNegocio === data_1.StatusNegocio.NO_PAGADO ||
                negocio.statusNegocio === data_1.StatusNegocio.PENDIENTE ||
                !negocio.fechaFinSuscripcion ||
                new Date(negocio.fechaFinSuscripcion) <= new Date());
            if (status === data_1.StatusNegocio.ACTIVO && needsCharge) {
                if (!this.subscriptionService) {
                    throw domain_1.CustomError.internalServer("Servicio de suscripción no inicializado");
                }
                // Intentamos cobrar atómicamente. Si falla, el negocio sigue en su estado anterior.
                yield this.subscriptionService.chargeSubscription(negocio, false);
            }
            if (status === data_1.StatusNegocio.NO_PAGADO && negocio.fechaFinSuscripcion && new Date(negocio.fechaFinSuscripcion) > new Date()) {
                throw domain_1.CustomError.badRequest(`El negocio aún tiene una suscripción vigente hasta el ${new Date(negocio.fechaFinSuscripcion).toLocaleDateString()}. No se puede pasar a NO_PAGADO prematuramente.`);
            }
            negocio.statusNegocio = status;
            yield negocio.save();
            return { message: `Estado cambiado a ${status}`, status: negocio.statusNegocio };
        });
    }
    purgeNegocioAdmin(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.deleteNegocioAdmin(id);
        });
    }
    // ADMIN: Get all businesses for a user (Pagination + Admin View)
    getNegociosByUserAdmin(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 10) {
            // Validate UUID
            if (!config_1.regularExp.uuid.test(userId)) {
                throw domain_1.CustomError.badRequest("ID de usuario inválido");
            }
            const skip = (page - 1) * limit;
            const [negocios, total] = yield data_1.Negocio.findAndCount({
                where: { usuario: { id: userId } },
                relations: ["categoria", "productos"], // Include products to count them
                order: { created_at: "DESC" },
                take: limit,
                skip: skip,
                withDeleted: true // Include soft deleted if applicable but typeorm default delete is soft usually needs @DeleteDateColumn. 
                // Assuming your entity uses typical status columns.
            });
            // Process images and stats
            const formattedNegocios = yield Promise.all(negocios.map((negocio) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                const resolvedImg = negocio.imagenNegocio
                    ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: negocio.imagenNegocio
                    }).catch(() => null)
                    : null;
                // Count products
                const totalProductos = ((_a = negocio.productos) === null || _a === void 0 ? void 0 : _a.length) || 0;
                // Count active products if you had a status on products, assuming you iterate or count in DB.
                // For efficiency, usually better to use query builder specifically for counts, but relations load is okay for small sets.
                // Let's assume 'productos' are loaded.
                // StatusProducto enum check:
                // Adjust if StatusProducto is not imported here.
                // We will just count total for now as requested "Cantidad de productos asociados".
                // "Cantidad de productos activos" -> need to filter.
                let activeProducts = 0;
                if (negocio.productos) {
                    // Assuming product has a status field
                    activeProducts = negocio.productos.filter((p) => p.statusProducto === 'ACTIVO').length;
                }
                return {
                    id: negocio.id,
                    nombre: negocio.nombre,
                    descripcion: negocio.descripcion,
                    statusNegocio: negocio.statusNegocio,
                    estadoNegocio: negocio.estadoNegocio, // Abierto/Cerrado
                    categoria: (_b = negocio.categoria) === null || _b === void 0 ? void 0 : _b.nombre,
                    modeloMonetizacion: negocio.modeloMonetizacion,
                    valorSuscripcion: negocio.valorSuscripcion,
                    diaPago: negocio.diaPago,
                    fechaUltimoCobro: negocio.fechaUltimoCobro,
                    intentosCobro: negocio.intentosCobro,
                    fechaInicioSuscripcion: negocio.fechaInicioSuscripcion,
                    fechaFinSuscripcion: negocio.fechaFinSuscripcion,
                    direccion: negocio.direccionTexto,
                    latitud: negocio.latitud,
                    longitud: negocio.longitud,
                    direccionTexto: negocio.direccionTexto,
                    whatsapp: (_c = negocio.usuario) === null || _c === void 0 ? void 0 : _c.whatsapp,
                    created_at: negocio.created_at,
                    updated_at: negocio.updated_at,
                    imagenUrl: resolvedImg,
                    totalProductos,
                    activeProducts
                };
            })));
            return {
                negocios: formattedNegocios,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            };
        });
    }
}
exports.NegocioAdminService = NegocioAdminService;
