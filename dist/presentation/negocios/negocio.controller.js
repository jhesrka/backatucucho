"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NegocioController = void 0;
const domain_1 = require("../../domain");
const CreateNegocioDTO_1 = require("../../domain/dtos/negocios/CreateNegocioDTO");
class NegocioController {
    constructor(negocioService) {
        this.negocioService = negocioService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        // ======================= CREATE ========================
        this.createNegocio = (req, res) => {
            const [error, dto] = CreateNegocioDTO_1.CreateNegocioDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.negocioService
                .createNegocio(dto, req.file) // 👈 admite imagen
                .then((negocio) => res.status(201).json(negocio))
                .catch((error) => this.handleError(error, res));
        };
        // ======================= READ ==========================
        this.getNegociosByCategoria = (req, res) => {
            const { categoriaId } = req.params;
            this.negocioService
                .getNegociosByCategoria(categoriaId)
                .then((negocios) => res.status(200).json(negocios))
                .catch((error) => {
                if (error instanceof domain_1.CustomError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                console.error("Unhandled error:", error);
                return res.status(500).json({ message: "Something went very wrong" });
            });
        };
        // ================== TOGGLE ABIERTO / CERRADO ======================
        this.toggleEstadoNegocio = (req, res) => {
            const { id } = req.params;
            this.negocioService
                .toggleEstadoNegocio(id)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.getNegociosFiltrados = (req, res) => {
            const status = req.query.status;
            this.negocioService
                .getNegociosFiltrados(status)
                .then((negocios) => res.status(200).json(negocios))
                .catch((error) => this.handleError(error, res));
        };
        this.getNegociosByUserId = (req, res) => {
            const { userId } = req.params;
            this.negocioService
                .getNegociosByUsuarioId(userId)
                .then((negocios) => res.status(200).json(negocios))
                .catch((error) => this.handleError(error, res));
        };
        // ======================= UPDATE ========================
        this.updateNegocio = (req, res) => {
            const { id } = req.params;
            const body = req.body;
            this.negocioService
                .updateNegocio(id, body, req.file) // 👈 admite imagen
                .then((negocio) => res.status(200).json(negocio))
                .catch((error) => this.handleError(error, res));
        };
        // ======================= DELETE ========================
        this.deleteIfNotActivo = (req, res) => {
            const { id } = req.params;
            this.negocioService
                .deleteIfNotActivo(id)
                .then((mensaje) => res.status(200).json(mensaje))
                .catch((error) => this.handleError(error, res));
        };
        this.deleteNegocio = (req, res) => {
            const { id } = req.params;
            this.negocioService
                .deleteNegocio(id)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.paySubscription = (req, res) => {
            var _a;
            const { id } = req.params;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId)
                return res.status(401).json({ message: "Usuario no autenticado" });
            this.negocioService
                .paySubscription(id, userId)
                .then((result) => res.status(200).json({ success: true, message: "Suscripción pagada exitosamente", negocio: result }))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.NegocioController = NegocioController;
