"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductoControllerAdmin = void 0;
const domain_1 = require("../../domain");
const data_1 = require("../../data");
class ProductoControllerAdmin {
    constructor(productoServiceAdmin) {
        this.productoServiceAdmin = productoServiceAdmin;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("❌ Error en ProductoControllerAdmin:", error);
            return res
                .status(500)
                .json({ message: "Ocurrió un error inesperado en el servidor" });
        };
        // ======================== GET PRODUCTOS ADMIN ========================
        this.getProductosAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { limit, offset, status, search, negocioId } = req.query;
                const parsedLimit = limit ? Number(limit) : 5;
                const parsedOffset = offset ? Number(offset) : 0;
                const parsedStatus = status ? String(status).toUpperCase() : undefined;
                const parsedNegocioId = negocioId ? String(negocioId) : undefined;
                // Validaciones básicas
                if (isNaN(parsedLimit) || parsedLimit < 0)
                    return res
                        .status(400)
                        .json({ message: "El parámetro 'limit' no es válido" });
                if (isNaN(parsedOffset) || parsedOffset < 0)
                    return res
                        .status(400)
                        .json({ message: "El parámetro 'offset' no es válido" });
                if (parsedStatus &&
                    !Object.values(data_1.StatusProducto).includes(parsedStatus)) {
                    return res.status(400).json({ message: "Estado de producto inválido" });
                }
                // Llamada al service
                const result = yield this.productoServiceAdmin.getProductosAdmin({
                    limit: parsedLimit,
                    offset: parsedOffset,
                    status: parsedStatus,
                    search: search ? String(search) : undefined,
                    negocioId: parsedNegocioId,
                });
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ======================== UPDATE PRODUCTO ADMIN ========================
        this.updateProductoAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { nombre, descripcion, precio_venta, precio_app, disponible, statusProducto, } = req.body;
                const imagen = req.file; // si usas multer para subir archivos
                const result = yield this.productoServiceAdmin.updateProductoAdmin(id, {
                    nombre,
                    descripcion,
                    precio_venta: precio_venta ? Number(precio_venta) : undefined,
                    precio_app: precio_app ? Number(precio_app) : undefined,
                    disponible: disponible !== undefined
                        ? disponible === "true"
                        : undefined,
                    statusProducto: statusProducto
                        ? String(statusProducto).toUpperCase()
                        : undefined,
                    imagen,
                });
                return res.status(200).json({
                    message: "Producto actualizado correctamente",
                    producto: result,
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.changeStatusProductoAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { status } = req.body;
            if (!status)
                return res.status(400).json({ message: "Status required" });
            try {
                const result = yield this.productoServiceAdmin.changeStatusProductoAdmin(id, status);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.deleteProductoAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const result = yield this.productoServiceAdmin.deleteProductoAdmin(id);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
    }
}
exports.ProductoControllerAdmin = ProductoControllerAdmin;
