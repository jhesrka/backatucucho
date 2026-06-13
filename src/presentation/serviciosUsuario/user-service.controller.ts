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

  toggleVisibility = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id;
    const { id } = req.params;
    this.userServiceService.toggleVisibility(userId, id)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  renewService = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id;
    const { id } = req.params;
    this.userServiceService.renewService(userId, id)
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

  deleteService = (req: Request, res: Response) => {
    const userId = req.body.sessionUser?.id || req.body.user?.id;
    const { id } = req.params;
    this.userServiceService.deleteService(userId, id)
      .then((result) => res.json(result))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  getPublicServicesByCategory = (req: Request, res: Response) => {
    const { categoriaId } = req.params;
    const { subcategoriaId, page = "1", limit = "10" } = req.query;
    this.userServiceService.getPublicServicesByCategory(
      categoriaId, 
      subcategoriaId as string | undefined, 
      parseInt(page as string), 
      parseInt(limit as string)
    )
      .then((services) => res.json(services))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  // ==================================
  // ADMIN GLOBAL MANAGEMENT
  // ==================================

  getAllServicesAdmin = (req: Request, res: Response) => {
    const { page = "1", limit = "10", search = "", status = "", categoriaId = "" } = req.query;
    this.userServiceService.getAllServicesAdmin(
      parseInt(page as string),
      parseInt(limit as string),
      search as string,
      status as string,
      categoriaId as string
    )
      .then((services) => res.json(services))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  }

  changeServiceStatusAdmin = (req: Request, res: Response) => {
    const { id } = req.params;
    const { newStatus, isVisible } = req.body;
    this.userServiceService.changeServiceStatusAdmin(id, newStatus, isVisible)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  }

  extendServiceDaysAdmin = (req: Request, res: Response) => {
    const { id } = req.params;
    const { daysToAdd } = req.body;
    this.userServiceService.extendServiceDaysAdmin(id, parseInt(daysToAdd))
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  }

  editServiceAdmin = (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    this.userServiceService.editServiceAdmin(id, data)
      .then((service) => res.json(service))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  }

  deleteServiceAdmin = (req: Request, res: Response) => {
    const { id } = req.params;
    this.userServiceService.deleteServiceAdmin(id)
      .then(() => res.json({ message: "Servicio eliminado exitosamente" }))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  }
}
