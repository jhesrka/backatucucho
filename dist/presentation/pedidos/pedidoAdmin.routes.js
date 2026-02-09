"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PedidoAdminRoutes = void 0;
const express_1 = require("express");
const pedidoAdmin_service_1 = require("../services/pedidosServices/pedidoAdmin.service");
const pedidoAdmin_controller_1 = require("./pedidoAdmin.controller");
const auth_admin_middleware_1 = require("../../middlewares/auth-admin.middleware");
const auth_motorizado_middleware_1 = require("../../middlewares/auth-motorizado.middleware");
class PedidoAdminRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const service = new pedidoAdmin_service_1.PedidoAdminService();
        const controller = new pedidoAdmin_controller_1.PedidoAdminController(service);
        // 1. Obtener pedidos con filtros (GET /)
        router.get("/", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.obtenerPedidosAdmin);
        // 2. Obtener pedido por ID (GET /:id)
        router.get("/:id", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.obtenerPedidoById);
        // 3. Cambiar estado de pedido (PATCH /estado)
        router.patch("/estado", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.cambiarEstadoPedido);
        // 4. Asignar motorizado (PATCH /asignar-motorizado)
        router.patch("/asignar-motorizado", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.asignarMotorizado);
        // 5. Eliminar pedidos antiguos (DELETE /antiguos)
        router.delete("/antiguos", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.eliminarPedidosAntiguos);
        // ✅ Nueva ruta: Configurar retención de pedidos
        router.put("/config/retention", auth_admin_middleware_1.AuthAdminMiddleware.protect, controller.configureRetentionDays);
        router.patch("/motorizado/estado", auth_motorizado_middleware_1.AuthMotorizadoMiddleware.protect, controller.cambiarEstadoPorMotorizado);
        return router;
    }
}
exports.PedidoAdminRoutes = PedidoAdminRoutes;
