import { Router } from "express";
import { SubcategoriaController } from "../controller/administradorController/subcategoria.controller";
import { SubcategoriaService } from "../services/subcategoria.service";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";

export class SubcategoriaRoutes {
  static get routes(): Router {
    const router = Router();
    const service = new SubcategoriaService();
    const controller = new SubcategoriaController(service);

    router.post("/", AuthAdminMiddleware.protect, controller.create);
    router.get("/categoria/:categoriaId", controller.getByCategoria);
    router.put("/:id", AuthAdminMiddleware.protect, controller.update);
    router.delete("/:id", AuthAdminMiddleware.protect, controller.delete);

    return router;
  }
}
