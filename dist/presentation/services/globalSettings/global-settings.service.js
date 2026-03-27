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
exports.GlobalSettingsService = void 0;
const data_1 = require("../../../data");
class GlobalSettingsService {
    getSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            let settings = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!settings) {
                settings = new data_1.GlobalSettings();
                // Defaults?
                settings.orderRetentionDays = 20;
                settings.freePostsLimit = 5;
                settings.freePostDurationDays = 1;
                settings.freePostDurationHours = 0;
                settings.subscriptionBasicPrice = 5.00;
                settings.subscriptionBasicDurationDays = 30;
                settings.reportsRetentionDays = 30;
                settings.currentTermsVersion = "v1.0";
                settings.hora_apertura = "08:00:00";
                settings.hora_cierre = "22:00:00";
                settings.app_status = "CLOSED";
                settings.modo_operacion = "AUTO";
                settings.max_wait_time_acceptance = 10;
                settings.cleanupSubscriptionContentDays = 60;
                yield settings.save();
            }
            return settings;
        });
    }
    updateSettings(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let settings = yield this.getSettings();
            let termsChanged = false;
            if (data.supportWhatsapp !== undefined)
                settings.supportWhatsapp = data.supportWhatsapp;
            // Explicitly update text fields even if empty string (to allow clearing)
            if (data.termsAndConditions !== undefined) {
                if (settings.termsAndConditions !== data.termsAndConditions) {
                    settings.termsAndConditions = data.termsAndConditions;
                    termsChanged = true;
                }
            }
            if (data.privacyPolicy !== undefined) {
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
            // NEW: Schedule Settings
            if (data.hora_apertura !== undefined)
                settings.hora_apertura = data.hora_apertura;
            if (data.hora_cierre !== undefined)
                settings.hora_cierre = data.hora_cierre;
            // status/mode should be handled by specific methods, but allowing manual override for flexibility could be okay.
            // But per requirements, use specific endpoints. However, an admin might want to force "OPEN" manually.
            // Let's stick to the requested endpoints for status/mode, but allow updating hours here.
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
            if (data.max_wait_time_acceptance !== undefined)
                settings.max_wait_time_acceptance = Number(data.max_wait_time_acceptance);
            if (data.cleanupSubscriptionContentDays !== undefined)
                settings.cleanupSubscriptionContentDays = Number(data.cleanupSubscriptionContentDays);
            yield settings.save();
            return settings;
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
            yield settings.save();
            return settings;
        });
    }
    closeApp() {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield this.getSettings();
            settings.app_status = "CLOSED";
            settings.modo_operacion = "MANUAL";
            yield settings.save();
            return settings;
        });
    }
    enableAutoMode() {
        return __awaiter(this, void 0, void 0, function* () {
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
}
exports.GlobalSettingsService = GlobalSettingsService;
