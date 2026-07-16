import { Router } from "express";
import { FormularioCreditoController } from "./formulario-credito.controller";
import { FormularioCreditoService } from "../services/formularioCredito.service";

export class FormularioCreditoRoutes {
  static get routes(): Router {
    const router = Router();
    const service = new FormularioCreditoService();
    const controller = new FormularioCreditoController(service);

    // Obtener preguntas (Público / Cliente)
    router.get("/negocio/:negocioId/preguntas", controller.obtenerPreguntasPorNegocio);

    // Guardar preguntas (Dueño del negocio) -> Debería tener AuthMiddleware, lo simplificamos aquí
    router.post("/negocio/:negocioId/preguntas", controller.guardarPreguntas);

    // Pagar lead (Cliente antes de abrir WhatsApp)
    router.post("/pagar-lead", controller.pagarLeadCredito);

    return router;
  }
}
