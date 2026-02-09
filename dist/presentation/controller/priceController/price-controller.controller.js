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
exports.PriceController = void 0;
const domain_1 = require("../../../domain");
class PriceController {
    constructor(priceService, userAdminService) {
        this.priceService = priceService;
        this.userAdminService = userAdminService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        // Obtener configuración actual de precios
        this.getPriceSettings = (req, res) => {
            this.priceService
                .getCurrentPriceSettings()
                .then((settings) => res.status(200).json(settings))
                .catch((error) => this.handleError(error, res));
        };
        // Actualizar configuración de precios (admin)
        this.updatePriceSettings = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { basePrice, extraDayPrice, masterPin } = req.body;
            if (basePrice === undefined || extraDayPrice === undefined) {
                return res
                    .status(422)
                    .json({ message: "Debe proporcionar basePrice y extraDayPrice" });
            }
            if (!masterPin) {
                return res.status(400).json({ message: "Se requiere el PIN maestro para realizar cambios" });
            }
            try {
                // Validar PIN
                yield this.userAdminService.validateMasterPin(masterPin);
                // Si es válido, actualizar
                const updated = yield this.priceService.updatePriceSettings(Number(basePrice), Number(extraDayPrice));
                return res.status(200).json(updated);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // Actualizar configuración de comisiones (admin)
        this.updateCommissionSettings = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { motorizadoPercentage, appPercentage, masterPin } = req.body;
            if (motorizadoPercentage === undefined || appPercentage === undefined) {
                return res.status(422).json({ message: "Debe proporcionar motorizadoPercentage y appPercentage" });
            }
            if (!masterPin) {
                return res.status(400).json({ message: "Se requiere el PIN maestro para realizar cambios" });
            }
            try {
                yield this.userAdminService.validateMasterPin(masterPin);
                // Get admin from request (set by middleware)
                const admin = req.admin;
                const updated = yield this.priceService.updateCommissionSettings(Number(motorizadoPercentage), Number(appPercentage), admin);
                return res.status(200).json(updated);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // Calcular precio de historia según días
        this.calculateStoriePrice = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const diasParam = req.query.dias;
                // Validación estricta
                if (diasParam === undefined ||
                    diasParam === null ||
                    diasParam === "" ||
                    Array.isArray(diasParam)) {
                    return res.status(400).json({
                        message: "Debe proporcionar un número válido de días",
                    });
                }
                const dias = Number(diasParam);
                // Validamos nuevamente por seguridad
                if (isNaN(dias) || dias < 1) {
                    return res.status(400).json({
                        message: "Debe proporcionar un número válido de días",
                    });
                }
                const settings = yield this.priceService.getCurrentPriceSettings();
                const base = Number(settings.basePrice);
                const extra = Number(settings.extraDayPrice);
                const price = this.priceService.calcularPrecio(dias, base, extra);
                return res.status(200).json({
                    dias,
                    price, // ← Ya es número, no se convierte a string
                });
            }
            catch (error) {
                console.error("Error al calcular el precio:", error);
                return this.handleError(error, res);
            }
        });
    }
}
exports.PriceController = PriceController;
