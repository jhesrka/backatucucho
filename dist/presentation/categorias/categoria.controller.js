"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriaController = void 0;
const domain_1 = require("../../domain");
const CreateCategoriaDTO_1 = require("../../domain/dtos/categoriaProductos/CreateCategoriaDTO");
const UpdateCategoriaDTO_1 = require("../../domain/dtos/categoriaProductos/UpdateCategoriaDTO");
// =============== CATEGORIA CONTROLLER ===============
class CategoriaController {
    constructor(categoriaService) {
        this.categoriaService = categoriaService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        // Crear categoría
        this.createCategoria = (req, res) => {
            const [error, dto] = CreateCategoriaDTO_1.CreateCategoriaDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.categoriaService
                .createCategoria(dto)
                .then((categoria) => res.status(201).json(categoria))
                .catch((error) => this.handleError(error, res));
        };
        // Obtener todas las categorías
        this.getAllCategorias = (_req, res) => {
            this.categoriaService
                .getAllCategorias()
                .then((categorias) => res.status(200).json(categorias))
                .catch((error) => this.handleError(error, res));
        };
        // Obtener categoría por ID
        this.getCategoriaById = (req, res) => {
            const id = req.params.id;
            this.categoriaService
                .getCategoriaById(id)
                .then((categoria) => res.status(200).json(categoria))
                .catch((error) => this.handleError(error, res));
        };
        // Actualizar categoría
        this.updateCategoria = (req, res) => {
            const id = req.params.id;
            const [error, dto] = UpdateCategoriaDTO_1.UpdateCategoriaDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.categoriaService
                .updateCategoria(id, dto)
                .then((categoria) => res.status(200).json(categoria))
                .catch((error) => this.handleError(error, res));
        };
        // Eliminar categoría
        this.deleteCategoria = (req, res) => {
            const id = req.params.id;
            this.categoriaService
                .deleteCategoria(id)
                .then(() => res.status(204).send())
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.CategoriaController = CategoriaController;
