import { Request, Response } from "express";
import { SubcategoriaService } from "../../services/subcategoria.service";
import { CreateSubcategoriaDTO, UpdateSubcategoriaDTO } from "../../../domain/dtos/subcategorias";
import { CustomError } from "../../../domain";

export class SubcategoriaController {
  constructor(private readonly subcategoriaService: SubcategoriaService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  };

  create = (req: Request, res: Response) => {
    const masterPin = req.header("x-master-pin");
    if (!masterPin) return res.status(401).json({ message: "Master PIN requerido" });

    const [error, dto] = CreateSubcategoriaDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.subcategoriaService
      .create(dto!, masterPin)
      .then((data) => res.status(201).json(data))
      .catch((error) => this.handleError(error, res));
  };

  getByCategoria = (req: Request, res: Response) => {
    const { categoriaId } = req.params;
    this.subcategoriaService
      .getAllByCategoria(categoriaId)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  update = (req: Request, res: Response) => {
    const { id } = req.params;
    const masterPin = req.header("x-master-pin");
    if (!masterPin) return res.status(401).json({ message: "Master PIN requerido" });

    const [error, dto] = UpdateSubcategoriaDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.subcategoriaService
      .update(id, dto!, masterPin)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  delete = (req: Request, res: Response) => {
    const { id } = req.params;
    const masterPin = req.header("x-master-pin");
    if (!masterPin) return res.status(401).json({ message: "Master PIN requerido" });

    this.subcategoriaService
      .delete(id, masterPin)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
}
