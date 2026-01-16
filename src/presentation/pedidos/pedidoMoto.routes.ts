import { Router } from "express";

import { PedidoMotoController } from "./pedidoMoto.controller";
import { PedidoMotoService } from "../services/pedidosServices/pedidoMoto.service";
import { AuthMotorizadoMiddleware } from "../../middlewares";

export class PedidoMotoRoutes {
  static get routes(): Router {
    const router = Router();

    const pedidoMotoService = new PedidoMotoService();
    const pedidoMotoController = new PedidoMotoController(pedidoMotoService);

    // ===================== ACEPTAR PEDIDO =====================
    router.post(
      "/aceptar",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.aceptarPedido
    );

    // ===================== RECHAZAR PEDIDO =====================
    router.post(
      "/rechazar",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.rechazarPedido
    );

    // ===================== MARCAR EN CAMINO =====================
    router.post(
      "/en-camino",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.marcarEnCamino
    );

    // ===================== ENTREGAR PEDIDO =====================
    router.post(
      "/entregado",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.entregarPedido
    );

    // ===================== CANCELAR PEDIDO =====================
    router.post(
      "/cancelar",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.cancelarPedido
    );

    // ===================== HISTORIAL Y BILLETERA =====================
    router.get(
      "/historial",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.obtenerHistorial
    );

    router.get(
      "/billetera",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.obtenerBilletera
    );

    // 🏦 Nuevas Rutas de Billetera
    router.post(
      "/billetera/retiro",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.solicitarRetiro
    );
    router.put(
      "/billetera/banco",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.guardarDatosBancarios
    );

    // ===================== OBTENER PEDIDO PENDIENTE =====================
    // Se usa para refrescar pantalla / reconexión del motorizado
    router.post(
      "/pedido-pendiente",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.obtenerPedidoPendiente
    );

    // ===================== OBTENER PEDIDO ACTIVO =====================
    // Se usa para cargar el pedido que el motorizado está entregando
    router.post(
      "/pedido-activo",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.obtenerPedidoActivo
    );

    router.post(
      "/disponibilidad",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.cambiarDisponibilidad
    );
    router.get(
      "/estado",
      AuthMotorizadoMiddleware.protect,
      pedidoMotoController.obtenerEstado
    );

    return router;
  }
}
