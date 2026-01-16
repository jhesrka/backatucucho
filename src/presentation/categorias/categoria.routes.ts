import { Router } from "express";
import { CategoriaService } from "../services/categoria.service";
import { CategoriaController } from "./categoria.controller";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";

export class CategoriaRoutes {
  static get routes(): Router {
    const router = Router();

    const categoriaService = new CategoriaService();
    const categoriaController = new CategoriaController(categoriaService);

    // ====================== ADMIN ======================

    // Crear categoría
    router.post("/", AuthAdminMiddleware.protect, categoriaController.createCategoria);

    // Actualizar categoría
    router.patch("/:id", AuthAdminMiddleware.protect, categoriaController.updateCategoria);

    // Eliminar categoría
    router.delete("/:id", AuthAdminMiddleware.protect, categoriaController.deleteCategoria);

    router.get("/", AuthAdminMiddleware.protect, categoriaController.getAllCategorias);

    // =================== AUTENTICADOS ==================

    // Obtener todas las categorías
    router.get("/user", AuthMiddleware.protect, categoriaController.getAllCategorias);

    // Obtener categoría por ID
    router.get("/:id", AuthMiddleware.protect, categoriaController.getCategoriaById);

    return router;
  }
}
