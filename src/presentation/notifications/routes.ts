import { Router } from 'express';
import { NotificationController } from './controller';
import { AuthMiddleware } from '../../middlewares/auth.middleware';
import { AuthMotorizadoMiddleware } from '../../middlewares/auth-motorizado.middleware';

export class NotificationRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = new NotificationController();

    // Clientes, Admins, Negocios
    router.post('/register', [AuthMiddleware.protect], controller.registerToken);
    router.post('/remove', [AuthMiddleware.protect], controller.removeToken);

    // Motorizados
    router.post('/register-motorizado', [AuthMotorizadoMiddleware.protect], controller.registerTokenMotorizado);
    router.post('/remove-motorizado', [AuthMotorizadoMiddleware.protect], controller.removeTokenMotorizado);

    return router;
  }
}
