import {
  Pedido,
  EstadoPedido,
  User,
  UserMotorizado,
  Negocio,
  ProductoPedido,
  EstadoTrabajoMotorizado,
  EstadoCuentaMotorizado,
} from "../../../data";
import { GlobalSettings } from "../../../data/postgres/models/global-settings.model";
import { PedidoOperativoLog } from "../../../data/postgres/models/PedidoOperativoLog";
import { getIO } from "../../../config/socket";
import {
  AsignarMotorizadoDTO,
  CustomError,
  UpdateEstadoPedidoDTO,
} from "../../../domain";
import { Between, ILike, LessThan, Raw } from "typeorm";
import { PedidoMotoService } from "./pedidoMoto.service";
import { NotificationService } from "../NotificationService";

const notificationService = new NotificationService();

export class PedidoAdminService {
  // ✅ 1. Obtener todos los pedidos con filtros
  async getPedidosAdmin({
    estado,
    negocioId,
    motorizadoId,
    clienteId,
    desde,
    hasta,
    search,
    limit = 10,
    offset = 0,
  }: {
    estado?: EstadoPedido;
    negocioId?: string;
    motorizadoId?: string;
    clienteId?: string;
    desde?: Date;
    hasta?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    const hasSearch = !!search && search.trim().length > 0;

    if (hasSearch) {
      // Si hay búsqueda por ID, ignoramos el resto de filtros según requerimiento
      // Usamos Raw para castear el UUID a TEXT y permitir búsqueda ILIKE sin errores de Postgres
      where.id = Raw((alias) => `CAST(${alias} AS TEXT) ILIKE :search`, { search: `%${search}%` });
    } else {
      if (estado) where.estado = estado;
      if (negocioId) where.negocio = { id: negocioId };
      if (motorizadoId) where.motorizado = { id: motorizadoId };
      if (clienteId) where.cliente = { id: clienteId };
      if (desde && hasta) where.createdAt = Between(desde, hasta);
    }
    const [pedidos, total] = await Pedido.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: "DESC" },
      relations: ["cliente", "motorizado", "negocio", "productos", "productos.producto"],
    });

    const mappedPedidos = pedidos.map(p => ({
      ...p,
      productos: p.productos.map(pp => ({
        ...pp,
        producto: pp.producto || { nombre: pp.producto_nombre || "P. Eliminado", id: 'deleted' }
      }))
    }));

    return { total, pedidos: mappedPedidos };
  }

  // ✅ 2. Ver pedido por ID
  async getPedidoById(id: string) {
    const pedido = await Pedido.findOne({
      where: { id },
      relations: ["cliente", "motorizado", "negocio", "productos", "productos.producto"],
    });

    if (!pedido) throw CustomError.notFound("Pedido no encontrado");
    
    // ✅ Transformar para soportar productos eliminados (usando snapshot)
    pedido.productos = pedido.productos.map(pp => ({
      ...pp,
      producto: pp.producto || { 
        nombre: pp.producto_nombre || "Producto ya no disponible", 
        id: 'deleted',
        imagen: pp.producto_imagen 
      }
    })) as any;

    return pedido;
  }

  // ✅ 3. Cambiar estado de pedido
  async cambiarEstado(dto: UpdateEstadoPedidoDTO) {
    const pedido = await Pedido.findOneBy({ id: dto.pedidoId });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    pedido.estado = dto.nuevoEstado;

    // Generar códigos si faltan al cambiar de estado manualmente
    if (pedido.estado === EstadoPedido.PREPARANDO_ASIGNADO && !pedido.pickup_code) {
      pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
      pedido.pickup_verified = false;
    }
    if (pedido.estado === EstadoPedido.EN_CAMINO && !pedido.delivery_code) {
      pedido.delivery_code = Math.floor(1000 + Math.random() * 9000).toString();
      pedido.delivery_verified = false;
    }

    await pedido.save();

    const pRel = await Pedido.findOne({ where: { id: pedido.id }, relations: ["cliente", "negocio"] });
    
    const io = getIO();
    const updateData = {
      pedidoId: pedido.id,
      estado: pedido.estado,
      timestamp: new Date().toISOString(),
    };

    if (pRel) {
        io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
        io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
    }
    io.emit("pedido_actualizado", updateData);

    return pedido;
  }

  /**
   * ✅ 4. Asignar motorizado (MANUAL ADMIN)
   * Usa transacciones para asegurar compatibilidad con el algoritmo automático
   */
  async asignarMotorizado(dto: AsignarMotorizadoDTO, adminId?: string) {
    return await Pedido.getRepository().manager.transaction(async (manager) => {
      // 1. Bloquear pedido para evitar conflicto con el Cron
      const pedido = await manager.findOne(Pedido, {
        where: { id: dto.pedidoId },
        lock: { mode: "pessimistic_write" }
      });
      if (!pedido) throw CustomError.notFound("Pedido no encontrado");

      const motorizado = await manager.findOne(UserMotorizado, {
        where: { id: dto.motorizadoId },
        lock: { mode: "pessimistic_write" }
      });
      if (!motorizado) throw CustomError.notFound("El motorizado ya no existe");

      // 2. Validar aptitud del motorizado
      if (motorizado.estadoCuenta !== "ACTIVO") {
        throw CustomError.badRequest("El motorizado no está activo administrativamente");
      }

      const estadosPermitidos = [
        EstadoTrabajoMotorizado.DISPONIBLE,
        EstadoTrabajoMotorizado.EN_EVALUACION,
        EstadoTrabajoMotorizado.NO_TRABAJANDO
      ];

      if (motorizado.estadoTrabajo === EstadoTrabajoMotorizado.ENTREGANDO) {
        throw CustomError.badRequest("El motorizado ya tiene un pedido en camino/entrega");
      }

      // 3. Validar estado del pedido
      const estadosAsignables = [
        EstadoPedido.PREPARANDO,
        EstadoPedido.PREPARANDO_NO_ASIGNADO,
        EstadoPedido.EN_CAMINO // Reasignación
      ];

      if (!estadosAsignables.includes(pedido.estado)) {
        throw CustomError.badRequest(`El pedido no es asignable en su estado actual: ${pedido.estado}`);
      }

      // 4. Ejecutar Asignación
      const motorizadoAnteriorId = pedido.motorizado?.id;
      pedido.motorizado = motorizado;

      if (pedido.estado === EstadoPedido.PREPARANDO || pedido.estado === EstadoPedido.PREPARANDO_NO_ASIGNADO) {
        pedido.estado = EstadoPedido.PREPARANDO_ASIGNADO;
        pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
        pedido.pickup_verified = false;
      }

      // Limpiar campos de ronda para que el algoritmo automático no lo toque más
      PedidoMotoService.limpiarCamposRonda(pedido);

      await manager.save(pedido);

      // Actualizar estado del motorizado
      motorizado.estadoTrabajo = EstadoTrabajoMotorizado.ENTREGANDO;
      await manager.save(motorizado);

      // Registrar evento
      await PedidoOperativoLog.registrarEvento({
        pedidoId: pedido.id,
        motorizadoId: motorizado.id,
        adminId,
        evento: "ASIGNADO_MANUAL",
        detalle: `Asignado por administrador${motorizadoAnteriorId ? `. Reemplaza a motorizado ${motorizadoAnteriorId}` : ''}`
      });

      // Notificar a las partes
      const io = getIO();
      const updateData = {
        pedidoId: pedido.id,
        estado: pedido.estado,
        motorizadoId: motorizado.id,
        timestamp: new Date().toISOString(),
      };

      const pRel = await manager.findOne(Pedido, { 
        where: { id: pedido.id }, 
        relations: ["cliente", "negocio"] 
      });

      if (pRel) {
        io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
        io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
      }
      io.emit("pedido_actualizado", updateData);
      io.emit("admin_live_update", { type: 'ORDER_UPDATED', pedidoId: pedido.id });

      // Notificar específicamente al motorizado
      getIO().to(motorizado.id).emit("nueva_asignacion_manual", {
        pedidoId: pedido.id,
        mensaje: "Un administrador te ha asignado un pedido directamente."
      });

      await notificationService.sendPushNotification(
        motorizado.id,
        "¡Nueva Asignación Manual!",
        `Un administrador te ha asignado el pedido #${pedido.id.split('-')[0]} directamente.`,
        { url: '/motorizado' }
      );

      return pedido;
    });
  }

  // ✅ 7. Liberar motorizado atascado
  async liberarMotorizado(motorizadoId: string, adminId: string, comment: string) {
    const motorizado = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    const estadoAnterior = motorizado.estadoTrabajo;
    motorizado.estadoTrabajo = motorizado.quiereTrabajar 
      ? EstadoTrabajoMotorizado.DISPONIBLE 
      : EstadoTrabajoMotorizado.NO_TRABAJANDO;
    
    motorizado.fechaHoraDisponible = new Date();
    await motorizado.save();

    // Buscamos si tenía un pedido "fantasma" asignado
    const pedidoFantasma = await Pedido.findOne({
      where: [
        { motorizado: { id: motorizadoId }, estado: EstadoPedido.PREPARANDO_ASIGNADO },
        { motorizado: { id: motorizadoId }, estado: EstadoPedido.EN_CAMINO }
      ]
    });

    await PedidoOperativoLog.registrarEvento({
      pedidoId: pedidoFantasma?.id || '00000000-0000-0000-0000-000000000000',
      motorizadoId,
      adminId,
      evento: "LIBERADO_MANUAL",
      detalle: `Liberado por admin. Estado anterior: ${estadoAnterior}. Comentario: ${comment}`
    });

    const io = getIO();
    io.emit("admin_live_update", { type: 'MOTORIZADO_UPDATED', motorizadoId });
    io.to(motorizadoId).emit("estado_reset", { mensaje: "Tu estado ha sido restablecido por un administrador." });

    return { message: "Motorizado liberado correctamente" };
  }

  // ✅ 8. Obtener datos en vivo del Centro Operativo
  async getLiveControlData() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    const fifteenMinAgo = new Date(now.getTime() - (15 * 60 * 1000));
    
    // Configurar inicio de hoy en la zona horaria de la DB (asumimos local o UTC estable)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Pedidos Activos (No terminados ni cancelados)
    const pedidosActivos = await Pedido.find({
      where: [
        { estado: EstadoPedido.PENDIENTE },
        { estado: EstadoPedido.ACEPTADO },
        { estado: EstadoPedido.PREPARANDO },
        { estado: EstadoPedido.PREPARANDO_ASIGNADO },
        { estado: EstadoPedido.PREPARANDO_NO_ASIGNADO },
        { estado: EstadoPedido.EN_CAMINO },
        { estado: EstadoPedido.PENDIENTE_PAGO },
      ],
      relations: ["cliente", "motorizado", "negocio", "productos", "productos.producto"],
      order: { createdAt: "ASC" }
    });

    // 2. Motorizados Conectados / Activos
    const motorizados = await UserMotorizado.find({
      where: {
        estadoCuenta: EstadoCuentaMotorizado.ACTIVO
      },
      select: ["id", "name", "surname", "whatsapp", "estadoTrabajo", "quiereTrabajar", "fechaHoraDisponible", "ratingPromedio", "lastSeenAt"]
    });

    // 3. Enriquecer motorizados con su pedido actual, pedido en evaluación y métricas del día
    const motorizadosFull = await Promise.all(motorizados.map(async (m) => {
      let pedidoActualId = null;
      let pedidoEnEvaluacionId = null;

      if (m.estadoTrabajo === EstadoTrabajoMotorizado.ENTREGANDO) {
        const p = await Pedido.findOne({
          where: [
            { motorizado: { id: m.id }, estado: EstadoPedido.PREPARANDO_ASIGNADO },
            { motorizado: { id: m.id }, estado: EstadoPedido.EN_CAMINO }
          ],
          select: ["id"]
        });
        pedidoActualId = p?.id || null;
      }

      if (m.estadoTrabajo === EstadoTrabajoMotorizado.EN_EVALUACION) {
        const pEval = pedidosActivos.find(pa => pa.motorizadoEnEvaluacion === m.id);
        pedidoEnEvaluacionId = pEval?.id || null;
      }

      const entregasHoy = await Pedido.count({
        where: {
          motorizado: { id: m.id },
          estado: EstadoPedido.ENTREGADO,
          updatedAt: Between(startOfToday, new Date())
        }
      });

      return { ...m, pedidoActualId, pedidoEnEvaluacionId, entregasHoy };
    }));

    // Enriquecer pedidos con nombre del motorizado en evaluación
    const pedidosEnriquecidos = pedidosActivos.map(p => {
      let motorizadoEvalNombre = null;
      if (p.motorizadoEnEvaluacion) {
        const moto = motorizados.find(m => m.id === p.motorizadoEnEvaluacion);
        motorizadoEvalNombre = moto ? `${moto.name} ${moto.surname}` : "Desconocido";
      }
      return { ...p, motorizadoEvalNombre };
    });

    // 4. Calcular Métricas de Resumen
    const sinMotorizado = pedidosActivos.filter(p => p.estado === EstadoPedido.PREPARANDO_NO_ASIGNADO).length;
    const motorizadosDisponibles = motorizadosFull.filter(m => m.estadoTrabajo === EstadoTrabajoMotorizado.DISPONIBLE && m.quiereTrabajar).length;
    const motorizadosEntregando = motorizadosFull.filter(m => m.estadoTrabajo === EstadoTrabajoMotorizado.ENTREGANDO).length;
    const pedidosTrabados = pedidosActivos.filter(p => p.updatedAt < fifteenMinAgo).length;

    const rechazosRecientes = await PedidoOperativoLog.count({
      where: {
        evento: "MOTORIZADO_RECHAZO",
        createdAt: Between(oneHourAgo, new Date())
      }
    });

    // Tiempo promedio de asignación aproximado (últimos 10 éxitos)
    const ultimasAceptaciones = await PedidoOperativoLog.find({
      where: { evento: "MOTORIZADO_ACEPTO" },
      take: 10,
      order: { createdAt: "DESC" }
    });

    let avgAssignmentTime = 0;
    if (ultimasAceptaciones.length > 0) {
      const times = await Promise.all(ultimasAceptaciones.map(async log => {
        const ped = await Pedido.findOne({ where: { id: log.pedidoId }, select: ["createdAt"] });
        return ped ? (log.createdAt.getTime() - ped.createdAt.getTime()) : 0;
      }));
      const validTimes = times.filter(t => t > 0);
      if (validTimes.length > 0) {
        avgAssignmentTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length / 1000 / 60;
      }
    }

    // 5. Generar Alertas
    const alertas: any[] = [];
    motorizadosFull.forEach((m: any) => {
      if (m.estadoTrabajo === EstadoTrabajoMotorizado.ENTREGANDO && !m.pedidoActualId) {
        alertas.push({ type: 'INCONSISTENCY', severity: 'CRITICAL', message: `Motorizado ${m.name} figura "Entregando" sin pedido activo.` });
      }
      const lastSeen = m.lastSeenAt ? new Date(m.lastSeenAt).getTime() : 0;
      if (m.quiereTrabajar && (Date.now() - lastSeen > 10 * 60 * 1000)) {
        alertas.push({ type: 'OFFLINE', severity: 'WARNING', message: `${m.name} está activo pero no reporta ubicación hace >10 min.` });
      }
    });

    pedidosActivos.forEach(p => {
      if (p.estado === EstadoPedido.PREPARANDO_NO_ASIGNADO && p.createdAt < fifteenMinAgo) {
        alertas.push({ type: 'STUCK', severity: 'CRITICAL', message: `Pedido #${p.id.slice(-6)} lleva >15 min sin motorizado.` });
      }
    });

    return {
      pedidos: pedidosEnriquecidos,
      motorizados: motorizadosFull,
      summary: {
        totalActivos: pedidosActivos.length,
        sinMotorizado,
        motorizadosDisponibles,
        motorizadosEntregando,
        pedidosTrabados,
        rechazosRecientes,
        avgAssignmentTime: Math.round(avgAssignmentTime)
      },
      alertas
    };
  }

  // ✅ 9. Obtener trazabilidad completa de un pedido
  async getPedidoTrazabilidad(pedidoId: string) {
    const logs = await PedidoOperativoLog.find({
      where: { pedidoId },
      order: { createdAt: "ASC" },
      relations: ["motorizado"]
    });

    return logs;
  }

  // ✅ 5. Eliminar pedidos finalizados antiguos (Configurable)
  async purgeOldOrders() {
    let settings = await GlobalSettings.findOne({ where: {} });
    if (!settings) {
      settings = new GlobalSettings();
      await settings.save();
    }

    const retentionDays = settings.orderRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const pedidos = await Pedido.find({
      where: [
        {
          estado: EstadoPedido.ENTREGADO,
          createdAt: LessThan(cutoffDate),
        },
        {
          estado: EstadoPedido.CANCELADO,
          createdAt: LessThan(cutoffDate),
        },
      ],
    });

    if (pedidos.length === 0) return { deletedCount: 0 };

    const deleted = await Pedido.remove(pedidos);
    return { deletedCount: deleted.length };
  }

  // ✅ 6. Actualizar Configuración de Purga
  async updateRetentionDays(days: number) {
    let settings = await GlobalSettings.findOne({ where: {} });
    if (!settings) {
      settings = new GlobalSettings();
    }

    settings.orderRetentionDays = days;
    await settings.save();
    return settings;
  }

  async actualizarEstadoPorMotorizado(dto: UpdateEstadoPedidoDTO & { motorizadoId: string }) {
    const { pedidoId, nuevoEstado, motorizadoId } = dto;

    if (![EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO].includes(nuevoEstado)) {
      throw CustomError.badRequest("El motorizado sólo puede cambiar estado a ENTREGADO o CANCELADO");
    }

    const pedido = await Pedido.findOne({
      where: { id: pedidoId },
      relations: ["motorizado"],
    });

    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
      throw CustomError.forbiden("No tienes permiso para modificar este pedido");
    }

    if (pedido.estado !== EstadoPedido.EN_CAMINO) {
      throw CustomError.badRequest("El pedido no está en estado EN_CAMINO");
    }

    pedido.estado = nuevoEstado;
    await pedido.save();

    const pRel = await Pedido.findOne({ where: { id: pedido.id }, relations: ["cliente", "negocio"] });

    const io = getIO();
    const updateData = {
      pedidoId: pedido.id,
      estado: pedido.estado,
      timestamp: new Date().toISOString(),
    };

    if (pRel) {
      io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
      io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
    }
    io.emit("pedido_actualizado", updateData);

    return pedido;
  }
}
