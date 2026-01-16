import {
  Pedido,
  EstadoPedido,
  User,
  UserMotorizado,
  Negocio,
  ProductoPedido,
} from "../../../data";
import { GlobalSettings } from "../../../data/postgres/models/global-settings.model";
import {
  AsignarMotorizadoDTO,
  CustomError,
  UpdateEstadoPedidoDTO,
} from "../../../domain";
import { Between, ILike, LessThan } from "typeorm";

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

    const [pedidos, total] = await Pedido.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: "DESC" },
      relations: ["cliente", "motorizado", "negocio", "productos"],
    });

    return { total, pedidos };
  }

  // ✅ 2. Ver pedido por ID
  async getPedidoById(id: string) {
    const pedido = await Pedido.findOne({
      where: { id },
      relations: ["cliente", "motorizado", "negocio", "productos"],
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
    return pedido;
  }

  // ✅ 4. Asignar motorizado
  async asignarMotorizado(dto: AsignarMotorizadoDTO) {
    const pedido = await Pedido.findOneBy({ id: dto.pedidoId });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    const motorizado = await UserMotorizado.findOneBy({ id: dto.motorizadoId });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    if (motorizado.estadoCuenta !== "ACTIVO") {
      throw CustomError.badRequest(
        "Solo se pueden asignar motorizados con estado ACTIVO"
      );
    }

    if (pedido.estado === EstadoPedido.PREPARANDO) {
      // Primera asignación: asignar motorizado y cambiar estado a EN_CAMINO
      pedido.motorizado = motorizado;
      pedido.estado = EstadoPedido.EN_CAMINO;
    } else if (pedido.estado === EstadoPedido.EN_CAMINO) {
      // Reasignación permitida solo si ya está en EN_CAMINO
      pedido.motorizado = motorizado;
      // El estado no cambia
    } else {
      throw CustomError.badRequest(
        "Solo se puede asignar o reasignar motorizado si el pedido está en estado PREPARANDO o EN_CAMINO"
      );
    }

    await pedido.save();
    return pedido;
  }

  // ✅ 5. Eliminar pedidos finalizados antiguos (más de 7 días)
  // ✅ 5. Eliminar pedidos finalizados antiguos (Configurable)
  async purgeOldOrders() {
    // 1. Obtener días de retención desde configuración
    let settings = await GlobalSettings.findOne({ where: {} });
    if (!settings) {
      settings = new GlobalSettings(); // Default 20 days
      await settings.save();
    }

    const retentionDays = settings.orderRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // 2. Buscar pedidos ANTIGUOS que estén ENTREGADOS o CANCELADOS
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

    // 3. Eliminar (Hard Delete)
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

    // Opcional: validar que el estado actual sea EN_CAMINO (o cualquier estado válido antes de entregado/cancelado)
    if (pedido.estado !== EstadoPedido.EN_CAMINO) {
      throw CustomError.badRequest("El pedido no está en estado EN_CAMINO, no puede ser actualizado por el motorizado");
    }

    pedido.estado = nuevoEstado;
    await pedido.save();

    return pedido;
  }
}
