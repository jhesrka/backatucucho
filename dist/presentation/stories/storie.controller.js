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
exports.StorieController = void 0;
const domain_1 = require("../../domain");
const CreateStorie_dto_1 = require("../../domain/dtos/stories/CreateStorie.dto");
class StorieController {
    constructor(storieService) {
        this.storieService = storieService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        this.createStorie = (req, res) => {
            const [error, createStorieDto] = CreateStorie_dto_1.CreateStorieDTO.create(req.body);
            if (error) {
                return res.status(422).json({ message: error });
            }
            this.storieService
                .createStorie(createStorieDto, req.file)
                .then((data) => {
                res.status(201).json(data);
            })
                .catch((error) => {
                console.error("Error en createStorie:", error);
                return res
                    .status(500)
                    .json({ message: error.message || "Unknown error" });
            });
        };
        this.findAllStorie = (req, res) => {
            this.storieService
                .findAllStorie()
                .then((data) => {
                res.status(201).json(data);
            })
                .catch((error) => this.handleError(error, res));
        };
        // 🆕 Eliminar historia (soft o hard delete)
        this.deleteStorie = (req, res) => {
            var _a;
            const { id } = req.params;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id; // Igual que en posts
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            this.storieService
                .deleteStorie(id, userId)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.getStoriesByUser = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const sessionUser = req.body.sessionUser;
            if (!(sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id)) {
                return res.status(401).json({
                    success: false,
                    message: "Usuario no autenticado o sesión inválida",
                });
            }
            if (!this.isValidUUID(sessionUser.id)) {
                return res.status(400).json({
                    success: false,
                    message: "ID de usuario no válido",
                });
            }
            try {
                const stories = yield this.storieService.getStoriesByUser(sessionUser.id);
                return res.status(200).json({
                    success: true,
                    stories,
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // --------- ADMIN ---------
        // 1) Buscar story por ID (admin)
        this.findStorieByIdAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!this.isValidUUID(id)) {
                return res.status(400).json({ message: "ID de story inválido" });
            }
            try {
                const story = yield this.storieService.findStorieByIdAdmin(id);
                return res.status(200).json({ success: true, story });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 2) Bloquear / Desbloquear story (toggle)
        this.blockStorieAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!this.isValidUUID(id)) {
                return res.status(400).json({ message: "ID de story inválido" });
            }
            try {
                const { message, status } = yield this.storieService.blockStorieAdmin(id);
                return res.status(200).json({ success: true, status, message });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 3) Purgar stories DELETED (>3 días)
        this.purgeDeletedStoriesOlderThan3Days = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { deletedCount } = yield this.storieService.purgeDeletedStoriesOlderThan3Days();
                return res.status(200).json({ success: true, deletedCount });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // Total de historias publicadas (activas: no expiradas)
        this.countPaidStories = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const total = yield this.storieService.countPaidStories();
                return res.status(200).json({ success: true, total });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // Historias publicadas en las últimas 24 horas (y activas)
        this.countPaidStoriesLast24h = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const total = yield this.storieService.countPaidStoriesLast24h();
                return res.status(200).json({ success: true, total, windowHours: 24 });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ADMIN: Change status explicitly
        this.changeStatusStorieAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { status } = req.body;
            if (!status)
                return res.status(400).json({ message: "Status is required" });
            this.storieService.changeStatusStorieAdmin(id, status)
                .then(data => res.status(200).json(data))
                .catch(err => this.handleError(err, res));
        });
        // ADMIN: Purge definitive
        this.purgeStorieAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            this.storieService.purgeStorieAdmin(id)
                .then(data => res.status(200).json(data))
                .catch(err => this.handleError(err, res));
        });
        // ADMIN: Get All Stories of User
        this.getStoriesByUserAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params; // userId
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                if (!id)
                    return res.status(400).json({ message: "User ID is required" });
                const data = yield this.storieService.getStoriesByUserAdmin(id, page, limit);
                return res.status(200).json(Object.assign({ success: true }, data));
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 4) Get Admin Stats
        this.getAdminStats = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield this.storieService.getAdminStats();
                return res.json(stats);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 5) Get All Stories Admin (Filtered)
        this.getAllStoriesAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { page, limit, id, status, type, startDate, endDate } = req.query;
                const data = yield this.storieService.getAllStoriesAdmin({
                    page: page ? Number(page) : 1,
                    limit: limit ? Number(limit) : 50,
                    id: id,
                    status: status,
                    type: type,
                    startDate: startDate,
                    endDate: endDate
                });
                return res.json(data);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 6) Purge Old Deleted Stories (+30 days default or specified)
        this.purgeOldStories = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { days } = req.body; // Optional override
                const result = yield this.storieService.purgeOldDeletedStories(days ? Number(days) : 30);
                return res.json(Object.assign({ success: true }, result));
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
    }
    isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}
exports.StorieController = StorieController;
