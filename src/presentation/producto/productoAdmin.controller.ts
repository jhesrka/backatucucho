import { Request, Response } from "express";
import { ProductoServiceAdmin } from "../services/productoAdmin.service";
import { CustomError } from "../../domain";
import { StatusProducto } from "../../data";

export class ProductoControllerAdmin {
  constructor(private readonly productoServiceAdmin: ProductoServiceAdmin) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("❌ Error en ProductoControllerAdmin:", error);
    return res
      .status(500)
      .json({ message: "Ocurrió un error inesperado en el servidor" });
  };

  // ======================== GET PRODUCTOS ADMIN ========================
  getProductosAdmin = async (req: Request, res: Response) => {
    try {
      const { limit, offset, status, search, negocioId } = req.query;

      const parsedLimit = limit ? Number(limit) : 5;
      const parsedOffset = offset ? Number(offset) : 0;
      const parsedStatus = status ? String(status).toUpperCase() : undefined;
      const parsedNegocioId = negocioId ? String(negocioId) : undefined;

      // Validaciones básicas
      if (isNaN(parsedLimit) || parsedLimit < 0)
        return res
          .status(400)
          .json({ message: "El parámetro 'limit' no es válido" });

      if (isNaN(parsedOffset) || parsedOffset < 0)
        return res
          .status(400)
          .json({ message: "El parámetro 'offset' no es válido" });

      if (
        parsedStatus &&
        !Object.values(StatusProducto).includes(parsedStatus as StatusProducto)
      ) {
        return res.status(400).json({ message: "Estado de producto inválido" });
      }

      // Llamada al service
      const result = await this.productoServiceAdmin.getProductosAdmin({
        limit: parsedLimit,
        offset: parsedOffset,
        status: parsedStatus as StatusProducto,
        search: search ? String(search) : undefined,
        negocioId: parsedNegocioId,
      });

      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };
  // ======================== UPDATE PRODUCTO ADMIN ========================
  updateProductoAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        nombre,
        descripcion,
        precio_venta,
        precio_app,
        disponible,
        statusProducto,
      } = req.body;

      const imagen = req.file; // si usas multer para subir archivos

      const result = await this.productoServiceAdmin.updateProductoAdmin(id, {
        nombre,
        descripcion,
        precio_venta: precio_venta ? Number(precio_venta) : undefined,
        precio_app: precio_app ? Number(precio_app) : undefined,
        disponible:
          disponible !== undefined
            ? disponible === "true"
            : undefined,
        statusProducto: statusProducto
          ? (String(statusProducto).toUpperCase() as StatusProducto)
          : undefined,
        imagen,
      });

      return res.status(200).json({
        message: "Producto actualizado correctamente",
        producto: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };


  changeStatusProductoAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Status required" });

    try {
      const result = await this.productoServiceAdmin.changeStatusProductoAdmin(id, status);
      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  deleteProductoAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await this.productoServiceAdmin.deleteProductoAdmin(id);
      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }
}
