import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { NegocioService } from "../services/negocio.service";
import { CreateNegocioDTO } from "../../domain/dtos/negocios/CreateNegocioDTO";

export class NegocioController {
  constructor(private readonly negocioService: NegocioService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // ======================= CREATE ========================
  createNegocio = (req: Request, res: Response) => {
    const [error, dto] = CreateNegocioDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    this.negocioService
      .createNegocio(dto!, req.file) // 👈 admite imagen
      .then((negocio) => res.status(201).json(negocio))
      .catch((error) => this.handleError(error, res));
  };

  // ======================= READ ==========================
  getNegociosByCategoria = (req: Request, res: Response) => {
    const { categoriaId } = req.params;

    this.negocioService
      .getNegociosByCategoria(categoriaId)
      .then((negocios) => res.status(200).json(negocios))
      .catch((error) => {
        if (error instanceof CustomError) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Unhandled error:", error);
        return res.status(500).json({ message: "Something went very wrong" });
      });
  };
  // ================== TOGGLE ABIERTO / CERRADO ======================
  toggleEstadoNegocio = (req: Request, res: Response) => {
    const { id } = req.params;

    this.negocioService
      .toggleEstadoNegocio(id)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  getNegociosFiltrados = (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;

    this.negocioService
      .getNegociosFiltrados(status)
      .then((negocios) => res.status(200).json(negocios))
      .catch((error) => this.handleError(error, res));
  };

  getNegociosByUserId = (req: Request, res: Response) => {
    const { userId } = req.params;

    this.negocioService
      .getNegociosByUsuarioId(userId)
      .then((negocios) => res.status(200).json(negocios))
      .catch((error) => this.handleError(error, res));
  };

  // ======================= UPDATE ========================
  updateNegocio = (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;

    this.negocioService
      .updateNegocio(id, body, req.file) // 👈 admite imagen
      .then((negocio) => res.status(200).json(negocio))
      .catch((error) => this.handleError(error, res));
  };

  // ======================= DELETE ========================
  deleteIfNotActivo = (req: Request, res: Response) => {
    const { id } = req.params;

    this.negocioService
      .deleteIfNotActivo(id)
      .then((mensaje) => res.status(200).json(mensaje))
      .catch((error) => this.handleError(error, res));
  };

  deleteNegocio = (req: Request, res: Response) => {
    const { id } = req.params;
    this.negocioService
      .deleteNegocio(id)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };
}
