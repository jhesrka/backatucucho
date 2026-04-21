import { Router } from "express";
import { CategoriaService } from "../services/categoria.service";
import { CategoriaController } from "./categoria.controller";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";

import { uploadFields } from "../../config/upload-files.adapter";

export class CategoriaRoutes {
  static get routes(): Router {
    const router = Router();

    const categoriaService = new CategoriaService();
    const categoriaController = new CategoriaController(categoriaService);

    // ====================== ADMIN ======================

    // Crear categoría
    router.post("/", [AuthAdminMiddleware.protect, uploadFields([{ name: "imagen", maxCount: 1 }, { name: "coverImage", maxCount: 1 }])], categoriaController.createCategoria);

    // Actualizar categoría
    router.patch("/:id", [AuthAdminMiddleware.protect, uploadFields([{ name: "imagen", maxCount: 1 }, { name: "coverImage", maxCount: 1 }])], categoriaController.updateCategoria);

    // Eliminar categoría
    router.delete("/:id", AuthAdminMiddleware.protect, categoriaController.deleteCategoria);

    router.get("/", AuthAdminMiddleware.protect, categoriaController.getAllCategorias);

    // =================== AUTENTICADOS ==================

    // Obtener todas las categorías (Solo las que están en estado ACTIVO)
    router.get("/user", AuthMiddleware.protect, categoriaController.getAllCategoriasUser);

    // Obtener categoría por ID
    router.get("/:id", AuthMiddleware.protect, categoriaController.getCategoriaById);

    return router;
  }
}
