import { DeliverySettings } from "../../../data/postgres/models/DeliverySettings";
import { CustomError } from "../../../domain";


export class DeliverySettingsAdminService {
  async getActive() {
    const settings = await DeliverySettings.findOne({ where: { isActive: true }});
    if (!settings) throw CustomError.notFound("No hay configuración activa");
    return settings;
  }

  async createOrActivate(data: Partial<DeliverySettings>) {
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
    });
    return await s.save();
  }

  async update(id: string, data: Partial<DeliverySettings>) {
    const s = await DeliverySettings.findOneBy({ id });
    if (!s) throw CustomError.notFound("Configuración no encontrada");

    if (typeof data.firstRangeKm === "number") s.firstRangeKm = data.firstRangeKm;
    if (typeof data.firstRangeFee === "number") s.firstRangeFee = data.firstRangeFee;
    if (typeof data.extraStepKm === "number") s.extraStepKm = data.extraStepKm;
    if (typeof data.extraStepFee === "number") s.extraStepFee = data.extraStepFee;

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
}
