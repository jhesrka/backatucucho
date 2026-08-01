"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipoProductoRoutes = void 0;
// src/routes/tipoProducto.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const auth_admin_middleware_1 = require("../../middlewares/auth-admin.middleware");
const tipoProducto_service_1 = require("../services/tipoProducto.service");
const tipoProducto_controller_1 = require("./tipoProducto.controller");
class TipoProductoRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const tipoProductoService = new tipoProducto_service_1.TipoProductoService();
        const tipoProductoController = new tipoProducto_controller_1.TipoProductoController(tipoProductoService);
        // Crear tipo producto (usuario autenticado)
        router.post("/", auth_middleware_1.AuthMiddleware.protect, tipoProductoController.createTipoProducto);
        // Obtener todos los tipos de producto (usuario autenticado)
        router.get("/negocio/:negocioId", auth_middleware_1.AuthMiddleware.protect, tipoProductoController.getTiposByNegocio);
        // Obtener todos los tipos de producto (admin)
        router.get("/admin/negocio/:negocioId", auth_admin_middleware_1.AuthAdminMiddleware.protect, tipoProductoController.getTiposByNegocio);
        // Editar tipo de producto (admin)
        router.put("/admin/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, tipoProductoController.updateTipoProducto);
        // Eliminar tipo producto por id (admin)
        router.delete("/admin/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, tipoProductoController.deleteTipoProducto);
        // Eliminar tipo producto por id (usuario autenticado, podría restringirse a admin)
        router.delete("/:id", auth_middleware_1.AuthMiddleware.protect, tipoProductoController.deleteTipoProducto);
        // Reordenar categorías (usuario autenticado)
        router.put("/reordenar", auth_middleware_1.AuthMiddleware.protect, tipoProductoController.reordenarTipos);
        return router;
    }
}
exports.TipoProductoRoutes = TipoProductoRoutes;
