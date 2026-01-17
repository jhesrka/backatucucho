import { Request, Response } from "express";
import { UserMotorizadoService } from "../../services";
import {
  CreateMotorizadoDTO,
  CustomError,
  ForgotPasswordMotorizadoDTO,
  LoginMotorizadoUserDTO,
  ResetPasswordMotorizadoDTO,
} from "../../../domain";
import { encriptAdapter } from "../../../config";

export class MotorizadoController {
  constructor(private readonly motorizadoService: UserMotorizadoService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  };

  // Crear motorizado (solo admin)
  createMotorizado = (req: Request, res: Response) => {
    // 🔐 VALIDACIÓN DE PIN DE SEGURIDAD
    const admin = req.body.sessionAdmin; // Injected by AuthAdminMiddleware
    const { securityPin } = req.body;

    if (!admin) return res.status(401).json({ message: "No autorizado" });

    if (!admin.securityPin) {
      return res.status(403).json({
        message: "Debe configurar su PIN de seguridad antes de crear motorizados.",
      });
    }

    if (!securityPin) {
      return res.status(400).json({ message: "Ingrese su PIN de seguridad" });
    }

    const isPinValid = encriptAdapter.compare(securityPin, admin.securityPin);
    if (!isPinValid) {
      return res.status(401).json({ message: "PIN de seguridad incorrecto" });
    }

    // CONTINUAR CREACIÓN
    const [error, dto] = CreateMotorizadoDTO.create(req.body);
    if (error) return this.handleError(error, res);
    this.motorizadoService
      .createMotorizado(dto!)
      .then((data) => res.status(201).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // Login motorizado (público)
  loginMotorizado = (req: Request, res: Response) => {
    const [error, dto] = LoginMotorizadoUserDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    this.motorizadoService
      .loginMotorizado(dto!)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  logoutMotorizado = (req: Request, res: Response) => {
    const motorizadoId = req.body.sessionMotorizado?.id;

    if (!motorizadoId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    this.motorizadoService
      .logoutMotorizado(motorizadoId)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // Obtener información completa del motorizado autenticado
  getMotorizadoMe = (req: Request, res: Response) => {
    const motorizadoId = req.body.sessionMotorizado?.id;

    if (!motorizadoId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    this.motorizadoService
      .getMotorizadoFull(motorizadoId)
      .then((data: unknown) => res.status(200).json(data))
      .catch((error: unknown) => this.handleError(error, res));
  };

  forgotPassword = (req: Request, res: Response) => {
    const [error, dto] = ForgotPasswordMotorizadoDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.motorizadoService
      .forgotPassword(dto!)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };

  resetPassword = (req: Request, res: Response) => {
    const [errors, dto] = ResetPasswordMotorizadoDTO.create(req.body);

    if (errors && errors.length > 0) {
      return res.status(400).json({ message: errors });
    }

    this.motorizadoService
      .resetPassword(dto!)
      .then((data) => res.status(200).json(data))
      .catch((err) => this.handleError(err, res));
  };

  // Obtener todos los motorizados (solo admin)
  findAllMotorizados = (req: Request, res: Response) => {
    this.motorizadoService
      .findAllMotorizados()
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // Obtener motorizado por id (solo admin)
  findMotorizadoById = (req: Request, res: Response) => {
    const { id } = req.params;
    this.motorizadoService
      .findMotorizadoById(id)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // Actualizar motorizado (solo admin)
  updateMotorizado = (req: Request, res: Response) => {
    const { id } = req.params;
    // Aquí puedes validar parcialmente con un DTO o manualmente si quieres
    this.motorizadoService
      .updateMotorizado(id, req.body)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // Activar/desactivar motorizado (solo admin)
  toggleActivo = (req: Request, res: Response) => {
    const { id } = req.params;
    this.motorizadoService
      .toggleActivo(id)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // Eliminar motorizado (solo admin)
  deleteMotorizado = (req: Request, res: Response) => {
    const { id } = req.params;
    this.motorizadoService
      .deleteMotorizado(id)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // Cambiar contraseña motorizado (solo admin)
  cambiarPassword = (req: Request, res: Response) => {
    const { id } = req.params;
    const { nuevaPassword } = req.body;
    if (!nuevaPassword)
      return res.status(422).json({ message: "Nueva contraseña obligatoria" });

    this.motorizadoService
      .cambiarPassword(id, nuevaPassword)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
}
