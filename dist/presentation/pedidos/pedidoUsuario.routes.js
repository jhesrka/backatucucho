"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PedidoUsuarioRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const config_1 = require("../../config");
const pedidoUsuario_service_1 = require("../services/pedidosServices/pedidoUsuario.service");
const pedidoUsuario_controller_1 = require("./pedidoUsuario.controller");
class PedidoUsuarioRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const pedidoUsuarioService = new pedidoUsuario_service_1.PedidoUsuarioService();
        const pedidoUsuarioController = new pedidoUsuario_controller_1.PedidoUsuarioController(pedidoUsuarioService);
        // ===================== CALCULAR ENVÍO SIN CREAR PEDIDO =====================
        // ⚠️ Este endpoint NO requiere autenticación
        router.post("/calcular-envio", pedidoUsuarioController.calcularEnvio);
        // ===================== CREAR PEDIDO =====================
        router.post("/", auth_middleware_1.AuthMiddleware.protect, pedidoUsuarioController.crearPedido);
        // ===================== SUBIR COMPROBANTE DE PAGO =====================
        router.post("/upload-comprobante", auth_middleware_1.AuthMiddleware.protect, (0, config_1.uploadSingleFile)("comprobante"), pedidoUsuarioController.subirComprobante);
        // ===================== OBTENER PEDIDOS DE UN CLIENTE =====================
        router.get("/cliente/:clienteId", auth_middleware_1.AuthMiddleware.protect, pedidoUsuarioController.obtenerPedidosCliente);
        // ===================== ELIMINAR PEDIDO DEL CLIENTE =====================
        router.delete("/cliente/:clienteId/:pedidoId", auth_middleware_1.AuthMiddleware.protect, pedidoUsuarioController.eliminarPedidoCliente);
        return router;
    }
}
exports.PedidoUsuarioRoutes = PedidoUsuarioRoutes;
