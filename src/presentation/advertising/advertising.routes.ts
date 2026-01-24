import { Router } from "express";
import { AdvertisingController } from "./advertising.controller";
import { AdvertisingService } from "../services/advertising.service";
import { EmailService } from "../services/email.service";
import { envs } from "../../config";
import { AuthAdminMiddleware } from "../../middlewares";

export class AdvertisingRoutes {
    static get routes(): Router {
        const router = Router();

        const emailService = new EmailService(
            envs.MAILER_SERVICE,
            envs.MAILER_EMAIL,
            envs.MAILER_SECRET_KEY,
            envs.SEND_EMAIL
        );
        const advertisingService = new AdvertisingService(emailService);
        const controller = new AdvertisingController(advertisingService);

        router.use(AuthAdminMiddleware.protect); // All routes protected

        router.get("/campaigns", controller.getCampaigns);
        router.post("/campaigns", controller.createCampaign);
        router.delete("/campaigns/:id", controller.deleteCampaign);

        router.get("/campaigns/:id/targets", controller.getCampaignTargets);
        router.post("/message/:logId", controller.sendOneMessage); // Manual trigger

        router.post("/estimate", controller.estimateRecipients);

        return router;
    }
}
