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
exports.StorieService = void 0;
const date_fns_1 = require("date-fns");
const data_1 = require("../../data");
const config_1 = require("../../config");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const socket_1 = require("../../config/socket");
const domain_1 = require("../../domain");
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
class StorieService {
    constructor(userService, walletService, priceService) {
        this.userService = userService;
        this.walletService = walletService;
        this.priceService = priceService;
    }
    createStorie(storieData, file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file) {
                throw domain_1.CustomError.badRequest("La imagen es obligatoria para crear una historia");
            }
            // Buscar el usuario
            const user = yield this.userService.findOneUser(storieData.userId);
            // Obtener configuración de precios
            const config = yield this.priceService.getCurrentPriceSettings();
            const costo = this.priceService.calcularPrecio(storieData.dias, config.basePrice, config.extraDayPrice);
            // Validar y descontar de wallet
            yield this.walletService.subtractFromWallet(user.id, costo, "Pago por publicación de historia", "STORIE");
            // Subir la imagen
            let key;
            let url;
            try {
                key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `stories/${Date.now()}-${file.originalname}`,
                    body: file.buffer,
                    contentType: file.mimetype,
                });
                url = (yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key,
                }));
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error subiendo la imagen de la historia");
            }
            // Crear la historia
            const storie = new data_1.Storie();
            storie.description = storieData.description.trim();
            storie.imgstorie = key;
            storie.user = user;
            storie.expires_at = (0, date_fns_1.addDays)(new Date(), storieData.dias);
            storie.showWhatsapp = storieData.showWhatsapp;
            // Guardar snapshot de precios
            storie.val_primer_dia = config.basePrice;
            storie.val_dias_adicionales = config.extraDayPrice;
            storie.total_pagado = costo;
            try {
                const savedStorie = yield storie.save();
                // Solo en respuesta: mostrar URL pública
                savedStorie.imgstorie = url;
                // Emitir evento de socket
                (0, socket_1.getIO)().emit("storieChanged", savedStorie);
                return savedStorie;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error creando la historia");
            }
        });
    }
    //funcionado
    findAllStorie() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                // 1️⃣ Traer solo stories activas que no hayan expirado
                const stories = yield data_1.Storie.find({
                    where: {
                        statusStorie: data_1.StatusStorie.PUBLISHED,
                        expires_at: (0, typeorm_1.MoreThan)(now),
                    },
                    relations: ["user"],
                    select: {
                        user: {
                            id: true,
                            name: true,
                            surname: true,
                            photoperfil: true,
                            whatsapp: true,
                        },
                    },
                    order: { createdAt: "DESC" },
                });
                // 2️⃣ Convertir imágenes a URLs públicas
                const storiesWithUrls = yield Promise.all(stories.map((story) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const imgstorieUrl = story.imgstorie
                        ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: story.imgstorie,
                        })
                        : null;
                    const photoperfilUrl = ((_a = story.user) === null || _a === void 0 ? void 0 : _a.photoperfil)
                        ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: story.user.photoperfil,
                        })
                        : null;
                    return Object.assign(Object.assign({}, story), { imgstorie: imgstorieUrl, user: Object.assign(Object.assign({}, story.user), { photoperfil: photoperfilUrl }) });
                })));
                // 3️⃣ Procesar stories expiradas en segundo plano
                this.processExpiredStories().catch((error) => {
                    console.error("Error procesando stories expiradas:", error);
                });
                return storiesWithUrls;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error obteniendo datos de stories");
            }
        });
    }
    // 🔁 Método para manejar stories expiradas
    processExpiredStories() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            // Buscar stories que hayan expirado y aún estén publicadas
            const expiredStories = yield data_1.Storie.find({
                where: {
                    statusStorie: data_1.StatusStorie.PUBLISHED,
                    expires_at: (0, typeorm_1.LessThanOrEqual)(now),
                },
                relations: ["user"],
            });
            if (expiredStories.length > 0) {
                yield Promise.all(expiredStories.map((story) => __awaiter(this, void 0, void 0, function* () {
                    // Aquí aplicamos la misma lógica soft/hard delete
                    yield this.deleteStorie(story.id, story.user.id);
                })));
            }
        });
    }
    // 🔹 Método de eliminar story (soft/hard) similar a tus posts
    deleteStorie(id, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const story = yield data_1.Storie.findOne({
                where: { id },
                relations: ["user"],
            });
            if (!story)
                throw domain_1.CustomError.notFound("Story no encontrada");
            if (story.user.id !== userId)
                throw domain_1.CustomError.forbiden("No autorizado para eliminar esta story");
            return story.statusStorie === data_1.StatusStorie.DELETED
                ? yield this.hardDeleteStorie(story)
                : yield this.softDeleteStorie(story);
        });
    }
    softDeleteStorie(story) {
        return __awaiter(this, void 0, void 0, function* () {
            story.statusStorie = data_1.StatusStorie.DELETED;
            story.deletedAt = new Date();
            yield story.save();
            (0, socket_1.getIO)().emit("storieChanged", {
                action: "delete",
                storieId: story.id,
            });
            return { message: "Story marcada como eliminada" };
        });
    }
    hardDeleteStorie(story) {
        return __awaiter(this, void 0, void 0, function* () {
            if (story.imgstorie) {
                yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: story.imgstorie,
                });
            }
            yield data_1.Storie.remove(story);
            (0, socket_1.getIO)().emit("storieChanged", {
                action: "hardDelete",
                storieId: story.id,
            });
            return { message: "Story eliminada permanentemente" };
        });
    }
    getStoriesByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!userId) {
                throw domain_1.CustomError.badRequest("ID de usuario no proporcionado");
            }
            try {
                const now = new Date();
                const stories = yield data_1.Storie.find({
                    where: {
                        statusStorie: data_1.StatusStorie.PUBLISHED,
                        expires_at: (0, typeorm_1.MoreThan)(now),
                        user: { id: userId },
                    },
                    relations: ["user"],
                    select: {
                        user: {
                            id: true,
                            name: true,
                            surname: true,
                            photoperfil: true,
                            whatsapp: true,
                        },
                    },
                    order: { createdAt: "DESC" },
                });
                const storiesWithUrls = yield Promise.all(stories.map((story) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const imgstorieUrl = story.imgstorie
                        ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: story.imgstorie,
                        }).catch(() => null)
                        : null;
                    const photoperfilUrl = ((_a = story.user) === null || _a === void 0 ? void 0 : _a.photoperfil)
                        ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: story.user.photoperfil,
                        }).catch(() => null)
                        : null;
                    return Object.assign(Object.assign({}, story), { imgstorie: imgstorieUrl, user: Object.assign(Object.assign({}, story.user), { photoperfil: photoperfilUrl }) });
                })));
                return storiesWithUrls.filter((story) => story.imgstorie !== null);
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error obteniendo historias del usuario");
            }
        });
    }
    //ADMINISTRADOR
    findStorieByIdAdmin(storieId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                if (!storieId || !(0, uuid_1.validate)(storieId)) {
                    throw domain_1.CustomError.badRequest("ID de story inválido");
                }
                const story = yield data_1.Storie.findOne({
                    where: { id: storieId },
                    relations: ["user"],
                    select: {
                        user: {
                            id: true,
                            name: true,
                            surname: true,
                            photoperfil: true,
                            whatsapp: true,
                            email: true,
                        },
                    },
                });
                if (!story)
                    throw domain_1.CustomError.notFound("Story no encontrada");
                // Resolver URLs
                const [imgUrl, userImgUrl] = yield Promise.all([
                    story.imgstorie
                        ? upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: story.imgstorie,
                        }).catch(() => null)
                        : null,
                    ((_a = story.user) === null || _a === void 0 ? void 0 : _a.photoperfil)
                        ? upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: story.user.photoperfil,
                        }).catch(() => null)
                        : null,
                ]);
                return {
                    id: story.id,
                    description: story.description,
                    statusStorie: story.statusStorie,
                    createdAt: story.createdAt,
                    expires_at: story.expires_at,
                    imgstorie: imgUrl,
                    user: {
                        id: story.user.id,
                        name: story.user.name,
                        surname: story.user.surname,
                        whatsapp: story.user.whatsapp,
                        photoperfil: userImgUrl,
                        email: story.user.email,
                    },
                };
            }
            catch (error) {
                if (error instanceof domain_1.CustomError)
                    throw error;
                throw domain_1.CustomError.internalServer("Error buscando la story por ID (admin)");
            }
        });
    }
    blockStorieAdmin(storieId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!storieId || !(0, uuid_1.validate)(storieId)) {
                    throw domain_1.CustomError.badRequest("ID de story inválido");
                }
                const story = yield data_1.Storie.findOne({ where: { id: storieId } });
                if (!story)
                    throw domain_1.CustomError.notFound("Story no encontrada");
                const wasBanned = story.statusStorie === data_1.StatusStorie.BANNED;
                story.statusStorie = wasBanned
                    ? data_1.StatusStorie.PUBLISHED
                    : data_1.StatusStorie.BANNED;
                yield story.save();
                (0, socket_1.getIO)().emit("storieChanged", {
                    action: wasBanned ? "unban" : "ban",
                    storieId: story.id,
                    status: story.statusStorie,
                });
                return {
                    message: wasBanned
                        ? "Story desbloqueada correctamente"
                        : "Story bloqueada correctamente",
                    status: story.statusStorie,
                };
            }
            catch (error) {
                if (error instanceof domain_1.CustomError)
                    throw error;
                throw domain_1.CustomError.internalServer("Error al bloquear/desbloquear la story");
            }
        });
    }
    // ADMIN: Cambiar estado explicitamente
    changeStatusStorieAdmin(storieId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const story = yield data_1.Storie.findOne({ where: { id: storieId } });
            if (!story)
                throw domain_1.CustomError.notFound("Story no encontrada");
            story.statusStorie = status;
            if (status === data_1.StatusStorie.DELETED) {
                story.deletedAt = new Date();
            }
            else {
                story.deletedAt = null;
            }
            yield story.save();
            (0, socket_1.getIO)().emit("storieChanged", { action: "update", storieId: story.id, status: story.statusStorie });
            return { message: `Estado cambiado a ${status}`, status: story.statusStorie };
        });
    }
    // ADMIN: Purga definitiva
    purgeStorieAdmin(storieId) {
        return __awaiter(this, void 0, void 0, function* () {
            const story = yield data_1.Storie.findOne({ where: { id: storieId } });
            if (!story)
                throw domain_1.CustomError.notFound("Story no encontrada");
            return yield this.hardDeleteStorie(story);
        });
    }
    purgeDeletedStoriesOlderThan3Days() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
                // Buscar stories en DELETED con deletedAt <= cutoff
                const stories = yield data_1.Storie.find({
                    where: {
                        statusStorie: data_1.StatusStorie.DELETED,
                        deletedAt: (0, typeorm_1.LessThan)(cutoff),
                    },
                });
                if (stories.length === 0) {
                    return { deletedCount: 0 };
                }
                let deletedCount = 0;
                for (const story of stories) {
                    try {
                        // 1) Borrar imagen en S3 si existe
                        if (story.imgstorie) {
                            yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: story.imgstorie,
                            }).catch(() => undefined);
                        }
                        // 2) Eliminar definitivamente el registro
                        yield data_1.Storie.remove(story);
                        deletedCount++;
                    }
                    catch (_a) {
                        continue; // tolerante a fallos por historia
                    }
                }
                (0, socket_1.getIO)().emit("storiesPurged", { count: deletedCount });
                return { deletedCount };
            }
            catch (_b) {
                throw domain_1.CustomError.internalServer("Error al purgar stories eliminadas mayores a 3 días");
            }
        });
    }
    // Total de historias pagadas publicadas (todas son pagadas por individual)
    countPaidStories() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Publicadas y no expiradas (expires_at NULL o > now)
                const now = new Date();
                const total = yield data_1.Storie.count({
                    where: [
                        { statusStorie: data_1.StatusStorie.PUBLISHED, expires_at: (0, typeorm_1.IsNull)() },
                        { statusStorie: data_1.StatusStorie.PUBLISHED, expires_at: (0, typeorm_1.MoreThan)(now) },
                    ],
                });
                return total;
            }
            catch (error) {
                console.error("[StorieService.countPaidStories]", error);
                throw domain_1.CustomError.internalServer("Error al contar historias pagadas publicadas");
            }
        });
    }
    // Historias publicadas en las últimas 24h (y activas)
    countPaidStoriesLast24h() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const total = yield data_1.Storie.count({
                    where: [
                        {
                            statusStorie: data_1.StatusStorie.PUBLISHED,
                            createdAt: (0, typeorm_1.MoreThan)(since),
                            expires_at: (0, typeorm_1.IsNull)(),
                        },
                        {
                            statusStorie: data_1.StatusStorie.PUBLISHED,
                            createdAt: (0, typeorm_1.MoreThan)(since),
                            expires_at: (0, typeorm_1.MoreThan)(now),
                        },
                    ],
                });
                return total;
            }
            catch (error) {
                console.error("[StorieService.countPaidStoriesLast24h]", error);
                throw domain_1.CustomError.internalServer("Error al contar historias pagadas de las últimas 24 horas");
            }
        });
    }
    // ==========================================
    // 🛡️ ADMIN PANEL METHODS
    // ==========================================
    getAdminStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                // Total stories (including soft deleted)
                const totalStories = yield data_1.Storie.count({ withDeleted: true });
                // By Status
                const published = yield data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.PUBLISHED } });
                const blocked = yield data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.BANNED } });
                const hidden = yield data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.HIDDEN } });
                // Soft Deleted
                const deleted = yield data_1.Storie.count({
                    where: { statusStorie: data_1.StatusStorie.DELETED },
                    withDeleted: true
                });
                // Purge Candidates (Deleted +30 days ago)
                const purgeCandidates = yield data_1.Storie.count({
                    where: {
                        statusStorie: data_1.StatusStorie.DELETED,
                        deletedAt: (0, typeorm_1.LessThan)(thirtyDaysAgo)
                    },
                    withDeleted: true
                });
                // Paid vs Free (assuming total_pagado > 0 is paid)
                const paid = yield data_1.Storie.count({ where: { total_pagado: (0, typeorm_1.MoreThan)(0) }, withDeleted: true });
                const free = yield data_1.Storie.count({ where: { total_pagado: 0 }, withDeleted: true });
                // Expiring Soon (Published and expires in < 24h)
                const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                const expiringSoon = yield data_1.Storie.count({
                    where: {
                        statusStorie: data_1.StatusStorie.PUBLISHED,
                        expires_at: (0, typeorm_1.Between)(now, tomorrow)
                    }
                });
                return {
                    totalStories,
                    published,
                    deleted,
                    blocked,
                    hidden,
                    paid,
                    free,
                    expiringSoon,
                    purgeCandidates
                };
            }
            catch (error) {
                console.error("Error fetching admin stats:", error);
                throw domain_1.CustomError.internalServer("Error calculando estadísticas de historias");
            }
        });
    }
    getAllStoriesAdmin(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { page = 1, limit = 10, id, status, type, startDate, endDate, userId } = options;
            const skip = (page - 1) * limit;
            const where = {};
            // Filters
            if (id)
                where.id = id;
            if (status)
                where.statusStorie = status;
            if (userId)
                where.user = { id: userId };
            // Date Range (Creation)
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt = (0, typeorm_1.Between)(start, end);
            }
            else if (startDate) {
                const start = new Date(startDate);
                where.createdAt = (0, typeorm_1.MoreThan)(start);
            }
            // Type (Paid/Free)
            if (type === 'PAGADO') {
                where.total_pagado = (0, typeorm_1.MoreThan)(0);
            }
            else if (type === 'GRATIS') {
                where.total_pagado = 0;
            }
            try {
                const [stories, total] = yield data_1.Storie.findAndCount({
                    where,
                    relations: ["user"],
                    order: { createdAt: "DESC" },
                    take: limit,
                    skip,
                    withDeleted: true // Important to see soft deleted ones
                });
                // Enrich with signed URLs
                const enrichedStories = yield Promise.all(stories.map((story) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const imgUrl = story.imgstorie
                        ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: config_1.envs.AWS_BUCKET_NAME, key: story.imgstorie }).catch(() => null)
                        : null;
                    const userImg = ((_a = story.user) === null || _a === void 0 ? void 0 : _a.photoperfil)
                        ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: config_1.envs.AWS_BUCKET_NAME, key: story.user.photoperfil }).catch(() => null)
                        : null;
                    return Object.assign(Object.assign({}, story), { imgstorie: imgUrl, user: Object.assign(Object.assign({}, story.user), { photoperfil: userImg }) });
                })));
                return {
                    stories: enrichedStories,
                    total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page
                };
            }
            catch (error) {
                console.error("Error in getAllStoriesAdmin:", error);
                throw domain_1.CustomError.internalServer("Error listando historias para admin");
            }
        });
    }
    purgeOldDeletedStories() {
        return __awaiter(this, arguments, void 0, function* (days = 30) {
            try {
                const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                // 1. Find candidates (Status DELETED + deletedAt < cutoff) OR (Status BANNED + createdAt < cutoff)
                const stories = yield data_1.Storie.find({
                    where: [
                        {
                            statusStorie: data_1.StatusStorie.DELETED,
                            deletedAt: (0, typeorm_1.LessThan)(cutoff),
                        },
                        {
                            statusStorie: data_1.StatusStorie.BANNED,
                            createdAt: (0, typeorm_1.LessThan)(cutoff),
                        }
                    ],
                    withDeleted: true
                });
                if (stories.length === 0)
                    return { deletedCount: 0 };
                let deletedCount = 0;
                for (const story of stories) {
                    try {
                        // A. Delete from S3
                        if (story.imgstorie) {
                            yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: story.imgstorie,
                            }).catch(err => console.warn(`Failed to delete S3 file ${story.imgstorie}`, err));
                        }
                        // B. Delete from DB (Hard Delete)
                        yield data_1.Storie.remove(story);
                        deletedCount++;
                    }
                    catch (err) {
                        console.error(`Error purging story ${story.id}`, err);
                    }
                }
                (0, socket_1.getIO)().emit("storiesPurged", { count: deletedCount });
                return { deletedCount };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer(`Error en purga de historias (+${days} días)`);
            }
        });
    }
    // ADMIN: Get all stories for a user (Pagination + Admin View)
    getStoriesByUserAdmin(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 10) {
            try {
                const skip = (page - 1) * limit;
                const [stories, total] = yield data_1.Storie.findAndCount({
                    where: { user: { id: userId } },
                    relations: ["user"],
                    order: { createdAt: "DESC" },
                    take: limit,
                    skip: skip,
                    withDeleted: true // Include soft deleted if applicable
                });
                // Process images
                const formattedStories = yield Promise.all(stories.map((story) => __awaiter(this, void 0, void 0, function* () {
                    const resolvedImg = story.imgstorie
                        ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: story.imgstorie
                        }).catch(() => null)
                        : null;
                    const isExpired = new Date(story.expires_at) < new Date();
                    const isVisible = story.statusStorie === data_1.StatusStorie.PUBLISHED && !isExpired;
                    return Object.assign(Object.assign({}, story), { imgstorie: resolvedImg, isExpired,
                        isVisible });
                })));
                return {
                    stories: formattedStories,
                    total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page
                };
            }
            catch (error) {
                console.error("Error in getStoriesByUserAdmin:", error);
                throw domain_1.CustomError.internalServer("Error fetching user stories for admin");
            }
        });
    }
}
exports.StorieService = StorieService;
