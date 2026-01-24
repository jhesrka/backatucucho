import { Request, Response } from "express";
import { UserMotorizadoService } from "../../services";
import {
  CreateMotorizadoDTO,
  CustomError,
  ForgotPasswordMotorizadoDTO,
  LoginMotorizadoUserDTO,
  ResetPasswordMotorizadoDTO,
} from "../../../domain";
import { encriptAdapter, UploadFilesCloud, envs } from "../../../config";
import { GlobalSettings, Useradmin } from "../../../data";

export class MotorizadoController {
  constructor(private readonly motorizadoService: UserMotorizadoService) { }

  getGlobalWalletStats = (req: Request, res: Response) => {
    this.motorizadoService.getGlobalWalletStats()
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
  };

  getAllGlobalWithdrawals = (req: Request, res: Response) => {
    const { status } = req.query;
    this.motorizadoService.getAllGlobalWithdrawals(status as string)
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
  };


  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  };

  // Crear motorizado (solo admin)
  // Crear motorizado (solo admin)
  createMotorizado = (req: Request, res: Response) => {
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

  // 📊 Obtener rendimiento mensual (asignaciones/entregas)
  getMonthlyPerformance = (req: Request, res: Response) => {
    const { id } = req.params;
    this.motorizadoService.getMonthlyPerformance(id)
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
  };

  // 📜 Historial de pedidos avanzado
  getOrdersHistory = (req: Request, res: Response) => {
    const { id } = req.params;
    const { page, limit, search, status, startDate, endDate } = req.query;

    this.motorizadoService.getOrdersHistory(id, {
      page: page ? Number(page) : 1,
      limit: limit !== undefined ? Number(limit) : 20,
      search: search as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string
    })
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
  };

  // ✏️ Cambiar estado de pedido (Admin)
  changeOrderStatus = (req: Request, res: Response) => {
    const { pedidoId } = req.params;
    const { status } = req.body;

    this.motorizadoService.changeOrderStatus(pedidoId, status)
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
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

  // 💰 Obtener estadísticas de billetera y saldo
  getWalletStats = (req: Request, res: Response) => {
    const { id } = req.params;
    this.motorizadoService.getWalletStats(id)
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
  };

  // 📜 Obtener historial de transacciones (Admin)
  getTransactions = (req: Request, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    this.motorizadoService.getTransactions(id, Number(page), Number(limit))
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
  };

  adjustBalance = async (req: Request, res: Response) => {
    const admin = (req as any).sessionAdmin || req.body.sessionAdmin;
    const { id } = req.params;
    const { amount, observation, masterPin } = req.body;

    if (!admin) return res.status(401).json({ message: "No autorizado" });
    if (!masterPin) return res.status(400).json({ message: "El PIN maestro es requerido" });

    try {
      const cleanPin = String(masterPin).trim();

      // 1. Validar EXCLUSIVAMENTE contra GlobalSettings
      const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });

      if (!settings || !settings.masterPin) {
        return res.status(400).json({ message: "El sistema no tiene un PIN Maestro configurado." });
      }

      const isValid = encriptAdapter.compare(cleanPin, settings.masterPin);

      if (!isValid) {
        return res.status(400).json({ message: "PIN Maestro incorrecto" });
      }

      this.motorizadoService.adjustBalance(id, Number(amount), observation, admin.id)
        .then(data => res.json(data))
        .catch(error => this.handleError(error, res));

    } catch (error) {
      this.handleError(error, res);
    }
  };

  deleteForce = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { masterPin } = req.body;
    const sessionAdmin = (req as any).sessionAdmin || req.body.sessionAdmin;

    if (!masterPin) return res.status(400).json({ message: "PIN Maestro requerido" });

    try {
      const cleanPin = String(masterPin).trim();

      // 1. Validar EXCLUSIVAMENTE contra GlobalSettings
      const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });

      if (!settings || !settings.masterPin) {
        return res.status(400).json({ message: "El sistema no tiene un PIN Maestro configurado." });
      }

      const isValid = encriptAdapter.compare(cleanPin, settings.masterPin);

      if (!isValid) return res.status(400).json({ message: "PIN Maestro incorrecto" });

      this.motorizadoService.deleteForce(id)
        .then(data => res.status(200).json(data))
        .catch(error => this.handleError(error, res));

    } catch (err) {
      return this.handleError(err, res);
    }
  };

  // ✅ Obtener solicitudes de retiro
  getWithdrawals = (req: Request, res: Response) => {
    const { id } = req.params;
    const { page, limit, status } = req.query;

    this.motorizadoService.getWithdrawals(id, Number(page) || 1, Number(limit) || 20, status as string)
      .then(data => res.json(data))
      .catch(error => this.handleError(error, res));
  };

  // ✅ Aprobar retiro
  approveWithdrawal = async (req: Request, res: Response) => {
    const { transactionId } = req.params;
    const { masterPin, comment } = req.body;
    const admin = (req as any).sessionAdmin || req.body.sessionAdmin;
    const file = req.file;

    if (!admin) return res.status(401).json({ message: "No autorizado" });
    // if (!masterPin) return res.status(400).json({ message: "El PIN maestro es requerido" });
    if (!file) return res.status(400).json({ message: "El comprobante es requerido" });

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
      const proofUrl = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: `withdrawals/${transactionId}/${file.originalname}`,
        body: file.buffer,
        contentType: file.mimetype
      });

      this.motorizadoService.approveWithdrawal(transactionId, admin.id, proofUrl, comment)
        .then(data => res.json(data))
        .catch(error => this.handleError(error, res));

    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ✅ Rechazar retiro
  rejectWithdrawal = async (req: Request, res: Response) => {
    const { transactionId } = req.params;
    const { masterPin, comment } = req.body;
    const admin = (req as any).sessionAdmin || req.body.sessionAdmin;

    if (!admin) return res.status(401).json({ message: "No autorizado" });
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


    } catch (err) {
      this.handleError(err, res);
    }
  };
}
