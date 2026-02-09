"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductoController = void 0;
const domain_1 = require("../../domain");
const CreateProductoDTO_1 = require("../../domain/dtos/productos/CreateProductoDTO");
const UpdateProductoDTO_1 = require("../../domain/dtos/productos/UpdateProductoDTO");
class ProductoController {
    constructor(productoService) {
        this.productoService = productoService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        // ======================== CREATE ========================
        this.createProducto = (req, res) => {
            const file = req.file;
            if (!file) {
                return res
                    .status(400)
                    .json({ message: "La imagen del producto es obligatoria" });
            }
            const [error, dto] = CreateProductoDTO_1.CreateProductoDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            // Validar explícitamente que venga tipoId
            if (!(dto === null || dto === void 0 ? void 0 : dto.tipoId)) {
                return res.status(422).json({ message: "Debes proporcionar tipoId" });
            }
            this.productoService
                .createProducto(dto, file)
                .then((producto) => res.status(201).json(producto))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== READ por negocio ========================
        this.getProductosPorNegocio = (req, res) => {
            const { negocioId } = req.params;
            if (!negocioId) {
                return res.status(400).json({ message: "Falta el ID del negocio" });
            }
            this.productoService
                .getProductosByNegocio(negocioId)
                .then((productos) => res.status(200).json(productos))
                .catch((error) => this.handleError(error, res));
        };
        this.getProductosDisponiblesPorNegocio = (req, res) => {
            const { negocioId } = req.params;
            if (!negocioId) {
                return res.status(400).json({ message: "Falta el ID del negocio" });
            }
            this.productoService
                .getProductosDisponiblesByNegocio(negocioId)
                .then((productos) => res.status(200).json(productos))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== TOGGLE DISPONIBLE ========================
        this.toggleEstadoProducto = (req, res) => {
            const { id } = req.params;
            const { disponible } = req.body;
            if (typeof disponible !== "boolean") {
                return res
                    .status(400)
                    .json({ message: "El valor de 'disponible' debe ser booleano" });
            }
            this.productoService
                .toggleDisponible(id, disponible)
                .then((producto) => res.status(200).json(producto))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== UPDATE ========================
        this.updateProducto = (req, res) => {
            const { id } = req.params;
            const file = req.file;
            const [error, dto] = UpdateProductoDTO_1.UpdateProductoDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            // Validar que tipoId esté presente si se envía
            if (dto && dto.tipoId === undefined) {
                return res.status(422).json({ message: "Debes proporcionar tipoId" });
            }
            this.productoService
                .updateProducto(id, dto, file)
                .then((producto) => res.status(200).json(producto))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== DELETE ========================
        this.deleteProducto = (req, res) => {
            const { id } = req.params;
            this.productoService
                .deleteProducto(id)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.ProductoController = ProductoController;
