"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PedidoMotoRoutes = void 0;
const express_1 = require("express");
const pedidoMoto_controller_1 = require("./pedidoMoto.controller");
const pedidoMoto_service_1 = require("../services/pedidosServices/pedidoMoto.service");
const middlewares_1 = require("../../middlewares");
class PedidoMotoRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const pedidoMotoService = new pedidoMoto_service_1.PedidoMotoService();
        const pedidoMotoController = new pedidoMoto_controller_1.PedidoMotoController(pedidoMotoService);
        // ===================== ACEPTAR PEDIDO =====================
        router.post("/aceptar", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.aceptarPedido);
        // ===================== RECHAZAR PEDIDO =====================
        router.post("/rechazar", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.rechazarPedido);
        // ===================== MARCAR EN CAMINO =====================
        router.post("/en-camino", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.marcarEnCamino);
        // ===================== ENTREGAR PEDIDO =====================
        router.post("/entregado", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.entregarPedido);
        // ===================== CANCELAR PEDIDO =====================
        router.post("/cancelar", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.cancelarPedido);
        // ===================== MARCAR LLEGADA =====================
        router.post("/marcar-llegada", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.marcarLlegada);
        // ===================== HISTORIAL Y BILLETERA =====================
        router.get("/historial", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.obtenerHistorial);
        router.get("/billetera", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.obtenerBilletera);
        // 🏦 Nuevas Rutas de Billetera
        router.post("/billetera/retiro", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.solicitarRetiro);
        router.put("/billetera/banco", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.guardarDatosBancarios);
        // ===================== OBTENER PEDIDO PENDIENTE =====================
        // Se usa para refrescar pantalla / reconexión del motorizado
        router.post("/pedido-pendiente", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.obtenerPedidoPendiente);
        // ===================== OBTENER PEDIDO ACTIVO =====================
        // Se usa para cargar el pedido que el motorizado está entregando
        router.post("/pedido-activo", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.obtenerPedidoActivo);
        router.post("/disponibilidad", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.cambiarDisponibilidad);
        router.get("/estado", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.obtenerEstado);
        // ===================== TABLERO OPERATIVO =====================
        router.get("/tablero-operativo", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.obtenerTableroOperativo);
        router.post("/aceptar-espera", middlewares_1.AuthMotorizadoMiddleware.protect, pedidoMotoController.aceptarPedidoEnEspera);
        return router;
    }
}
exports.PedidoMotoRoutes = PedidoMotoRoutes;
