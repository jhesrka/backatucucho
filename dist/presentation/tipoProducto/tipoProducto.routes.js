"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipoProductoRoutes = void 0;
// src/routes/tipoProducto.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const tipoProducto_service_1 = require("../services/tipoProducto.service");
const tipoProducto_controller_1 = require("./tipoProducto.controller");
// Si quieres un middleware admin, podrías importarlo también y usarlo en rutas sensibles
class TipoProductoRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const tipoProductoService = new tipoProducto_service_1.TipoProductoService();
        const tipoProductoController = new tipoProducto_controller_1.TipoProductoController(tipoProductoService);
        // Crear tipo producto (usuario autenticado)
        router.post("/", auth_middleware_1.AuthMiddleware.protect, tipoProductoController.createTipoProducto);
        // Obtener todos los tipos de producto (usuario autenticado)
        router.get("/negocio/:negocioId", auth_middleware_1.AuthMiddleware.protect, tipoProductoController.getTiposByNegocio);
        // Eliminar tipo producto por id (usuario autenticado, podría restringirse a admin)
        router.delete("/:id", auth_middleware_1.AuthMiddleware.protect, tipoProductoController.deleteTipoProducto);
        return router;
    }
}
exports.TipoProductoRoutes = TipoProductoRoutes;
