import { Router } from "express";
import { SubcategoriaController } from "../controller/administradorController/subcategoria.controller";
import { SubcategoriaService } from "../services/subcategoria.service";

export class SubcategoriaRoutes {
  static get routes(): Router {
    const router = Router();
    const service = new SubcategoriaService();
    const controller = new SubcategoriaController(service);

    router.post("/", controller.create);
    router.get("/categoria/:categoriaId", controller.getByCategoria);
    router.put("/:id", controller.update);
    router.delete("/:id", controller.delete);

    return router;
  }
}
