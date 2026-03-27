import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { CategoriaService } from "../services/categoria.service";
import { CreateCategoriaDTO } from "../../domain/dtos/categoriaProductos/CreateCategoriaDTO";
import { UpdateCategoriaDTO } from "../../domain/dtos/categoriaProductos/UpdateCategoriaDTO";

// =============== CATEGORIA CONTROLLER ===============
export class CategoriaController {
  constructor(private readonly categoriaService: CategoriaService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // Crear categoría
  createCategoria = (req: Request, res: Response) => {
    const [error, dto] = CreateCategoriaDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    if (!req.file) {
      return res.status(422).json({ message: "La imagen de la categoría es obligatoria" });
    }

    const { masterPin } = req.body;
    if (!masterPin) return res.status(400).json({ message: "Master PIN es requerido" });

    this.categoriaService
      .createCategoria(dto!, req.file, masterPin)
      .then((categoria) => res.status(201).json(categoria))
      .catch((error) => this.handleError(error, res));
  };

  // Obtener todas las categorías (ADMIN)
  getAllCategorias = (_req: Request, res: Response) => {
    this.categoriaService
      .getAllCategorias()
      .then((categorias) => res.status(200).json(categorias))
      .catch((error) => this.handleError(error, res));
  };

  // Obtener todas las categorías (USUARIO PUBLICO) - Filtradas por ACTIVO
  getAllCategoriasUser = (_req: Request, res: Response) => {
    this.categoriaService
      .getAllCategorias("ACTIVO") // 🔐 Solo ACTIVOS
      .then((categorias) => res.status(200).json(categorias))
      .catch((error) => this.handleError(error, res));
  };

  // Obtener categoría por ID
  getCategoriaById = (req: Request, res: Response) => {
    const id = req.params.id;

    this.categoriaService
      .getCategoriaById(id)
      .then((categoria) => res.status(200).json(categoria))
      .catch((error) => this.handleError(error, res));
  };

  // Actualizar categoría
  updateCategoria = (req: Request, res: Response) => {
    const id = req.params.id;
    const [error, dto] = UpdateCategoriaDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    const { masterPin } = req.body;
    if (!masterPin) return res.status(400).json({ message: "Master PIN es requerido" });

    this.categoriaService
      .updateCategoria(id, dto!, req.file, masterPin)
      .then((categoria) => res.status(200).json(categoria))
      .catch((error) => this.handleError(error, res));
  };

  // Eliminar categoría
  deleteCategoria = (req: Request, res: Response) => {
    const id = req.params.id;
    const { masterPin } = req.body;

    if (!masterPin) return res.status(400).json({ message: "Master PIN es requerido" });

    this.categoriaService
      .deleteCategoria(id, masterPin)
      .then(() => res.status(204).send())
      .catch((error) => this.handleError(error, res));
  };
}
