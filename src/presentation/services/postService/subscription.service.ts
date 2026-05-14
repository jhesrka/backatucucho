import { MoreThan, LessThanOrEqual } from "typeorm";
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
  WalletStatus,
  GlobalSettings,
  Transaction,
  TransactionOrigin,
  TransactionReason,
} from "../../../data";
import { CustomError } from "../../../domain";
import { addDays } from "date-fns";
import { encriptAdapter } from "../../../config";

export class SubscriptionService {
  private subscriptionCost = 1; // Costo inicial de suscripción, modificable

  /**
   * 🔒 Asegura que las suscripciones del usuario tengan el estado correcto
   * (si alguna "ACTIVA" ya venció, la pasa a "EXPIRADA").
   * Se llama al inicio de los métodos de lectura/validación.
   */
  private async ensureExpiredStateForUser(userId: string): Promise<number> {
    const now = new Date();

    const toExpire = await Subscription.find({
      where: {
        user: { id: userId },
        status: SubscriptionStatus.ACTIVA,
        endDate: LessThanOrEqual(now),
      },
      order: { endDate: "DESC" },
    });

    if (!toExpire.length) return 0;

    for (const s of toExpire) {
      s.status = SubscriptionStatus.EXPIRADA;
      s.autoRenewal = false; // opcional
    }
    await Subscription.save(toExpire);
    return toExpire.length;
  }

  /**
   * Verifica si el usuario tiene suscripción activa (self-healing antes de consultar).
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    await this.ensureExpiredStateForUser(userId); // ← valida/actualiza antes de leer

    const activeSub = await Subscription.findOneBy({
      user: { id: userId },
      status: SubscriptionStatus.ACTIVA,
      endDate: MoreThan(new Date()),
    });
    return !!activeSub;
  }

  /**
   * Activa o renueva una suscripción.
   * Si se provee durationDays, se asume activación de cortesía (Costo $0).
   */
  async activateOrRenewSubscription(
    userId: string,
    plan: SubscriptionPlan = SubscriptionPlan.BASIC,
    durationDays?: number
  ): Promise<Subscription> {
    // Buscar usuario y su wallet
    const user = await User.findOne({
      where: { id: userId },
      relations: ["wallet"],
    });
    if (!user) throw CustomError.notFound("Usuario no encontrado");

    const wallet = user.wallet;
    if (!wallet || wallet.status !== WalletStatus.ACTIVO) {
      throw CustomError.badRequest("Wallet no disponible o bloqueada");
    }

    const now = new Date();
    let daysToAdd = durationDays || 30;
    let finalCost = 0;
    const isCourtesy = !!durationDays;

    // Si no es cortesía, obtenemos el precio real
    if (!isCourtesy) {
      const settings = await GlobalSettings.findOne({ where: {} });
      if (settings) {
        daysToAdd = settings.subscriptionBasicDurationDays || 30;
        const promo = settings.subscriptionBasicPromoPrice ? Number(settings.subscriptionBasicPromoPrice) : 0;
        const normal = Number(settings.subscriptionBasicPrice) || 5.00;
        finalCost = promo > 0 ? promo : normal;
      } else {
        finalCost = 5.00;
      }

      if (Number(wallet.balance) < finalCost) {
        throw CustomError.badRequest(`Saldo insuficiente. Requieres $${finalCost.toFixed(2)}`);
      }
    }

    // Buscar suscripción actual para extenderla si está activa
    let subscription = await Subscription.findOne({ where: { user: { id: userId }, plan } });

    let baseDate = (subscription && subscription.endDate && subscription.endDate > now) ? subscription.endDate : now;
    const newEndDate = addDays(baseDate, daysToAdd);
    newEndDate.setHours(23, 59, 59, 999);

    // Auditoría en Wallet
    const transaction = new Transaction();
    transaction.wallet = wallet;
    transaction.amount = finalCost;
    transaction.type = isCourtesy ? 'credit' : 'debit'; // Regalo es informativo
    transaction.reason = TransactionReason.SUBSCRIPTION;
    transaction.status = 'APPROVED';
    transaction.previousBalance = Number(wallet.balance);
    transaction.resultingBalance = isCourtesy ? Number(wallet.balance) : Number(wallet.balance) - finalCost;
    transaction.observation = isCourtesy 
      ? `CORTESÍA ADMINISTRATIVA: ${durationDays} días concedidos sin costo.` 
      : `Pago de suscripción plan ${plan} (${daysToAdd} días)`;

    await transaction.save();

    // Actualizar Wallet si hubo cobro
    if (finalCost > 0) {
      wallet.balance = Number(wallet.balance) - finalCost;
      await wallet.save();
    }

    // Actualizar o crear suscripción
    if (!subscription) {
      subscription = new Subscription();
      subscription.user = user;
      subscription.plan = plan;
    }

    subscription.startDate = subscription.startDate || now;
    subscription.endDate = newEndDate;
    subscription.status = SubscriptionStatus.ACTIVA;
    subscription.autoRenewal = true;
    
    await subscription.save();
    return subscription;
  }

  /**
   * Configurar el costo desde el administrador
   */
  setSubscriptionCost(value: number) {
    this.subscriptionCost = value;
  }

  /**
   * Devuelve el status crudo más reciente (self-healing antes de consultar).
   */
  async getRawSubscriptionStatus(
    userId: string
  ): Promise<SubscriptionStatus | "NO_SUBSCRIPTION"> {
    await this.ensureExpiredStateForUser(userId); // ← valida/actualiza antes de leer

    const subscription = await Subscription.findOne({
      where: { user: { id: userId } },
      order: { endDate: "DESC" },
    });

    if (!subscription) {
      return "NO_SUBSCRIPTION";
    }

    return subscription.status;
  }

  /**
   * Devuelve la suscripción más reciente (self-healing antes de consultar).
   */
  async getLatestSubscription(userId: string): Promise<Subscription | null> {
    await this.ensureExpiredStateForUser(userId); // ← valida/actualiza antes de leer

    const latest = await Subscription.findOne({
      where: { user: { id: userId } },
      order: { endDate: "DESC" },
    });
    return latest || null;
  }

  // ========================= ADMIN METHODS =========================

  /**
   * Obtener todas las suscripciones de un usuario (paginado)
   */
  async getSubscriptionsByUserAdmin(userId: string, page: number = 1, limit: number = 10) {
    // Asegurar estado correcto antes de devolver (opcional, pero recomendado para mostrar estado real)
    await this.ensureExpiredStateForUser(userId);

    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Subscription.findAndCount({
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
  }

  /**
   * Actualizar suscripción (Admin)
   */
  async updateSubscriptionAdmin(id: string, dto: { endDate?: string | Date; status?: SubscriptionStatus; autoRenewal?: boolean }) {
    const subscription = await Subscription.findOneBy({ id });
    if (!subscription) throw CustomError.notFound("Suscripción no encontrada");

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
      } else {
        // Fallback de seguridad
        const date = new Date(dto.endDate);
        date.setHours(23, 59, 59, 999);
        subscription.endDate = date;
      }
    }
    if (dto.status) subscription.status = dto.status;
    if (typeof dto.autoRenewal === 'boolean') subscription.autoRenewal = dto.autoRenewal;

    await subscription.save();
    return subscription;
  }

  /**
   * Cambiar estado directamente (Admin)
   */
  async changeSubscriptionStatusAdmin(id: string, status: SubscriptionStatus) {
    const subscription = await Subscription.findOneBy({ id });
    if (!subscription) throw CustomError.notFound("Suscripción no encontrada");

    subscription.status = status;
    await subscription.save();
    return subscription;
  }

  /**
   * 🔐 Validar Master PIN (con bcrypt)
   */
  public async validateMasterPin(pin: string): Promise<boolean> {
    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
    if (!settings || !settings.masterPin) {
      throw CustomError.badRequest("PIN maestro no configurado en el sistema");
    }
    // Comparar el PIN ingresado con el hash almacenado
    return encriptAdapter.compare(pin, settings.masterPin);
  }

  /**
   * 🆓 Activar suscripción SIN COBRO (requiere Master PIN)
   * No descuenta saldo, no genera movimiento de cobro
   */
  async activateSubscriptionWithoutCharge(
    userId: string,
    masterPin: string,
    plan: SubscriptionPlan = SubscriptionPlan.BASIC,
    days?: number
  ): Promise<Subscription> {
    try {
      // Validar PIN
      const isValidPin = await this.validateMasterPin(masterPin);
      if (!isValidPin) {
        throw CustomError.badRequest("PIN maestro incorrecto");
      }

      // Buscar usuario y su wallet (para auditoría)
      const user = await User.findOne({
        where: { id: userId },
        relations: ["wallet"]
      });
      if (!user) throw CustomError.notFound("Usuario no encontrado");

      const wallet = user.wallet;
      if (!wallet) throw CustomError.notFound("Billetera no encontrada");

      // Buscar o crear suscripción
      let subscription = await Subscription.findOne({
        where: { user: { id: userId }, plan },
      });

      const now = new Date();
      const settings = await GlobalSettings.findOne({ where: {} });
      const daysToAdd = days || settings?.subscriptionBasicDurationDays || 30;

      // Calcular nueva fecha de vencimiento
      let baseDate = (subscription && subscription.endDate && subscription.endDate > now) ? subscription.endDate : now;
      const newEndDate = addDays(baseDate, daysToAdd);
      newEndDate.setHours(23, 59, 59, 999);

      if (!subscription) {
        subscription = new Subscription();
        subscription.user = user;
        subscription.plan = plan;
      }

      subscription.startDate = subscription.startDate || now;
      subscription.endDate = newEndDate;
      subscription.status = SubscriptionStatus.ACTIVA;
      subscription.autoRenewal = true;
      
      await subscription.save();

      // 📝 AUDITORÍA: Crear transacción de cortesía ($0.00)
      const transaction = new Transaction();
      transaction.wallet = wallet;
      transaction.amount = 0;
      transaction.type = 'credit'; 
      transaction.reason = TransactionReason.SUBSCRIPTION;
      transaction.status = 'APPROVED';
      transaction.previousBalance = Number(wallet.balance);
      transaction.resultingBalance = Number(wallet.balance);
      transaction.observation = `ACTIVACIÓN DE CORTESÍA: ${daysToAdd} días otorgados por administración sin cargo.`;
      
      await transaction.save();

      return subscription;
    } catch (error) {
      console.error("Error en activateSubscriptionWithoutCharge:", error);
      throw error;
    }
  }

  /**
   * 📅 Modificar fecha de expiración (requiere Master PIN)
   * No genera cobros, acción administrativa
   */
  async updateSubscriptionExpirationDate(
    subscriptionId: string,
    newEndDate: Date,
    masterPin: string
  ): Promise<Subscription> {
    // Validar PIN
    const isValidPin = await this.validateMasterPin(masterPin);
    if (!isValidPin) {
      throw CustomError.badRequest("PIN maestro incorrecto");
    }

    const subscription = await Subscription.findOneBy({ id: subscriptionId });
    if (!subscription) throw CustomError.notFound("Suscripción no encontrada");

    subscription.endDate = new Date(newEndDate);
    await subscription.save();

    return subscription;
  }

  /**
   * 🔧 Configurar o actualizar Master PIN (solo admin) - Hashea el PIN con bcrypt
   */
  async setMasterPin(newPin: string): Promise<void> {
    // Validar formato (4 dígitos)
    if (!/^\d{4}$/.test(newPin)) {
      throw CustomError.badRequest("El PIN debe ser de 4 dígitos numéricos");
    }

    let settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
    if (!settings) {
      settings = new GlobalSettings();
    }

    // Hashear el PIN antes de guardarlo
    const hashedPin = encriptAdapter.hash(newPin);
    settings.masterPin = hashedPin;
    await settings.save();
  }

  /**
   * 🔍 Obtener configuración actual (sin exponer el PIN)
   */
  async getMasterPinStatus(): Promise<{ isConfigured: boolean }> {
    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
    return {
      isConfigured: !!(settings && settings.masterPin)
    };
  }

  /**
   * 🔄 Cambiar Master PIN (requiere PIN actual) - Hashea el nuevo PIN
   */
  async changeMasterPin(currentPin: string, newPin: string): Promise<void> {
    // Validar que el PIN actual sea correcto
    const isValidCurrentPin = await this.validateMasterPin(currentPin);
    if (!isValidCurrentPin) {
      throw CustomError.badRequest("PIN maestro actual incorrecto");
    }

    // Validar formato del nuevo PIN (4 dígitos)
    if (!/^\d{4}$/.test(newPin)) {
      throw CustomError.badRequest("El nuevo PIN debe ser de 4 dígitos numéricos");
    }

    // Actualizar el PIN
    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
    if (!settings) {
      throw CustomError.notFound("Configuración no encontrada");
    }

    // Hashear el nuevo PIN antes de guardarlo
    const hashedPin = encriptAdapter.hash(newPin);
    settings.masterPin = hashedPin;
    await settings.save();
  }

  /**
   * 🔄 Procesar renovaciones automáticas de usuarios (BASIC plans)
   * Se ejecuta mediante un CRON job diariamente.
   */
  async processUserAutoRenewals() {
    const now = new Date();

    // Buscar suscripciones que necesiten atención:
    // 1. ACTIVAS que ya vencieron
    // 2. EXPIRADAS que aún tienen autorenovación encendida
    const toRenew = await Subscription.find({
      where: [
        { status: SubscriptionStatus.ACTIVA, endDate: LessThanOrEqual(now), autoRenewal: true },
        { status: SubscriptionStatus.EXPIRADA, autoRenewal: true }
      ],
      relations: ["user"]
    });

    const results = {
      total: toRenew.length,
      success: 0,
      failed: 0
    };

    if (results.total === 0) return results;

    for (const sub of toRenew) {
      try {
        await this.activateOrRenewSubscription(sub.user.id, sub.plan);
        results.success++;
      } catch (error) {
        // Persistencia: Cambiamos a EXPIRADA pero DEJAMOS autoRenewal en true
        // para que el CRON o una recarga futura lo vuelvan a intentar.
        sub.status = SubscriptionStatus.EXPIRADA;
        await sub.save();
        results.failed++;
        console.error(`[AutoRenewal-User] Falló reintento para usuario ${sub.user.id}:`, error);
      }
    }

    return results;
  }

  /**
   * 🎯 Intento de recuperación inmediata (Real-time)
   * Se llama cuando el usuario recarga su billetera.
   */
  async checkAndRecoverSubscription(userId: string) {
    const now = new Date();

    const sub = await Subscription.findOne({
      where: [
        { user: { id: userId }, status: SubscriptionStatus.ACTIVA, endDate: LessThanOrEqual(now), autoRenewal: true },
        { user: { id: userId }, status: SubscriptionStatus.EXPIRADA, autoRenewal: true }
      ]
    });

    if (!sub) return null;

    try {
      // Intentamos renovar. Si tiene saldo de la recarga, se activará.
      return await this.activateOrRenewSubscription(userId, sub.plan);
    } catch (error) {
      // Si aún no alcanza el saldo, se queda como está para el próximo intento.
      return null;
    }
  }
}
