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
exports.MotorizadoController = void 0;
const domain_1 = require("../../../domain");
const config_1 = require("../../../config");
const data_1 = require("../../../data");
class MotorizadoController {
    constructor(motorizadoService) {
        this.motorizadoService = motorizadoService;
        this.getGlobalWalletStats = (req, res) => {
            this.motorizadoService.getGlobalWalletStats()
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        this.getAllGlobalWithdrawals = (req, res) => {
            const { status } = req.query;
            this.motorizadoService.getAllGlobalWithdrawals(status)
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            return res.status(500).json({ message: "Internal Server Error" });
        };
        // Crear motorizado (solo admin)
        // Crear motorizado (solo admin)
        this.createMotorizado = (req, res) => {
            const [error, dto] = domain_1.CreateMotorizadoDTO.create(req.body);
            if (error)
                return this.handleError(error, res);
            this.motorizadoService
                .createMotorizado(dto)
                .then((data) => res.status(201).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // Login motorizado (público)
        this.loginMotorizado = (req, res) => {
            const [error, dto] = domain_1.LoginMotorizadoUserDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.motorizadoService
                .loginMotorizado(dto)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.logoutMotorizado = (req, res) => {
            var _a;
            const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
            if (!motorizadoId) {
                return res.status(401).json({ message: "No autenticado" });
            }
            this.motorizadoService
                .logoutMotorizado(motorizadoId)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // Obtener información completa del motorizado autenticado
        this.getMotorizadoMe = (req, res) => {
            var _a;
            const motorizadoId = (_a = req.body.sessionMotorizado) === null || _a === void 0 ? void 0 : _a.id;
            if (!motorizadoId) {
                return res.status(401).json({ message: "No autenticado" });
            }
            this.motorizadoService
                .getMotorizadoFull(motorizadoId)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.forgotPassword = (req, res) => {
            const [error, dto] = domain_1.ForgotPasswordMotorizadoDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            this.motorizadoService
                .forgotPassword(dto)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        this.resetPassword = (req, res) => {
            const [errors, dto] = domain_1.ResetPasswordMotorizadoDTO.create(req.body);
            if (errors && errors.length > 0) {
                return res.status(400).json({ message: errors });
            }
            this.motorizadoService
                .resetPassword(dto)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        // Obtener todos los motorizados (solo admin)
        this.findAllMotorizados = (req, res) => {
            this.motorizadoService
                .findAllMotorizados()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // Obtener motorizado por id (solo admin)
        this.findMotorizadoById = (req, res) => {
            const { id } = req.params;
            this.motorizadoService
                .findMotorizadoById(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // Actualizar motorizado (solo admin)
        this.updateMotorizado = (req, res) => {
            const { id } = req.params;
            // Aquí puedes validar parcialmente con un DTO o manualmente si quieres
            this.motorizadoService
                .updateMotorizado(id, req.body)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // 📊 Obtener rendimiento mensual (asignaciones/entregas)
        this.getMonthlyPerformance = (req, res) => {
            const { id } = req.params;
            this.motorizadoService.getMonthlyPerformance(id)
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        // 📜 Historial de pedidos avanzado
        this.getOrdersHistory = (req, res) => {
            const { id } = req.params;
            const { page, limit, search, status, startDate, endDate } = req.query;
            this.motorizadoService.getOrdersHistory(id, {
                page: page ? Number(page) : 1,
                limit: limit !== undefined ? Number(limit) : 20,
                search: search,
                status: status,
                startDate: startDate,
                endDate: endDate
            })
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        // ✏️ Cambiar estado de pedido (Admin)
        this.changeOrderStatus = (req, res) => {
            const { pedidoId } = req.params;
            const { status } = req.body;
            this.motorizadoService.changeOrderStatus(pedidoId, status)
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        // Activar/desactivar motorizado (solo admin)
        this.toggleActivo = (req, res) => {
            const { id } = req.params;
            this.motorizadoService
                .toggleActivo(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // Eliminar motorizado (solo admin)
        this.deleteMotorizado = (req, res) => {
            const { id } = req.params;
            this.motorizadoService
                .deleteMotorizado(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // Cambiar contraseña motorizado (solo admin)
        this.cambiarPassword = (req, res) => {
            const { id } = req.params;
            const { nuevaPassword } = req.body;
            if (!nuevaPassword)
                return res.status(422).json({ message: "Nueva contraseña obligatoria" });
            this.motorizadoService
                .cambiarPassword(id, nuevaPassword)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // 💰 Obtener estadísticas de billetera y saldo
        this.getWalletStats = (req, res) => {
            const { id } = req.params;
            this.motorizadoService.getWalletStats(id)
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        // 📜 Obtener historial de transacciones (Admin)
        this.getTransactions = (req, res) => {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            this.motorizadoService.getTransactions(id, Number(page), Number(limit))
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        this.adjustBalance = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const admin = req.sessionAdmin || req.body.sessionAdmin;
            const { id } = req.params;
            const { amount, observation, masterPin } = req.body;
            if (!admin)
                return res.status(401).json({ message: "No autorizado" });
            if (!masterPin)
                return res.status(400).json({ message: "El PIN maestro es requerido" });
            try {
                const cleanPin = String(masterPin).trim();
                // 1. Validar EXCLUSIVAMENTE contra GlobalSettings
                const settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
                if (!settings || !settings.masterPin) {
                    return res.status(400).json({ message: "El sistema no tiene un PIN Maestro configurado." });
                }
                const isValid = config_1.encriptAdapter.compare(cleanPin, settings.masterPin);
                if (!isValid) {
                    return res.status(400).json({ message: "PIN Maestro incorrecto" });
                }
                this.motorizadoService.adjustBalance(id, Number(amount), observation, admin.id)
                    .then(data => res.json(data))
                    .catch(error => this.handleError(error, res));
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.deleteForce = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { masterPin } = req.body;
            const sessionAdmin = req.sessionAdmin || req.body.sessionAdmin;
            if (!masterPin)
                return res.status(400).json({ message: "PIN Maestro requerido" });
            try {
                const cleanPin = String(masterPin).trim();
                // 1. Validar EXCLUSIVAMENTE contra GlobalSettings
                const settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
                if (!settings || !settings.masterPin) {
                    return res.status(400).json({ message: "El sistema no tiene un PIN Maestro configurado." });
                }
                const isValid = config_1.encriptAdapter.compare(cleanPin, settings.masterPin);
                if (!isValid)
                    return res.status(400).json({ message: "PIN Maestro incorrecto" });
                this.motorizadoService.deleteForce(id)
                    .then(data => res.status(200).json(data))
                    .catch(error => this.handleError(error, res));
            }
            catch (err) {
                return this.handleError(err, res);
            }
        });
        // ✅ Obtener solicitudes de retiro
        this.getWithdrawals = (req, res) => {
            const { id } = req.params;
            const { page, limit, status } = req.query;
            this.motorizadoService.getWithdrawals(id, Number(page) || 1, Number(limit) || 20, status)
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
        // ✅ Aprobar retiro
        this.approveWithdrawal = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { transactionId } = req.params;
            const { masterPin, comment } = req.body;
            const admin = req.sessionAdmin || req.body.sessionAdmin;
            const file = req.file;
            if (!admin)
                return res.status(401).json({ message: "No autorizado" });
            // if (!masterPin) return res.status(400).json({ message: "El PIN maestro es requerido" });
            if (!file)
                return res.status(400).json({ message: "El comprobante es requerido" });
            // Validate Master PIN REMOVED per user request
            try {
                /*
                let isValid = false;
                const settings = await GlobalSettings.find({ order: { updatedAt: "DESC" }, take: 1 });
                if (settings.length > 0 && settings[0].masterPin) {
                  if (encriptAdapter.compare(masterPin, settings[0].masterPin)) isValid = true;
                }
                if (!isValid && admin.securityPin) {
                  if (encriptAdapter.compare(masterPin, admin.securityPin)) isValid = true;
                }
          
                if (!isValid) return res.status(401).json({ message: "PIN maestro incorrecto" });
                */
                // Upload Proof
                const proofUrl = yield config_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `withdrawals/${transactionId}/${file.originalname}`,
                    body: file.buffer,
                    contentType: file.mimetype
                });
                this.motorizadoService.approveWithdrawal(transactionId, admin.id, proofUrl, comment)
                    .then(data => res.json(data))
                    .catch(error => this.handleError(error, res));
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // ✅ Rechazar retiro
        this.rejectWithdrawal = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { transactionId } = req.params;
            const { masterPin, comment } = req.body;
            const admin = req.sessionAdmin || req.body.sessionAdmin;
            if (!admin)
                return res.status(401).json({ message: "No autorizado" });
            // if (!masterPin) return res.status(400).json({ message: "El PIN maestro es requerido" });
            try {
                // PIN validation REMOVED per user request
                /*
                let isValid = false;
                const settings = await GlobalSettings.find({ order: { updatedAt: "DESC" }, take: 1 });
                if (settings.length > 0 && settings[0].masterPin) {
                  if (encriptAdapter.compare(masterPin, settings[0].masterPin)) isValid = true;
                }
                if (!isValid && admin.securityPin) {
                  if (encriptAdapter.compare(masterPin, admin.securityPin)) isValid = true;
                }
          
                if (!isValid) return res.status(401).json({ message: "PIN maestro incorrecto" });
                */
                this.motorizadoService.rejectWithdrawal(transactionId, admin.id, comment)
                    .then(data => res.json(data))
                    .catch(error => this.handleError(error, res));
            }
            catch (err) {
                this.handleError(err, res);
            }
        });
    }
}
exports.MotorizadoController = MotorizadoController;
