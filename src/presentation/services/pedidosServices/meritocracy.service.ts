import { Pedido, UserMotorizado, MotorizadoTier, PriceSettings, EstadoPedido, EstadoCuentaMotorizado } from "../../../data";
import { CustomError } from "../../../domain";
import { Between, In } from "typeorm";

export class MeritocracyService {

  /**
   * Obtiene el ranking en vivo basado en los pedidos entregados 
   * desde el último cierre de ranking hasta ahora.
   */
  async getLiveRanking(): Promise<{ totalPedidos: number, ranking: any[], startDate?: Date, endDate?: Date }> {
    const config = await PriceSettings.findOne({ where: {} });
    if (!config) throw CustomError.internalServer("Configuración de precios no encontrada");

    // Determinar la fecha de inicio del periodo actual
    // Si no hay lastRankingUpdate, usamos el inicio del mes actual
    let startDate = config.lastRankingUpdate;
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date();

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
        updatedAt: Between(startDate, endDate)
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
  async processTierUpdate(): Promise<{ success: boolean, processed: number }> {
    const { ranking } = await this.getLiveRanking();
    const tiers = await MotorizadoTier.find({ order: { minParticipationPercentage: 'DESC' } });
    const config = await PriceSettings.findOne({ where: {} });

    if (!config) throw CustomError.internalServer("No se pudo cargar la configuración");

    for (const r of ranking) {
      const moto = await UserMotorizado.findOne({ where: { id: r.id } });
      if (!moto) continue;

      // Buscar el tier que le corresponde
      const nuevoTier = tiers.find((t: MotorizadoTier) => r.participacion >= Number(t.minParticipationPercentage));
      
      if (nuevoTier) {
        moto.currentTier = nuevoTier;
        // La comisión real se guarda para usarla en el cálculo de pedidos
        // Aunque el pedido siempre consulta la comisión al momento de crearse/asignarse
      }

      moto.performanceLastPeriod = {
        pedidos: r.pedidosCount,
        participacion: r.participacion,
        fechaCierre: new Date(),
        tierAsignado: nuevoTier?.name || 'Base'
      };

      await moto.save();
    }

    // Actualizar fecha de último cierre
    config.lastRankingUpdate = new Date();
    await config.save();

    return { success: true, processed: ranking.length };
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
