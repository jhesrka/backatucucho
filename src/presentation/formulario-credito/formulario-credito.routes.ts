import { Router } from "express";
import { FormularioCreditoController } from "./formulario-credito.controller";
import { FormularioCreditoService } from "../services/formularioCredito.service";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { UserRoleAdmin } from "../../data/postgres/models/useradmin.model";
export class FormularioCreditoRoutes {
  static get routes(): Router {
    const router = Router();
    const service = new FormularioCreditoService();
    const controller = new FormularioCreditoController(service);

    // Obtener preguntas (Público / Cliente)
    router.get("/negocio/:negocioId/preguntas", controller.obtenerPreguntasPorNegocio);

    // Guardar preguntas (Requiere autenticación)
    router.post('/negocio/:negocioId/preguntas', AuthMiddleware.protect, controller.guardarPreguntas);

    // Obtener leads de crédito de un negocio
    router.get('/negocio/:negocioId/leads', AuthMiddleware.protect, controller.obtenerLeadsPorNegocio);

    // Cobrar por un lead (Requiere autenticación del cliente)
    router.post('/pagar-lead', AuthMiddleware.protect, controller.pagarLeadCredito);

    // Auditoría de Leads (Solo Admin)
    router.get('/auditoria/:codigo', AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), controller.obtenerLeadPorCodigoAuditoria);

    return router;
  }
}
