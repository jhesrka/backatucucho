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
exports.DeliverySettingsController = void 0;
const domain_1 = require("../../domain");
class DeliverySettingsController {
    constructor(service) {
        this.service = service;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        // ======================== Obtener configuración activa ========================
        this.getActive = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const settings = yield this.service.getActive();
                return res.status(200).json(settings);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Crear nueva configuración (activa) ========================
        this.create = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { firstRangeKm, firstRangeFee, extraStepKm, extraStepFee, isActive, // opcional; si no viene, se asume true en el service
                 } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
                // Validaciones mínimas (opcionales; el service también valida)
                const toNum = (v) => (v === undefined ? undefined : Number(v));
                const payload = {
                    firstRangeKm: toNum(firstRangeKm),
                    firstRangeFee: toNum(firstRangeFee),
                    extraStepKm: toNum(extraStepKm),
                    extraStepFee: toNum(extraStepFee),
                    isActive: typeof isActive === "boolean" ? isActive : true,
                };
                const created = yield this.service.createOrActivate(payload);
                return res.status(201).json(created);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ======================== Actualizar configuración por ID ========================
        this.update = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                if (!id)
                    return res.status(400).json({ message: "Falta el ID de la configuración" });
                const { firstRangeKm, firstRangeFee, extraStepKm, extraStepFee, isActive, } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
                const toNum = (v) => (v === undefined ? undefined : Number(v));
                const payload = {
                    firstRangeKm: toNum(firstRangeKm),
                    firstRangeFee: toNum(firstRangeFee),
                    extraStepKm: toNum(extraStepKm),
                    extraStepFee: toNum(extraStepFee),
                    isActive: typeof isActive === "boolean" ? isActive : undefined,
                };
                const updated = yield this.service.update(id, payload);
                return res.status(200).json(updated);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
    }
}
exports.DeliverySettingsController = DeliverySettingsController;
