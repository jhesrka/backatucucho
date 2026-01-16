// src/presentation/controllers/DeliverySettingsController.ts
import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { DeliverySettingsAdminService } from "../services/pedidosServices/deliverySettingsAdmin.service";

export class DeliverySettingsController {
  constructor(private readonly service: DeliverySettingsAdminService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // ======================== Obtener configuración activa ========================
  getActive = async (_req: Request, res: Response) => {
    try {
      const settings = await this.service.getActive();
      return res.status(200).json(settings);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Crear nueva configuración (activa) ========================
  create = async (req: Request, res: Response) => {
    try {
      const {
        firstRangeKm,
        firstRangeFee,
        extraStepKm,
        extraStepFee,
        isActive, // opcional; si no viene, se asume true en el service
      } = req.body ?? {};

      // Validaciones mínimas (opcionales; el service también valida)
      const toNum = (v: any) => (v === undefined ? undefined : Number(v));
      const payload = {
        firstRangeKm: toNum(firstRangeKm),
        firstRangeFee: toNum(firstRangeFee),
        extraStepKm: toNum(extraStepKm),
        extraStepFee: toNum(extraStepFee),
        isActive: typeof isActive === "boolean" ? isActive : true,
      };

      const created = await this.service.createOrActivate(payload);
      return res.status(201).json(created);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Actualizar configuración por ID ========================
  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "Falta el ID de la configuración" });

      const {
        firstRangeKm,
        firstRangeFee,
        extraStepKm,
        extraStepFee,
        isActive,
      } = req.body ?? {};

      const toNum = (v: any) => (v === undefined ? undefined : Number(v));
      const payload = {
        firstRangeKm: toNum(firstRangeKm),
        firstRangeFee: toNum(firstRangeFee),
        extraStepKm: toNum(extraStepKm),
        extraStepFee: toNum(extraStepFee),
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      };

      const updated = await this.service.update(id, payload);
      return res.status(200).json(updated);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
}
