import { MoreThan, LessThanOrEqual } from "typeorm";
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
  WalletStatus,
  GlobalSettings,
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
   * Activa o renueva una suscripción (30 días calendario, lunes a domingo).
   */
  async activateOrRenewSubscription(
    userId: string,
    plan: SubscriptionPlan = SubscriptionPlan.BASIC
  ): Promise<Subscription> {
    // Buscar usuario
    const user = await User.findOne({
      where: { id: userId },
      relations: ["wallet"],
    });
    if (!user) throw CustomError.notFound("Usuario no encontrado");

    const wallet = user.wallet;
    if (!wallet || wallet.status !== WalletStatus.ACTIVO) {
      throw CustomError.badRequest("Wallet no disponible o bloqueada");
    }

    // Buscar suscripción por usuario y plan
    let subscription = await Subscription.findOne({
      where: { user: { id: userId }, plan },
    });

    const now = new Date();
    let newStartDate = now;
    let newEndDate: Date = now; // inicialización obligatoria

    const daysToAdd = 30; // duración de la suscripción en días calendario (lunes a domingo)

    if (!subscription) {
      // Crear nueva suscripción si no existía
      subscription = new Subscription();
      subscription.user = user;
      subscription.plan = plan;
      subscription.status = SubscriptionStatus.PENDIENTE;

      // Fechas por calendario
      subscription.startDate = now;
      subscription.endDate = addDays(now, daysToAdd);

      // Alinear con la actualización final (sin cambiar la lógica existente)
      newStartDate = subscription.startDate;
      newEndDate = subscription.endDate!;
    } else {
      if (subscription.isActive()) {
        // Renovación: sumar días restantes
        const remainingDays = Math.ceil(
          (subscription.endDate!.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
        );
        newStartDate = subscription.startDate!;
        newEndDate = addDays(now, daysToAdd + Math.max(remainingDays, 0));
      } else {
        // Suscripción expirada: nueva activación (calendario)
        newStartDate = now;
        newEndDate = addDays(now, daysToAdd);
      }
    }

    // Validar saldo
    if (wallet.balance < this.subscriptionCost) {
      throw CustomError.badRequest(
        "Saldo insuficiente para activar la suscripción"
      );
    }

    // Debitar Wallet
    wallet.balance -= this.subscriptionCost;
    await wallet.save();

    // Actualizar suscripción
    subscription.startDate = newStartDate;
    subscription.endDate = newEndDate;
    subscription.status = SubscriptionStatus.ACTIVA;
    subscription.autoRenewal = true; // activar auto-renovación
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
  async updateSubscriptionAdmin(id: string, dto: { endDate?: Date; status?: SubscriptionStatus; autoRenewal?: boolean }) {
    const subscription = await Subscription.findOneBy({ id });
    if (!subscription) throw CustomError.notFound("Suscripción no encontrada");

    if (dto.endDate) subscription.endDate = new Date(dto.endDate);
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
  private async validateMasterPin(pin: string): Promise<boolean> {
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
    plan: SubscriptionPlan = SubscriptionPlan.BASIC // Usa el enum correcto
  ): Promise<Subscription> {
    try {
      // Validar PIN
      const isValidPin = await this.validateMasterPin(masterPin);
      if (!isValidPin) {
        throw CustomError.badRequest("PIN maestro incorrecto");
      }

      // Buscar usuario
      const user = await User.findOne({
        where: { id: userId },
      });
      if (!user) throw CustomError.notFound("Usuario no encontrado");

      // Buscar o crear suscripción
      let subscription = await Subscription.findOne({
        where: { user: { id: userId }, plan },
      });

      const now = new Date();
      const daysToAdd = 30;

      if (!subscription) {
        // Crear nueva suscripción
        subscription = new Subscription();
        subscription.user = user;
        subscription.plan = plan;
        subscription.startDate = now;
        subscription.endDate = addDays(now, daysToAdd);
      } else {
        // Si ya existe, extender o reactivar
        if (subscription.isActive()) {
          // Extender desde la fecha actual de expiración
          const remainingDays = Math.ceil(
            (subscription.endDate!.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
          );
          subscription.endDate = addDays(now, daysToAdd + Math.max(remainingDays, 0));
        } else {
          // Reactivar desde ahora
          subscription.startDate = now;
          subscription.endDate = addDays(now, daysToAdd);
        }
      }

      // Activar sin cobro
      subscription.status = SubscriptionStatus.ACTIVA;
      subscription.autoRenewal = false; // No auto-renovar suscripciones gratuitas
      await subscription.save();

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
    console.log("[SubscriptionService] getMasterPinStatus check:", {
      found: !!settings,
      hasPin: !!settings?.masterPin
    });
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
}
