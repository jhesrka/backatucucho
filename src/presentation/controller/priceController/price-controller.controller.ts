import { Request, Response } from "express";
import { PriceService } from "../../services";
import { CustomError } from "../../../domain";

export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // Obtener configuración actual de precios
  getPriceSettings = (req: Request, res: Response) => {
    this.priceService
      .getCurrentPriceSettings()
      .then((settings) => res.status(200).json(settings))
      .catch((error: unknown) => this.handleError(error, res));
  };

  // Actualizar configuración de precios (admin)
  updatePriceSettings = (req: Request, res: Response) => {
    const { basePrice, extraDayPrice } = req.body;

    if (basePrice === undefined || extraDayPrice === undefined) {
      return res
        .status(422)
        .json({ message: "Debe proporcionar basePrice y extraDayPrice" });
    }

    this.priceService
      .updatePriceSettings(Number(basePrice), Number(extraDayPrice))
      .then((updated) => res.status(200).json(updated))
      .catch((error: unknown) => this.handleError(error, res));
  };

  // Calcular precio de historia según días
  calculateStoriePrice = async (req: Request, res: Response) => {
    try {
      const diasParam = req.query.dias;

      // Validación estricta
      if (
        diasParam === undefined ||
        diasParam === null ||
        diasParam === "" ||
        Array.isArray(diasParam)
      ) {
        return res.status(400).json({
          message: "Debe proporcionar un número válido de días",
        });
      }

      const dias = Number(diasParam);

      // Validamos nuevamente por seguridad
      if (isNaN(dias) || dias < 1) {
        return res.status(400).json({
          message: "Debe proporcionar un número válido de días",
        });
      }

      const settings = await this.priceService.getCurrentPriceSettings();

      const base = Number(settings.basePrice);
      const extra = Number(settings.extraDayPrice);

      const price = this.priceService.calcularPrecio(dias, base, extra);

      return res.status(200).json({
        dias,
        price, // ← Ya es número, no se convierte a string
      });
    } catch (error) {
      console.error("Error al calcular el precio:", error);
      return this.handleError(error, res);
    }
  };
}
