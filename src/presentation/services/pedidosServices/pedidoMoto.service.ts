import { Pedido, EstadoPedido } from "../../../data/postgres/models/Pedido";
import {
  UserMotorizado,
  EstadoCuentaMotorizado,
  EstadoTrabajoMotorizado,
} from "../../../data/postgres/models/UserMotorizado";
import {
  TransaccionMotorizado,
  TipoTransaccion,
  EstadoTransaccion,
} from "../../../data";

import { getIO } from "../../../config/socket";
import { CustomError } from "../../../domain";
import { IsNull, Brackets } from "typeorm";

export class PedidoMotoService {
  private static readonly TIMEOUT_RONDA_MS = 60_000; // 1 min (castigo SOLO en rechazar)
  private static readonly MAX_RONDAS = 4;

  // ============================================================
  // 🧠 HELPERS
  // ============================================================

  private static isRondaExpirada(pedido: Pedido): boolean {
    if (!pedido.fechaInicioRonda) return false;
    return (
      Date.now() - pedido.fechaInicioRonda.getTime() >= this.TIMEOUT_RONDA_MS
    );
  }

  private static limpiarCamposRonda(pedido: Pedido): void {
    pedido.motorizadoEnEvaluacion = null;
    pedido.fechaInicioRonda = null;
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
   * ✅ Elegibilidad profesional (sin ONLINE/OFFLINE):
   * - Cuenta ACTIVA
   * - Trabajo DISPONIBLE
   * - Quiere trabajar = true (switch)
   * - No está castigado (noDisponibleHasta null o ya venció)
   * - FIFO por fechaHoraDisponible ASC
   */
  private static async obtenerMotorizadosElegibles(): Promise<
    UserMotorizado[]
  > {
    const now = new Date();

    return UserMotorizado.createQueryBuilder("m")
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
      )
      .orderBy("m.fechaHoraDisponible", "ASC")
      .getMany();
  }

  /**
   * Ajusta el estado del motorizado cuando queda libre (sin pedido activo),
   * respetando el switch y el castigo persistente.
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

    moto.fechaHoraDisponible = now; // lo manda al final de la cola FIFO
    await moto.save();
  }

  // ============================================================
  // 🧩 REPARADOR DE PEDIDOS CONGELADOS
  // ============================================================
  private static async rescatarPedidosCongelados() {
    const pedidos = await Pedido.find({
      where: {
        estado: EstadoPedido.PREPARANDO,
        motorizadoEnEvaluacion: IsNull(),
        asignacionBloqueada: false,
      },
    });

    for (const pedido of pedidos) {
      if (!pedido.fechaInicioRonda) {
        pedido.fechaInicioRonda = new Date();
        pedido.rondaAsignacion = pedido.rondaAsignacion || 1;
        await pedido.save();
      }

      await this.procesarPedido(pedido);
    }
  }

  // ============================================================
  // 🟢 ASIGNACIÓN AUTOMÁTICA (LLAMADO POR EL CRON)
  // ============================================================
  static async asignarPedidosAutomaticamente() {
    await this.rescatarPedidosCongelados();

    const pedidos = await Pedido.find({
      where: { estado: EstadoPedido.PREPARANDO },
      order: { createdAt: "ASC" },
      relations: ["negocio", "cliente"],
    });

    for (const pedido of pedidos) {
      if (pedido.asignacionBloqueada) continue;
      // Si está en evaluación → revisar expiración
      if (pedido.motorizadoEnEvaluacion) {
        if (!this.isRondaExpirada(pedido)) continue;

        const continuar = await this.finalizarRondaTimeout(pedido);
        if (!continuar) continue;
      }

      await this.procesarPedido(pedido);
    }
  }

  // ============================================================
  // 🟡 PROCESAR PEDIDO → ASIGNAR A SIGUIENTE MOTORIZADO ELEGIBLE
  // ============================================================
  private static async procesarPedido(pedido: Pedido) {
    if (pedido.estado !== EstadoPedido.PREPARANDO) return;

    pedido.asignacionBloqueada = true;
    await pedido.save();

    try {
      const disponibles = await this.obtenerMotorizadosElegibles();
      if (!disponibles.length) return;

      const moto = disponibles[0];

      // Marca al motorizado en evaluación (no debe recibir otro pedido)
      moto.estadoTrabajo = EstadoTrabajoMotorizado.EN_EVALUACION;
      await moto.save();

      // Marca el pedido en evaluación
      pedido.motorizadoEnEvaluacion = moto.id;
      pedido.fechaInicioRonda = new Date();
      pedido.rondaAsignacion = pedido.rondaAsignacion || 1;
      await pedido.save();

      // Notificación al motorizado
      getIO()
        .to(moto.id)
        .emit("pedido_para_ti", {
          pedidoId: pedido.id,
          negocioId: pedido.negocio?.id || null,
          total: pedido.total,
          expiresAt: Date.now() + this.TIMEOUT_RONDA_MS,
        });
    } finally {
      // Siempre liberar el lock
      pedido.asignacionBloqueada = false;
      await pedido.save();
    }
  }

  // ============================================================
  // 🔥 TIMEOUT DE RONDA (SIN CASTIGO, PERO MOVER AL FINAL)
  // ============================================================
  private static async finalizarRondaTimeout(pedido: Pedido): Promise<boolean> {
    const motoIdPrevio = pedido.motorizadoEnEvaluacion;

    // Si dejó expirar: el motorizado vuelve a "libre" según su intención (switch) y castigo vigente si existiera
    if (motoIdPrevio) {
      const moto = await UserMotorizado.findOneBy({ id: motoIdPrevio });
      if (
        moto &&
        moto.estadoTrabajo === EstadoTrabajoMotorizado.EN_EVALUACION
      ) {
        await this.normalizarEstadoLibreMotorizado(moto);
      }
    }

    const rondaActual = pedido.rondaAsignacion || 1;

    // Si ya completó todas las rondas → NO ASIGNADO (admin lo asigna manualmente)
    if (rondaActual >= this.MAX_RONDAS) {
      pedido.estado = EstadoPedido.PREPARANDO_NO_ASIGNADO;
      this.limpiarCamposRonda(pedido);
      await pedido.save();

      getIO().emit("pedido_actualizado", {
        pedidoId: pedido.id,
        estado: pedido.estado,
      });

      return false;
    }

    // Siguiente ronda
    pedido.rondaAsignacion = rondaActual + 1;
    this.limpiarCamposRonda(pedido);
    await pedido.save();

    return true;
  }

  // ============================================================
  // ❌ RECHAZAR → CASTIGO PERSISTENTE (SIN setTimeout)
  // ============================================================
  private static async bloquearPrevio(id: string | null) {
    if (!id) return;

    const moto = await UserMotorizado.findOneBy({ id });
    if (!moto) return;

    // Castigo persistente:
    // - Lo sacas de la cola (NO_TRABAJANDO)
    // - Le apagas el "quiero trabajar" (para evitar que vuelva solo por switch)
    // - Guardas hasta cuándo dura el castigo
    moto.estadoTrabajo = EstadoTrabajoMotorizado.NO_TRABAJANDO;
    moto.quiereTrabajar = false;
    moto.noDisponibleHasta = new Date(Date.now() + this.TIMEOUT_RONDA_MS);
    await moto.save();
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

    // (Opcional pero recomendado) Si ya no está en evaluación, algo raro pasó
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

    // CASTIGO AQUÍ (persistente)
    await this.bloquearPrevio(motorizadoId);

    const rondaActual = pedido.rondaAsignacion || 1;

    if (rondaActual >= this.MAX_RONDAS) {
      pedido.estado = EstadoPedido.PREPARANDO_NO_ASIGNADO;
      this.limpiarCamposRonda(pedido);
      await pedido.save();

      getIO().emit("pedido_actualizado", {
        pedidoId: pedido.id,
        estado: pedido.estado,
      });

      return pedido;
    }

    pedido.rondaAsignacion = rondaActual + 1;
    this.limpiarCamposRonda(pedido);
    await pedido.save();

    await this.procesarPedido(pedido);
    return pedido;
  }

  // ============================================================
  // 🚚 MARCAR EN CAMINO
  // ============================================================
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

  // ============================================================
  // 🏁 ENTREGAR
  // ============================================================
  static async entregarPedido(pedidoId: string, motorizadoId: string) {
    const pedido = await this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);
    const moto = await this.obtenerMotorizadoOrFail(motorizadoId);

    if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
      throw CustomError.badRequest("No autorizado");
    }

    pedido.estado = EstadoPedido.ENTREGADO;
    await pedido.save();

    // ===========================
    // 💰 CALCULAR PROPINAS/GANANCIAS (80/20)
    // ===========================
    const gananciaMoto = Number((pedido.costoEnvio * 0.8).toFixed(2));
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

    // Al terminar, el estado depende del switch y del castigo persistente
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

    // 🔒 Estados críticos NO se pueden cambiar
    if (
      moto.estadoTrabajo === EstadoTrabajoMotorizado.ENTREGANDO ||
      moto.estadoTrabajo === EstadoTrabajoMotorizado.EN_EVALUACION
    ) {
      throw CustomError.badRequest(
        "No puedes cambiar tu disponibilidad mientras tienes un pedido activo"
      );
    }

    moto.quiereTrabajar = quiereTrabajar;

    // 🔁 Ajustar estado operativo
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

  // ============================================================
  // 🚫 CANCELAR (MOTORIZADO)
  // ============================================================
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
    await pedido.save();

    // Liberar motorizado
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

  // ============================================================
  // 📜 HISTORIAL DE PEDIDOS
  // ============================================================
  static async obtenerHistorial(
    motorizadoId: string,
    fechaInicio?: string,
    fechaFin?: string
  ) {
    const query = Pedido.createQueryBuilder("pedido")
      .leftJoinAndSelect("pedido.negocio", "negocio")
      .leftJoinAndSelect("pedido.cliente", "cliente")
      .leftJoinAndSelect("pedido.productos", "productos") // opcional, si queremos ver productos
      .leftJoinAndSelect("productos.producto", "productoRef")
      .where("pedido.motorizadoId = :motorizadoId", { motorizadoId })
      .andWhere("pedido.estado IN (:...estados)", {
        estados: [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO],
      })
      .orderBy("pedido.createdAt", "DESC");

    if (fechaInicio) {
      query.andWhere("pedido.createdAt >= :fechaInicio", {
        fechaInicio: new Date(fechaInicio),
      });
    }

    if (fechaFin) {
      // Ajustar fin del día para fechaFin
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      query.andWhere("pedido.createdAt <= :fechaFin", { fechaFin: fin });
    }

    const pedidos = await query.getMany();

    // Enriquecer con cálculo de ganancia visual
    return pedidos.map((p) => ({
      ...p,
      gananciaEstimada: (p.costoEnvio * 0.8).toFixed(2),
      comisionApp: (p.costoEnvio * 0.2).toFixed(2),
    }));
  }

  // ============================================================
  // 💰 BILLETERA
  // ============================================================
  static async obtenerBilletera(motorizadoId: string) {
    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    const transacciones = await TransaccionMotorizado.find({
      where: { motorizado: { id: motorizadoId } },
      relations: ["pedido", "pedido.cliente"],
      order: { createdAt: "DESC" },
      take: 50, // Últimas 50
    });

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
    };
  }

  // ============================================================
  // 🏦 DATOS BANCARIOS
  // ============================================================
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

  // ============================================================
  // 💸 SOLICITAR RETIRO
  // ============================================================
  static async solicitarRetiro(motorizadoId: string, monto: number) {
    if (monto < 5) {
      throw CustomError.badRequest("El monto mínimo de retiro es $5.00");
    }

    const moto = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    const saldoActual = Number(moto.saldo);
    if (saldoActual < monto) {
      throw CustomError.badRequest("Saldo insuficiente");
    }

    if (!moto.bancoNumeroCuenta || !moto.bancoNombre) {
      throw CustomError.badRequest(
        "Debes registrar tus datos bancarios antes de retirar"
      );
    }

    // Descontar inmediatamente para evitar duplicidad
    const saldoNuevo = saldoActual - monto;
    moto.saldo = saldoNuevo;

    const tx = new TransaccionMotorizado();
    tx.motorizado = moto;
    tx.tipo = TipoTransaccion.RETIRO;
    tx.monto = -monto; // Negativo para indicar egreso visualmente, aunque la lógica ya descontó
    tx.descripcion = `Solicitud de Retiro`;
    tx.estado = EstadoTransaccion.PENDIENTE;
    tx.saldoAnterior = saldoActual;
    tx.saldoNuevo = saldoNuevo;
    tx.detalles = JSON.stringify({
      banco: moto.bancoNombre,
      cuenta: moto.bancoNumeroCuenta,
      tipo: moto.bancoTipoCuenta,
      titular: moto.bancoTitular,
      ci: moto.bancoIdentificacion,
    });

    // Guardamos ambos en transacción para atomicidad (idealmente usar queryRunner, pero por brevedad así)
    await tx.save();
    await moto.save();

    return tx;
  }
}
