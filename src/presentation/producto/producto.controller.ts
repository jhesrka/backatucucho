import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { ProductoService } from "../services/producto.service";
import { CreateProductoDTO } from "../../domain/dtos/productos/CreateProductoDTO";
import { UpdateProductoDTO } from "../../domain/dtos/productos/UpdateProductoDTO";

export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // ======================== CREATE ========================
  createProducto = (req: Request, res: Response) => {
    const file = req.file;

    if (!file) {
      return res
        .status(400)
        .json({ message: "La imagen del producto es obligatoria" });
    }

    const [error, dto] = CreateProductoDTO.create(req.body);

    if (error) return res.status(422).json({ message: error });

    // Validar explícitamente que venga tipoId
    if (!dto?.tipoId) {
      return res.status(422).json({ message: "Debes proporcionar tipoId" });
    }

    this.productoService
      .createProducto(dto!, file)
      .then((producto) => res.status(201).json(producto))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== READ por negocio ========================
  getProductosPorNegocio = (req: Request, res: Response) => {
    const { negocioId } = req.params;
    if (!negocioId) {
      return res.status(400).json({ message: "Falta el ID del negocio" });
    }

    this.productoService
      .getProductosByNegocio(negocioId)
      .then((productos) => res.status(200).json(productos))
      .catch((error) => this.handleError(error, res));
  };

  getProductosDisponiblesPorNegocio = (req: Request, res: Response) => {
    const { negocioId } = req.params;
    if (!negocioId) {
      return res.status(400).json({ message: "Falta el ID del negocio" });
    }

    this.productoService
      .getProductosDisponiblesByNegocio(negocioId)
      .then((productos) => res.status(200).json(productos))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== TOGGLE DISPONIBLE ========================
  toggleEstadoProducto = (req: Request, res: Response) => {
    const { id } = req.params;
    const { disponible } = req.body;

    if (typeof disponible !== "boolean") {
      return res
        .status(400)
        .json({ message: "El valor de 'disponible' debe ser booleano" });
    }

    this.productoService
      .toggleDisponible(id, disponible)
      .then((producto) => res.status(200).json(producto))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== UPDATE ========================
  updateProducto = (req: Request, res: Response) => {
    const { id } = req.params;
    const file = req.file;

    const [error, dto] = UpdateProductoDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    // Validar que tipoId esté presente si se envía
    if (dto && dto.tipoId === undefined) {
      return res.status(422).json({ message: "Debes proporcionar tipoId" });
    }

    this.productoService
      .updateProducto(id, dto!, file)
      .then((producto) => res.status(200).json(producto))
      .catch((error) => this.handleError(error, res));
  };

  // ======================== DELETE ========================
  deleteProducto = (req: Request, res: Response) => {
    const { id } = req.params;

    this.productoService
      .deleteProducto(id)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };
}
