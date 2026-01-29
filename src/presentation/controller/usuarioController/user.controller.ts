// src/presentation/user/user.controller.ts
import { Request, Response } from "express";
import { UserService } from "../../services";
import {
  CreateUserDTO,
  UpdateUserDTO,
  CustomError,
  LoginUserDTO,
  ForgotPasswordUserDTO,
  ResetPasswordUserDTO,
  SearchUserDTO,
  UpdateUserStatusDTO,
  SendNotificationDTO,
  UpdateUserAdminDTO,
  FilterUsersByStatusDTO,
  LoginGoogleUserDTO,
  ChangePasswordUserDTO,
} from "../../../domain";

export class UserController {
  constructor(private readonly userService: UserService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  };
  //USUARIO
  createUser = (req: Request, res: Response) => {
    const [error, createUserDto] = CreateUserDTO.create(req.body);
    if (error) return this.handleError(error, res);

    this.userService
      .createUser(createUserDto!, req.file)
      .then((data) => res.status(201).json(data))
      .catch((error) => this.handleError(error, res));
  };
  login = (req: Request, res: Response) => {
    // Extraer IP de headers o conexión
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const [error, loginUserDto] = LoginUserDTO.create({ ...req.body, ip });

    if (error) return res.status(422).json({ message: error });
    this.userService
      .login(loginUserDto!)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  loginGoogle = (req: Request, res: Response) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || "127.0.0.1";
    const [error, loginGoogleDto] = LoginGoogleUserDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });
    this.userService
      .loginWithGoogle(loginGoogleDto!.token, ip)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  logout = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id;
    this.userService.logout(userId)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  }

  forgotPassword = (req: Request, res: Response) => {
    const [error, dto] = ForgotPasswordUserDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.userService
      .forgotPassword(dto!)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };

  resetPassword = (req: Request, res: Response) => {
    const [errors, dto] = ResetPasswordUserDTO.create(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors });
    }

    this.userService
      .resetPassword(dto!)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };

  changePassword = (req: Request, res: Response) => {
    const userId = req.body.sessionUser.id;
    const [error, dto] = ChangePasswordUserDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.userService
      .changePassword(userId, dto!)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
  updateUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const [error, updateUserDto] = UpdateUserDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });
    try {
      const updatedUser = await this.userService.updateUser(
        id,
        updateUserDto!,
        req.file
      );
      return res.status(200).json(updatedUser);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  completeProfile = (req: Request, res: Response) => {
    const { whatsapp, password, acceptedTerms, acceptedPrivacy } = req.body;
    const userId = req.body.sessionUser.id;

    this.userService
      .completeProfile(userId, { whatsapp, password, acceptedTerms, acceptedPrivacy })
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  findOneUser = (req: Request, res: Response) => {
    const { id } = req.params;
    this.userService
      .findOneUser(id)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  deleteUser = (req: Request, res: Response) => {
    const { id } = req.params;
    this.userService
      .deleteUser(id)
      .then(() => res.status(204).json(null))
      .catch((error) => this.handleError(error, res));
  };

  getFullProfile = (req: Request, res: Response) => {
    this.userService
      .getFullProfile(req.body.sessionUser)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
  getLoggedUserInfo = (req: Request, res: Response) => {
    this.userService
      .getProfileUserLogged(req.body.sessionUser)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  validateAccount = (req: Request, res: Response) => {
    const { token } = req.params;
    this.userService
      .validateEmail(token)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  getProfile = (req: Request, res: Response) => {
    this.userService
      .getUserProfile(req.body.sessionUser)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  blockAccount = (req: Request, res: Response) => {
    this.userService
      .blockAccount()
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  //ADMINISTRADOR
  // 1. Listar todos los usuarios
  findAllUsers = (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;

    this.userService
      .findAllUsers(page)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // 2. Buscar usuarios por campos
  searchUsersByFields = (req: Request, res: Response) => {
    const [error, dto] = SearchUserDTO.create(req.query);
    if (error) return res.status(400).json({ message: error });

    this.userService
      .searchUsersByFields(dto!)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };

  // 3. Filtrar por estado

  filterUsersByStatus = async (req: Request, res: Response) => {
    const [error, dto] = FilterUsersByStatusDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    try {
      const data = await this.userService.filterUsersByStatus(dto!);
      return res.status(200).json(data);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  // 4. Perfil completo
  // En tu controlador
  getFullUserProfile = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const data = await this.userService.getFullUserProfile(id);
      return res.status(200).json(data);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // 5. Actualizar usuario desde admin
  updateUserFromAdmin = (req: Request, res: Response) => {
    const { id } = req.params;
    const [error, dto] = UpdateUserAdminDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.userService
      .updateUserFromAdmin(id, dto!, req.file)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };

  // 6. Cambiar estado del usuario
  changeUserStatus = (req: Request, res: Response) => {
    const [error, dto] = UpdateUserStatusDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.userService
      .changeUserStatus(dto!.id, dto!)
      .then(() =>
        res.status(200).json({ message: "Estado actualizado correctamente" })
      )
      .catch((err) => this.handleError(err, res));
  };

  // 9. Exportar CSV
  exportUsersToCSV = (_req: Request, res: Response) => {
    this.userService
      .exportUsersToCSV()
      .then((csv) => {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=usuarios.csv"
        );
        res.status(200).send(csv);
      })
      .catch((err) => this.handleError(err, res));
  };

  // 10. Enviar notificación
  sendNotificationToUser = (req: Request, res: Response) => {
    const [error, dto] = SendNotificationDTO.create(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    this.userService
      .sendNotificationToUser(dto!)
      .then(() =>
        res.status(200).json({ message: "Notificación enviada correctamente" })
      )
      .catch((err) => this.handleError(err, res));
  };
  sendNotificationToAllUsers = (req: Request, res: Response) => {
    const { subject, message } = req.body;

    // Validar mínimo el asunto y mensaje
    if (
      !subject ||
      subject.trim().length < 3 ||
      !message ||
      message.trim().length < 5
    ) {
      return res
        .status(400)
        .json({ message: "Asunto y mensaje son obligatorios" });
    }

    this.userService
      .sendNotificationToAllUsers({
        subject: subject.trim(),
        message: message.trim(),
      })
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };
  // Total de usuarios activos
  countActiveUsers = async (_req: Request, res: Response) => {
    try {
      const total = await this.userService.countActiveUsers();
      return res.status(200).json({ success: true, total });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // Usuarios registrados en las últimas 24 horas
  countUsersRegisteredLast24h = async (_req: Request, res: Response) => {
    try {
      const total = await this.userService.countUsersRegisteredLast24h();
      return res.status(200).json({ success: true, total, windowHours: 24 });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // 11. Purgar usuario (Eliminación definitiva)
  purgeUser = (req: Request, res: Response) => {
    const { id } = req.params;
    this.userService
      .purgeUser(id)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // ===================== NUEVOS MÉTODOS DE GESTIÓN AVANZADA =====================

  updateUserAdminAction = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, whatsapp, status } = req.body;
    try {
      const result = await this.userService.updateUserAdmin(id, { email, whatsapp, status });
      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  forceLogoutAdminAction = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await this.userService.forceLogoutAdmin(id);
      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  sendPasswordResetAdminAction = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await this.userService.sendPasswordResetAdmin(id);
      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  purgeUserAdminAction = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await this.userService.purgeUserAdmin(id);
      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

}
