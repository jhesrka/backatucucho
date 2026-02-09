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
            // sessionUser viene del middleware AuthMiddleware
            const { id } = req.body.sessionUser;
            this.businessService
                .getMyBusinesses(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getOrders = (req, res) => {
            const { businessId } = req.params;
            const { status, page = 1, limit = 10, date } = req.query;
            this.businessService
                .getOrdersByBusiness(businessId, status, +page, +limit, date)
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
        this.registerPayment = (req, res) => {
            var _a;
            const { businessId } = req.params;
            const { date } = req.body;
            const file = (_a = req.files) === null || _a === void 0 ? void 0 : _a.file;
            this.businessService.registerPayment(businessId, date, file)
                .then(data => res.json(data))
                .catch(error => this.handleError(error, res));
        };
    }
}
exports.BusinessController = BusinessController;
