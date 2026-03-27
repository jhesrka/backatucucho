"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessController = void 0;
const domain_1 = require("../../domain");
class BusinessController {
    constructor(businessService) {
        this.businessService = businessService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        };
        this.login = (req, res) => {
            const [error, loginUserDto] = domain_1.LoginUserDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.businessService
                .loginBusiness(loginUserDto)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getMyBusinesses = (req, res) => {
            const { id } = req.body.sessionUser;
            this.businessService
                .getMyBusinesses(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getOrders = (req, res) => {
            const { businessId } = req.params;
            const { status, page = 1, limit = 15, date, search } = req.query;
            this.businessService
                .getOrdersByBusiness(businessId, status, Number(page), Number(limit), date, search)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.updateOrderStatus = (req, res) => {
            const { businessId, orderId } = req.params;
            const { status, motivoCancelacion } = req.body;
            this.businessService
                .updateOrderStatus(businessId, orderId, status, motivoCancelacion)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getFinance = (req, res) => {
            const { businessId } = req.params;
            const { date } = req.query;
            this.businessService
                .getFinanceSummary(businessId, date)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.closeDay = (req, res) => {
            const { businessId } = req.params;
            const { date } = req.body;
            this.businessService
                .closeDay(businessId, date)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.registerPayment = (req, res) => {
            var _a;
            const { businessId } = req.params;
            const { date } = req.body;
            const file = req.file || ((_a = req.files) === null || _a === void 0 ? void 0 : _a.file);
            if (!file)
                return res.status(400).json({ message: "Comprobante requerido" });
            this.businessService.registerPayment(businessId, date, file)
                .then((data) => res.json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.verifyPickupCode = (req, res) => {
            const { businessId, orderId } = req.params;
            const { code } = req.body;
            if (!code)
                return res.status(400).json({ message: "Código requerido" });
            this.businessService
                .verifyPickupCode(businessId, orderId, code)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.confirmTransferCancellation = (req, res) => {
            const { businessId, orderId } = req.params;
            const { confirmed } = req.body;
            this.businessService
                .confirmTransferCancellation(businessId, orderId, confirmed)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getUnclosedDays = (req, res) => {
            const { businessId } = req.params;
            this.businessService
                .getUnclosedDays(businessId)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.updateSettings = (req, res) => {
            const { businessId } = req.params;
            const settings = req.body;
            this.businessService
                .updateSettings(businessId, settings)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.BusinessController = BusinessController;
