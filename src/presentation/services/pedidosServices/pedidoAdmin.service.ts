import {
  Pedido,
  EstadoPedido,
  User,
  UserMotorizado,
  Negocio,
  ProductoPedido,
  EstadoTrabajoMotorizado,
  EstadoCuentaMotorizado,
  WalletMovement,
  WalletMovementType,
  WalletMovementStatus,
  TransaccionMotorizado,
  TipoTransaccion,
  EstadoTransaccion,
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
import moment from "moment-timezone";
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
      relations: ["cliente", "motorizado", "negocio", "negocio.usuario", "productos", "productos.producto"],
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
      relations: ["cliente", "motorizado", "negocio", "negocio.usuario", "productos", "productos.producto"],
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
    const pedido = await Pedido.findOne({
      where: { id: dto.pedidoId },
      relations: ["motorizado"]
    });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    const estadoAnterior = pedido.estado;
    pedido.estado = dto.nuevoEstado;

    if (dto.nuevoEstado === EstadoPedido.ACEPTADO && !pedido.fecha_aceptado) {
      pedido.fecha_aceptado = new Date();
    }

    // Si hay motivo de cancelación (Emergencia Admin)
    if (dto.nuevoEstado === EstadoPedido.CANCELADO && dto.motivoCancelacion) {
      pedido.motivoCancelacion = dto.motivoCancelacion;
      
      // Detener cualquier algoritmo automático
      PedidoMotoService.limpiarCamposRonda(pedido);

      // Si tenía motorizado asignado, liberarlo (opcional, pero buena práctica si ya estaba en PREPARANDO_ASIGNADO)
      if (pedido.motorizado) {
        const motorizado = pedido.motorizado;
        motorizado.estadoTrabajo = motorizado.quiereTrabajar ? EstadoTrabajoMotorizado.DISPONIBLE : EstadoTrabajoMotorizado.NO_TRABAJANDO;
        motorizado.fechaHoraDisponible = new Date();
        await motorizado.save();
        
        // Notificar al motorizado
        getIO().to(motorizado.id).emit("estado_reset", { mensaje: "El pedido asignado ha sido cancelado por la administración." });
      }
    }

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

    // Registrar en Log Operativo
    await PedidoOperativoLog.registrarEvento({
      pedidoId: pedido.id,
      motorizadoId: pedido.motorizado?.id,
      adminId: dto.userId, // ID del admin que hizo la acción
      evento: "CAMBIO_ESTADO_ADMIN",
      detalle: `Admin cambió estado de ${estadoAnterior} a ${dto.nuevoEstado}.${dto.motivoCancelacion ? ` Motivo: ${dto.motivoCancelacion}` : ''}`
    });

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
   * ✅ 3.5. Entregar pedido (EMERGENCIA ADMIN)
   * Fuerza el estado a ENTREGADO sin necesidad del código PIN,
   * y ejecuta la misma liquidación de comisiones que la app del motorizado.
   */
  async entregarPedidoEmergencia(pedidoId: string, adminId: string) {
    const pedido = await Pedido.findOne({
      where: { id: pedidoId },
      relations: ["motorizado", "cliente", "negocio"]
    });

    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    if (!pedido.motorizado) {
      throw CustomError.badRequest("El pedido no tiene un motorizado asignado");
    }

    if (pedido.estado !== EstadoPedido.EN_CAMINO && pedido.estado !== EstadoPedido.PREPARANDO_ASIGNADO) {
      throw CustomError.badRequest(`El pedido no se puede entregar desde el estado ${pedido.estado}`);
    }

    const moto = await UserMotorizado.findOneBy({ id: pedido.motorizado.id });
    if (!moto) throw CustomError.notFound("Motorizado no encontrado");

    pedido.estado = EstadoPedido.ENTREGADO;
    pedido.delivery_verified = true; // Forzado por admin
    await pedido.save();

    await PedidoOperativoLog.registrarEvento({
      pedidoId,
      motorizadoId: moto.id,
      adminId,
      evento: "PEDIDO_ENTREGADO_EMERGENCIA",
      detalle: "El administrador forzó la entrega de emergencia del pedido"
    });

    // 1. Calcular Ganancia
    const ps = await PedidoMotoService.getPriceSettings();
    const porcentaje = Number(ps.motorizadoPercentage || 80);

    const gananciaMoto = Number(pedido.ganancia_motorizado || (pedido.costoEnvio * (porcentaje / 100)).toFixed(2));
    const saldoAnterior = Number(moto.saldo);
    const saldoNuevo = saldoAnterior + gananciaMoto;

    // 2. Acreditar Billetera
    moto.saldo = saldoNuevo;

    const movement = new WalletMovement();
    movement.motorizado = moto;
    movement.pedido = pedido;
    movement.type = WalletMovementType.GANANCIA_ENVIO;
    movement.amount = gananciaMoto;
    movement.balanceAfter = saldoNuevo;
    movement.description = `Ganancia envío (Admin Force) #${pedido.id.slice(-6).toUpperCase()}`;
    movement.status = WalletMovementStatus.COMPLETADO;
    await movement.save();

    const tx = new TransaccionMotorizado();
    tx.motorizado = moto;
    tx.pedido = pedido;
    tx.tipo = TipoTransaccion.GANANCIA_ENVIO;
    tx.monto = gananciaMoto;
    tx.descripcion = `Ganancia envío (Admin Force) #${pedido.id.slice(-6).toUpperCase()}`;
    tx.estado = EstadoTransaccion.COMPLETADA;
    tx.saldoAnterior = saldoAnterior;
    tx.saldoNuevo = saldoNuevo;
    await tx.save();

    await moto.save();
    
    // 3. Liberar al Motorizado
    await PedidoMotoService.normalizarEstadoLibreMotorizado(moto);

    // 4. Notificaciones
    const io = getIO();
    const updateData = {
      pedidoId,
      estado: pedido.estado,
      timestamp: new Date().toISOString(),
    };

    io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
    io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
    io.emit("pedido_actualizado", updateData);
    io.emit("admin_live_update", { type: 'ORDER_UPDATED', pedidoId: pedido.id });

    await notificationService.sendPushNotification(
      pedido.cliente.id,
      "¡Pedido Entregado!",
      `¡Buen provecho! Tu pedido #${pedido.id.split('-')[0]} ha sido entregado (Confirmación Admin).`,
      { url: '/mis-pedidos' }
    );

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
    
    // Configurar rango de hoy en la zona horaria de Guayaquil
    const startOfToday = moment.tz('America/Guayaquil').startOf('day').toDate();
    const endOfToday = moment.tz('America/Guayaquil').endOf('day').toDate();

    // 1. Pedidos del día (Activos y Finalizados)
    const pedidosActivos = await Pedido.find({
      where: [
        { estado: EstadoPedido.PENDIENTE, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.ACEPTADO, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.PREPARANDO, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.PREPARANDO_ASIGNADO, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.PREPARANDO_NO_ASIGNADO, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.EN_CAMINO, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.PENDIENTE_PAGO, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.RETORNO_PENDIENTE, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.DEVUELTO_A_LOCAL, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.ENTREGADO, createdAt: Between(startOfToday, endOfToday) },
        { estado: EstadoPedido.CANCELADO, createdAt: Between(startOfToday, endOfToday) },
      ],
      relations: ["cliente", "motorizado", "negocio", "negocio.usuario", "productos", "productos.producto"],
      order: { createdAt: "ASC" }
    });

    // 2. Motorizados Conectados / Activos
    const motorizados = await UserMotorizado.find({
      where: {
        estadoCuenta: EstadoCuentaMotorizado.ACTIVO
      },
      select: ["id", "name", "surname", "whatsapp", "estadoTrabajo", "quiereTrabajar", "fechaHoraDisponible", "ratingPromedio", "lastSeenAt", "estadoCuenta"]
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
      return { 
        ...p, 
        motorizadoEvalNombre,
        negocio: p.negocio,
        motorizado: p.motorizado,
        cliente: p.cliente
      };
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

    const retornosActivos = pedidosActivos.filter(p => [EstadoPedido.RETORNO_PENDIENTE, EstadoPedido.DEVUELTO_A_LOCAL].includes(p.estado)).length;
    const finalizadosHoy = pedidosActivos.filter(p => [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO].includes(p.estado)).length;

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
        retornosActivos,
        finalizadosHoy,
        avgAssignmentTime: Math.round(avgAssignmentTime)
      },
      alertas
    };
  }

  // ✅ 9. Obtener trazabilidad completa de un pedido
  async getPedidoTrazabilidad(pedidoId: string) {
    const logs = await PedidoOperativoLog.find({
      where: { pedidoId },
      order: { createdAt: "DESC" },
      relations: ["motorizado"]
    });

    return logs;
  }

  // ✅ 10. Obtener trazabilidad global (últimos logs operativos con filtros)
  async getGlobalTrazabilidad(options: { 
    limit?: number; 
    offset?: number; 
    fecha?: string; 
    excludeEvents?: string[] 
  }) {
    const { limit = 15, offset = 0, fecha, excludeEvents = [] } = options;

    const queryBuilder = PedidoOperativoLog.createQueryBuilder("log")
      .leftJoinAndSelect("log.motorizado", "motorizado")
      .orderBy("log.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (excludeEvents.length > 0) {
      queryBuilder.andWhere("log.evento NOT IN (:...excludeEvents)", { excludeEvents });
    }

    if (fecha) {
      // Ajustar para cubrir todo el día especificado
      const startOfDay = new Date(fecha);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(fecha);
      endOfDay.setHours(23, 59, 59, 999);
      
      queryBuilder.andWhere("log.createdAt BETWEEN :start AND :end", { 
        start: startOfDay, 
        end: endOfDay 
      });
    }

    const [logs, total] = await queryBuilder.getManyAndCount();
    return { logs, total };
  }

  // ✅ 5. Eliminar pedidos finalizados antiguos (Configurable)
  async purgeOldOrders() {
    let settings = await GlobalSettings.findOne({ where: {} });
    if (!settings) {
      settings = new GlobalSettings();
      await settings.save();
    }

    const retentionDays = settings.orderRetentionDays;
    const cutoffDateOrders = new Date();
    cutoffDateOrders.setDate(cutoffDateOrders.getDate() - retentionDays);

    // Los reportes operativos se borran cada 30 días (solicitud user)
    const cutoffDateLogs = new Date();
    cutoffDateLogs.setDate(cutoffDateLogs.getDate() - 30);

    // 1. Purgar Logs Operativos antiguos
    const oldLogs = await PedidoOperativoLog.find({
      where: {
        createdAt: LessThan(cutoffDateLogs)
      }
    });

    if (oldLogs.length > 0) {
      await PedidoOperativoLog.remove(oldLogs);
      console.log(`🧹 Auditoría: ${oldLogs.length} registros operativos eliminados (+30 días).`);
    }

    // 2. Purgar Pedidos antiguos
    const pedidos = await Pedido.find({
      where: [
        {
          estado: EstadoPedido.ENTREGADO,
          createdAt: LessThan(cutoffDateOrders),
        },
        {
          estado: EstadoPedido.CANCELADO,
          createdAt: LessThan(cutoffDateOrders),
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
