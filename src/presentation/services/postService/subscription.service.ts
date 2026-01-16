import { MoreThan, LessThanOrEqual } from "typeorm";
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
  WalletStatus,
} from "../../../data";
import { CustomError } from "../../../domain";
import { addDays } from "date-fns";

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
}
