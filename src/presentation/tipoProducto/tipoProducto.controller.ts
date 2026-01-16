// src/controllers/tipoProducto.controller.ts
import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { TipoProductoService } from "../services/tipoProducto.service";


export class TipoProductoController {
  constructor(private readonly tipoProductoService: TipoProductoService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // ======================== CREATE ========================
    createTipoProducto = (req: Request, res: Response) => {
    const { nombre, negocioId } = req.body as { nombre?: string; negocioId?: string };

    if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio" });
    if (!negocioId) return res.status(400).json({ message: "Falta el ID del negocio" });

    this.tipoProductoService
      .createTipoProducto(nombre, negocioId)
      .then((tipo) => res.status(201).json(tipo))
      .catch((error) => this.handleError(error, res));
  };
  // ======================== READ ========================
   getTiposByNegocio = (req: Request, res: Response) => {
    const { negocioId } = req.params as { negocioId?: string };
    if (!negocioId) return res.status(400).json({ message: "Falta el ID del negocio" });

    this.tipoProductoService
      .getTiposByNegocio(negocioId)
      .then((tipos) => res.status(200).json(tipos))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== DELETE ========================
  deleteTipoProducto = (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Falta el id del tipo" });

    this.tipoProductoService
      .deleteTipo(id)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };
}
