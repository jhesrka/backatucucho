import { Request, Response } from "express";
import { CreatePedidoDTO, CustomError } from "../../domain";
import { PedidoUsuarioService } from "../services/pedidosServices/pedidoUsuario.service";

export class PedidoUsuarioController {
  constructor(private readonly pedidoUsuarioService: PedidoUsuarioService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
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
      // Validar y tipar el body con tu patrón de DTO
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
}
