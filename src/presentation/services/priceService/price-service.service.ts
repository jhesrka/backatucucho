// src/domain/services/PriceService.ts
import { PriceSettings } from "../../../data";
import { CustomError } from "../../../domain";

export class PriceService {
  async getCurrentPriceSettings(): Promise<PriceSettings> {
    // Buscar el primer registro existente
    const config = await PriceSettings.findOne({ where: {} }); // ✅ TypeORM 0.3+

    // Si no existe, crear uno por defecto
    if (!config) {
      const defaultConfig = new PriceSettings();
      defaultConfig.basePrice = 1.0;
      defaultConfig.extraDayPrice = 0.25;
      return await defaultConfig.save();
    }

    return config;
  }

  async updatePriceSettings(basePrice: number, extraDayPrice: number) {
    const config = await this.getCurrentPriceSettings();
    config.basePrice = basePrice;
    config.extraDayPrice = extraDayPrice;
    return await config.save();
  }

  calcularPrecio(
    dias: number,
    base: number | string,
    extra: number | string
  ): number {
    const baseNumber = Number(base);
    const extraNumber = Number(extra);

    if (isNaN(baseNumber) || isNaN(extraNumber)) {
      throw CustomError.internalServer("Precio base o extra inválido");
    }

    if (dias < 1) throw CustomError.badRequest("Duración mínima: 1 día");

    return Number((baseNumber + (dias - 1) * extraNumber).toFixed(2));
  }
}
