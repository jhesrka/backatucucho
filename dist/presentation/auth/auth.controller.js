"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const domain_1 = require("../../domain");
class AuthController {
    constructor(authService) {
        this.authService = authService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Auth Error:", error);
            return res.status(500).json({ message: "Internal server error" });
        };
        this.refreshToken = (req, res) => {
            const { refreshToken } = req.body;
            this.authService
                .refreshToken(refreshToken)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.AuthController = AuthController;
