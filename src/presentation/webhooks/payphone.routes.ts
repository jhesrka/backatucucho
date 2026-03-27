import { Router } from "express";
import { PayphoneWebhookController } from "./payphone.controller";

export class PayphoneWebhookRoutes {
    static get routes(): Router {
        const router = Router();
        const controller = new PayphoneWebhookController();

        // 🚨 IMPORTANTE: Payphone requiere una ruta pública POST para el webhook
        // No lleva AuthMiddleware porque viene de Payphone (el controlador verifica el token)
        router.post("/", controller.handleWebhook);
        
        // Opcional: una ruta GET para verificar rápidamente que el endpoint responde
        router.get("/", (req, res) => res.status(200).send("Payphone Webhook Endpoint Active"));

        return router;
    }
}
