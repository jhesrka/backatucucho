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
import { Between, ILike, LessThan } from "typeorm";
import { PedidoMotoService } from "./pedidoMoto.service";

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

    if (estado) where.estado = estado;
    if (negocioId) where.negocio = { id: negocioId };
    if (motorizadoId) where.motorizado = { id: motorizadoId };
    if (clienteId) where.cliente = { id: clienteId };
    if (desde && hasta) where.createdAt = Between(desde, hasta);

    // Search logic for UUID or short ID
    if (search) {
      where.id = ILike(`%${search}%`);
    }

    const [pedidos, total] = await Pedido.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: "DESC" },
      relations: ["cliente", "motorizado", "negocio", "productos", "productos.producto"],
    });

    return { total, pedidos };
  }

  // ✅ 2. Ver pedido por ID
  async getPedidoById(id: string) {
    const pedido = await Pedido.findOne({
      where: { id },
      relations: ["cliente", "motorizado", "negocio", "productos", "productos.producto"],
    });

    if (!pedido) throw CustomError.notFound("Pedido no encontrado");
    return pedido;
  }

  // ✅ 3. Cambiar estado de pedido
  async cambiarEstado(dto: UpdateEstadoPedidoDTO) {
    const pedido = await Pedido.findOneBy({ id: dto.pedidoId });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    pedido.estado = dto.nuevoEstado;
    await pedido.save();

    getIO().emit("pedido_actualizado", {
      pedidoId: pedido.id,
      estado: pedido.estado,
      timestamp: new Date().toISOString(),
    });

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
      }

      // Limpiar campos de ronda para que el algoritmo automático no lo toque más
      PedidoMotoService.limpiarCamposRonda(pedido);

      await manager.save(pedido);

      // Actualizar estado del motorizado
      motorizado.estadoTrabajo = EstadoTrabajoMotorizado.ENTREGANDO;
      await manager.save(motorizado);

      // Notificar a las partes
      getIO().emit("pedido_actualizado", {
        pedidoId: pedido.id,
        estado: pedido.estado,
        motorizadoId: motorizado.id,
        timestamp: new Date().toISOString(),
      });

      // Notificar específicamente al motorizado
      getIO().to(motorizado.id).emit("nueva_asignacion_manual", {
        pedidoId: pedido.id,
        mensaje: "Un administrador te ha asignado un pedido directamente."
      });

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

    getIO().emit("pedido_actualizado", {
      pedidoId: pedido.id,
      estado: pedido.estado,
      timestamp: new Date().toISOString(),
    });

    return pedido;
  }
}
