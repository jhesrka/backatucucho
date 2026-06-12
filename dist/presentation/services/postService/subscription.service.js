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
     * Activa o renueva una suscripción.
     * Si se provee durationDays, se asume activación de cortesía (Costo $0).
     */
    activateOrRenewSubscription(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, plan = data_1.SubscriptionPlan.BASIC, durationDays) {
            // Buscar usuario y su wallet
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
            const now = new Date();
            let daysToAdd = durationDays || 30;
            let finalCost = 0;
            const isCourtesy = !!durationDays;
            // Si no es cortesía, obtenemos el precio real
            if (!isCourtesy) {
                const settings = yield data_1.GlobalSettings.findOne({ where: {} });
                if (settings) {
                    daysToAdd = settings.subscriptionBasicDurationDays || 30;
                    const promo = settings.subscriptionBasicPromoPrice ? Number(settings.subscriptionBasicPromoPrice) : 0;
                    const normal = Number(settings.subscriptionBasicPrice) || 5.00;
                    finalCost = promo > 0 ? promo : normal;
                }
                else {
                    finalCost = 5.00;
                }
                if (Number(wallet.balance) < finalCost) {
                    throw domain_1.CustomError.badRequest(`Saldo insuficiente. Requieres $${finalCost.toFixed(2)}`);
                }
            }
            // Buscar suscripción actual para extenderla si está activa
            let subscription = yield data_1.Subscription.findOne({ where: { user: { id: userId }, plan } });
            let baseDate = (subscription && subscription.endDate && subscription.endDate > now) ? subscription.endDate : now;
            const newEndDate = (0, date_fns_1.addDays)(baseDate, daysToAdd);
            newEndDate.setHours(23, 59, 59, 999);
            // Auditoría en Wallet
            const transaction = new data_1.Transaction();
            transaction.wallet = wallet;
            transaction.amount = finalCost;
            transaction.type = isCourtesy ? 'credit' : 'debit'; // Regalo es informativo
            transaction.reason = data_1.TransactionReason.SUBSCRIPTION;
            transaction.status = 'APPROVED';
            transaction.previousBalance = Number(wallet.balance);
            transaction.resultingBalance = isCourtesy ? Number(wallet.balance) : Number(wallet.balance) - finalCost;
            const formatDateEcuador = (d) => d.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric' });
            transaction.observation = isCourtesy
                ? `CORTESÍA ADMINISTRATIVA: (Del ${formatDateEcuador(baseDate)} al ${formatDateEcuador(newEndDate)})`
                : `Pago de suscripción plan ${plan} (Del ${formatDateEcuador(baseDate)} al ${formatDateEcuador(newEndDate)})`;
            yield transaction.save();
            // Actualizar Wallet si hubo cobro
            if (finalCost > 0) {
                wallet.balance = Number(wallet.balance) - finalCost;
                yield wallet.save();
            }
            // Actualizar o crear suscripción
            if (!subscription) {
                subscription = new data_1.Subscription();
                subscription.user = user;
                subscription.plan = plan;
            }
            const isExtension = subscription && subscription.status === data_1.SubscriptionStatus.ACTIVA && subscription.endDate && subscription.endDate > now;
            subscription.startDate = isExtension ? subscription.startDate : now;
            subscription.endDate = newEndDate;
            subscription.status = data_1.SubscriptionStatus.ACTIVA;
            subscription.autoRenewal = true;
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
            if (dto.endDate) {
                // 🛡️ SOLUCIÓN DEFINITIVA: Extraer solo la parte de la fecha (YYYY-MM-DD) 
                // ignorando cualquier desfase que traiga el string original.
                const datePart = dto.endDate.toString().split('T')[0];
                const parts = datePart.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0]);
                    const month = parseInt(parts[1]);
                    const day = parseInt(parts[2]);
                    // Crear la fecha en la zona horaria local del servidor (Ecuador)
                    // Forzamos el día exacto seleccionado en el formulario
                    const date = new Date(year, month - 1, day, 23, 59, 59, 999);
                    subscription.endDate = date;
                }
                else {
                    // Fallback de seguridad
                    const date = new Date(dto.endDate);
                    date.setHours(23, 59, 59, 999);
                    subscription.endDate = date;
                }
            }
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
        return __awaiter(this, arguments, void 0, function* (userId, masterPin, plan = data_1.SubscriptionPlan.BASIC, days) {
            try {
                // Validar PIN
                const isValidPin = yield this.validateMasterPin(masterPin);
                if (!isValidPin) {
                    throw domain_1.CustomError.badRequest("PIN maestro incorrecto");
                }
                // Buscar usuario y su wallet (para auditoría)
                const user = yield data_1.User.findOne({
                    where: { id: userId },
                    relations: ["wallet"]
                });
                if (!user)
                    throw domain_1.CustomError.notFound("Usuario no encontrado");
                const wallet = user.wallet;
                if (!wallet)
                    throw domain_1.CustomError.notFound("Billetera no encontrada");
                // Buscar o crear suscripción
                let subscription = yield data_1.Subscription.findOne({
                    where: { user: { id: userId }, plan },
                });
                const now = new Date();
                const settings = yield data_1.GlobalSettings.findOne({ where: {} });
                const daysToAdd = days || (settings === null || settings === void 0 ? void 0 : settings.subscriptionBasicDurationDays) || 30;
                // Calcular nueva fecha de vencimiento
                let baseDate = (subscription && subscription.endDate && subscription.endDate > now) ? subscription.endDate : now;
                const newEndDate = (0, date_fns_1.addDays)(baseDate, daysToAdd);
                newEndDate.setHours(23, 59, 59, 999);
                if (!subscription) {
                    subscription = new data_1.Subscription();
                    subscription.user = user;
                    subscription.plan = plan;
                }
                const isExtension = subscription && subscription.status === data_1.SubscriptionStatus.ACTIVA && subscription.endDate && subscription.endDate > now;
                subscription.startDate = isExtension ? subscription.startDate : now;
                subscription.endDate = newEndDate;
                subscription.status = data_1.SubscriptionStatus.ACTIVA;
                subscription.autoRenewal = true;
                yield subscription.save();
                // 📝 AUDITORÍA: Crear transacción de cortesía ($0.00)
                const transaction = new data_1.Transaction();
                transaction.wallet = wallet;
                transaction.amount = 0;
                transaction.type = 'credit';
                transaction.reason = data_1.TransactionReason.SUBSCRIPTION;
                transaction.status = 'APPROVED';
                transaction.previousBalance = Number(wallet.balance);
                transaction.resultingBalance = Number(wallet.balance);
                const formatDateEcuador = (d) => d.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric' });
                transaction.observation = `ACTIVACIÓN DE CORTESÍA: (Del ${formatDateEcuador(baseDate)} al ${formatDateEcuador(newEndDate)})`;
                yield transaction.save();
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
    /**
     * 🔄 Procesar renovaciones automáticas de usuarios (BASIC plans)
     * Se ejecuta mediante un CRON job diariamente.
     */
    processUserAutoRenewals() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            // Buscar suscripciones que necesiten atención:
            // 1. ACTIVAS que ya vencieron
            // 2. EXPIRADAS que aún tienen autorenovación encendida
            const toRenew = yield data_1.Subscription.find({
                where: [
                    { status: data_1.SubscriptionStatus.ACTIVA, endDate: (0, typeorm_1.LessThanOrEqual)(now), autoRenewal: true },
                    { status: data_1.SubscriptionStatus.EXPIRADA, autoRenewal: true }
                ],
                relations: ["user"]
            });
            const results = {
                total: toRenew.length,
                success: 0,
                failed: 0
            };
            if (results.total === 0)
                return results;
            for (const sub of toRenew) {
                try {
                    yield this.activateOrRenewSubscription(sub.user.id, sub.plan);
                    results.success++;
                }
                catch (error) {
                    // Persistencia: Cambiamos a EXPIRADA pero DEJAMOS autoRenewal en true
                    // para que el CRON o una recarga futura lo vuelvan a intentar.
                    sub.status = data_1.SubscriptionStatus.EXPIRADA;
                    yield sub.save();
                    results.failed++;
                    console.error(`[AutoRenewal-User] Falló reintento para usuario ${sub.user.id}:`, error);
                }
            }
            return results;
        });
    }
    /**
     * 🎯 Intento de recuperación inmediata (Real-time)
     * Se llama cuando el usuario recarga su billetera.
     */
    checkAndRecoverSubscription(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const sub = yield data_1.Subscription.findOne({
                where: [
                    { user: { id: userId }, status: data_1.SubscriptionStatus.ACTIVA, endDate: (0, typeorm_1.LessThanOrEqual)(now), autoRenewal: true },
                    { user: { id: userId }, status: data_1.SubscriptionStatus.EXPIRADA, autoRenewal: true }
                ]
            });
            if (!sub)
                return null;
            try {
                // Intentamos renovar. Si tiene saldo de la recarga, se activará.
                return yield this.activateOrRenewSubscription(userId, sub.plan);
            }
            catch (error) {
                // Si aún no alcanza el saldo, se queda como está para el próximo intento.
                return null;
            }
        });
    }
}
exports.SubscriptionService = SubscriptionService;
