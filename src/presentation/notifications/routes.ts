import { Router } from 'express';
import { NotificationController } from './controller';
import { AuthMiddleware } from '../../middlewares/auth.middleware';
import { AuthMotorizadoMiddleware } from '../../middlewares/auth-motorizado.middleware';
import { AuthAdminMiddleware } from '../../middlewares/auth-admin.middleware';

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

    // Admins
    router.post('/register-admin', [AuthAdminMiddleware.protect], controller.registerTokenAdmin);
    // Para remover el admin, puede usar la misma logica de removeToken si pasamos un endpoint, pero para mantener la limpieza:
    // router.post('/remove-admin', [AuthAdminMiddleware.protect], controller.removeTokenAdmin); // Si se llegase a necesitar. Usaremos removeToken por ahora ya que borra por token y no requiere ID de usuario en el controller original.

    return router;
  }
}
