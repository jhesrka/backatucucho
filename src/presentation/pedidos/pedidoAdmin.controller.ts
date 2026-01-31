import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { EstadoPedido } from "../../data";
import { PedidoAdminService } from "../services/pedidosServices/pedidoAdmin.service";

export class PedidoAdminController {
  constructor(private readonly pedidoAdminService: PedidoAdminService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    const message = error instanceof Error ? error.message : "Error interno en pedidos admin";
    console.error("Orders Admin Error:", error);

    return res.status(500).json({
      message: `Error de Pedidos (Admin): ${message}`
    });
  };

  // ======================== 1. Obtener pedidos con filtros ========================
  obtenerPedidosAdmin = (req: Request, res: Response) => {
    try {
      const {
        estado,
        negocioId,
        motorizadoId,
        clienteId,
        desde,
        hasta,
        search,
        limit,
        offset,
      } = req.query;

      // Parsear fechas si vienen como string
      const desdeDate = desde ? new Date(desde as string) : undefined;
      const hastaDate = hasta ? new Date(hasta as string) : undefined;

      // Validar estado si existe y convertir a enum
      let estadoEnum: EstadoPedido | undefined = undefined;
      if (estado && typeof estado === "string") {
        if (Object.values(EstadoPedido).includes(estado as EstadoPedido)) {
          estadoEnum = estado as EstadoPedido;
        } else {
          return res.status(400).json({ message: "Estado inválido" });
        }
      }

      this.pedidoAdminService
        .getPedidosAdmin({
          estado: estadoEnum,
          negocioId: negocioId as string | undefined,
          motorizadoId: motorizadoId as string | undefined,
          clienteId: clienteId as string | undefined,
          desde: desdeDate,
          hasta: hastaDate,
          search: search as string | undefined,
          limit: limit ? parseInt(limit as string, 10) : 10,
          offset: offset ? parseInt(offset as string, 10) : 0,
        })
        .then(({ total, pedidos }) => {
          const safePedidos = pedidos.map((p) => ({
            id: p.id,
            estado: p.estado,
            total: p.total,
            costoEnvio: p.costoEnvio,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            cliente: {
              id: p.cliente.id,
              name: p.cliente.name,
              surname: p.cliente.surname,
              whatsapp: p.cliente.whatsapp,
            },
            motorizado: p.motorizado
              ? {
                id: p.motorizado.id,
                name: p.motorizado.name,
                surname: p.motorizado.surname,
                whatsapp: p.motorizado.whatsapp,
              }
              : null,
            negocio: {
              id: p.negocio.id,
              nombre: p.negocio.nombre,
              statusNegocio: p.negocio.statusNegocio,
              modeloMonetizacion: p.negocio.modeloMonetizacion,
            },
            productos: p.productos.map((prod) => ({
              id: prod.id,
              nombre: prod.producto.nombre, // Map product name
              cantidad: prod.cantidad,
              precioUnitario: prod.precioUnitario,
              subtotal: prod.subtotal,
            })),
          }));

          return res.status(200).json({ total, pedidos: safePedidos });
        })

        .catch((error) => this.handleError(error, res));
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ======================== 2. Obtener pedido por ID ========================
  obtenerPedidoById = (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Falta el ID del pedido" });

    this.pedidoAdminService
      .getPedidoById(id)
      .then((pedido) => res.status(200).json(pedido))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== 3. Cambiar estado de pedido ========================
  cambiarEstadoPedido = (req: Request, res: Response) => {
    const { pedidoId, nuevoEstado } = req.body;
    if (!pedidoId || !nuevoEstado) {
      return res
        .status(400)
        .json({ message: "Faltan parámetros: pedidoId o nuevoEstado" });
    }

    if (!Object.values(EstadoPedido).includes(nuevoEstado)) {
      return res.status(400).json({ message: "Estado inválido" });
    }

    this.pedidoAdminService
      .cambiarEstado({
        pedidoId,
        nuevoEstado,
        userId: req.body.sessionAdmin.id,
      })

      .then((pedido) => res.status(200).json(pedido))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== 4. Asignar motorizado ========================
  asignarMotorizado = (req: Request, res: Response) => {
    const { pedidoId, motorizadoId } = req.body;
    if (!pedidoId || !motorizadoId) {
      return res
        .status(400)
        .json({ message: "Faltan parámetros: pedidoId o motorizadoId" });
    }

    this.pedidoAdminService
      .asignarMotorizado({ pedidoId, motorizadoId })
      .then((pedido) => res.status(200).json(pedido))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== 5. Eliminar pedidos antiguos ========================
  eliminarPedidosAntiguos = (req: Request, res: Response) => {
    this.pedidoAdminService
      .purgeOldOrders()
      .then(({ deletedCount }) =>
        res.status(200).json({ message: `Purga completada. Pedidos eliminados: ${deletedCount}` })
      )
      .catch((error) => this.handleError(error, res));
  };

  // ======================== 7. Configurar días de retención ========================
  configureRetentionDays = (req: Request, res: Response) => {
    const { days } = req.body;
    if (!days || isNaN(days)) {
      return res.status(400).json({ message: "Debe proporcionar un número válido de días" });
    }

    this.pedidoAdminService
      .updateRetentionDays(Number(days))
      .then((settings) => res.status(200).json(settings))
      .catch((error) => this.handleError(error, res));
  };
  // ======================== 6. Motorizado cambia estado a ENTREGADO o CANCELADO ========================
  cambiarEstadoPorMotorizado = (req: Request, res: Response) => {
    const { pedidoId, nuevoEstado } = req.body;
    const motorizadoId = req.body.sessionMotorizado?.id;

    if (!pedidoId || !nuevoEstado) {
      return res
        .status(400)
        .json({ message: "Faltan parámetros: pedidoId o nuevoEstado" });
    }
    if (!motorizadoId) {
      return res.status(401).json({ message: "No autorizado" });
    }
    if (
      ![EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO].includes(nuevoEstado)
    ) {
      return res
        .status(400)
        .json({ message: "Estado inválido para motorizado" });
    }

    this.pedidoAdminService
      .actualizarEstadoPorMotorizado({
        pedidoId,
        nuevoEstado,
        motorizadoId,
        userId: req.body.sessionMotorizado.id,
      })
      .then((pedido) => res.status(200).json(pedido))
      .catch((error) => this.handleError(error, res));
  };
}
