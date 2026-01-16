"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const domain_1 = require("../../domain");
class UserController {
    constructor(userService) {
        this.userService = userService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        };
        this.createUser = (req, res) => {
            // const photoUrl = req.file ? (req.file as any).location : undefined;
            const [error, createUserDto] = domain_1.CreateUserDTO.create(req.body);
            if (error)
                return this.handleError(error, res);
            console.log(req.file);
            // const updatedCreateUserDto = {
            //   ...createUserDto!,
            //   photoperfil: photoUrl ?? createUserDto!.photoperfil,
            // };
            this.userService
                .createUser(createUserDto, req.file)
                .then((data) => res.status(201).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.findAllUsers = (req, res) => {
            this.userService
                .findAllUsers()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.findOneUser = (req, res) => {
            const { id } = req.params;
            this.userService
                .findOneUser(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.updateUser = (req, res) => {
            const { id } = req.params;
            const [error, updateUserDto] = domain_1.UpdateUserDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.userService
                .updateUser(id, updateUserDto)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.deleteUser = (req, res) => {
            const { id } = req.params;
            this.userService
                .deleteUser(id)
                .then(() => res.status(204).json(null))
                .catch((error) => this.handleError(error, res));
        };
        this.login = (req, res) => {
            const [error, loginUserDto] = domain_1.LoginUserDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.userService
                .login(loginUserDto)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.validateAccount = (req, res) => {
            const { token } = req.params;
            this.userService
                .validateEmail(token)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getProfile = (req, res) => {
            this.userService
                .getUserProfile(req.body.sessionUser)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.blockAccount = (req, res) => {
            this.userService
                .blockAccount()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.UserController = UserController;
