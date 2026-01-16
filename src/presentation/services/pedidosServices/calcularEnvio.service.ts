import { Negocio } from "../../../data";
import { DeliverySettings } from "../../../data/postgres/models/DeliverySettings";

export class CalcularEnvioService {
  static toNumber(n: any, def = 0) {
    const v = Number(n);
    return Number.isFinite(v) ? v : def;
  }

  static haversineKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // km
    const dLat = (Math.PI/180) * (lat2 - lat1);
    const dLon = (Math.PI/180) * (lon2 - lon1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos((Math.PI/180)*lat1) * Math.cos((Math.PI/180)*lat2) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return +(R * c).toFixed(3);
  }

  static async getActiveSettingsOrThrow() {
    const settings = await DeliverySettings.findOne({ where: { isActive: true } });
    if (!settings) {
      throw new Error("No hay configuración global de delivery activa. Configúrala en el admin.");
    }
    return settings;
  }

  static calcFee(distanciaKm: number, s: DeliverySettings): number {
    const firstRangeKm = this.toNumber(s.firstRangeKm, 3);
    const firstRangeFee = this.toNumber(s.firstRangeFee, 1.25);
    const extraStepKm = this.toNumber(s.extraStepKm, 2);
    const extraStepFee = this.toNumber(s.extraStepFee, 0.25);

    if (distanciaKm <= firstRangeKm) return +firstRangeFee.toFixed(2);

    const extraBlocks = Math.ceil((distanciaKm - firstRangeKm) / extraStepKm);
    const fee = firstRangeFee + extraBlocks * extraStepFee;
    return +fee.toFixed(2);
  }

  static async calcularParaPedido(params: {
    negocio: Negocio;
    latCliente: number;
    lngCliente: number;
  }) {
    const { negocio, latCliente, lngCliente } = params;

    if (negocio.latitud == null || negocio.longitud == null) {
      throw new Error("El negocio no tiene coordenadas configuradas.");
    }

    const settings = await this.getActiveSettingsOrThrow();

    const distanciaKm = this.haversineKm(
      Number(negocio.latitud),
      Number(negocio.longitud),
      Number(latCliente),
      Number(lngCliente)
    );

    const costoEnvio = this.calcFee(distanciaKm, settings);

    return { distanciaKm, costoEnvio, settings };
  }
}
