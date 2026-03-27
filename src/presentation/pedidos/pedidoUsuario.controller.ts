import { Request, Response } from "express";
import { CreatePedidoDTO, CustomError, CalificarPedidoDTO } from "../../domain";
import { PedidoUsuarioService } from "../services/pedidosServices/pedidoUsuario.service";
import { PayphoneService } from "../services/payphone.service";
import { Pedido, Negocio } from "../../data";

export class PedidoUsuarioController {
  constructor(private readonly pedidoUsuarioService: PedidoUsuarioService) { }

  private handleError = (error: any, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unhandled error:", error);
    
    // Capture axios (Payphone) error body
    const axiosError = (error as any)?.response?.data;
    if (axiosError) {
      return res.status(400).json({ 
        message: axiosError.message || JSON.stringify(axiosError) 
      });
    }

    return res.status(500).json({ 
      message: "Internal Server Error", 
      error: (error as any).message 
    });
  };
  // ======================== Calcular envío ========================
  calcularEnvio = async (req: Request, res: Response) => {
    try {
      const { negocioId, lat, lng } = req.body;

      if (!negocioId || !lat || !lng) {
        return res
          .status(400)
          .json({ message: "Faltan datos: negocioId, lat o lng" });
      }

      const result = await PedidoUsuarioService.calcularEnvio({
        negocioId,
        lat,
        lng,
      });

      return res.status(200).json(result); // { distanciaKm, costoEnvio }
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Subir Comprobante ========================
  subirComprobante = async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No se subió ningún archivo" });
      }

      const result = await this.pedidoUsuarioService.subirComprobante(file);
      return res.status(200).json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ======================== Crear pedido ========================
  crearPedido = async (req: Request, res: Response) => {
    try {
      // 🧪 LOGS DE AUDITORÍA
      console.log("-------------------------------------------");
      console.log("🛒 NUEVA PETICIÓN DE PEDIDO");
      console.log("Headers Auth:", req.headers.authorization);
      console.log("User en Body:", req.body.sessionUser ? "✅ OK" : "❌ NO");
      console.log("-------------------------------------------");

      // 🥈 BACKEND – VALIDAR AUTH
      if (!req.body.sessionUser) {
        return res.status(401).json({ message: "No autenticado" });
      }

      // Inyectar clienteId de la sesión si falta
      if (!req.body.clienteId) req.body.clienteId = req.body.sessionUser.id;

      const [err, dto] = CreatePedidoDTO.create(req.body);
      if (err) return res.status(400).json({ message: err });

      const pedido = await this.pedidoUsuarioService.crearPedido(dto!);
      return res.status(201).json(pedido);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  // ======================== Obtener pedidos de un cliente ========================
  obtenerPedidosCliente = (req: Request, res: Response) => {
    const clienteId = req.params.clienteId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;

    const filters = {
      estado: req.query.estado as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    if (!clienteId) {
      return res.status(400).json({ message: "Falta el ID del cliente" });
    }

    this.pedidoUsuarioService
      .obtenerPedidosCliente(clienteId, page, limit, filters)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== Eliminar pedido del cliente ========================
  eliminarPedidoCliente = (req: Request, res: Response) => {
    const pedidoId = req.params.pedidoId;
    const clienteId = req.params.clienteId; // 👈 igual que en obtenerPedidosCliente

    if (!pedidoId) {
      return res.status(400).json({ message: "Falta el ID del pedido" });
    }
    if (!clienteId) {
      return res.status(400).json({ message: "Falta el ID del cliente" });
    }

    this.pedidoUsuarioService
      .eliminarPedidoCliente(pedidoId, clienteId)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  notificarYaVoy = (req: Request, res: Response) => {
    const { pedidoId, clienteId } = req.body;

    if (!pedidoId || !clienteId) {
      return res.status(400).json({ message: "Faltan datos: pedidoId o clienteId" });
    }

    this.pedidoUsuarioService
      .notificarYaVoy(pedidoId, clienteId)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  calificarPedido = (req: Request, res: Response) => {
    const [err, dto] = CalificarPedidoDTO.create(req.body);
    if (err) return res.status(400).json({ message: err });

    this.pedidoUsuarioService
      .calificarPedido(dto!)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  confirmarPago = async (req: Request, res: Response) => {
    try {
        const { id, clientTransactionId } = req.body;
        if (!id || !clientTransactionId) {
            return res.status(400).json({ message: "Faltan id o clientTransactionId" });
        }

        const result = await this.pedidoUsuarioService.confirmarPago(+id, clientTransactionId);
        return res.status(200).json(result);
    } catch (error) {
        return this.handleError(error, res);
    }
  };

  refreshTimer = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const result = await this.pedidoUsuarioService.refreshTimer(id);
        return res.status(200).json(result);
    } catch (error) {
        return this.handleError(error, res);
    }
  };

  runSqlUpdate = async (req: Request, res: Response) => {
    try {
        const repo = Pedido.getRepository();
        
        // 1. Limpiar espacios traicioneros en la BD
        await repo.query("UPDATE negocio SET payphone_store_id = TRIM(payphone_store_id), payphone_token = TRIM(payphone_token)");

        // 2. Intentar forzar los valores
        try {
            await repo.query("ALTER TYPE pedido_metodopago_enum ADD VALUE IF NOT EXISTS 'TARJETA'");
        } catch (e) {}
        try {
            await repo.query("ALTER TYPE pedido_estado_enum ADD VALUE IF NOT EXISTS 'PENDIENTE_PAGO'");
        } catch (e) {}

        // 3. Consultar valores REALES del negocio específico
        const business = await repo.query("SELECT id, nombre, payphone_store_id, " + '"pago_tarjeta_habilitado_admin"' + " as enabled FROM negocio WHERE id = '36a53408-4d75-4f96-928b-a8ffb840e753'");

        return res.status(200).json({ 
            success: true,
            status: "DB CLEANED",
            business: business[0]
        });
    } catch (error: any) {
        return res.status(500).json({ message: "Error", error: error.message });
    }
  };
}

