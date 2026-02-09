"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseradminController = void 0;
const domain_1 = require("../../../../domain");
class UseradminController {
    constructor(useradminService) {
        this.useradminService = useradminService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            return res.status(500).json({ message: "Internal Server Error" });
        };
        this.createUseradmin = (req, res) => {
            const [error, createUseradminDto] = domain_1.CreateUseradminDTO.create(req.body);
            if (error)
                return this.handleError(error, res);
            this.useradminService
                .createUseradmin(createUseradminDto)
                .then((data) => res.status(201).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.loginAdmin = (req, res) => {
            const [error, loginAdminUserDto] = domain_1.LoginAdminUserDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.useradminService
                .loginAdmin(loginAdminUserDto)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.forgotPassword = (req, res) => {
            const [error, dto] = domain_1.ForgotPasswordDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            this.useradminService
                .forgotPassword(dto)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        this.resetPassword = (req, res) => {
            const [errors, dto] = domain_1.ResetPasswordDTO.create(req.body);
            if (errors.length > 0) {
                return res.status(400).json({ message: errors });
            }
            this.useradminService
                .resetPassword(dto)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        this.findAllUsersadmin = (req, res) => {
            this.useradminService
                .findAllUsersadmin()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.updatePassword = (req, res) => {
            const { user, currentPassword, newPassword } = req.body;
            // user is injected by middleware
            this.useradminService
                .updatePassword(user.id, { currentPassword, newPassword })
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.validateMasterPin = (req, res) => {
            const { pin, sessionAdmin } = req.body;
            this.useradminService.validateMasterPin(pin, sessionAdmin === null || sessionAdmin === void 0 ? void 0 : sessionAdmin.id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.updateSecurityPin = (req, res) => {
            const { user, pin } = req.body;
            this.useradminService
                .updateSecurityPin(user.id, pin)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.UseradminController = UseradminController;
