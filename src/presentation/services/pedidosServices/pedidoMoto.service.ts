import {
  Pedido,
  EstadoPedido,
  UserMotorizado,
  EstadoCuentaMotorizado,
  EstadoTrabajoMotorizado,
  TransaccionMotorizado,
  TipoTransaccion,
  EstadoTransaccion,
  GlobalSettings,
} from "../../../data";

import { getIO } from "../../../config/socket";
import { CustomError } from "../../../domain";
import { IsNull, Brackets } from "typeorm";

export class PedidoMotoService {
  private static settings: GlobalSettings | null = null;

  private static async getSettings(): Promise<GlobalSettings> {
    if (this.settings) return this.settings;
    let s = await GlobalSettings.findOne({ where: {} });
    if (!s) {
      s = new GlobalSettings();
      await s.save();
    }
    this.settings = s;
    return s;
  }

  public static async getTimeout(): Promise<number> {
    const s = await this.getSettings();
    return s.timeoutRondaMs || 60_000;
  }

  private static async getMaxRondas(): Promise<number> {
    const s = await this.getSettings();
    return s.maxRondasAsignacion || 4;
  }

  // ============================================================
  // 🧠 HELPERS
  // ============================================================

  private static async isRondaExpirada(pedido: Pedido): Promise<boolean> {
    if (!pedido.fechaInicioRonda) return false;
    const timeout = await this.getTimeout();
    return (
      Date.now() - pedido.fechaInicioRonda.getTime() >= timeout
    );
  }

  public static limpiarCamposRonda(pedido: Pedido): void {
    pedido.motorizadoEnEvaluacion = null;
    pedido.fechaInicioRonda = null;
    pedido.asignacionBloqueada = false;
  }

  private static async obtenerPedidoOrFail(
    id: string,
    relations: string[] = []
  ): Promise<Pedido> {
    const pedido = await Pedido.findOne({ where: { id }, relations });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");
    return pedido;
  }

  private static async obtenerMotorizadoOrFail(
    id: string
  ): Promise<UserMotorizado> {
    const moto = await UserMotorizado.findOneBy({ id });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");
    return moto;
  }

  /**
   * ✅ Elegibilidad profesional:
   * - FIFO por fechaHoraDisponible ASC
   */
  private static async obtenerMotorizadosElegibles(excluidos: string[] = []): Promise<
    UserMotorizado[]
  > {
    const now = new Date();

    const query = UserMotorizado.createQueryBuilder("m")
      .where("m.estadoCuenta = :estadoCuenta", {
        estadoCuenta: EstadoCuentaMotorizado.ACTIVO,
      })
      .andWhere("m.estadoTrabajo = :estadoTrabajo", {
        estadoTrabajo: EstadoTrabajoMotorizado.DISPONIBLE,
      })
      .andWhere("m.quiereTrabajar = :quiereTrabajar", { quiereTrabajar: true })
      .andWhere(
        new Brackets((qb) => {
          qb.where("m.noDisponibleHasta IS NULL").orWhere(
            "m.noDisponibleHasta <= :now",
            { now }
          );
        })
      );

    // Filtrar excluidos si existen
    if (excluidos && excluidos.length > 0 && (excluidos.length > 1 || (excluidos[0] !== "" && excluidos[0] !== null))) {
      query.andWhere("m.id NOT IN (:...excluidos)", { excluidos });
    }

    return query.orderBy("m.fechaHoraDisponible", "ASC").getMany();
  }

  /**
   * Ajusta el estado del motorizado cuando queda libre (sin pedido activo),
   * mandándolo al final de la cola FIFO.
   */
  private static async normalizarEstadoLibreMotorizado(moto: UserMotorizado) {
    const now = new Date();
    const castigado =
      moto.noDisponibleHasta &&
      moto.noDisponibleHasta.getTime() > now.getTime();

    if (moto.quiereTrabajar && !castigado) {
      moto.estadoTrabajo = EstadoTrabajoMotorizado.DISPONIBLE;
    } else {
      moto.estadoTrabajo = EstadoTrabajoMotorizado.NO_TRABAJANDO;
    }

    moto.fechaHoraDisponible = now;
    await moto.save();
  }

  /**
   * Detecta pedidos que quedaron "atascados" (en evaluación pero sin motorizado real o asignación colgada)
   */
  private static async rescatarPedidosCongelados() {
    const timeout = await this.getTimeout();
    const cutoff = new Date(Date.now() - timeout * 2); // Un margen de seguridad adicional

    const pedidosCongelados = await Pedido.find({
      where: {
        estado: EstadoPedido.PREPARANDO,
        asignacionBloqueada: true,
        updatedAt: LessThan(cutoff) as any // Cast for old TypeORM versions if needed
      }
    });

    for (const pedido of pedidosCongelados) {
      console.log(`[RESCATE] Liberando pedido ${pedido.id} por inactividad prolongada`);
      this.limpiarCamposRonda(pedido);
      await pedido.save();
    }
  }

  // ============================================================
  // 🟢 ASIGNACIÓN AUTOMÁTICA (LLAMADO POR EL CRON)
  // ============================================================
  static async asignarPedidosAutomaticamente() {
    // 1. Mantenimiento preventivo
    await this.rescatarPedidosCongelados();

    // 2. Obtener pedidos prioritarios (Batch de 20 para evitar saturación)
    /**
     * Prioridad:
     * 1. Pedidos que ya están en evaluación (revisar expiración)
     * 2. Pedidos en PREPARANDO sin asignar (más antiguos primero)
     */
    const pedidos = await Pedido.find({
      where: { estado: EstadoPedido.PREPARANDO },
      order: {
        // Priorizamos pedidos que tienen motorizadoEnEvaluacion para resolver sus timeouts rápido
        motorizadoEnEvaluacion: "DESC", // Los null van al final en Postgres si usamos NULLS LAST, pero TypeORM sorting es más simple
        createdAt: "ASC"
      },
      relations: ["negocio", "cliente"],
      take: 20
    });

    for (const pedido of pedidos) {
      if (pedido.asignacionBloqueada) continue;

      if (pedido.motorizadoEnEvaluacion) {
        if (!await this.isRondaExpirada(pedido)) continue;

        const continuar = await this.finalizarRondaTimeout(pedido);
        if (!continuar) continue;
      }

      // Intentar procesar asignación
      await this.procesarPedido(pedido.id);
    }
  }

  // ============================================================
  // 🟡 PROCESAR PEDIDO → ASIGNAR A SIGUIENTE MOTORIZADO ELEGIBLE
  // ============================================================
  private static async procesarPedido(pedidoId: string) {
    await Pedido.getRepository().manager.transaction(async (manager) => {
      // 1. Bloqueamos la fila del pedido de forma limpia (sin relaciones para evitar error de Postgres con LEFT JOIN)
      const pedido = await manager.findOne(Pedido, {
        where: { id: pedidoId, estado: EstadoPedido.PREPARANDO },
        lock: { mode: "pessimistic_write" },
      });

      // Validaciones post-lock
      if (!pedido || pedido.motorizadoEnEvaluacion || pedido.asignacionBloqueada) return;

      // Cargamos relaciones después del bloqueo si las necesitamos para las notificaciones
      const pedidoRelaciones = await manager.findOne(Pedido, {
        where: { id: pedidoId },
        relations: ["negocio", "cliente"]
      });

      const disponibles = await this.obtenerMotorizadosElegibles(pedido.motorizadosExcluidos);

      if (!disponibles.length) {
        // No hay motorizados. Si el pedido lleva mucho tiempo sin asignarse, el admin ya lo verá en su tablero operativo.
        // Podríamos disparar un evento aquí para alertas críticas si fuera necesario.
        return;
      }

      const moto = disponibles[0];

      // Bloquear asignación
      pedido.asignacionBloqueada = true;
      pedido.motorizadoEnEvaluacion = moto.id;
      pedido.fechaInicioRonda = new Date();
      pedido.rondaAsignacion = pedido.rondaAsignacion || 1;
      await manager.save(pedido);

      // Bloquear motorizado
      moto.estadoTrabajo = EstadoTrabajoMotorizado.EN_EVALUACION;
      await manager.save(moto);

      const timeout = await this.getTimeout();
      getIO()
        .to(moto.id)
        .emit("pedido_para_ti", {
          pedidoId: pedido.id,
          negocioId: pedidoRelaciones?.negocio?.id || null,
          total: pedido.total,
          expiresAt: Date.now() + timeout,
          duration: timeout,
        });

      getIO().emit("pedido_actualizado", {
        pedidoId: pedido.id,
        estado: pedido.estado,
        motorizadoEnEvaluacion: pedido.motorizadoEnEvaluacion,
      });

      // Liberar lock lógico
      pedido.asignacionBloqueada = false;
      await manager.save(pedido);
    });
  }

  // ============================================================
  // 🔥 TIMEOUT DE RONDA (MOVER AL FINAL DE LA COLA)
  // ============================================================
  private static async finalizarRondaTimeout(pedido: Pedido): Promise<boolean> {
    const motoIdPrevio = pedido.motorizadoEnEvaluacion;

    if (motoIdPrevio) {
      const moto = await UserMotorizado.findOneBy({ id: motoIdPrevio });
      if (moto && moto.estadoTrabajo === EstadoTrabajoMotorizado.EN_EVALUACION) {
        await this.normalizarEstadoLibreMotorizado(moto);
      }
    }

    const rondaActual = pedido.rondaAsignacion || 1;
    const maxRondas = await this.getMaxRondas();

    if (rondaActual >= maxRondas) {
      pedido.estado = EstadoPedido.PREPARANDO_NO_ASIGNADO;
      this.limpiarCamposRonda(pedido);
      pedido.noAssignedSince = new Date(); // Marca de tiempo para el tablero del admin
      await pedido.save();

      getIO().emit("pedido_actualizado", {
        pedidoId: pedido.id,
        estado: pedido.estado,
      });

      return false;
    }

    pedido.rondaAsignacion = rondaActual + 1;
    this.limpiarCamposRonda(pedido);
    await pedido.save();

    getIO().emit("pedido_actualizado", {
      pedidoId: pedido.id,
      estado: pedido.estado,
    });

    return true;
  }

  // ============================================================
  // 🟢 ACEPTAR PEDIDO
  // ============================================================
  static async aceptarPedido(pedidoId: string, motorizadoId: string) {
    const pedido = await this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);

    if (pedido.motorizadoEnEvaluacion !== motorizadoId) {
      throw CustomError.badRequest("No puedes aceptar este pedido");
    }

    const moto = await this.obtenerMotorizadoOrFail(motorizadoId);

    if (moto.estadoTrabajo !== EstadoTrabajoMotorizado.EN_EVALUACION) {
      throw CustomError.badRequest("Estado inválido para aceptar");
    }

    pedido.estado = EstadoPedido.PREPARANDO_ASIGNADO;
    pedido.motorizado = moto;
    this.limpiarCamposRonda(pedido);
    await pedido.save();

    moto.estadoTrabajo = EstadoTrabajoMotorizado.ENTREGANDO;
    await moto.save();

    getIO().emit("pedido_actualizado", {
      pedidoId,
      estado: pedido.estado,
      motorizadoId,
    });

    return pedido;
  }

  // ============================================================
  // ❌ RECHAZAR PEDIDO
  // ============================================================
  static async rechazarPedido(pedidoId: string, motorizadoId: string) {
    const pedido = await this.obtenerPedidoOrFail(pedidoId);

    if (pedido.motorizadoEnEvaluacion !== motorizadoId) {
      throw CustomError.badRequest("No puedes rechazar este pedido");
    }

    // Castigo: Solo mandarlo al final de la cola
    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (moto) {
      await this.normalizarEstadoLibreMotorizado(moto);
    }

    const rondaActual = pedido.rondaAsignacion || 1;
    const maxRondas = await this.getMaxRondas();

    if (rondaActual >= maxRondas) {
      pedido.estado = EstadoPedido.PREPARANDO_NO_ASIGNADO;
      this.limpiarCamposRonda(pedido);
      pedido.noAssignedSince = new Date();
      await pedido.save();

      getIO().emit("pedido_actualizado", {
        pedidoId: pedido.id,
        estado: pedido.estado,
      });

      return pedido;
    }

    // Excluir a este motorizado de este pedido específico
    if (!pedido.motorizadosExcluidos) {
      pedido.motorizadosExcluidos = [];
    }
    if (!pedido.motorizadosExcluidos.includes(motorizadoId)) {
      pedido.motorizadosExcluidos.push(motorizadoId);
    }

    pedido.rondaAsignacion = rondaActual + 1;
    this.limpiarCamposRonda(pedido);
    await pedido.save();

    // Reintentar asignación inmediatamente con otro motorizado
    setImmediate(async () => {
      try { await this.procesarPedido(pedido.id); } catch (e) { }
    });

    return pedido;
  }

  static async marcarEnCamino(pedidoId: string, motorizadoId: string) {
    const pedido = await this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);

    if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
      throw CustomError.badRequest("No autorizado");
    }

    pedido.estado = EstadoPedido.EN_CAMINO;
    await pedido.save();

    getIO().emit("pedido_actualizado", {
      pedidoId,
      estado: pedido.estado,
    });

    return pedido;
  }

  static async entregarPedido(pedidoId: string, motorizadoId: string) {
    const pedido = await this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);
    const moto = await this.obtenerMotorizadoOrFail(motorizadoId);

    if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
      throw CustomError.badRequest("No autorizado");
    }

    pedido.estado = EstadoPedido.ENTREGADO;
    await pedido.save();

    const gananciaMoto = Number(pedido.ganancia_motorizado || (pedido.costoEnvio * 0.8).toFixed(2));
    const saldoAnterior = Number(moto.saldo);
    const saldoNuevo = saldoAnterior + gananciaMoto;

    moto.saldo = saldoNuevo;

    const tx = new TransaccionMotorizado();
    tx.motorizado = moto;
    tx.pedido = pedido;
    tx.tipo = TipoTransaccion.GANANCIA_ENVIO;
    tx.monto = gananciaMoto;
    tx.descripcion = `Ganancia envío #${pedido.id.slice(0, 8)}`;
    tx.estado = EstadoTransaccion.COMPLETADA;
    tx.saldoAnterior = saldoAnterior;
    tx.saldoNuevo = saldoNuevo;
    await tx.save();

    await moto.save();
    await this.normalizarEstadoLibreMotorizado(moto);

    getIO().emit("pedido_actualizado", {
      pedidoId,
      estado: pedido.estado,
    });

    return pedido;
  }

  static async cambiarDisponibilidad(
    motorizadoId: string,
    quiereTrabajar: boolean
  ) {
    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    if (
      moto.estadoTrabajo === EstadoTrabajoMotorizado.ENTREGANDO ||
      moto.estadoTrabajo === EstadoTrabajoMotorizado.EN_EVALUACION
    ) {
      throw CustomError.badRequest(
        "No puedes cambiar tu disponibilidad mientras tienes un pedido activo"
      );
    }

    moto.quiereTrabajar = quiereTrabajar;

    if (quiereTrabajar) {
      moto.estadoTrabajo = EstadoTrabajoMotorizado.DISPONIBLE;
      moto.fechaHoraDisponible = new Date();
    } else {
      moto.estadoTrabajo = EstadoTrabajoMotorizado.NO_TRABAJANDO;
    }

    await moto.save();

    return {
      quiereTrabajar: moto.quiereTrabajar,
      estadoTrabajo: moto.estadoTrabajo,
    };
  }

  static async cancelarPedido(
    pedidoId: string,
    motorizadoId: string,
    motivo: string
  ) {
    const pedido = await this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);
    const moto = await this.obtenerMotorizadoOrFail(motorizadoId);

    if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
      throw CustomError.badRequest("No autorizado");
    }

    if (pedido.estado !== EstadoPedido.EN_CAMINO) {
      throw CustomError.badRequest("Solo puedes cancelar pedidos cuando ya estás en camino.");
    }

    pedido.estado = EstadoPedido.CANCELADO;
    pedido.motivoCancelacion = motivo;
    pedido.ganancia_motorizado = 0;
    pedido.comision_app_domicilio = 0;
    pedido.costoEnvio = 0;
    await pedido.save();

    await this.normalizarEstadoLibreMotorizado(moto);

    getIO().emit("pedido_actualizado", {
      pedidoId,
      estado: pedido.estado,
    });

    return pedido;
  }

  static async obtenerPedidoActivo(motorizadoId: string) {
    return Pedido.findOne({
      where: [
        {
          motorizado: { id: motorizadoId },
          estado: EstadoPedido.PREPARANDO_ASIGNADO,
        },
        {
          motorizado: { id: motorizadoId },
          estado: EstadoPedido.EN_CAMINO,
        },
      ],
      relations: ["negocio", "negocio.usuario", "cliente", "productos", "motorizado"],
    });
  }

  static async obtenerEstadoMotorizado(motorizadoId: string) {
    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    return {
      quiereTrabajar: moto.quiereTrabajar,
      estadoTrabajo: moto.estadoTrabajo,
    };
  }

  static async obtenerHistorial(
    motorizadoId: string,
    fecha?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const query = Pedido.createQueryBuilder("pedido")
      .leftJoinAndSelect("pedido.negocio", "negocio")
      .leftJoinAndSelect("pedido.cliente", "cliente")
      .where("pedido.motorizadoId = :motorizadoId", { motorizadoId })
      .andWhere("pedido.estado IN (:...estados)", {
        estados: [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO],
      });

    if (fecha) {
      const start = new Date(`${fecha}T00:00:00-05:00`);
      const end = new Date(`${fecha}T23:59:59.999-05:00`);
      query.andWhere("pedido.updatedAt BETWEEN :start AND :end", { start, end });
    }

    query.orderBy("pedido.updatedAt", "DESC");

    const [pedidos, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dailyEarningsQuery = Pedido.createQueryBuilder("pedido")
      .where("pedido.motorizadoId = :motorizadoId", { motorizadoId })
      .andWhere("pedido.estado = :estado", { estado: EstadoPedido.ENTREGADO });

    if (fecha) {
      const start = new Date(`${fecha}T00:00:00-05:00`);
      const end = new Date(`${fecha}T23:59:59.999-05:00`);
      dailyEarningsQuery.andWhere("pedido.updatedAt BETWEEN :start AND :end", { start, end });
    }

    const dailyEarningsResult = await dailyEarningsQuery
      .select("SUM(pedido.ganancia_motorizado)", "total")
      .getRawOne();

    const gananciaDelDia = Number(dailyEarningsResult?.total || 0).toFixed(2);

    const pedidosMapped = pedidos.map((p) => {
      const isCancelled = p.estado === EstadoPedido.CANCELADO;
      return {
        ...p,
        gananciaEstimada: isCancelled ? "0.00" : Number(p.ganancia_motorizado || (p.costoEnvio * 0.8)).toFixed(2),
        comisionApp: isCancelled ? "0.00" : Number(p.comision_app_domicilio || (p.costoEnvio * 0.2)).toFixed(2),
        costoEnvio: isCancelled ? "0.00" : Number(p.costoEnvio).toFixed(2),
      };
    });

    return {
      pedidos: pedidosMapped,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      gananciaDelDia,
    };
  }

  static async obtenerBilletera(motorizadoId: string) {
    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    const transacciones = await TransaccionMotorizado.find({
      where: { motorizado: { id: motorizadoId } },
      relations: ["pedido", "pedido.cliente"],
      order: { createdAt: "DESC" },
      take: 50,
    });

    const totalIngresos = await TransaccionMotorizado.sum("monto", {
      motorizado: { id: motorizadoId },
      tipo: TipoTransaccion.GANANCIA_ENVIO
    });
    const earnings = Number(totalIngresos || 0);

    const deliveredOrders = await TransaccionMotorizado.count({
      where: {
        motorizado: { id: motorizadoId },
        tipo: TipoTransaccion.GANANCIA_ENVIO
      }
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyEarnings = await TransaccionMotorizado.createQueryBuilder("t")
      .where("t.motorizadoId = :id", { id: motorizadoId })
      .andWhere("t.tipo = :tipo", { tipo: TipoTransaccion.GANANCIA_ENVIO })
      .andWhere("t.createdAt >= :start", { start: startOfMonth })
      .select("SUM(t.monto)", "total")
      .getRawOne();

    return {
      saldo: moto.saldo,
      datosBancarios: {
        banco: moto.bancoNombre,
        tipo: moto.bancoTipoCuenta,
        numero: moto.bancoNumeroCuenta,
        titular: moto.bancoTitular,
        identificacion: moto.bancoIdentificacion,
      },
      transacciones,
      stats: {
        deliveredOrders,
        averagePerOrder: deliveredOrders > 0 ? (earnings / deliveredOrders).toFixed(2) : 0,
        monthlyEarnings: Number(monthlyEarnings?.total || 0),
        totalIngresos: earnings
      }
    };
  }

  static async guardarDatosBancarios(
    motorizadoId: string,
    data: {
      banco: string;
      tipo: string;
      numero: string;
      titular: string;
      identificacion: string;
    }
  ) {
    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    moto.bancoNombre = data.banco;
    moto.bancoTipoCuenta = data.tipo;
    moto.bancoNumeroCuenta = data.numero;
    moto.bancoTitular = data.titular;
    moto.bancoIdentificacion = data.identificacion;
    await moto.save();

    return { message: "Datos actualizados" };
  }

  static async solicitarRetiro(motorizadoId: string, monto: number) {
    if (monto < 5) {
      throw CustomError.badRequest("El monto mínimo de retiro es $5.00");
    }

    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    const saldoActual = Number(moto.saldo);

    const pendingWithdrawals = await TransaccionMotorizado.sum("monto", {
      motorizado: { id: motorizadoId },
      tipo: TipoTransaccion.RETIRO,
      estado: EstadoTransaccion.PENDIENTE
    });
    const totalPending = Math.abs(pendingWithdrawals || 0);

    if ((saldoActual - totalPending) < monto) {
      throw CustomError.badRequest(`Saldo insuficiente. Tienes $${totalPending.toFixed(2)} en solicitudes pendientes.`);
    }

    if (!moto.bancoNumeroCuenta || !moto.bancoNombre) {
      throw CustomError.badRequest(
        "Debes registrar tus datos bancarios antes de retirar"
      );
    }

    const tx = new TransaccionMotorizado();
    tx.motorizado = moto;
    tx.tipo = TipoTransaccion.RETIRO;
    tx.monto = -monto;
    tx.descripcion = `Solicitud de Retiro`;
    tx.estado = EstadoTransaccion.PENDIENTE;
    tx.saldoAnterior = saldoActual;
    tx.saldoNuevo = saldoActual;
    tx.detalles = JSON.stringify({
      banco: moto.bancoNombre,
      cuenta: moto.bancoNumeroCuenta,
      tipo: moto.bancoTipoCuenta,
      titular: moto.bancoTitular,
      ci: moto.bancoIdentificacion,
    });

    await tx.save();
    return tx;
  }

  static async obtenerTableroOperativo() {
    const proximosASalirCount = await Pedido.count({
      where: { estado: EstadoPedido.ACEPTADO }
    });

    const asignandoseCount = await Pedido.createQueryBuilder("p")
      .where("p.estado = :estado", { estado: EstadoPedido.PREPARANDO })
      .andWhere("p.motorizadoEnEvaluacion IS NULL")
      .getCount();

    const pedidosEsperando = await Pedido.find({
      where: { estado: EstadoPedido.PREPARANDO_NO_ASIGNADO },
      order: { noAssignedSince: "ASC" },
      relations: ["negocio"]
    });

    return {
      conteos: {
        proximosASalir: proximosASalirCount,
        asignandose: asignandoseCount,
        esperandoMotorizado: pedidosEsperando.length
      },
      pedidosEsperando: pedidosEsperando.map(p => ({
        id: p.id,
        negocioNombre: p.negocio?.nombre || "Negocio",
        noAssignedSince: p.noAssignedSince,
        total: p.total
      }))
    };
  }

  static async aceptarPedidoEnEspera(pedidoId: string, motorizadoId: string) {
    const pedido = await this.obtenerPedidoOrFail(pedidoId);
    const moto = await this.obtenerMotorizadoOrFail(motorizadoId);

    if (pedido.estado !== EstadoPedido.PREPARANDO_NO_ASIGNADO) {
      throw CustomError.badRequest("Este pedido ya no está disponible para aceptación manual");
    }

    if (moto.estadoTrabajo !== EstadoTrabajoMotorizado.DISPONIBLE) {
      throw CustomError.badRequest("No estás disponible para aceptar pedidos");
    }

    pedido.estado = EstadoPedido.PREPARANDO_ASIGNADO;
    pedido.motorizado = moto;
    this.limpiarCamposRonda(pedido);
    await pedido.save();

    moto.estadoTrabajo = EstadoTrabajoMotorizado.ENTREGANDO;
    await moto.save();

    getIO().emit("pedido_actualizado", {
      pedidoId,
      estado: pedido.estado,
      motorizadoId,
    });

    return pedido;
  }
}
import { LessThan } from "typeorm";
