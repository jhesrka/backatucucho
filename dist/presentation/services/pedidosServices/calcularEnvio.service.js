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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalcularEnvioService = void 0;
const DeliverySettings_1 = require("../../../data/postgres/models/DeliverySettings");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
class CalcularEnvioService {
    static toNumber(n, def = 0) {
        const v = Number(n);
        return Number.isFinite(v) ? v : def;
    }
    static haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (Math.PI / 180) * (lat2 - lat1);
        const dLon = (Math.PI / 180) * (lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((Math.PI / 180) * lat1) * Math.cos((Math.PI / 180) * lat2) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return +(R * c).toFixed(3);
    }
    static getActiveSettingsOrThrow() {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield DeliverySettings_1.DeliverySettings.findOne({ where: { isActive: true } });
            if (!settings) {
                const { CustomError } = yield Promise.resolve().then(() => __importStar(require("../../../domain")));
                throw CustomError.badRequest("No hay configuración global de delivery activa. Configúrala en el admin.");
            }
            return settings;
        });
    }
    static calcFee(distanciaKm, s) {
        const firstRangeKm = this.toNumber(s.firstRangeKm, 3);
        const firstRangeFee = this.toNumber(s.firstRangeFee, 1.25);
        const extraStepKm = this.toNumber(s.extraStepKm, 2);
        const extraStepFee = this.toNumber(s.extraStepFee, 0.25);
        if (distanciaKm <= firstRangeKm)
            return +firstRangeFee.toFixed(2);
        const extraBlocks = Math.ceil((distanciaKm - firstRangeKm) / extraStepKm);
        const fee = firstRangeFee + extraBlocks * extraStepFee;
        return +fee.toFixed(2);
    }
    static calcularParaPedido(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { negocio, latCliente, lngCliente } = params;
            if (negocio.latitud == null || negocio.longitud == null) {
                const { CustomError } = yield Promise.resolve().then(() => __importStar(require("../../../domain")));
                throw CustomError.badRequest("El negocio no tiene coordenadas configuradas.");
            }
            const settings = yield this.getActiveSettingsOrThrow();
            const distanciaKm = this.haversineKm(Number(negocio.latitud), Number(negocio.longitud), Number(latCliente), Number(lngCliente));
            const costoEnvioBase = this.calcFee(distanciaKm, settings);
            let costoEnvioTotal = costoEnvioBase;
            let recargoPico = 0;
            let porcentajePicoAplicado = 0;
            let isPeakHour = false;
            // --- EVALUACIÓN DE HORARIOS PICO ---
            if (settings.peakHours && Array.isArray(settings.peakHours)) {
                const horaActualEcuador = (0, moment_timezone_1.default)().tz("America/Guayaquil");
                const currentMinutes = horaActualEcuador.hours() * 60 + horaActualEcuador.minutes();
                for (const peak of settings.peakHours) {
                    if (!peak.enabled)
                        continue;
                    const [startH, startM] = peak.startTime.split(':').map(Number);
                    const [endH, endM] = peak.endTime.split(':').map(Number);
                    const startMinutes = startH * 60 + startM;
                    let endMinutes = endH * 60 + endM;
                    // Soporte si el horario cruza la medianoche (ej: 22:00 a 02:00)
                    let inRange = false;
                    if (startMinutes <= endMinutes) {
                        inRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
                    }
                    else {
                        // Cruza la medianoche
                        inRange = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
                    }
                    if (inRange) {
                        isPeakHour = true;
                        porcentajePicoAplicado = Number(peak.surchargePercentage) || 0;
                        recargoPico = +(costoEnvioBase * (porcentajePicoAplicado / 100)).toFixed(2);
                        costoEnvioTotal = +(costoEnvioBase + recargoPico).toFixed(2);
                        break; // Solo aplicamos el primer horario pico que coincida
                    }
                }
            }
            return {
                distanciaKm,
                costoEnvioBase,
                costoEnvio: costoEnvioTotal,
                recargoPico,
                isPeakHour,
                porcentajePicoAplicado,
                settings
            };
        });
    }
}
exports.CalcularEnvioService = CalcularEnvioService;
