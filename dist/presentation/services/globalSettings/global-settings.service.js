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
                settings.currentTermsVersion = "v1.0";
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
            if (data.freePostsLimit !== undefined)
                settings.freePostsLimit = data.freePostsLimit;
            if (data.subscriptionBasicPrice !== undefined)
                settings.subscriptionBasicPrice = data.subscriptionBasicPrice;
            if (data.subscriptionBasicPromoPrice !== undefined)
                settings.subscriptionBasicPromoPrice = data.subscriptionBasicPromoPrice;
            if (data.subscriptionBasicDurationDays !== undefined)
                settings.subscriptionBasicDurationDays = data.subscriptionBasicDurationDays;
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
}
exports.GlobalSettingsService = GlobalSettingsService;
