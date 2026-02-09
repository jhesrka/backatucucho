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
exports.CalcularEnvioService = void 0;
const DeliverySettings_1 = require("../../../data/postgres/models/DeliverySettings");
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
                throw new Error("No hay configuración global de delivery activa. Configúrala en el admin.");
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
                throw new Error("El negocio no tiene coordenadas configuradas.");
            }
            const settings = yield this.getActiveSettingsOrThrow();
            const distanciaKm = this.haversineKm(Number(negocio.latitud), Number(negocio.longitud), Number(latCliente), Number(lngCliente));
            const costoEnvio = this.calcFee(distanciaKm, settings);
            return { distanciaKm, costoEnvio, settings };
        });
    }
}
exports.CalcularEnvioService = CalcularEnvioService;
