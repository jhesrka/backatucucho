import { Pedido, UserMotorizado, MotorizadoTier, PriceSettings, EstadoPedido, EstadoCuentaMotorizado, MeritocracyCycleLog } from "../../../data";
import { CustomError } from "../../../domain";
import { Between } from "typeorm";
import moment from "moment-timezone";

export class MeritocracyService {

  /**
   * Calcula el rango de fechas para el ciclo de meritocracia actual (de Lunes 00:00 a Domingo 23:59).
   */
  private getCycleDates(lastRankingUpdate: Date | null, periodDays: number): { startDate: Date, endDate: Date } {
    const tz = 'America/Guayaquil';
    
    let startMom: moment.Moment;
    if (!lastRankingUpdate) {
      // Por defecto: Lunes de la semana actual
      startMom = moment().tz(tz).startOf('isoWeek');
    } else {
      // El ciclo anterior finalizó en un Domingo a las 23:59:59.999
      // El siguiente ciclo inicia inmediatamente en el siguiente Lunes a las 00:00:00
      startMom = moment(lastRankingUpdate).tz(tz).add(1, 'ms').startOf('isoWeek');
    }
    
    // Determinar la duración del ciclo en semanas (mínimo 1 semana)
    const weeks = Math.max(1, Math.round(periodDays / 7));
    
    // El ciclo termina el domingo de la semana W a las 23:59:59.999
    const endMom = startMom.clone().add(weeks, 'weeks').subtract(1, 'ms');
    
    return {
      startDate: startMom.toDate(),
      endDate: endMom.toDate()
    };
  }

  /**
   * Obtiene el estado actual del ciclo de meritocracia y control de ejecución.
   */
  async getMeritocracyStatus(): Promise<any> {
    const config = await PriceSettings.findOne({ where: {} });
    if (!config) throw CustomError.internalServer("Configuración de precios no encontrada");

    const periodDays = config.rankingEvaluationPeriodDays || 7;
    const { startDate, endDate } = this.getCycleDates(config.lastRankingUpdate, periodDays);

    const now = new Date();
    const isPendingClosure = now > endDate;

    // Obtener el último log de ejecución
    const lastExecution = await MeritocracyCycleLog.findOne({
      where: {},
      order: { executedAt: 'DESC' }
    });

    const isAlreadyClosed = config.lastRankingUpdate ? (config.lastRankingUpdate.getTime() === endDate.getTime()) : false;
    const canCloseManually = isPendingClosure && !isAlreadyClosed;

    return {
      currentCycleStart: startDate,
      currentCycleEnd: endDate,
      isPendingClosure,
      canCloseManually,
      lastExecution
    };
  }

  /**
   * Obtiene el ranking en vivo basado en los pedidos entregados 
   * desde el inicio del ciclo actual.
   */
  async getLiveRanking(): Promise<{ totalPedidos: number, ranking: any[], startDate?: Date, endDate?: Date }> {
    const config = await PriceSettings.findOne({ where: {} });
    if (!config) throw CustomError.internalServer("Configuración de precios no encontrada");

    const periodDays = config.rankingEvaluationPeriodDays || 7;
    const { startDate, endDate } = this.getCycleDates(config.lastRankingUpdate, periodDays);

    const now = new Date();
    // Si el periodo ya culminó pero no se ha cerrado, limitamos el ranking
    // a los pedidos acumulados dentro de los límites del ciclo vencido.
    const queryEndDate = now > endDate ? endDate : now;

    // 1. Obtener todos los motorizados activos
    const motorizados = await UserMotorizado.find({
      where: { estadoCuenta: EstadoCuentaMotorizado.ACTIVO },
      relations: ['currentTier']
    });

    if (motorizados.length === 0) return { totalPedidos: 0, ranking: [] };

    // 2. Obtener pedidos entregados en este periodo
    const pedidos = await Pedido.find({
      where: {
        estado: EstadoPedido.ENTREGADO,
        updatedAt: Between(startDate, queryEndDate)
      },
      relations: ['motorizado']
    });

    const totalPedidos = pedidos.length;

    // 3. Calcular estadísticas por motorizado
    const stats = motorizados.map(moto => {
      const pedidosMoto = pedidos.filter(p => p.motorizado?.id === moto.id).length;
      const participacion = totalPedidos > 0 ? (pedidosMoto / totalPedidos) * 100 : 0;

      return {
        id: moto.id,
        nombre: `${moto.name} ${moto.surname}`,
        pedidosCount: pedidosMoto,
        participacion: Number(participacion.toFixed(2)),
        tierActual: moto.currentTier?.name || 'Sin Rango',
        comisionActual: moto.currentTier?.commissionPercentage || config.motorizadoPercentage
      };
    });

    // 4. Ordenar por participación de mayor a menor
    const ranking = stats.sort((a, b) => b.participacion - a.participacion);

    // 5. Proyectar próximo nivel basado en los umbrales actuales
    const tiers = await MotorizadoTier.find({ order: { minParticipationPercentage: 'DESC' } });
    
    const rankingWithProjection = ranking.map(r => {
      const proximoTier = tiers.find((t: MotorizadoTier) => r.participacion >= Number(t.minParticipationPercentage));
      return {
        ...r,
        proximoTier: proximoTier?.name || (tiers.length > 0 ? tiers[tiers.length - 1].name : 'Base'),
        proximoTierColor: proximoTier?.color || '#admin-primary'
      };
    });

    return {
      totalPedidos,
      startDate,
      endDate,
      ranking: rankingWithProjection
    };
  }

  /**
   * Cierra el periodo actual y asigna las nuevas comisiones
   */
  async processTierUpdate(executionType: 'AUTO' | 'MANUAL' = 'MANUAL'): Promise<{ success: boolean, processed: number }> {
    const config = await PriceSettings.findOne({ where: {} });
    if (!config) throw CustomError.internalServer("No se pudo cargar la configuración");

    const periodDays = config.rankingEvaluationPeriodDays || 7;
    const { startDate, endDate } = this.getCycleDates(config.lastRankingUpdate, periodDays);

    const now = new Date();
    // Validar que realmente ya haya finalizado el ciclo
    if (now <= endDate) {
      throw CustomError.badRequest("El ciclo actual de meritocracia aún no ha finalizado.");
    }

    let processedCount = 0;
    let totalOrders = 0;

    try {
      // Obtener el ranking cerrado para este periodo
      const rankingData = await this.getLiveRanking();
      const ranking = rankingData.ranking;
      totalOrders = rankingData.totalPedidos;

      const tiers = await MotorizadoTier.find({ order: { minParticipationPercentage: 'DESC' } });

      for (const r of ranking) {
        const moto = await UserMotorizado.findOne({ where: { id: r.id } });
        if (!moto) continue;

        // Buscar el tier que le corresponde
        const nuevoTier = tiers.find((t: MotorizadoTier) => r.participacion >= Number(t.minParticipationPercentage));
        
        if (nuevoTier) {
          moto.currentTier = nuevoTier;
        }

        moto.performanceLastPeriod = {
          pedidos: r.pedidosCount,
          participacion: r.participacion,
          fechaCierre: endDate,
          tierAsignado: nuevoTier?.name || 'Base'
        };

        await moto.save();
        processedCount++;
      }

      // Actualizar fecha de último cierre a la fecha exacta del fin del ciclo
      config.lastRankingUpdate = endDate;
      await config.save();

      // Guardar log exitoso
      const log = new MeritocracyCycleLog();
      log.cycleStart = startDate;
      log.cycleEnd = endDate;
      log.executionType = executionType;
      log.status = 'SUCCESS';
      log.processedMotorizadosCount = processedCount;
      log.totalOrdersCount = totalOrders;
      await log.save();

      return { success: true, processed: processedCount };
    } catch (error: any) {
      // Registrar log fallido
      const log = new MeritocracyCycleLog();
      log.cycleStart = startDate;
      log.cycleEnd = endDate;
      log.executionType = executionType;
      log.status = 'FAILED';
      log.errorMessage = error.message || String(error);
      await log.save();

      throw error;
    }
  }

  /**
   * Actualiza o crea los tiers de meritocracia de forma masiva
   */
  async updateTiers(tiers: any[]): Promise<MotorizadoTier[]> {
    const results: MotorizadoTier[] = [];

    // 1. Obtener IDs entrantes
    const incomingIds = tiers.filter(t => t.id).map(t => t.id);

    // 2. Borrar los que ya no están en la lista (Sincronización completa)
    const existingTiers = await MotorizadoTier.find();
    for (const et of existingTiers) {
      if (!incomingIds.includes(et.id)) {
        await MotorizadoTier.delete(et.id);
      }
    }

    // 3. Actualizar o Crear
    for (const t of tiers) {
      let tier: MotorizadoTier;
      
      if (t.id) {
        tier = await MotorizadoTier.findOne({ where: { id: t.id } }) || new MotorizadoTier();
      } else {
        tier = new MotorizadoTier();
      }

      tier.name = t.name;
      tier.commissionPercentage = Number(t.commissionPercentage);
      tier.minParticipationPercentage = Number(t.minParticipationPercentage);
      tier.color = t.color || '#admin-primary';

      await tier.save();
      results.push(tier);
    }

    return results;
  }

  /**
   * Elimina un tier por ID
   */
  async deleteTier(id: string): Promise<boolean> {
    const result = await MotorizadoTier.delete(id);
    return (result.affected || 0) > 0;
  }

  /**
   * Inicializa tiers por defecto si la tabla está vacía
   */
  async ensureDefaultTiers() {
    const count = await MotorizadoTier.count();
    if (count === 0) {
      const defaultTiers = [
        { name: 'Diamante', commissionPercentage: 80, minParticipationPercentage: 20, color: '#00D1FF' },
        { name: 'Oro', commissionPercentage: 70, minParticipationPercentage: 10, color: '#FFD700' },
        { name: 'Bronce', commissionPercentage: 65, minParticipationPercentage: 0, color: '#CD7F32' },
      ];

      for (const t of defaultTiers) {
        const tier = new MotorizadoTier();
        tier.name = t.name;
        tier.commissionPercentage = t.commissionPercentage;
        tier.minParticipationPercentage = t.minParticipationPercentage;
        tier.color = t.color;
        await tier.save();
      }
    }

    // Asegurar que todos los motorizados tengan un tier inicial (el más alto para los nuevos)
    const topTier = await MotorizadoTier.findOne({ where: {}, order: { commissionPercentage: 'DESC' } });
    if (topTier) {
      await UserMotorizado.createQueryBuilder()
        .update()
        .set({ currentTier: topTier as any })
        .where("currentTierId IS NULL")
        .execute();
    }
  }
}
