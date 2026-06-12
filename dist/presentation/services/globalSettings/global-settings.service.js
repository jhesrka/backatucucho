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
exports.GlobalSettingsService = void 0;
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
const upload_files_cloud_adapter_1 = require("../../../config/upload-files-cloud-adapter");
const image_optimizer_adapter_1 = require("../../../config/image-optimizer.adapter");
const config_1 = require("../../../config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class GlobalSettingsService {
    getSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!settings) {
                settings = new data_1.GlobalSettings();
                // Defaults?
                settings.appName = "Shop ";
                settings.orderRetentionDays = 20;
                settings.freePostsLimit = 5;
                settings.freePostDurationDays = 1;
                settings.freePostDurationHours = 0;
                settings.subscriptionBasicPrice = 5.00;
                settings.subscriptionBasicDurationDays = 30;
                settings.reportsRetentionDays = 30;
                settings.postsRetentionDays = 30;
                settings.paidPostsRetentionDays = 90;
                settings.paidPurgeInactivityMonths = 6;
                settings.autoPurgeEnabled = true;
                settings.currentTermsVersion = "v1.0";
                settings.hora_apertura = "08:00:00";
                settings.hora_cierre = "22:00:00";
                settings.app_status = "CLOSED";
                settings.modo_operacion = "AUTO";
                settings.pendingOrderTimeoutMinutes = 10;
                settings.acceptedOrderGraceMinutes = 10;
                settings.cleanupSubscriptionContentDays = 60;
                settings.payphoneRechargePercentage = 0.00;
                yield settings.save();
            }
            // Asegurar valores por defecto para registros existentes tras migración
            if (settings.autoPurgeEnabled === null || settings.autoPurgeEnabled === undefined) {
                settings.autoPurgeEnabled = true;
            }
            if (settings.paidPostsRetentionDays === null || settings.paidPostsRetentionDays === undefined) {
                settings.paidPostsRetentionDays = 90;
            }
            if (settings.paidPurgeInactivityMonths === null || settings.paidPurgeInactivityMonths === undefined) {
                settings.paidPurgeInactivityMonths = 6;
            }
            if (settings.cardRechargeEnabled === null || settings.cardRechargeEnabled === undefined) {
                settings.cardRechargeEnabled = true;
            }
            if ((_a = settings.businessCover) === null || _a === void 0 ? void 0 : _a.imageUrl) {
                try {
                    settings.businessCover.imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: settings.businessCover.imageUrl,
                    });
                }
                catch (e) {
                    console.error(e);
                }
            }
            if (settings.appLogoKey) {
                try {
                    settings.appLogoUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: settings.appLogoKey,
                    });
                }
                catch (e) {
                    console.error(e);
                }
            }
            if (settings.appFaviconKey) {
                try {
                    settings.appFaviconUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: settings.appFaviconKey,
                    });
                }
                catch (e) {
                    console.error(e);
                }
            }
            return settings;
        });
    }
    updateSettings(data, file) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (data.masterPin) {
                const currentSettings = yield this.getSettings();
                if (currentSettings.masterPin) {
                    const isMatch = yield bcryptjs_1.default.compare(data.masterPin, currentSettings.masterPin);
                    if (!isMatch)
                        throw domain_1.CustomError.badRequest("PIN Maestro incorrecto");
                }
            }
            let settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!settings)
                settings = new data_1.GlobalSettings();
            let termsChanged = false;
            if (data.supportWhatsapp)
                settings.supportWhatsapp = data.supportWhatsapp;
            if (data.appName !== undefined && data.appName.trim() !== "")
                settings.appName = data.appName;
            // Explicitly update text fields if provided
            if (data.termsAndConditions) {
                if (settings.termsAndConditions !== data.termsAndConditions) {
                    settings.termsAndConditions = data.termsAndConditions;
                    termsChanged = true;
                }
            }
            if (data.privacyPolicy) {
                if (settings.privacyPolicy !== data.privacyPolicy) {
                    settings.privacyPolicy = data.privacyPolicy;
                    termsChanged = true;
                }
            }
            if (termsChanged) {
                // Incrementar versión (ej: v1.0 -> v1.1 o generar timestamp-based)
                const matches = settings.currentTermsVersion.match(/v(\d+)\.(\d+)/);
                if (matches) {
                    const major = parseInt(matches[1]);
                    const minor = parseInt(matches[2]) + 1;
                    settings.currentTermsVersion = `v${major}.${minor}`;
                }
                else {
                    settings.currentTermsVersion = `v1.1`;
                }
                settings.termsUpdatedAt = new Date();
            }
            // Maintain existing logic if any
            if (data.orderRetentionDays !== undefined)
                settings.orderRetentionDays = data.orderRetentionDays;
            if (data.reportsRetentionDays !== undefined)
                settings.reportsRetentionDays = data.reportsRetentionDays;
            if (data.freePostsLimit !== undefined)
                settings.freePostsLimit = data.freePostsLimit;
            // NEW: Schedule Settings (FALSY SKIP TO AVOID DB ERROR WITH EMPTY STRINGS)
            if (data.hora_apertura)
                settings.hora_apertura = data.hora_apertura;
            if (data.hora_cierre)
                settings.hora_cierre = data.hora_cierre;
            if (data.subscriptionBasicPrice !== undefined)
                settings.subscriptionBasicPrice = data.subscriptionBasicPrice;
            if (data.subscriptionBasicPromoPrice !== undefined)
                settings.subscriptionBasicPromoPrice = data.subscriptionBasicPromoPrice;
            if (data.subscriptionBasicDurationDays !== undefined)
                settings.subscriptionBasicDurationDays = data.subscriptionBasicDurationDays;
            if (data.timeoutRondaMs !== undefined)
                settings.timeoutRondaMs = data.timeoutRondaMs;
            if (data.maxRondasAsignacion !== undefined)
                settings.maxRondasAsignacion = data.maxRondasAsignacion;
            if (data.pendingOrderTimeoutMinutes !== undefined) {
                const pendingOrdersCount = yield data_1.Pedido.count({ where: { estado: data_1.EstadoPedido.PENDIENTE } });
                if (pendingOrdersCount > 0 && Number(data.pendingOrderTimeoutMinutes) !== settings.pendingOrderTimeoutMinutes) {
                    throw domain_1.CustomError.badRequest("No se puede cambiar el tiempo máximo de pendiente mientras existan pedidos pendientes activos en el sistema.");
                }
                settings.pendingOrderTimeoutMinutes = Number(data.pendingOrderTimeoutMinutes);
            }
            if (data.acceptedOrderGraceMinutes !== undefined)
                settings.acceptedOrderGraceMinutes = Number(data.acceptedOrderGraceMinutes);
            if (data.cleanupSubscriptionContentDays !== undefined)
                settings.cleanupSubscriptionContentDays = Number(data.cleanupSubscriptionContentDays);
            // LÍMITES DE MÉTODOS DE PAGO
            if (data.minEfectivo !== undefined)
                settings.minEfectivo = data.minEfectivo === "" || data.minEfectivo === null ? null : Number(data.minEfectivo);
            if (data.maxEfectivo !== undefined)
                settings.maxEfectivo = data.maxEfectivo === "" || data.maxEfectivo === null ? null : Number(data.maxEfectivo);
            if (data.minTransferencia !== undefined)
                settings.minTransferencia = data.minTransferencia === "" || data.minTransferencia === null ? null : Number(data.minTransferencia);
            if (data.maxTransferencia !== undefined)
                settings.maxTransferencia = data.maxTransferencia === "" || data.maxTransferencia === null ? null : Number(data.maxTransferencia);
            if (data.minTarjeta !== undefined)
                settings.minTarjeta = data.minTarjeta === "" || data.minTarjeta === null ? null : Number(data.minTarjeta);
            if (data.maxTarjeta !== undefined)
                settings.maxTarjeta = data.maxTarjeta === "" || data.maxTarjeta === null ? null : Number(data.maxTarjeta);
            // Payphone
            if (data.payphoneToken !== undefined)
                settings.payphoneToken = data.payphoneToken;
            if (data.payphoneStoreId !== undefined)
                settings.payphoneStoreId = data.payphoneStoreId;
            if (data.payphoneRechargePercentage !== undefined)
                settings.payphoneRechargePercentage = Number(data.payphoneRechargePercentage);
            if (data.cardRechargeEnabled !== undefined)
                settings.cardRechargeEnabled = data.cardRechargeEnabled === true || data.cardRechargeEnabled === 'true';
            const coverRaw = data.businessCover || data.cover;
            if (coverRaw) {
                try {
                    const parsedCover = typeof coverRaw === 'string'
                        ? JSON.parse(coverRaw)
                        : coverRaw;
                    // 🛡️ DEFINITIVE S3 PRE-SIGNED URL FIX:
                    // If imageUrl is a temporary HTTP pre-signed URL, preserve the existing raw key from the database.
                    if (parsedCover && parsedCover.imageUrl && parsedCover.imageUrl.startsWith('http')) {
                        const currentSettings = yield data_1.GlobalSettings.findOne({ where: {} });
                        if ((_a = currentSettings === null || currentSettings === void 0 ? void 0 : currentSettings.businessCover) === null || _a === void 0 ? void 0 : _a.imageUrl) {
                            parsedCover.imageUrl = currentSettings.businessCover.imageUrl;
                        }
                    }
                    settings.businessCover = parsedCover;
                }
                catch (e) {
                    console.error("Error parsing businessCover JSON", e);
                }
            }
            if (file) {
                try {
                    // Delete old cover image if it exists
                    if ((_b = settings.businessCover) === null || _b === void 0 ? void 0 : _b.imageUrl) {
                        try {
                            yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: settings.businessCover.imageUrl
                            });
                        }
                        catch (e) {
                            console.error("[GlobalSettingsService] Error deleting old cover:", e);
                        }
                    }
                    // ⚡️ OPTIMIZACIÓN DE IMAGEN
                    const optimizedBuffer = yield image_optimizer_adapter_1.ImageOptimizer.optimize(file.buffer, image_optimizer_adapter_1.ImageSize.LARGE);
                    const key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: `settings/covers/${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.webp`,
                        body: optimizedBuffer,
                        contentType: 'image/webp',
                    });
                    if (!settings.businessCover)
                        settings.businessCover = { type: 'image', imageUrl: key };
                    else
                        settings.businessCover = Object.assign(Object.assign({}, settings.businessCover), { imageUrl: key });
                }
                catch (error) {
                    throw domain_1.CustomError.internalServer("Error actualizando la imagen de portada de la sección negocios");
                }
            }
            yield settings.save();
            return yield this.getSettings();
        });
    }
    updateAppLogo(masterPin, file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw domain_1.CustomError.badRequest("No file provided");
            const settings = yield this.getSettings();
            if (masterPin) {
                if (settings.masterPin) {
                    const isMatch = yield bcryptjs_1.default.compare(masterPin, settings.masterPin);
                    if (!isMatch)
                        throw domain_1.CustomError.badRequest("PIN Maestro incorrecto");
                }
            }
            else {
                throw domain_1.CustomError.badRequest("PIN Maestro requerido");
            }
            try {
                // Delete old logo if it exists
                if (settings.appLogoKey) {
                    try {
                        yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: settings.appLogoKey
                        });
                    }
                    catch (e) {
                        console.error("[GlobalSettingsService] Error deleting old logo:", e);
                    }
                }
                // OPTIMIZACIÓN DE IMAGEN
                const optimizedBuffer = yield image_optimizer_adapter_1.ImageOptimizer.optimize(file.buffer, image_optimizer_adapter_1.ImageSize.LARGE);
                const key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `settings/logo/${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.webp`,
                    body: optimizedBuffer,
                    contentType: 'image/webp',
                });
                settings.appLogoKey = key;
                yield settings.save();
                return yield this.getSettings();
            }
            catch (error) {
                console.error("updateAppLogo error:", error);
                throw domain_1.CustomError.internalServer("Error actualizando el logo de la aplicación");
            }
        });
    }
    updateAppFavicon(masterPin, file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw domain_1.CustomError.badRequest("No file provided");
            const settings = yield this.getSettings();
            if (masterPin) {
                if (settings.masterPin) {
                    const isMatch = yield bcryptjs_1.default.compare(masterPin, settings.masterPin);
                    if (!isMatch)
                        throw domain_1.CustomError.badRequest("PIN Maestro incorrecto");
                }
            }
            else {
                throw domain_1.CustomError.badRequest("PIN Maestro requerido");
            }
            try {
                // Delete old favicon if it exists
                if (settings.appFaviconKey) {
                    try {
                        yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: settings.appFaviconKey
                        });
                    }
                    catch (e) {
                        console.error("[GlobalSettingsService] Error deleting old favicon:", e);
                    }
                }
                // OPTIMIZACIÓN DE IMAGEN
                const optimizedBuffer = yield image_optimizer_adapter_1.ImageOptimizer.optimize(file.buffer, image_optimizer_adapter_1.ImageSize.LARGE);
                const key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `settings/favicon/${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.webp`,
                    body: optimizedBuffer,
                    contentType: 'image/webp',
                });
                settings.appFaviconKey = key;
                yield settings.save();
                return yield this.getSettings();
            }
            catch (error) {
                console.error("updateAppFavicon error:", error);
                throw domain_1.CustomError.internalServer("Error actualizando el favicon de la aplicación");
            }
        });
    }
    updateFreePostSettings(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            let settings = yield this.getSettings();
            if (dto.freePostsLimit !== undefined)
                settings.freePostsLimit = dto.freePostsLimit;
            if (dto.freePostDurationDays !== undefined)
                settings.freePostDurationDays = dto.freePostDurationDays;
            if (dto.freePostDurationHours !== undefined)
                settings.freePostDurationHours = dto.freePostDurationHours;
            if (dto.postsRetentionDays !== undefined)
                settings.postsRetentionDays = dto.postsRetentionDays;
            if (dto.paidPostsRetentionDays !== undefined)
                settings.paidPostsRetentionDays = dto.paidPostsRetentionDays;
            if (dto.paidPurgeInactivityMonths !== undefined)
                settings.paidPurgeInactivityMonths = dto.paidPurgeInactivityMonths;
            if (dto.autoPurgeEnabled !== undefined)
                settings.autoPurgeEnabled = dto.autoPurgeEnabled;
            yield settings.save();
            return settings;
        });
    }
    closeApp(masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            const isMatch = yield this.validateMasterPin(masterPin);
            if (!isMatch)
                throw domain_1.CustomError.badRequest("PIN Maestro incorrecto");
            const settings = yield this.getSettings();
            settings.app_status = "CLOSED";
            settings.modo_operacion = "MANUAL";
            yield settings.save();
            return settings;
        });
    }
    enableAutoMode(masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            const isMatch = yield this.validateMasterPin(masterPin);
            if (!isMatch)
                throw domain_1.CustomError.badRequest("PIN Maestro incorrecto");
            const settings = yield this.getSettings();
            settings.modo_operacion = "AUTO";
            yield settings.save();
            // 🔥 RECÁLCULO INMEDIATO
            yield this.checkAppSchedule();
            return settings;
        });
    }
    checkAppSchedule() {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield this.getSettings();
            if (settings.modo_operacion === 'MANUAL') {
                return; // Do nothing
            }
            // 1️⃣ 🔥 ZONA HORARIA OBLIGATORIA (America/Guayaquil)
            // Obtener hora actual en Ecuador
            const now = new Date();
            const ecuadorTimeStr = now.toLocaleString("en-US", { timeZone: "America/Guayaquil" });
            const ecuadorDate = new Date(ecuadorTimeStr);
            const currentH = ecuadorDate.getHours();
            const currentM = ecuadorDate.getMinutes();
            // Parse database times which are strings "HH:mm:ss"
            const [openH, openM] = settings.hora_apertura.split(':').map(Number);
            const [closeH, closeM] = settings.hora_cierre.split(':').map(Number);
            const currentMinutes = currentH * 60 + currentM;
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;
            let newState = "CLOSED";
            if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
                newState = "OPEN";
            }
            else {
                newState = "CLOSED";
            }
            if (newState !== settings.app_status) {
                console.log(`[CRON/AUTO] Updating App Status: ${settings.app_status} -> ${newState} (Ecuador Time: ${currentH}:${currentM})`);
                settings.app_status = newState;
                // 5️⃣ 🔥 MEJORA OPCIONAL: Audit field
                settings.ultimo_cambio_automatico = new Date(); // Save server time or ecuador time? TypeORM handles Date as timestamp. using server time is fine for audit.
                yield settings.save();
            }
        });
    }
    validateMasterPin(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield this.getSettings();
            if (!settings.masterPin) {
                // Si no hay PIN configurado, por seguridad no permitimos la acción
                throw domain_1.CustomError.badRequest("PIN Maestro no configurado en el sistema.");
            }
            return yield bcryptjs_1.default.compare(pin, settings.masterPin);
        });
    }
}
exports.GlobalSettingsService = GlobalSettingsService;
