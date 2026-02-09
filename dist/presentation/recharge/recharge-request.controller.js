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
exports.RechargeRequestController = void 0;
const domain_1 = require("../../domain");
const data_1 = require("../../data");
class RechargeRequestController {
    constructor(rechargeService) {
        this.rechargeService = rechargeService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        //USUARIO
        //CREAR UNA RECARGA
        this.createRecharge = (req, res) => {
            const [error, createRechargedto] = domain_1.CreateRechargeRequestDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.rechargeService
                .createRecharge(createRechargedto, req.file)
                .then((data) => {
                const responseDTO = domain_1.RechargeResponseDTO.fromEntity(data);
                res.status(201).json(responseDTO);
            })
                .catch((error) => this.handleError(error, res));
        };
        // SCAN RECEIPT
        this.scanReceipt = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.rechargeService.analyzeReceipt(req.file);
                res.json({ success: true, data });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // OBTENER RECARGAS POR PAGINACION DE 5 USUARIO LOGEADO
        this.getRechargeRequestsByUser = (req, res) => {
            const { userId } = req.params;
            const page = parseInt(req.query.page) || 1;
            this.rechargeService
                .getByUser(userId, page)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // ✅ Filtrar por estado
        this.filterByStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { status } = req.params;
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = parseInt(req.query.itemsPerPage) || 3; // Hacer configurable
            // Validar el estado
            if (!Object.values(data_1.StatusRecarga).includes(status)) {
                return res.status(400).json({ message: "Estado inválido" });
            }
            try {
                // Obtener usuario autenticado del middleware
                const sessionUser = req.body.sessionUser;
                // Si no hay usuario (ruta de admin) o si es ruta de usuario específico
                const userId = req.params.userId || (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id);
                const result = yield this.rechargeService.filterByStatus(status, userId, // undefined para admin, userId para usuario
                page, itemsPerPage);
                // Mantener formato de respuesta consistente
                return res.status(200).json({
                    success: true,
                    data: result.data,
                    pagination: {
                        total: result.total,
                        currentPage: result.currentPage,
                        totalPages: result.totalPages,
                        itemsPerPage,
                    },
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ✅ Filtrar por rango de fechas (USUARIO LOGEADO)
        this.filterByDateRange = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { startDate, endDate, page = "1", itemsPerPage = "9" } = req.query;
            const { userId } = req.params;
            // Obtener usuario del middleware (que está en req.body.sessionUser)
            const sessionUser = req.body.sessionUser;
            // Validaciones de seguridad
            if (!sessionUser) {
                return res.status(401).json({ message: "Usuario no autenticado" });
            }
            if (String(sessionUser.id) !== String(userId)) {
                console.error("IDs no coinciden:", {
                    autenticado: sessionUser.id,
                    solicitado: userId,
                });
                return res.status(403).json({
                    message: "No autorizado para consultar estas recargas",
                    detail: "El ID del usuario no coincide con el token",
                });
            }
            if (!startDate || !endDate) {
                return res.status(400).json({
                    message: "Debe proporcionar startDate y endDate",
                });
            }
            try {
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    return res.status(400).json({ message: "Formato de fecha inválido" });
                }
                const pageNumber = parseInt(page);
                const perPage = parseInt(itemsPerPage);
                if (pageNumber < 1 || perPage < 1) {
                    return res.status(400).json({
                        message: "Los parámetros de paginación deben ser positivos",
                    });
                }
                // Llamar al servicio
                const result = yield this.rechargeService.filterByDateRangeForUser(userId, start, end, pageNumber, perPage);
                return res.status(200).json({
                    success: true,
                    data: result.data,
                    pagination: {
                        total: result.total,
                        currentPage: result.currentPage,
                        totalPages: result.totalPages,
                        itemsPerPage: perPage,
                    },
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        //ADMINISTRADOR
        //1
        this.getAllRequestsPaginated = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const page = parseInt(req.query.page) || 1;
            try {
                const result = yield this.rechargeService.getAllRequestsPaginated(page);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 2 ✅ Búsqueda por término
        this.searchRechargeRequests = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const term = req.query.term;
            if (!term) {
                return res
                    .status(400)
                    .json({ message: "El parámetro 'term' es requerido" });
            }
            try {
                const results = yield this.rechargeService.searchRechargeRequests(term);
                return res.status(200).json(results);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        //3
        this.getAllRechargeRequests = (_req, res) => {
            this.rechargeService
                .getAllRechargeRequests()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        //4
        // ✅ Filtrar por rango de fechas con paginación (ADMIN)
        this.filterByDateRangePaginated = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { startDate, endDate } = req.query;
            const page = parseInt(req.query.page) || 1;
            if (!startDate || !endDate) {
                return res
                    .status(400)
                    .json({ message: "Debe proporcionar startDate y endDate en la query" });
            }
            try {
                const start = new Date(startDate);
                const end = new Date(endDate);
                // Validación de fechas
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    return res.status(400).json({ message: "Formato de fecha inválido" });
                }
                const perPage = parseInt(req.query.itemsPerPage) || 9;
                const result = yield this.rechargeService.filterByDateRangePaginated(start, end, page, perPage);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        //5 ✅ Actualizar estado de una solicitud de recarga (ADMIN)
        this.updateStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = req.params.id;
            const { status, adminComment, bank_name, amount, transaction_date, receipt_number, } = req.body;
            if (!status) {
                return res
                    .status(400)
                    .json({ message: "El campo 'status' es obligatorio" });
            }
            try {
                const result = yield this.rechargeService.updateStatus(id, status, adminComment, bank_name, amount, transaction_date, receipt_number);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        //6
        this.exportToCSVByDate = (req, res) => __awaiter(this, void 0, void 0, function* () {
            // Obtiene fechas desde query params
            const { startDate, endDate } = req.query;
            // Validación básica: ambas fechas deben estar presentes
            if (!startDate || !endDate) {
                return res.status(400).json({
                    message: "Debe proporcionar startDate y endDate en la query",
                });
            }
            // Convierte a Date y valida formato
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({ message: "Formato de fecha inválido" });
            }
            try {
                // Llama al service para obtener el CSV
                const csv = yield this.rechargeService.exportToCSVByDate(start, end);
                // Configura cabeceras para descarga de archivo CSV
                res.header("Content-Type", "text/csv");
                res.attachment(`recharges_${startDate}_${endDate}.csv`);
                // Envía el CSV generado
                return res.send(csv);
            }
            catch (error) {
                // Maneja errores (puedes personalizar este método)
                return this.handleError(error, res);
            }
        });
        //7
        // recharge-request.controller.ts
        this.filterByStatusAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { status } = req.params;
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = parseInt(req.query.itemsPerPage) || 3;
            if (!Object.values(data_1.StatusRecarga).includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Estado inválido. Valores permitidos: ${Object.values(data_1.StatusRecarga).join(", ")}`,
                });
            }
            try {
                const result = yield this.rechargeService.filterByStatusAdmin(status, // Tipo correcto
                page, // number
                itemsPerPage // number
                );
                return res.status(200).json({
                    success: true,
                    data: result.data,
                    pagination: {
                        total: result.total,
                        currentPage: result.currentPage,
                        totalPages: result.totalPages,
                        itemsPerPage: itemsPerPage, // Usamos el valor del controlador
                    },
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 8. Eliminar solicitudes de recarga viejas (más de 2 días como prueba)
        this.deleteOldRechargeRequests = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.rechargeService.deleteOldRechargeRequests();
                return res.status(200).json({
                    success: true,
                    message: result.message,
                    deleted: result.deleted,
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 9 REVERSAR RECARGA
        this.reverseRecharge = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // req.body.sessionUser comes from AuthAdminMiddleware
            const adminUser = req.body.sessionAdmin || req.body.sessionUser;
            try {
                const result = yield this.rechargeService.reverseRecharge(id, adminUser);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 10 Configurar Purga
        this.configurePurge = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { pin, days } = req.body;
            try {
                const result = yield this.rechargeService.configurePurge(pin, days);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
    }
}
exports.RechargeRequestController = RechargeRequestController;
