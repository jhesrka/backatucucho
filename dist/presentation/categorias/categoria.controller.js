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
            var _a, _b;
            const [error, dto] = CreateCategoriaDTO_1.CreateCategoriaDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            const files = req.files;
            const iconFile = (_a = files === null || files === void 0 ? void 0 : files.imagen) === null || _a === void 0 ? void 0 : _a[0];
            const coverFile = (_b = files === null || files === void 0 ? void 0 : files.coverImage) === null || _b === void 0 ? void 0 : _b[0];
            if (!iconFile) {
                return res.status(422).json({ message: "La imagen de la categoría es obligatoria" });
            }
            const { masterPin } = req.body;
            if (!masterPin)
                return res.status(400).json({ message: "Master PIN es requerido" });
            this.categoriaService
                .createCategoria(dto, iconFile, masterPin, coverFile)
                .then((categoria) => res.status(201).json(categoria))
                .catch((error) => this.handleError(error, res));
        };
        // Obtener todas las categorías (ADMIN)
        this.getAllCategorias = (_req, res) => {
            this.categoriaService
                .getAllCategorias()
                .then((categorias) => res.status(200).json(categorias))
                .catch((error) => this.handleError(error, res));
        };
        // Seed de Categorías de Negocio
        this.seedBusinessCategories = (_req, res) => {
            this.categoriaService
                .seedBusinessCategories()
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        // Obtener todas las categorías (USUARIO PUBLICO) - Filtradas por ACTIVO
        this.getAllCategoriasUser = (_req, res) => {
            this.categoriaService
                .getAllCategorias("ACTIVO") // 🔐 Solo ACTIVOS
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
            var _a, _b;
            const id = req.params.id;
            const [error, dto] = UpdateCategoriaDTO_1.UpdateCategoriaDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            const files = req.files;
            const iconFile = (_a = files === null || files === void 0 ? void 0 : files.imagen) === null || _a === void 0 ? void 0 : _a[0];
            const coverFile = (_b = files === null || files === void 0 ? void 0 : files.coverImage) === null || _b === void 0 ? void 0 : _b[0];
            const { masterPin } = req.body;
            if (!masterPin)
                return res.status(400).json({ message: "Master PIN es requerido" });
            this.categoriaService
                .updateCategoria(id, dto, iconFile, masterPin, coverFile)
                .then((categoria) => res.status(200).json(categoria))
                .catch((error) => this.handleError(error, res));
        };
        // Eliminar categoría
        this.deleteCategoria = (req, res) => {
            const id = req.params.id;
            const { masterPin } = req.body;
            if (!masterPin)
                return res.status(400).json({ message: "Master PIN es requerido" });
            this.categoriaService
                .deleteCategoria(id, masterPin)
                .then(() => res.status(204).send())
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.CategoriaController = CategoriaController;
