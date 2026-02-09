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
exports.PriceService = void 0;
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
class PriceService {
    getCurrentPriceSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            // Buscar el primer registro existente
            const config = yield data_1.PriceSettings.findOne({ where: {} }); // ✅ TypeORM 0.3+
            // Si no existe, crear uno por defecto
            if (!config) {
                const defaultConfig = new data_1.PriceSettings();
                defaultConfig.basePrice = 1.0;
                defaultConfig.extraDayPrice = 0.25;
                defaultConfig.motorizadoPercentage = 80.00;
                defaultConfig.appPercentage = 20.00;
                return yield defaultConfig.save();
            }
            return config;
        });
    }
    updatePriceSettings(basePrice, extraDayPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield this.getCurrentPriceSettings();
            config.basePrice = basePrice;
            config.extraDayPrice = extraDayPrice;
            return yield config.save();
        });
    }
    updateCommissionSettings(motorizadoPercentage, appPercentage, administrativeUser) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield this.getCurrentPriceSettings();
            // Guardar log de auditoría
            const log = new data_1.CommissionLog();
            log.prevMotorizadoPercentage = Number(config.motorizadoPercentage);
            log.newMotorizadoPercentage = motorizadoPercentage;
            log.prevAppPercentage = Number(config.appPercentage);
            log.newAppPercentage = appPercentage;
            log.changedBy = administrativeUser;
            yield log.save();
            config.motorizadoPercentage = motorizadoPercentage;
            config.appPercentage = appPercentage;
            return yield config.save();
        });
    }
    calcularPrecio(dias, base, extra) {
        const baseNumber = Number(base);
        const extraNumber = Number(extra);
        if (isNaN(baseNumber) || isNaN(extraNumber)) {
            throw domain_1.CustomError.internalServer("Precio base o extra inválido");
        }
        if (dias < 1)
            throw domain_1.CustomError.badRequest("Duración mínima: 1 día");
        return Number((baseNumber + (dias - 1) * extraNumber).toFixed(2));
    }
}
exports.PriceService = PriceService;
