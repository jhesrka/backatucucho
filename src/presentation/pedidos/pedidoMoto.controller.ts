import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { PedidoMotoService } from "../services/pedidosServices/pedidoMoto.service";
import { EstadoPedido, Pedido } from "../../data/postgres/models/Pedido";

export class PedidoMotoController {
  constructor(private readonly pedidoMotoService: PedidoMotoService) { }

  // ======================== Manejo de errores ========================
  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // ======================== Aceptar pedido ========================
  aceptarPedido = async (req: Request, res: Response) => {
    try {
      const { pedidoId } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) {
        return res.status(400).json({ message: "Falta el pedidoId" });
      }
      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const pedido = await PedidoMotoService.aceptarPedido(
        pedidoId,
        motorizadoId
      );

      return res.status(200).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Rechazar pedido ========================
  rechazarPedido = async (req: Request, res: Response) => {
    try {
      const { pedidoId } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) {
        return res.status(400).json({ message: "Falta el pedidoId" });
      }
      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const pedido = await PedidoMotoService.rechazarPedido(
        pedidoId,
        motorizadoId
      );

      return res.status(200).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Marcar pedido EN CAMINO ========================
  marcarEnCamino = async (req: Request, res: Response) => {
    try {
      const { pedidoId } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) {
        return res.status(400).json({ message: "Falta el pedidoId" });
      }
      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const pedido = await PedidoMotoService.marcarEnCamino(
        pedidoId,
        motorizadoId
      );

      return res.status(200).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Entregar pedido ========================
  entregarPedido = async (req: Request, res: Response) => {
    try {
      const { pedidoId } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) {
        return res.status(400).json({ message: "Falta el pedidoId" });
      }
      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const pedido = await PedidoMotoService.entregarPedido(
        pedidoId,
        motorizadoId
      );

      return res.status(200).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Cancelar pedido ========================
  cancelarPedido = async (req: Request, res: Response) => {
    try {
      const { pedidoId, motivo } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) {
        return res.status(400).json({ message: "Falta el pedidoId" });
      }
      if (!motivo) {
        return res.status(400).json({ message: "Falta el motivo cancelacion" });
      }
      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const pedido = await PedidoMotoService.cancelarPedido(
        pedidoId,
        motorizadoId,
        motivo
      );

      return res.status(200).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Historial ========================
  obtenerHistorial = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;
      const { fechaInicio, fechaFin } = req.query;

      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const historial = await PedidoMotoService.obtenerHistorial(
        motorizadoId,
        fechaInicio as string,
        fechaFin as string
      );

      return res.json(historial);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Billetera ========================
  obtenerBilletera = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const billetera = await PedidoMotoService.obtenerBilletera(motorizadoId);

      return res.json(billetera);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Guardar Datos Bancarios ========================
  guardarDatosBancarios = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;
      const { banco, tipo, numero, titular, identificacion } = req.body;

      if (!motorizadoId) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const result = await PedidoMotoService.guardarDatosBancarios(
        motorizadoId,
        { banco, tipo, numero, titular, identificacion }
      );

      return res.json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Solicitar Retiro ========================
  solicitarRetiro = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;
      const { monto } = req.body;

      if (!motorizadoId) {
        return res.status(401).json({ message: "No autenticado" });
      }

      if (!monto) {
        return res.status(400).json({ message: "Monto requerido" });
      }

      const tx = await PedidoMotoService.solicitarRetiro(motorizadoId, Number(monto));

      return res.json(tx);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ============================================================
  // 🔍 OBTENER PEDIDO PENDIENTE (refrescar pantalla del motorizado)
  // ============================================================
  obtenerPedidoPendiente = async (req: Request, res: Response) => {
    try {
      const motorizadoId =
        req.body.sessionMotorizado?.id || req.body.motorizadoId;

      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no identificado" });
      }

      const pedido = await Pedido.findOne({
        where: {
          motorizadoEnEvaluacion: motorizadoId,
          estado: EstadoPedido.PREPARANDO,
        },
        relations: ["negocio", "cliente"],
      });

      if (!pedido) return res.json(null);

      // ===========================
      // FIX DE SEGURIDAD (SE MANTIENE)
      // ===========================
      if (!pedido.fechaInicioRonda) {
        pedido.fechaInicioRonda = new Date();
        await pedido.save();
      }

      const expiresAt = pedido.fechaInicioRonda.getTime() + 60_000; // 1 minuto

      return res.json({
        pedidoId: pedido.id,
        total: pedido.total,
        negocioId: pedido.negocio?.id || null,
        expiresAt,
        costoEnvio: pedido.costoEnvio, // Ensure this is sent if needed
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ============================================================
  // 🚚 OBTENER PEDIDO ACTIVO (para tab "Activos")
  // ============================================================
  obtenerPedidoActivo = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      // Usar el servicio para evitar duplicación de lógica y dependencias
      const pedido = await PedidoMotoService.obtenerPedidoActivo(motorizadoId);

      if (!pedido) return res.json(null);

      return res.json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  cambiarDisponibilidad = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado.id;
      const { quiereTrabajar } = req.body;

      if (typeof quiereTrabajar !== "boolean") {
        return res.status(400).json({ message: "Valor inválido" });
      }

      const result = await PedidoMotoService.cambiarDisponibilidad(
        motorizadoId,
        quiereTrabajar
      );

      return res.json(result);
    } catch (error) {
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Error interno" });
    }
  };

  obtenerEstado = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;
      if (!motorizadoId) {
        return res.status(401).json({ message: "Motorizado no autenticado" });
      }

      const estado = await PedidoMotoService.obtenerEstadoMotorizado(
        motorizadoId
      );

      return res.json(estado);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
}
