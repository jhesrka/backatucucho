import { Request, Response } from "express";
import { UseradminService } from "../../../services";
import {
  CreateUseradminDTO,
  CustomError,
  ForgotPasswordDTO,
  LoginAdminUserDTO,
  ResetPasswordDTO,
} from "../../../../domain";

export class UseradminController {
  constructor(private readonly useradminService: UseradminService) { }
  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  };

  createUseradmin = (req: Request, res: Response) => {
    const [error, createUseradminDto] = CreateUseradminDTO.create(req.body);
    if (error) return this.handleError(error, res);
    this.useradminService
      .createUseradmin(createUseradminDto!)
      .then((data) => res.status(201).json(data))
      .catch((error) => this.handleError(error, res));
  };

  loginAdmin = (req: Request, res: Response) => {
    const [error, loginAdminUserDto] = LoginAdminUserDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });
    this.useradminService
      .loginAdmin(loginAdminUserDto!)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
  forgotPassword = (req: Request, res: Response) => {
    const [error, dto] = ForgotPasswordDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.useradminService
      .forgotPassword(dto!)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };

  resetPassword = (req: Request, res: Response) => {
    const [errors, dto] = ResetPasswordDTO.create(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors });
    }

    this.useradminService
      .resetPassword(dto!)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };


  findAllUsersadmin = (req: Request, res: Response) => {
    this.useradminService
      .findAllUsersadmin()
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
  updatePassword = (req: Request, res: Response) => {
    const { user, currentPassword, newPassword } = req.body;
    // user is injected by middleware
    this.useradminService
      .updatePassword(user.id, { currentPassword, newPassword })
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  validateMasterPin = (req: Request, res: Response) => {
    const { pin, sessionAdmin } = req.body;
    (this.useradminService as any).validateMasterPin(pin, sessionAdmin?.id)
      .then((data: any) => res.status(200).json(data))
      .catch((error: any) => this.handleError(error, res));
  };

  updateSecurityPin = (req: Request, res: Response) => {
    const { user, pin } = req.body;
    this.useradminService
      .updateSecurityPin(user.id, pin)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
}
