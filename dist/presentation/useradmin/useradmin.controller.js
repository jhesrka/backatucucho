"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseradminController = void 0;
const domain_1 = require("../../domain");
const create_useradmin_dto_1 = require("../../domain/dtos/useradmin/create-useradmin.dto");
class UseradminController {
    constructor(useradminService) {
        this.useradminService = useradminService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        };
        this.createUseradmin = (req, res) => {
            const [error, createUseradminDto] = create_useradmin_dto_1.CreateUseradminDTO.create(req.body);
            if (error)
                return this.handleError(error, res);
            this.useradminService
                .createUseradmin(createUseradminDto)
                .then((data) => res.status(201).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.findAllUsersadmin = (req, res) => {
            this.useradminService
                .findAllUsersadmin()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.UseradminController = UseradminController;
