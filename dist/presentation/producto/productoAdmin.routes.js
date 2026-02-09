"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductoAdminRoutes = void 0;
const express_1 = require("express");
const productoAdmin_controller_1 = require("./productoAdmin.controller");
const middlewares_1 = require("../../middlewares");
const productoAdmin_service_1 = require("../services/productoAdmin.service");
const config_1 = require("../../config");
class ProductoAdminRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const productoServiceAdmin = new productoAdmin_service_1.ProductoServiceAdmin();
        const productoControllerAdmin = new productoAdmin_controller_1.ProductoControllerAdmin(productoServiceAdmin);
        // ======================== OBTENER PRODUCTOS ADMIN ========================
        // Sólo administradores pueden acceder
        router.get("/", middlewares_1.AuthAdminMiddleware.protect, productoControllerAdmin.getProductosAdmin);
        // ======================== ACTUALIZAR PRODUCTO ADMIN ========================
        router.patch("/:id", middlewares_1.AuthAdminMiddleware.protect, (0, config_1.uploadSingleFile)("imagen"), // 👈 usa tu helper multer configurado
        productoControllerAdmin.updateProductoAdmin);
        // NUEVO: Admin Change Status
        router.put("/status/:id", middlewares_1.AuthAdminMiddleware.protect, productoControllerAdmin.changeStatusProductoAdmin);
        // NUEVO: Admin Purge Definitive
        router.delete("/purge/:id", middlewares_1.AuthAdminMiddleware.protect, productoControllerAdmin.deleteProductoAdmin);
        return router;
    }
}
exports.ProductoAdminRoutes = ProductoAdminRoutes;
