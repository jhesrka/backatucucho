import { Router } from 'express';
import { NotificationController } from './controller';
import { AuthMiddleware } from '../../middlewares/auth.middleware';

export class NotificationRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new NotificationController();

    router.post('/register', [AuthMiddleware.protect], controller.registerToken);
    router.post('/remove', [AuthMiddleware.protect], controller.removeToken);

    return router;
  }
}
