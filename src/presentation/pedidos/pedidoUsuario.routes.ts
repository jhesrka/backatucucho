import { Router } from "express";

import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { uploadSingleFile } from "../../config";
import { PedidoUsuarioService } from "../services/pedidosServices/pedidoUsuario.service";
import { PedidoUsuarioController } from "./pedidoUsuario.controller";

export class PedidoUsuarioRoutes {
  static get routes(): Router {
    const router = Router();

    const pedidoUsuarioService = new PedidoUsuarioService();
    const pedidoUsuarioController = new PedidoUsuarioController(
      pedidoUsuarioService
    );
    // ===================== CALCULAR ENVÍO SIN CREAR PEDIDO =====================
    // ⚠️ Este endpoint NO requiere autenticación
    router.post("/calcular-envio", pedidoUsuarioController.calcularEnvio);

    // ===================== CREAR PEDIDO =====================
    router.post(
      "/",
      AuthMiddleware.protect,
      pedidoUsuarioController.crearPedido
    );

    // ===================== SUBIR COMPROBANTE DE PAGO =====================
    router.post(
      "/upload-comprobante",
      AuthMiddleware.protect,
      uploadSingleFile("comprobante"),
      pedidoUsuarioController.subirComprobante
    );

    // ===================== OBTENER PEDIDOS DE UN CLIENTE =====================
    router.get(
      "/cliente/:clienteId",
      AuthMiddleware.protect,
      pedidoUsuarioController.obtenerPedidosCliente
    );
    // ===================== ELIMINAR PEDIDO DEL CLIENTE =====================
    router.delete(
      "/cliente/:clienteId/:pedidoId",
      AuthMiddleware.protect,
      pedidoUsuarioController.eliminarPedidoCliente
    );

    return router;
  }
}
