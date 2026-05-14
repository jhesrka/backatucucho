import { Request, Response } from "express";
import { FreePostTrackerService, SubscriptionService } from "../../services";
import { CustomError } from "../../../domain";

import { GlobalSettingsService } from "../../services";

export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly freePostTrackerService: FreePostTrackerService,
    private readonly globalSettingsService: GlobalSettingsService
  ) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
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
      const settings = await this.globalSettingsService.getSettings();
      const freePostsRemaining = Math.max(0, settings.freePostsLimit - tracker.count);

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

  // ========================= ADMIN CONTROLLER METHODS =========================

  getSubscriptionsByUserAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params; // User ID from route /admin/user/:id/subscriptions
      const { page = 1, limit = 10 } = req.query;

      const result = await this.subscriptionService.getSubscriptionsByUserAdmin(id, +page, +limit);
      res.json({ success: true, ...result });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  updateSubscriptionAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params; // Subscription ID
      const dto = req.body;
      const subscription = await this.subscriptionService.updateSubscriptionAdmin(id, dto);
      res.json({ success: true, subscription });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  changeSubscriptionStatusAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params; // Subscription ID
      const { status } = req.body;
      const subscription = await this.subscriptionService.changeSubscriptionStatusAdmin(id, status);
      res.json({ success: true, subscription });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ========================= MASTER PIN OPERATIONS =========================

  /**
   * 🆓 Activar suscripción sin cobro (requiere Master PIN)
   */
  activateSubscriptionWithoutCharge = async (req: Request, res: Response) => {
    try {
      const { userId, masterPin, plan, days } = req.body;

      if (!userId || !masterPin) {
        return res.status(400).json({ message: "userId y masterPin son requeridos" });
      }

      const subscription = await this.subscriptionService.activateSubscriptionWithoutCharge(
        userId,
        masterPin,
        plan,
        days ? Number(days) : undefined
      );

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
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * 📅 Modificar fecha de expiración (requiere Master PIN)
   */
  updateSubscriptionExpirationDate = async (req: Request, res: Response) => {
    try {
      const { id } = req.params; // Subscription ID
      const { newEndDate, masterPin } = req.body;

      if (!newEndDate || !masterPin) {
        return res.status(400).json({ message: "newEndDate y masterPin son requeridos" });
      }

      const subscription = await this.subscriptionService.updateSubscriptionExpirationDate(
        id,
        newEndDate,
        masterPin
      );

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
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * 🔧 Configurar Master PIN
   */
  setMasterPin = async (req: Request, res: Response) => {
    try {
      const { newPin } = req.body;

      if (!newPin) {
        return res.status(400).json({ message: "newPin es requerido" });
      }

      await this.subscriptionService.setMasterPin(newPin);

      res.json({
        success: true,
        message: "PIN maestro configurado correctamente"
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * 🔍 Verificar si el Master PIN está configurado
   */
  getMasterPinStatus = async (req: Request, res: Response) => {
    try {
      const status = await this.subscriptionService.getMasterPinStatus();
      res.json({ success: true, ...status });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * 🔄 Cambiar Master PIN (requiere PIN actual)
   */
  changeMasterPin = async (req: Request, res: Response) => {
    try {
      const { currentPin, newPin } = req.body;

      if (!currentPin || !newPin) {
        return res.status(400).json({ message: "currentPin y newPin son requeridos" });
      }

      await this.subscriptionService.changeMasterPin(currentPin, newPin);

      res.json({
        success: true,
        message: "PIN maestro actualizado correctamente"
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * 🔐 Verificar Master PIN
   */
  verifyMasterPin = async (req: Request, res: Response) => {
    try {
      const { masterPin } = req.body;

      if (!masterPin) {
        return res.status(400).json({ message: "masterPin es requerido" });
      }

      const isValid = await this.subscriptionService.validateMasterPin(masterPin);

      if (!isValid) {
        return res.status(403).json({ message: "PIN Maestro incorrecto" });
      }

      res.json({
        success: true,
        message: "PIN validado correctamente"
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Actualizar configuración de posts gratuitos (solo admin)
   */
  updateFreePostSettings = async (req: Request, res: Response) => {
    try {
      const { freePostsLimit, freePostDurationDays, freePostDurationHours, masterPin } = req.body;

      // Validar PIN Maestro
      const isValidPin = await this.subscriptionService.validateMasterPin(masterPin);
      if (!isValidPin) {
        throw CustomError.forbiden("PIN Maestro incorrecto");
      }

      const settings = await this.globalSettingsService.updateFreePostSettings({
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
          postsRetentionDays: settings.postsRetentionDays,
          paidPostsRetentionDays: settings.paidPostsRetentionDays,
          paidPurgeInactivityMonths: settings.paidPurgeInactivityMonths,
          autoPurgeEnabled: settings.autoPurgeEnabled,
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Obtener configuración actual de posts gratuitos (solo admin)
   */
  getFreePostSettings = async (req: Request, res: Response) => {
    try {
      const settings = await this.globalSettingsService.getSettings();
      res.json({
        success: true,
        settings: {
          freePostsLimit: settings.freePostsLimit,
          freePostDurationDays: settings.freePostDurationDays,
          freePostDurationHours: settings.freePostDurationHours,
          postsRetentionDays: settings.postsRetentionDays,
          paidPostsRetentionDays: settings.paidPostsRetentionDays,
          paidPurgeInactivityMonths: settings.paidPurgeInactivityMonths,
          autoPurgeEnabled: settings.autoPurgeEnabled,
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
