import { Router } from 'express';
import { MeritocracyController } from './meritocracy.controller';
import { MeritocracyService } from '../services/pedidosServices/meritocracy.service';

export class MeritocracyRoutes {
  static get routes(): Router {
    const router = Router();
    const service = new MeritocracyService();
    const controller = new MeritocracyController(service);

    router.get('/ranking', controller.getLiveRanking);
    router.get('/tiers', controller.getTiers);
    router.post('/evaluate', controller.processUpdate);
    router.post('/tiers', controller.updateTiers);
    router.delete('/tiers/:id', controller.deleteTier);

    return router;
  }
}
