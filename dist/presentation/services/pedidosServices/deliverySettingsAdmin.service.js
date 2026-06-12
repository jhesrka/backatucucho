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
exports.DeliverySettingsAdminService = void 0;
const DeliverySettings_1 = require("../../../data/postgres/models/DeliverySettings");
const domain_1 = require("../../../domain");
const global_settings_model_1 = require("../../../data/postgres/models/global-settings.model");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class DeliverySettingsAdminService {
    getActive() {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield DeliverySettings_1.DeliverySettings.findOne({ where: { isActive: true } });
            if (!settings)
                throw domain_1.CustomError.notFound("No hay configuración activa");
            return settings;
        });
    }
    createOrActivate(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            yield this.verifyMasterPin(data.masterPin || "");
            // Desactivar actuales
            yield DeliverySettings_1.DeliverySettings.createQueryBuilder()
                .update(DeliverySettings_1.DeliverySettings)
                .set({ isActive: false })
                .where("isActive = :active", { active: true })
                .execute();
            const s = DeliverySettings_1.DeliverySettings.create({
                firstRangeKm: (_a = data.firstRangeKm) !== null && _a !== void 0 ? _a : 3,
                firstRangeFee: (_b = data.firstRangeFee) !== null && _b !== void 0 ? _b : 1.25,
                extraStepKm: (_c = data.extraStepKm) !== null && _c !== void 0 ? _c : 2,
                extraStepFee: (_d = data.extraStepFee) !== null && _d !== void 0 ? _d : 0.25,
                isActive: true,
                peakHours: (_e = data.peakHours) !== null && _e !== void 0 ? _e : [],
            });
            return yield s.save();
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.verifyMasterPin(data.masterPin || "");
            const s = yield DeliverySettings_1.DeliverySettings.findOneBy({ id });
            if (!s)
                throw domain_1.CustomError.notFound("Configuración no encontrada");
            if (typeof data.firstRangeKm === "number")
                s.firstRangeKm = data.firstRangeKm;
            if (typeof data.firstRangeFee === "number")
                s.firstRangeFee = data.firstRangeFee;
            if (typeof data.extraStepKm === "number")
                s.extraStepKm = data.extraStepKm;
            if (typeof data.extraStepFee === "number")
                s.extraStepFee = data.extraStepFee;
            if (Array.isArray(data.peakHours))
                s.peakHours = data.peakHours;
            if (typeof data.isActive === "boolean" && data.isActive) {
                // Si se reactiva esta, desactivar las otras
                yield DeliverySettings_1.DeliverySettings.createQueryBuilder()
                    .update(DeliverySettings_1.DeliverySettings)
                    .set({ isActive: false })
                    .where("id != :id", { id: s.id })
                    .execute();
                s.isActive = true;
            }
            return yield s.save();
        });
    }
    verifyMasterPin(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pin)
                throw domain_1.CustomError.unAuthorized("Master PIN requerido");
            const settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            if (!settings || !settings.masterPin) {
                throw domain_1.CustomError.internalServer("Error de seguridad: Master PIN no configurado en el sistema");
            }
            const isValid = bcryptjs_1.default.compareSync(pin, settings.masterPin);
            if (!isValid) {
                throw domain_1.CustomError.unAuthorized("Master PIN incorrecto");
            }
        });
    }
}
exports.DeliverySettingsAdminService = DeliverySettingsAdminService;
