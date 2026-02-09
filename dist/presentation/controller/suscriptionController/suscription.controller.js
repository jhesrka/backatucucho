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
exports.SubscriptionController = void 0;
const domain_1 = require("../../../domain");
class SubscriptionController {
    constructor(subscriptionService, freePostTrackerService, globalSettingsService) {
        this.subscriptionService = subscriptionService;
        this.freePostTrackerService = freePostTrackerService;
        this.globalSettingsService = globalSettingsService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            const message = error instanceof Error ? error.message : "Error interno de suscripción";
            console.error("Subscription Error:", error);
            return res.status(500).json({
                message: `Error de Suscripción: ${message}`
            });
        };
        /**
         * Activar o renovar una suscripción
         */
        this.activateOrRenewSubscription = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return res.status(401).json({ message: "Usuario no autenticado" });
                }
                const { plan } = req.body;
                const subscriptionPlan = plan || "basic";
                const subscription = yield this.subscriptionService.activateOrRenewSubscription(userId, subscriptionPlan);
                res.status(200).json({
                    success: true,
                    subscription: {
                        id: subscription.id,
                        plan: subscription.plan,
                        status: subscription.status,
                        startDate: subscription.startDate,
                        endDate: subscription.endDate,
                        autoRenewal: subscription.autoRenewal,
                    },
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * Obtener si el usuario tiene suscripción activa
         */
        this.hasActiveSubscription = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return res.status(401).json({ message: "Usuario no autenticado" });
                }
                const isActive = yield this.subscriptionService.hasActiveSubscription(userId);
                res.status(200).json({
                    success: true,
                    isActive,
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * Configurar el costo de la suscripción (solo admin)
         */
        this.setSubscriptionCost = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { cost } = req.body;
                if (typeof cost !== "number" || cost <= 0) {
                    return res.status(400).json({ message: "Costo inválido" });
                }
                this.subscriptionService.setSubscriptionCost(cost);
                res.status(200).json({
                    success: true,
                    message: `Costo de suscripción actualizado a $${cost}`,
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * Obtener estado de publicaciones del usuario (gratis y suscripción)
         */
        this.getUserPostStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId)
                    return res.status(401).json({ message: "Usuario no autenticado" });
                const tracker = yield this.freePostTrackerService.getOrCreateTracker(userId);
                const settings = yield this.globalSettingsService.getSettings();
                const freePostsRemaining = Math.max(0, settings.freePostsLimit - tracker.count);
                const latest = yield this.subscriptionService.getLatestSubscription(userId);
                const subscriptionStatus = latest ? latest.status : "NO_SUBSCRIPTION";
                return res.status(200).json({
                    success: true,
                    freePostsRemaining,
                    subscriptionStatus,
                    currentSubscription: latest
                        ? {
                            id: latest.id,
                            plan: latest.plan,
                            status: latest.status,
                            startDate: latest.startDate,
                            endDate: latest.endDate,
                            autoRenewal: !!latest.autoRenewal,
                        }
                        : null,
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ========================= ADMIN CONTROLLER METHODS =========================
        this.getSubscriptionsByUserAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params; // User ID from route /admin/user/:id/subscriptions
                const { page = 1, limit = 10 } = req.query;
                const result = yield this.subscriptionService.getSubscriptionsByUserAdmin(id, +page, +limit);
                res.json(Object.assign({ success: true }, result));
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.updateSubscriptionAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params; // Subscription ID
                const dto = req.body;
                const subscription = yield this.subscriptionService.updateSubscriptionAdmin(id, dto);
                res.json({ success: true, subscription });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.changeSubscriptionStatusAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params; // Subscription ID
                const { status } = req.body;
                const subscription = yield this.subscriptionService.changeSubscriptionStatusAdmin(id, status);
                res.json({ success: true, subscription });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ========================= MASTER PIN OPERATIONS =========================
        /**
         * 🆓 Activar suscripción sin cobro (requiere Master PIN)
         */
        this.activateSubscriptionWithoutCharge = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, masterPin, plan } = req.body;
                if (!userId || !masterPin) {
                    return res.status(400).json({ message: "userId y masterPin son requeridos" });
                }
                const subscription = yield this.subscriptionService.activateSubscriptionWithoutCharge(userId, masterPin, plan);
                res.json({
                    success: true,
                    message: "Suscripción activada sin cobro por administrador",
                    subscription: {
                        id: subscription.id,
                        plan: subscription.plan,
                        status: subscription.status,
                        startDate: subscription.startDate,
                        endDate: subscription.endDate,
                        autoRenewal: subscription.autoRenewal,
                    }
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 📅 Modificar fecha de expiración (requiere Master PIN)
         */
        this.updateSubscriptionExpirationDate = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params; // Subscription ID
                const { newEndDate, masterPin } = req.body;
                if (!newEndDate || !masterPin) {
                    return res.status(400).json({ message: "newEndDate y masterPin son requeridos" });
                }
                const subscription = yield this.subscriptionService.updateSubscriptionExpirationDate(id, newEndDate, masterPin);
                res.json({
                    success: true,
                    message: "Fecha de expiración actualizada por administrador",
                    subscription: {
                        id: subscription.id,
                        plan: subscription.plan,
                        status: subscription.status,
                        startDate: subscription.startDate,
                        endDate: subscription.endDate,
                        autoRenewal: subscription.autoRenewal,
                    }
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 🔧 Configurar Master PIN
         */
        this.setMasterPin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { newPin } = req.body;
                if (!newPin) {
                    return res.status(400).json({ message: "newPin es requerido" });
                }
                yield this.subscriptionService.setMasterPin(newPin);
                res.json({
                    success: true,
                    message: "PIN maestro configurado correctamente"
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 🔍 Verificar si el Master PIN está configurado
         */
        this.getMasterPinStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const status = yield this.subscriptionService.getMasterPinStatus();
                res.json(Object.assign({ success: true }, status));
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * 🔄 Cambiar Master PIN (requiere PIN actual)
         */
        this.changeMasterPin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { currentPin, newPin } = req.body;
                if (!currentPin || !newPin) {
                    return res.status(400).json({ message: "currentPin y newPin son requeridos" });
                }
                yield this.subscriptionService.changeMasterPin(currentPin, newPin);
                res.json({
                    success: true,
                    message: "PIN maestro actualizado correctamente"
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * Actualizar configuración de posts gratuitos (solo admin)
         */
        this.updateFreePostSettings = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { freePostsLimit, freePostDurationDays, freePostDurationHours, masterPin } = req.body;
                // Validar PIN Maestro
                const isValidPin = yield this.subscriptionService.validateMasterPin(masterPin);
                if (!isValidPin) {
                    throw domain_1.CustomError.forbiden("PIN Maestro incorrecto");
                }
                const settings = yield this.globalSettingsService.updateFreePostSettings({
                    freePostsLimit,
                    freePostDurationDays,
                    freePostDurationHours,
                });
                res.json({
                    success: true,
                    message: "Configuración de posts gratuitos actualizada",
                    settings: {
                        freePostsLimit: settings.freePostsLimit,
                        freePostDurationDays: settings.freePostDurationDays,
                        freePostDurationHours: settings.freePostDurationHours,
                    }
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        /**
         * Obtener configuración actual de posts gratuitos (solo admin)
         */
        this.getFreePostSettings = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const settings = yield this.globalSettingsService.getSettings();
                res.json({
                    success: true,
                    settings: {
                        freePostsLimit: settings.freePostsLimit,
                        freePostDurationDays: settings.freePostDurationDays,
                        freePostDurationHours: settings.freePostDurationHours,
                    }
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
    }
}
exports.SubscriptionController = SubscriptionController;
