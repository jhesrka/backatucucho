"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriaRoutes = void 0;
const express_1 = require("express");
const categoria_service_1 = require("../services/categoria.service");
const categoria_controller_1 = require("./categoria.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const auth_admin_middleware_1 = require("../../middlewares/auth-admin.middleware");
class CategoriaRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const categoriaService = new categoria_service_1.CategoriaService();
        const categoriaController = new categoria_controller_1.CategoriaController(categoriaService);
        // ====================== ADMIN ======================
        // Crear categoría
        router.post("/", auth_admin_middleware_1.AuthAdminMiddleware.protect, categoriaController.createCategoria);
        // Actualizar categoría
        router.patch("/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, categoriaController.updateCategoria);
        // Eliminar categoría
        router.delete("/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, categoriaController.deleteCategoria);
        router.get("/", auth_admin_middleware_1.AuthAdminMiddleware.protect, categoriaController.getAllCategorias);
        // =================== AUTENTICADOS ==================
        // Obtener todas las categorías
        router.get("/user", auth_middleware_1.AuthMiddleware.protect, categoriaController.getAllCategorias);
        // Obtener categoría por ID
        router.get("/:id", auth_middleware_1.AuthMiddleware.protect, categoriaController.getCategoriaById);
        return router;
    }
}
exports.CategoriaRoutes = CategoriaRoutes;
