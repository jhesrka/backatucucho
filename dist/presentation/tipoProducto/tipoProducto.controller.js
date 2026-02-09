"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipoProductoController = void 0;
const domain_1 = require("../../domain");
class TipoProductoController {
    constructor(tipoProductoService) {
        this.tipoProductoService = tipoProductoService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        // ======================== CREATE ========================
        this.createTipoProducto = (req, res) => {
            const { nombre, negocioId } = req.body;
            if (!nombre)
                return res.status(400).json({ message: "El nombre es obligatorio" });
            if (!negocioId)
                return res.status(400).json({ message: "Falta el ID del negocio" });
            this.tipoProductoService
                .createTipoProducto(nombre, negocioId)
                .then((tipo) => res.status(201).json(tipo))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== READ ========================
        this.getTiposByNegocio = (req, res) => {
            const { negocioId } = req.params;
            if (!negocioId)
                return res.status(400).json({ message: "Falta el ID del negocio" });
            this.tipoProductoService
                .getTiposByNegocio(negocioId)
                .then((tipos) => res.status(200).json(tipos))
                .catch((error) => this.handleError(error, res));
        };
        // ======================== DELETE ========================
        this.deleteTipoProducto = (req, res) => {
            const { id } = req.params;
            if (!id)
                return res.status(400).json({ message: "Falta el id del tipo" });
            this.tipoProductoService
                .deleteTipo(id)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.TipoProductoController = TipoProductoController;
