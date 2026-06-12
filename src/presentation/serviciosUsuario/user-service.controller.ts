import { Request, Response } from "express";
import { UserServiceService } from "../services/serviciosUsuario/user-service.service";

export class UserServiceController {
  constructor(private readonly userServiceService: UserServiceService) {}

  createService = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id; // asumiendo middleware auth
    const data = req.body;
    this.userServiceService.createService(userId, data)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  getMyServices = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id;
    this.userServiceService.getMyServices(userId)
      .then((services) => res.json(services))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  toggleAutoRenewal = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id;
    const { id } = req.params;
    this.userServiceService.toggleAutoRenewal(userId, id)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  updatePendingService = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id;
    const { id } = req.params;
    const data = req.body;
    this.userServiceService.updatePendingService(userId, id, data)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  getAllPendingServices = (req: Request, res: Response) => {
    this.userServiceService.getAllPendingServices()
      .then((services) => res.json(services))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  approveService = (req: Request, res: Response) => {
    const adminId = req.body.sessionAdmin?.id || req.body.admin?.id;
    const { id } = req.params;
    this.userServiceService.approveService(adminId, id)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  rejectService = (req: Request, res: Response) => {
    const adminId = req.body.sessionAdmin?.id || req.body.admin?.id;
    const { id } = req.params;
    const { motivo } = req.body;
    this.userServiceService.rejectService(adminId, id, motivo)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  getPublicServicesByCategory = (req: Request, res: Response) => {
    const { categoriaId } = req.params;
    this.userServiceService.getPublicServicesByCategory(categoriaId)
      .then((services) => res.json(services))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };
}
