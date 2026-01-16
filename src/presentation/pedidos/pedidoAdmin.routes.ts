import { Router } from "express";
import { PedidoAdminService } from "../services/pedidosServices/pedidoAdmin.service";
import { PedidoAdminController } from "./pedidoAdmin.controller";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { AuthMotorizadoMiddleware } from "../../middlewares/auth-motorizado.middleware";

export class PedidoAdminRoutes {
  static get routes(): Router {
    const router = Router();

    const service = new PedidoAdminService();
    const controller = new PedidoAdminController(service);

    // 1. Obtener pedidos con filtros (GET /)
    router.get(
      "/",
      AuthAdminMiddleware.protect,
      controller.obtenerPedidosAdmin
    );

    // 2. Obtener pedido por ID (GET /:id)
    router.get(
      "/:id",
      AuthAdminMiddleware.protect,
      controller.obtenerPedidoById
    );

    // 3. Cambiar estado de pedido (PATCH /estado)
    router.patch(
      "/estado",
      AuthAdminMiddleware.protect,
      controller.cambiarEstadoPedido
    );

    // 4. Asignar motorizado (PATCH /asignar-motorizado)
    router.patch(
      "/asignar-motorizado",
      AuthAdminMiddleware.protect,
      controller.asignarMotorizado
    );

    // 5. Eliminar pedidos antiguos (DELETE /antiguos)
    router.delete(
      "/antiguos",
      AuthAdminMiddleware.protect,
      controller.eliminarPedidosAntiguos
    );

    // ✅ Nueva ruta: Configurar retención de pedidos
    router.put(
      "/config/retention",
      AuthAdminMiddleware.protect,
      controller.configureRetentionDays
    );

    router.patch(
      "/motorizado/estado",
      AuthMotorizadoMiddleware.protect,
      controller.cambiarEstadoPorMotorizado
    );

    return router;
  }
}
