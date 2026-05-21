import { Router } from 'express';
import { TrainingController } from './training.controller';
import { AuthAdminMiddleware } from '../../middlewares/auth-admin.middleware';

export class TrainingRoutes {
  static get routes(): Router {
    const router = Router();

    // Rutas públicas
    router.get('/public', TrainingController.getPublicVideos);

    // Rutas privadas (Admin)
    router.use(AuthAdminMiddleware.protect);
    
    router.get('/', TrainingController.getAllVideos);
    router.post('/', TrainingController.createVideo);
    router.put('/:id', TrainingController.updateVideo);
    router.delete('/:id', TrainingController.deleteVideo);
    router.patch('/:id/toggle-status', TrainingController.toggleVideoStatus);

    // Rutas privadas (Admin) - Categorías
    router.get('/categories/all', TrainingController.getCategories);
    router.post('/categories', TrainingController.createCategory);
    router.put('/categories/:id', TrainingController.updateCategory);
    router.delete('/categories/:id', TrainingController.deleteCategory);

    return router;
  }
}
