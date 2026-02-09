import { PriceSettings, CommissionLog, Useradmin } from "../../../data";
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
      defaultConfig.motorizadoPercentage = 80.00;
      defaultConfig.appPercentage = 20.00;
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

  async updateCommissionSettings(motorizadoPercentage: number, appPercentage: number, administrativeUser: Useradmin) {
    const config = await this.getCurrentPriceSettings();

    // Guardar log de auditoría
    const log = new CommissionLog();
    log.prevMotorizadoPercentage = Number(config.motorizadoPercentage);
    log.newMotorizadoPercentage = motorizadoPercentage;
    log.prevAppPercentage = Number(config.appPercentage);
    log.newAppPercentage = appPercentage;
    log.changedBy = administrativeUser;
    await log.save();

    config.motorizadoPercentage = motorizadoPercentage;
    config.appPercentage = appPercentage;
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
