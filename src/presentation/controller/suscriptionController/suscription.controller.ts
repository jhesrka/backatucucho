import { Request, Response } from "express";
import { FreePostTrackerService, SubscriptionService } from "../../services";
import { CustomError } from "../../../domain";

export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly freePostTrackerService: FreePostTrackerService
  ) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  /**
   * Activar o renovar una suscripción
   */
  activateOrRenewSubscription = async (req: Request, res: Response) => {
    try {
      const userId = req.body.sessionUser?.id;

      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const { plan } = req.body;
      const subscriptionPlan = plan || "basic";

      const subscription =
        await this.subscriptionService.activateOrRenewSubscription(
          userId,
          subscriptionPlan
        );

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
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Obtener si el usuario tiene suscripción activa
   */
  hasActiveSubscription = async (req: Request, res: Response) => {
    try {
      const userId = req.body.sessionUser?.id;

      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const isActive = await this.subscriptionService.hasActiveSubscription(
        userId
      );

      res.status(200).json({
        success: true,
        isActive,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Configurar el costo de la suscripción (solo admin)
   */
  setSubscriptionCost = async (req: Request, res: Response) => {
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
    } catch (error) {
      this.handleError(error, res);
    }
  };
  /**
   * Obtener estado de publicaciones del usuario (gratis y suscripción)
   */
  getUserPostStatus = async (req: Request, res: Response) => {
    try {
      const userId = req.body.sessionUser?.id;
      if (!userId)
        return res.status(401).json({ message: "Usuario no autenticado" });

      const tracker = await this.freePostTrackerService.getOrCreateTracker(
        userId
      );
      const freePostsRemaining = Math.max(0, 5 - tracker.count);

      const latest = await this.subscriptionService.getLatestSubscription(
        userId
      );
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
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
