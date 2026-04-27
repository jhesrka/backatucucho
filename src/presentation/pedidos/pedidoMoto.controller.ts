import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { PedidoMotoService } from "../services/pedidosServices/pedidoMoto.service";
import { EstadoPedido, Pedido } from "../../data/postgres/models/Pedido";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs } from "../../config/env";
import { v4 as uuidv4 } from "uuid";

export class PedidoMotoController {
  /** Controlador para la gestion de pedidos por parte de los motorizados */
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

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const pedido = await PedidoMotoService.aceptarPedido(pedidoId, motorizadoId);
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

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const pedido = await PedidoMotoService.rechazarPedido(pedidoId, motorizadoId);
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

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const pedido = await PedidoMotoService.marcarEnCamino(pedidoId, motorizadoId);
      return res.status(200).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Entregar pedido ========================
  entregarPedido = async (req: Request, res: Response) => {
    try {
      const { pedidoId, code } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!code) return res.status(400).json({ message: "Falta el codigo de entrega" });
      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const pedido = await PedidoMotoService.entregarPedido(pedidoId, motorizadoId, code);
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

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!motivo) return res.status(400).json({ message: "Falta el motivo cancelacion" });
      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const pedido = await PedidoMotoService.cancelarPedido(pedidoId, motorizadoId, motivo);
      return res.status(200).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Marcar LLEGADA ========================
  marcarLlegada = async (req: Request, res: Response) => {
    try {
      const { pedidoId } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const result = await PedidoMotoService.marcarLlegada(pedidoId, motorizadoId);
      return res.status(200).json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };


  // ======================== Historial ========================
  obtenerHistorial = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;
      const { fecha, page, limit } = req.query;

      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const historial = await this.pedidoMotoService.obtenerHistorial(
        motorizadoId,
        fecha as string,
        page ? Number(page) : 1,
        limit ? Number(limit) : 10
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
      const { fecha, page = 1, limit = 10 } = req.query;

      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const billetera = await this.pedidoMotoService.obtenerBilletera(
        motorizadoId,
        fecha as string,
        Number(page),
        Number(limit)
      );

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

      if (!motorizadoId) return res.status(401).json({ message: "No autenticado" });

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

      if (!motorizadoId) return res.status(401).json({ message: "No autenticado" });
      if (!monto) return res.status(400).json({ message: "Monto requerido" });

      const tx = await PedidoMotoService.solicitarRetiro(motorizadoId, Number(monto));
      return res.json(tx);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ============================================================
  // OBTENER PEDIDO PENDIENTE (refrescar pantalla del motorizado)
  // ============================================================
  obtenerPedidoPendiente = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id || req.body.motorizadoId;

      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no identificado" });

      const pedido = await Pedido.findOne({
        where: {
          motorizadoEnEvaluacion: motorizadoId,
          estado: EstadoPedido.PREPARANDO,
        },
        relations: ["negocio", "cliente"],
      });

      if (!pedido) return res.json(null);

      if (!pedido.fechaInicioRonda) {
        pedido.fechaInicioRonda = new Date();
        await pedido.save();
      }

      const timeout = await PedidoMotoService.getTimeout();
      const expiresAt = pedido.fechaInicioRonda.getTime() + timeout;

      return res.json({
        pedidoId: pedido.id,
        total: pedido.total,
        negocioId: pedido.negocio?.id || null,
        expiresAt,
        duration: timeout,
        costoEnvio: pedido.costoEnvio,
        rondaAsignacion: pedido.rondaAsignacion || 1,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ============================================================
  // OBTENER PEDIDO ACTIVO (para tab Activos)
  // ============================================================
  obtenerPedidoActivo = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

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

      if (typeof quiereTrabajar !== "boolean") return res.status(400).json({ message: "Valor invalido" });

      const result = await PedidoMotoService.cambiarDisponibilidad(motorizadoId, quiereTrabajar);
      return res.json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  obtenerEstado = async (req: Request, res: Response) => {
    try {
      const motorizadoId = req.body.sessionMotorizado?.id;
      if (!motorizadoId) return res.status(401).json({ message: "Motorizado no autenticado" });

      const estado = await PedidoMotoService.obtenerEstadoMotorizado(motorizadoId);
      return res.json(estado);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  obtenerTableroOperativo = async (req: Request, res: Response) => {
    try {
      const result = await PedidoMotoService.obtenerTableroOperativo();
      return res.json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  aceptarPedidoEnEspera = async (req: Request, res: Response) => {
    try {
      const { pedidoId } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!motorizadoId) return res.status(401).json({ message: "No autenticado" });

      const pedido = await PedidoMotoService.aceptarPedidoEnEspera(pedidoId, motorizadoId);
      return res.json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  cancelarPedidoPorAusencia = async (req: Request, res: Response) => {
    try {
      const { pedidoId, evidenceKey } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!evidenceKey) return res.status(400).json({ message: "Falta la evidencia fotografica" });
      if (!motorizadoId) return res.status(401).json({ message: "No autenticado" });

      const result = await PedidoMotoService.cancelarPedidoPorAusencia(pedidoId, motorizadoId, evidenceKey);
      return res.json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  confirmarRetornoLocal = async (req: Request, res: Response) => {
    try {
      const { pedidoId, evidenceKey } = req.body;
      const motorizadoId = req.body.sessionMotorizado?.id;

      if (!pedidoId) return res.status(400).json({ message: "Falta el pedidoId" });
      if (!evidenceKey) return res.status(400).json({ message: "Falta la evidencia del retorno" });
      if (!motorizadoId) return res.status(401).json({ message: "No autenticado" });

      const result = await PedidoMotoService.confirmarRetornoLocal(pedidoId, motorizadoId, evidenceKey);
      return res.json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  uploadEvidence = async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const fileExtension = req.file.originalname.split(".").pop() || "jpg";
      const fileName = `${uuidv4()}.${fileExtension}`;
      const folder = "pedidos/evidence";
      const key = `${folder}/${fileName}`;

      const uploadedKey = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: key,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });

      const signedUrl = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: uploadedKey
      });

      return res.status(200).json({
        success: true,
        url: signedUrl,
        key: uploadedKey
      });

    } catch (error) {
      return this.handleError(error, res);
    }
  };
}
