import { Router } from "express";

import { ProductoControllerAdmin } from "./productoAdmin.controller";
import { AuthAdminMiddleware } from "../../middlewares";
import { ProductoServiceAdmin } from "../services/productoAdmin.service";
import { uploadSingleFile } from "../../config";

export class ProductoAdminRoutes {
  static get routes(): Router {
    const router = Router();

    const productoServiceAdmin = new ProductoServiceAdmin();
    const productoControllerAdmin = new ProductoControllerAdmin(
      productoServiceAdmin
    );

    // ======================== OBTENER PRODUCTOS ADMIN ========================
    // Sólo administradores pueden acceder
    router.get(
      "/",
      AuthAdminMiddleware.protect,
      productoControllerAdmin.getProductosAdmin
    );
    // ======================== ACTUALIZAR PRODUCTO ADMIN ========================
    router.patch(
      "/:id",
      AuthAdminMiddleware.protect,
      uploadSingleFile("imagen"), // 👈 usa tu helper multer configurado
      productoControllerAdmin.updateProductoAdmin
    );

    // NUEVO: Admin Change Status
    router.put(
      "/status/:id",
      AuthAdminMiddleware.protect,
      productoControllerAdmin.changeStatusProductoAdmin
    );

    // NUEVO: Admin Bulk Create
    router.post(
      "/bulk/:negocioId",
      AuthAdminMiddleware.protect,
      productoControllerAdmin.bulkCreateProductos
    );

    // NUEVO: Admin Purge Definitive
    router.delete(
      "/purge/:id",
      AuthAdminMiddleware.protect,
      productoControllerAdmin.deleteProductoAdmin
    );

    return router;
  }
}
