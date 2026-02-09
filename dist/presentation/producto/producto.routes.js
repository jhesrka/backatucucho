"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductoRoutes = void 0;
const express_1 = require("express");
const producto_service_1 = require("../services/producto.service");
const producto_controller_1 = require("./producto.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const config_1 = require("../../config");
class ProductoRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const productoService = new producto_service_1.ProductoService();
        const productoController = new producto_controller_1.ProductoController(productoService);
        // Crear producto (usuario autenticado)
        router.post("/", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("imagen"), productoController.createProducto);
        // Obtener productos por negocio (usuario autenticado)
        router.get("/negocio/:negocioId", auth_middleware_1.AuthMiddleware.protect, productoController.getProductosPorNegocio);
        router.get("/negocio/:negocioId/disponibles", auth_middleware_1.AuthMiddleware.protect, productoController.getProductosDisponiblesPorNegocio);
        // Cambiar estado (sólo admin)
        router.patch("/:id/estado", auth_middleware_1.AuthMiddleware.protect, productoController.toggleEstadoProducto);
        // Actualizar producto (usuario autenticado, puede ser dueño del negocio)
        router.patch("/:id", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("imagen"), productoController.updateProducto);
        // Eliminar producto (sólo admin o dueño del negocio)
        router.delete("/:id", auth_middleware_1.AuthMiddleware.protect, productoController.deleteProducto);
        return router;
    }
}
exports.ProductoRoutes = ProductoRoutes;
