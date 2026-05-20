import { Request, Response } from 'express';
import { MeritocracyService } from '../services/pedidosServices/meritocracy.service';
import { CustomError } from '../../domain';
import { GlobalSettings } from '../../data';
import bcrypt from 'bcryptjs';

export class MeritocracyController {
  constructor(private readonly meritocracyService: MeritocracyService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.log(`${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  };

  getLiveRanking = (req: Request, res: Response) => {
    this.meritocracyService.getLiveRanking()
      .then(ranking => res.json(ranking))
      .catch(error => this.handleError(error, res));
  };

  getCycleStatus = (req: Request, res: Response) => {
    this.meritocracyService.getMeritocracyStatus()
      .then(status => res.json(status))
      .catch(error => this.handleError(error, res));
  };

  processUpdate = async (req: Request, res: Response) => {
    const { masterPin } = req.body;
    
    // Validar PIN Maestro
    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings || !settings.masterPin || !bcrypt.compareSync(masterPin, settings.masterPin)) {
        return res.status(401).json({ error: 'PIN Maestro inválido' });
    }
    
    this.meritocracyService.processTierUpdate('MANUAL')
      .then(result => res.json(result))
      .catch(error => this.handleError(error, res));
  };


  getTiers = (req: Request, res: Response) => {
    // Implementación rápida para obtener los tiers definidos
    // (Podrías mover esto al service)
    import('../../data').then(({ MotorizadoTier }) => {
        MotorizadoTier.find({ order: { minParticipationPercentage: 'DESC' } })
            .then(tiers => res.json(tiers))
            .catch(error => this.handleError(error, res));
    });
  };

  updateTiers = async (req: Request, res: Response) => {
    const { tiers, masterPin } = req.body;
    
    // Validar PIN Maestro
    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings || !settings.masterPin || !bcrypt.compareSync(masterPin, settings.masterPin)) {
        return res.status(401).json({ error: 'PIN Maestro inválido' });
    }

    this.meritocracyService.updateTiers(tiers)
      .then(results => res.json(results))
      .catch(error => this.handleError(error, res));
  };

  deleteTier = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { masterPin } = req.body;

    // Validar PIN Maestro
    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings || !settings.masterPin || !bcrypt.compareSync(masterPin, settings.masterPin)) {
        return res.status(401).json({ error: 'PIN Maestro inválido' });
    }

    this.meritocracyService.deleteTier(id)
        .then(success => res.json({ success }))
        .catch(error => this.handleError(error, res));
  };
}
