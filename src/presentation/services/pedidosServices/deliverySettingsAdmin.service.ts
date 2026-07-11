import { DeliverySettings } from "../../../data/postgres/models/DeliverySettings";
import { CustomError } from "../../../domain";
import { GlobalSettings } from "../../../data/postgres/models/global-settings.model";
import bcrypt from "bcryptjs";


export class DeliverySettingsAdminService {
  async getActive() {
    const settings = await DeliverySettings.findOne({ where: { isActive: true }});
    if (!settings) throw CustomError.notFound("No hay configuración activa");
    return settings;
  }

  async createOrActivate(data: Partial<DeliverySettings> & { masterPin?: string }) {
    await this.verifyMasterPin(data.masterPin || "");

    // Desactivar actuales
    await DeliverySettings.createQueryBuilder()
      .update(DeliverySettings)
      .set({ isActive: false })
      .where("isActive = :active", { active: true })
      .execute();

    const s = DeliverySettings.create({
      firstRangeKm: data.firstRangeKm ?? 3,
      firstRangeFee: data.firstRangeFee ?? 1.25,
      extraStepKm: data.extraStepKm ?? 2,
      extraStepFee: data.extraStepFee ?? 0.25,
      isActive: true,
      peakHours: data.peakHours ?? [],
    });
    return await s.save();
  }

  async update(id: string, data: Partial<DeliverySettings> & { masterPin?: string }) {
    await this.verifyMasterPin(data.masterPin || "");

    const s = await DeliverySettings.findOneBy({ id });
    if (!s) throw CustomError.notFound("Configuración no encontrada");

    if (typeof data.firstRangeKm === "number") s.firstRangeKm = data.firstRangeKm;
    if (typeof data.firstRangeFee === "number") s.firstRangeFee = data.firstRangeFee;
    if (typeof data.extraStepKm === "number") s.extraStepKm = data.extraStepKm;
    if (typeof data.extraStepFee === "number") s.extraStepFee = data.extraStepFee;
    if (Array.isArray(data.peakHours)) s.peakHours = data.peakHours;

    if (typeof data.isActive === "boolean" && data.isActive) {
      // Si se reactiva esta, desactivar las otras
      await DeliverySettings.createQueryBuilder()
        .update(DeliverySettings)
        .set({ isActive: false })
        .where("id != :id", { id: s.id })
        .execute();
      s.isActive = true;
    }

    return await s.save();
  }

  private async verifyMasterPin(pin: string) {
    if (!pin) throw CustomError.unAuthorized("Master PIN requerido");

    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings || !settings.masterPin) {
      throw CustomError.internalServer("Error de seguridad: Master PIN no configurado en el sistema");
    }

    const isValid = await bcrypt.compare(pin, settings.masterPin);
    if (!isValid) {
      throw CustomError.unAuthorized("Master PIN incorrecto");
    }
  }
}
