import { Negocio } from "../../../data";
import { DeliverySettings } from "../../../data/postgres/models/DeliverySettings";
import moment from "moment-timezone";

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

    const costoEnvioBase = this.calcFee(distanciaKm, settings);
    let costoEnvioTotal = costoEnvioBase;
    let recargoPico = 0;
    let porcentajePicoAplicado = 0;
    let isPeakHour = false;

    // --- EVALUACIÓN DE HORARIOS PICO ---
    if (settings.peakHours && Array.isArray(settings.peakHours)) {
      const horaActualEcuador = moment().tz("America/Guayaquil");
      const currentMinutes = horaActualEcuador.hours() * 60 + horaActualEcuador.minutes();

      for (const peak of settings.peakHours) {
        if (!peak.enabled) continue;

        const [startH, startM] = peak.startTime.split(':').map(Number);
        const [endH, endM] = peak.endTime.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;

        // Soporte si el horario cruza la medianoche (ej: 22:00 a 02:00)
        let inRange = false;
        if (startMinutes <= endMinutes) {
          inRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
          // Cruza la medianoche
          inRange = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }

        if (inRange) {
          isPeakHour = true;
          porcentajePicoAplicado = Number(peak.surchargePercentage) || 0;
          recargoPico = +(costoEnvioBase * (porcentajePicoAplicado / 100)).toFixed(2);
          costoEnvioTotal = +(costoEnvioBase + recargoPico).toFixed(2);
          break; // Solo aplicamos el primer horario pico que coincida
        }
      }
    }

    return { 
      distanciaKm, 
      costoEnvioBase, 
      costoEnvio: costoEnvioTotal, 
      recargoPico, 
      isPeakHour,
      porcentajePicoAplicado,
      settings 
    };
  }
}
