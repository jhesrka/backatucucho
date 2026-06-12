import { Router } from "express";
import { ServiceCategoryController } from "./service-category.controller";
import { UserServiceController } from "./user-service.controller";
import { ServiceCategoryService } from "../services/serviciosUsuario/service-category.service";
import { UserServiceService } from "../services/serviciosUsuario/user-service.service";
import { AuthMiddleware } from "../../middlewares/auth.middleware";
import { AuthAdminMiddleware } from "../../middlewares/auth-admin.middleware";
import { UserRole, UserRoleAdmin } from "../../data";

export class ServiciosUsuarioRoutes {
  static get routes(): Router {
    const router = Router();

    const categorySvc = new ServiceCategoryService();
    const categoryCtrl = new ServiceCategoryController(categorySvc);

    const userSvc = new UserServiceService();
    const userCtrl = new UserServiceController(userSvc);

    // ===================================
    // RUTAS PÚBLICAS
    // ===================================
    router.get("/categorias/public", categoryCtrl.getPublicCategories);
    router.get("/categoria/:categoriaId/public", userCtrl.getPublicServicesByCategory);

    // Ruta para creación de servicios (usuarios que publican)
    router.get("/categorias/activas", categoryCtrl.getActiveCategoriesForCreation);

    // ===================================
    // RUTAS ADMIN
    // ===================================
    router.get("/admin/categorias", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.getAllCategoriesAdmin);
    router.post("/admin/categorias", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.createCategory);
    router.put("/admin/categorias/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.updateCategory);
    
    router.post("/admin/categorias/:categoriaId/subcategorias", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.createSubcategory);
    router.put("/admin/subcategorias/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.updateSubcategory);

    router.delete("/admin/categorias/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.deleteCategory);
    router.delete("/admin/subcategorias/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.deleteSubcategory);

    router.post("/admin/seed-categorias", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), categoryCtrl.seedCategories);

    router.get("/admin/pendientes", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), userCtrl.getAllPendingServices);
    router.put("/admin/aprobar/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), userCtrl.approveService);
    router.put("/admin/rechazar/:id", AuthAdminMiddleware.protect, AuthAdminMiddleware.restrictTo(UserRoleAdmin.ADMIN), userCtrl.rejectService);

    // ===================================
    // RUTAS USUARIO
    // ===================================
    router.post("/user/crear", AuthMiddleware.protect, userCtrl.createService);
    router.get("/user/mis-servicios", AuthMiddleware.protect, userCtrl.getMyServices);
    router.put("/user/mis-servicios/:id", AuthMiddleware.protect, userCtrl.updatePendingService);
    router.put("/user/mis-servicios/:id/toggle-autorenovacion", AuthMiddleware.protect, userCtrl.toggleAutoRenewal);

    return router;
  }
}
