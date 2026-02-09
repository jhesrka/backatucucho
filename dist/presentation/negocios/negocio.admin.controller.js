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
exports.NegocioAdminController = void 0;
const domain_1 = require("../../domain");
const data_1 = require("../../data");
const CreateNegocioDTO_1 = require("../../domain/dtos/negocios/CreateNegocioDTO");
const UpdateNegocioDTO_1 = require("../../domain/dtos/negocios/UpdateNegocioDTO");
const subscription_service_1 = require("../services/subscription.service");
class NegocioAdminController {
    constructor(negocioAdminService, subscriptionService = new subscription_service_1.SubscriptionService()) {
        this.negocioAdminService = negocioAdminService;
        this.subscriptionService = subscriptionService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            // Si no es un CustomError, intentamos extraer el mensaje para ser claros con el Admin
            const message = error instanceof Error ? error.message : "Error interno no controlado";
            console.error("Unhandled error:", error);
            return res.status(500).json({
                message: `Error de Sistema: ${message}`,
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        };
        // ===================== GET ALL CON FILTROS Y PAGINACIÓN =====================
        this.getNegociosAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Extraemos el status raw (string)
                const statusRaw = req.query.status;
                // Validamos que sea un valor válido del enum StatusNegocio
                const statusEnum = statusRaw &&
                    Object.values(data_1.StatusNegocio).includes(statusRaw)
                    ? statusRaw
                    : undefined;
                const filtros = {
                    status: statusEnum,
                    categoriaId: req.query.categoriaId,
                    userId: req.query.userId,
                    search: req.query.search,
                    limit: Number(req.query.limit) || 10,
                    offset: Number(req.query.offset) || 0,
                };
                const data = yield this.negocioAdminService.getNegociosAdmin(filtros);
                return res.status(200).json(data);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ========================= EXPORTAR A CSV =========================
        this.exportNegociosToCSV = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const filtros = {
                    status: req.query.status,
                    categoriaId: req.query.categoriaId,
                    userId: req.query.userId,
                    search: req.query.search,
                };
                const buffer = yield this.negocioAdminService.exportNegociosToCSV(filtros);
                res.setHeader("Content-Disposition", "attachment; filename=negocios.csv");
                res.setHeader("Content-Type", "text/csv");
                return res.send(buffer);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ========================= GET BY ID =========================
        this.getNegocioByIdAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const negocio = yield this.negocioAdminService.getNegocioByIdAdmin(id);
                return res.status(200).json(negocio);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ========================= CREATE =========================
        this.createNegocioAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const [error, dto] = CreateNegocioDTO_1.CreateNegocioDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            try {
                const negocio = yield this.negocioAdminService.createNegocioAdmin(dto, req.file);
                return res.status(201).json(negocio);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ========================= UPDATE =========================
        this.updateNegocioAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // Usamos el DTO que creamos
            const [error, dto] = UpdateNegocioDTO_1.UpdateNegocioDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            try {
                const negocioActualizado = yield this.negocioAdminService.updateNegocioAdmin(id, dto);
                return res.status(200).json(negocioActualizado);
            }
            catch (err) {
                this.handleError(err, res);
            }
        });
        // ========================= DELETE =========================
        this.deleteNegocioAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const result = yield this.negocioAdminService.deleteNegocioAdmin(id);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ================== TOGGLE ABIERTO / CERRADO ======================
        this.toggleEstadoNegocioAdmin = (req, res) => {
            const { id } = req.params;
            this.negocioAdminService
                .toggleEstadoNegocioAdmin(id)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        // ================== NUEVO MÉTODO: ESTADÍSTICAS ======================
        this.getNegociosStatsAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield this.negocioAdminService.getNegociosStatsAdmin();
                return res.status(200).json(stats);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.changeStatusNegocioAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { status } = req.body;
            if (!status)
                return res.status(400).json({ message: "Status required" });
            try {
                const result = yield this.negocioAdminService.changeStatusNegocioAdmin(id, status);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.purgeNegocioAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const result = yield this.negocioAdminService.purgeNegocioAdmin(id);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ADMIN: Get All Businesses of User
        this.getNegociosByUserAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params; // userId
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                if (!id)
                    return res.status(400).json({ message: "User ID is required" });
                const data = yield this.negocioAdminService.getNegociosByUserAdmin(id, page, limit);
                return res.status(200).json(Object.assign({ success: true }, data));
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        this.forceChargeSubscription = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params; // negocioId
            try {
                const updatedNegocio = yield this.subscriptionService.forceChargeSubscription(id);
                return res.status(200).json({
                    success: true,
                    message: "Cobro realizado correctamente y período activado",
                    negocio: updatedNegocio
                });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
    }
}
exports.NegocioAdminController = NegocioAdminController;
