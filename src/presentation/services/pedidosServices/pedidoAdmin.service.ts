import {
  Pedido,
  EstadoPedido,
  User,
  UserMotorizado,
  Negocio,
  ProductoPedido,
  EstadoTrabajoMotorizado,
} from "../../../data";
import { GlobalSettings } from "../../../data/postgres/models/global-settings.model";
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
  async asignarMotorizado(dto: AsignarMotorizadoDTO) {
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

      // En asignación manual permitimos reasignar aunque no esté estrictamente "DISPONIBLE" 
      // si el admin así lo decide (por ejemplo, si se quedó atascado en EN_EVALUACION)
      const estadosPermitidos = [
        EstadoTrabajoMotorizado.DISPONIBLE,
        EstadoTrabajoMotorizado.EN_EVALUACION,
        EstadoTrabajoMotorizado.NO_TRABAJANDO // El admin puede forzarlo
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

      // Notificar a las partes
      const io = getIO();
      const updateData = {
        pedidoId: pedido.id,
        estado: pedido.estado,
        motorizadoId: motorizado.id,
        timestamp: new Date().toISOString(),
      };

      // Tenemos relaciones en el pedido (cargadas vía manager si fuera necesario, 
      // pero aquí el pedido viene del transaction)
      // Necesitamos cargar relaciones para las salas
      const pRel = await manager.findOne(Pedido, { 
        where: { id: pedido.id }, 
        relations: ["cliente", "negocio"] 
      });

      if (pRel) {
        io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
        io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
      }
      io.emit("pedido_actualizado", updateData);

      // Notificar específicamente al motorizado
      getIO().to(motorizado.id).emit("nueva_asignacion_manual", {
        pedidoId: pedido.id,
        mensaje: "Un administrador te ha asignado un pedido directamente."
      });

      // 🔔 Notificación Push al Motorizado
      await notificationService.sendPushNotification(
        motorizado.id,
        "¡Nueva Asignación Manual!",
        `Un administrador te ha asignado el pedido #${pedido.id.split('-')[0]} directamente.`,
        { url: '/motorizado' }
      );

      return pedido;
    });
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
