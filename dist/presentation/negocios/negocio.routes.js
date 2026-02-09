"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NegocioRoutes = void 0;
const express_1 = require("express");
const negocio_service_1 = require("../services/negocio.service");
const negocio_controller_1 = require("./negocio.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const auth_admin_middleware_1 = require("../../middlewares/auth-admin.middleware");
const config_1 = require("../../config");
// ✅
class NegocioRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const negocioService = new negocio_service_1.NegocioService();
        const negocioController = new negocio_controller_1.NegocioController(negocioService);
        // ===================== CREAR =====================
        router.post("/", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("imagenNegocio"), negocioController.createNegocio);
        router.post("/admin", auth_admin_middleware_1.AuthAdminMiddleware.protect, (0, config_1.uploadSingleFile)("imagenNegocio"), negocioController.createNegocio);
        // ===================== LEER =====================
        router.get("/categoria/:categoriaId", auth_middleware_1.AuthMiddleware.protect, negocioController.getNegociosByCategoria);
        router.get("/", auth_admin_middleware_1.AuthAdminMiddleware.protect, negocioController.getNegociosFiltrados);
        // Obtener todos los negocios creados por un usuario
        router.get("/usuario/:userId", auth_middleware_1.AuthMiddleware.protect, negocioController.getNegociosByUserId);
        // ===================== ACTUALIZAR =====================
        router.patch("/:id", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("imagenNegocio"), negocioController.updateNegocio);
        // ===================== CAMBIAR ESTADO =====================
        // 🔄 Alternar entre ABIERTO / CERRADO (solo el dueño del negocio o admin)
        router.patch("/:id/toggle-estado", auth_middleware_1.AuthMiddleware.protect, // o AuthAdminMiddleware si quieres solo admin
        negocioController.toggleEstadoNegocio);
        // 💳 Pagar suscripción manualmente (solo dueño)
        router.post("/:id/pay-subscription", auth_middleware_1.AuthMiddleware.protect, negocioController.paySubscription);
        // ===================== ELIMINAR =====================
        router.delete("/:id", auth_middleware_1.AuthMiddleware.protect, negocioController.deleteIfNotActivo);
        return router;
    }
}
exports.NegocioRoutes = NegocioRoutes;
