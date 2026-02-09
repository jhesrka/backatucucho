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
exports.SubscriptionService = void 0;
const typeorm_1 = require("typeorm");
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
const date_fns_1 = require("date-fns");
const config_1 = require("../../../config");
class SubscriptionService {
    constructor() {
        this.subscriptionCost = 1; // Costo inicial de suscripción, modificable
    }
    /**
     * 🔒 Asegura que las suscripciones del usuario tengan el estado correcto
     * (si alguna "ACTIVA" ya venció, la pasa a "EXPIRADA").
     * Se llama al inicio de los métodos de lectura/validación.
     */
    ensureExpiredStateForUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const toExpire = yield data_1.Subscription.find({
                where: {
                    user: { id: userId },
                    status: data_1.SubscriptionStatus.ACTIVA,
                    endDate: (0, typeorm_1.LessThanOrEqual)(now),
                },
                order: { endDate: "DESC" },
            });
            if (!toExpire.length)
                return 0;
            for (const s of toExpire) {
                s.status = data_1.SubscriptionStatus.EXPIRADA;
                s.autoRenewal = false; // opcional
            }
            yield data_1.Subscription.save(toExpire);
            return toExpire.length;
        });
    }
    /**
     * Verifica si el usuario tiene suscripción activa (self-healing antes de consultar).
     */
    hasActiveSubscription(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureExpiredStateForUser(userId); // ← valida/actualiza antes de leer
            const activeSub = yield data_1.Subscription.findOneBy({
                user: { id: userId },
                status: data_1.SubscriptionStatus.ACTIVA,
                endDate: (0, typeorm_1.MoreThan)(new Date()),
            });
            return !!activeSub;
        });
    }
    /**
     * Activa o renueva una suscripción (30 días calendario, lunes a domingo).
     */
    activateOrRenewSubscription(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, plan = data_1.SubscriptionPlan.BASIC) {
            // Buscar usuario
            const user = yield data_1.User.findOne({
                where: { id: userId },
                relations: ["wallet"],
            });
            if (!user)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            const wallet = user.wallet;
            if (!wallet || wallet.status !== data_1.WalletStatus.ACTIVO) {
                throw domain_1.CustomError.badRequest("Wallet no disponible o bloqueada");
            }
            // Buscar suscripción por usuario y plan
            let subscription = yield data_1.Subscription.findOne({
                where: { user: { id: userId }, plan },
            });
            const now = new Date();
            let newStartDate = now;
            let newEndDate = now; // inicialización obligatoria
            // Dynamic Settings Retrieval
            const settings = yield data_1.GlobalSettings.findOne({ where: {} });
            let finalCost = 5.00;
            let daysToAdd = 30;
            if (settings) {
                daysToAdd = settings.subscriptionBasicDurationDays || 30;
                const promo = settings.subscriptionBasicPromoPrice ? Number(settings.subscriptionBasicPromoPrice) : 0;
                const normal = Number(settings.subscriptionBasicPrice) || 5.00;
                finalCost = promo > 0 ? promo : normal;
            }
            if (!subscription) {
                // Crear nueva suscripción si no existía
                subscription = new data_1.Subscription();
                subscription.user = user;
                subscription.plan = plan;
                subscription.status = data_1.SubscriptionStatus.PENDIENTE;
                // Fechas por calendario
                subscription.startDate = now;
                subscription.endDate = (0, date_fns_1.addDays)(now, daysToAdd);
                // Alinear con la actualización final (sin cambiar la lógica existente)
                newStartDate = subscription.startDate;
                newEndDate = subscription.endDate;
            }
            else {
                if (subscription.isActive()) {
                    // Renovación: sumar días restantes
                    const remainingDays = Math.ceil((subscription.endDate.getTime() - now.getTime()) /
                        (1000 * 60 * 60 * 24));
                    newStartDate = subscription.startDate;
                    newEndDate = (0, date_fns_1.addDays)(now, daysToAdd + Math.max(remainingDays, 0));
                }
                else {
                    // Suscripción expirada: nueva activación (calendario)
                    newStartDate = now;
                    newEndDate = (0, date_fns_1.addDays)(now, daysToAdd);
                }
            }
            // Validar saldo
            if (wallet.balance < finalCost) {
                throw domain_1.CustomError.badRequest(`Saldo insuficiente para activar la suscripción. Costo: $${finalCost.toFixed(2)}`);
            }
            // Create Transaction for Audit
            const transaction = new data_1.Transaction();
            transaction.wallet = wallet;
            transaction.amount = finalCost;
            transaction.type = 'debit';
            transaction.reason = data_1.TransactionReason.SUBSCRIPTION;
            transaction.origin = data_1.TransactionOrigin.USER;
            transaction.previousBalance = Number(wallet.balance);
            transaction.resultingBalance = Number(wallet.balance) - finalCost;
            transaction.observation = `Pago de suscripción: ${plan}`;
            transaction.daysBought = daysToAdd;
            transaction.prevEndDate = subscription.endDate || null;
            transaction.newEndDate = newEndDate;
            transaction.reference = subscription.id || null;
            yield transaction.save();
            // Debitar Wallet
            wallet.balance -= finalCost;
            yield wallet.save();
            // Actualizar suscripción
            subscription.startDate = newStartDate;
            subscription.endDate = newEndDate;
            subscription.status = data_1.SubscriptionStatus.ACTIVA;
            subscription.autoRenewal = true; // activar auto-renovación
            yield subscription.save();
            return subscription;
        });
    }
    /**
     * Configurar el costo desde el administrador
     */
    setSubscriptionCost(value) {
        this.subscriptionCost = value;
    }
    /**
     * Devuelve el status crudo más reciente (self-healing antes de consultar).
     */
    getRawSubscriptionStatus(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureExpiredStateForUser(userId); // ← valida/actualiza antes de leer
            const subscription = yield data_1.Subscription.findOne({
                where: { user: { id: userId } },
                order: { endDate: "DESC" },
            });
            if (!subscription) {
                return "NO_SUBSCRIPTION";
            }
            return subscription.status;
        });
    }
    /**
     * Devuelve la suscripción más reciente (self-healing antes de consultar).
     */
    getLatestSubscription(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureExpiredStateForUser(userId); // ← valida/actualiza antes de leer
            const latest = yield data_1.Subscription.findOne({
                where: { user: { id: userId } },
                order: { endDate: "DESC" },
            });
            return latest || null;
        });
    }
    // ========================= ADMIN METHODS =========================
    /**
     * Obtener todas las suscripciones de un usuario (paginado)
     */
    getSubscriptionsByUserAdmin(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 10) {
            // Asegurar estado correcto antes de devolver (opcional, pero recomendado para mostrar estado real)
            yield this.ensureExpiredStateForUser(userId);
            const skip = (page - 1) * limit;
            const [subscriptions, total] = yield data_1.Subscription.findAndCount({
                where: { user: { id: userId } },
                order: { createdAt: "DESC" }, // Mostrar más recientes primero
                take: limit,
                skip: skip,
            });
            return {
                subscriptions: subscriptions.map(sub => ({
                    id: sub.id,
                    plan: sub.plan,
                    status: sub.status,
                    startDate: sub.startDate,
                    endDate: sub.endDate,
                    autoRenewal: sub.autoRenewal,
                    created_at: sub.createdAt,
                    updated_at: sub.updatedAt,
                    isActive: sub.isActive(),
                })),
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            };
        });
    }
    /**
     * Actualizar suscripción (Admin)
     */
    updateSubscriptionAdmin(id, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield data_1.Subscription.findOneBy({ id });
            if (!subscription)
                throw domain_1.CustomError.notFound("Suscripción no encontrada");
            if (dto.endDate)
                subscription.endDate = new Date(dto.endDate);
            if (dto.status)
                subscription.status = dto.status;
            if (typeof dto.autoRenewal === 'boolean')
                subscription.autoRenewal = dto.autoRenewal;
            yield subscription.save();
            return subscription;
        });
    }
    /**
     * Cambiar estado directamente (Admin)
     */
    changeSubscriptionStatusAdmin(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield data_1.Subscription.findOneBy({ id });
            if (!subscription)
                throw domain_1.CustomError.notFound("Suscripción no encontrada");
            subscription.status = status;
            yield subscription.save();
            return subscription;
        });
    }
    /**
     * 🔐 Validar Master PIN (con bcrypt)
     */
    validateMasterPin(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
            if (!settings || !settings.masterPin) {
                throw domain_1.CustomError.badRequest("PIN maestro no configurado en el sistema");
            }
            // Comparar el PIN ingresado con el hash almacenado
            return config_1.encriptAdapter.compare(pin, settings.masterPin);
        });
    }
    /**
     * 🆓 Activar suscripción SIN COBRO (requiere Master PIN)
     * No descuenta saldo, no genera movimiento de cobro
     */
    activateSubscriptionWithoutCharge(userId_1, masterPin_1) {
        return __awaiter(this, arguments, void 0, function* (userId, masterPin, plan = data_1.SubscriptionPlan.BASIC // Usa el enum correcto
        ) {
            try {
                // Validar PIN
                const isValidPin = yield this.validateMasterPin(masterPin);
                if (!isValidPin) {
                    throw domain_1.CustomError.badRequest("PIN maestro incorrecto");
                }
                // Buscar usuario
                const user = yield data_1.User.findOne({
                    where: { id: userId },
                });
                if (!user)
                    throw domain_1.CustomError.notFound("Usuario no encontrado");
                // Buscar o crear suscripción
                let subscription = yield data_1.Subscription.findOne({
                    where: { user: { id: userId }, plan },
                });
                const now = new Date();
                const settings = yield data_1.GlobalSettings.findOne({ where: {} });
                const daysToAdd = (settings === null || settings === void 0 ? void 0 : settings.subscriptionBasicDurationDays) || 30;
                if (!subscription) {
                    // Crear nueva suscripción
                    subscription = new data_1.Subscription();
                    subscription.user = user;
                    subscription.plan = plan;
                    subscription.startDate = now;
                    subscription.endDate = (0, date_fns_1.addDays)(now, daysToAdd);
                }
                else {
                    // Si ya existe, extender o reactivar
                    if (subscription.isActive()) {
                        // Extender desde la fecha actual de expiración
                        const remainingDays = Math.ceil((subscription.endDate.getTime() - now.getTime()) /
                            (1000 * 60 * 60 * 24));
                        subscription.endDate = (0, date_fns_1.addDays)(now, daysToAdd + Math.max(remainingDays, 0));
                    }
                    else {
                        // Reactivar desde ahora
                        subscription.startDate = now;
                        subscription.endDate = (0, date_fns_1.addDays)(now, daysToAdd);
                    }
                }
                // Activar sin cobro
                subscription.status = data_1.SubscriptionStatus.ACTIVA;
                subscription.autoRenewal = false; // No auto-renovar suscripciones gratuitas
                yield subscription.save();
                return subscription;
            }
            catch (error) {
                console.error("Error en activateSubscriptionWithoutCharge:", error);
                throw error;
            }
        });
    }
    /**
     * 📅 Modificar fecha de expiración (requiere Master PIN)
     * No genera cobros, acción administrativa
     */
    updateSubscriptionExpirationDate(subscriptionId, newEndDate, masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validar PIN
            const isValidPin = yield this.validateMasterPin(masterPin);
            if (!isValidPin) {
                throw domain_1.CustomError.badRequest("PIN maestro incorrecto");
            }
            const subscription = yield data_1.Subscription.findOneBy({ id: subscriptionId });
            if (!subscription)
                throw domain_1.CustomError.notFound("Suscripción no encontrada");
            subscription.endDate = new Date(newEndDate);
            yield subscription.save();
            return subscription;
        });
    }
    /**
     * 🔧 Configurar o actualizar Master PIN (solo admin) - Hashea el PIN con bcrypt
     */
    setMasterPin(newPin) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validar formato (4 dígitos)
            if (!/^\d{4}$/.test(newPin)) {
                throw domain_1.CustomError.badRequest("El PIN debe ser de 4 dígitos numéricos");
            }
            let settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
            if (!settings) {
                settings = new data_1.GlobalSettings();
            }
            // Hashear el PIN antes de guardarlo
            const hashedPin = config_1.encriptAdapter.hash(newPin);
            settings.masterPin = hashedPin;
            yield settings.save();
        });
    }
    /**
     * 🔍 Obtener configuración actual (sin exponer el PIN)
     */
    getMasterPinStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
            console.log("[SubscriptionService] getMasterPinStatus check:", {
                found: !!settings,
                hasPin: !!(settings === null || settings === void 0 ? void 0 : settings.masterPin)
            });
            return {
                isConfigured: !!(settings && settings.masterPin)
            };
        });
    }
    /**
     * 🔄 Cambiar Master PIN (requiere PIN actual) - Hashea el nuevo PIN
     */
    changeMasterPin(currentPin, newPin) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validar que el PIN actual sea correcto
            const isValidCurrentPin = yield this.validateMasterPin(currentPin);
            if (!isValidCurrentPin) {
                throw domain_1.CustomError.badRequest("PIN maestro actual incorrecto");
            }
            // Validar formato del nuevo PIN (4 dígitos)
            if (!/^\d{4}$/.test(newPin)) {
                throw domain_1.CustomError.badRequest("El nuevo PIN debe ser de 4 dígitos numéricos");
            }
            // Actualizar el PIN
            const settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
            if (!settings) {
                throw domain_1.CustomError.notFound("Configuración no encontrada");
            }
            // Hashear el nuevo PIN antes de guardarlo
            const hashedPin = config_1.encriptAdapter.hash(newPin);
            settings.masterPin = hashedPin;
            yield settings.save();
        });
    }
}
exports.SubscriptionService = SubscriptionService;
