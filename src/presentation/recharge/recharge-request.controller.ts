import { Request, Response } from "express";
import { RechargeRequestService } from "../services";
import {
  CreateRechargeRequestDTO,
  CustomError,
  RechargeResponseDTO,
} from "../../domain";
import { StatusRecarga } from "../../data";
export class RechargeRequestController {
  constructor(private readonly rechargeService: RechargeRequestService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  //USUARIO

  //CREAR UNA RECARGA
  createRecharge = (req: Request, res: Response) => {
    const [error, createRechargedto] = CreateRechargeRequestDTO.create(
      req.body
    );

    if (error) return res.status(422).json({ message: error });

    this.rechargeService
      .createRecharge(createRechargedto!, req.file as Express.Multer.File)
      .then((data) => {
        const responseDTO = RechargeResponseDTO.fromEntity(data);
        res.status(201).json(responseDTO);
      })
      .catch((error: unknown) => this.handleError(error, res));
  };

  // OBTENER RECARGAS POR PAGINACION DE 5 USUARIO LOGEADO

  getRechargeRequestsByUser = (req: Request, res: Response) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;

    this.rechargeService
      .getByUser(userId, page)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };

  // ✅ Filtrar por estado
  filterByStatus = async (req: Request, res: Response) => {
    const { status } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage as string) || 3; // Hacer configurable

    // Validar el estado
    if (!Object.values(StatusRecarga).includes(status as StatusRecarga)) {
      return res.status(400).json({ message: "Estado inválido" });
    }

    try {
      // Obtener usuario autenticado del middleware
      const sessionUser = req.body.sessionUser;

      // Si no hay usuario (ruta de admin) o si es ruta de usuario específico
      const userId = req.params.userId || sessionUser?.id;

      const result = await this.rechargeService.filterByStatus(
        status as StatusRecarga,
        userId, // undefined para admin, userId para usuario
        page,
        itemsPerPage
      );

      // Mantener formato de respuesta consistente
      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          itemsPerPage,
        },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ✅ Filtrar por rango de fechas (USUARIO LOGEADO)
  filterByDateRange = async (req: Request, res: Response) => {
    const { startDate, endDate, page = "1", itemsPerPage = "9" } = req.query;
    const { userId } = req.params;

    // Obtener usuario del middleware (que está en req.body.sessionUser)
    const sessionUser = req.body.sessionUser;

    // Validaciones de seguridad
    if (!sessionUser) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (String(sessionUser.id) !== String(userId)) {
      console.error("IDs no coinciden:", {
        autenticado: sessionUser.id,
        solicitado: userId,
      });
      return res.status(403).json({
        message: "No autorizado para consultar estas recargas",
        detail: "El ID del usuario no coincide con el token",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debe proporcionar startDate y endDate",
      });
    }

    try {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Formato de fecha inválido" });
      }

      const pageNumber = parseInt(page as string);
      const perPage = parseInt(itemsPerPage as string);

      if (pageNumber < 1 || perPage < 1) {
        return res.status(400).json({
          message: "Los parámetros de paginación deben ser positivos",
        });
      }

      // Llamar al servicio
      const result = await this.rechargeService.filterByDateRangeForUser(
        userId,
        start,
        end,
        pageNumber,
        perPage
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          itemsPerPage: perPage,
        },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  //ADMINISTRADOR

  //1
  getAllRequestsPaginated = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;

    try {
      const result = await this.rechargeService.getAllRequestsPaginated(page);
      return res.status(200).json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // 2 ✅ Búsqueda por término
  searchRechargeRequests = async (req: Request, res: Response) => {
    const term = req.query.term as string;

    if (!term) {
      return res
        .status(400)
        .json({ message: "El parámetro 'term' es requerido" });
    }

    try {
      const results = await this.rechargeService.searchRechargeRequests(term);
      return res.status(200).json(results);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  //3
  getAllRechargeRequests = (_req: Request, res: Response) => {
    this.rechargeService
      .getAllRechargeRequests()
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };
  //4
  // ✅ Filtrar por rango de fechas con paginación (ADMIN)
  filterByDateRangePaginated = async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const page = parseInt(req.query.page as string) || 1;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Debe proporcionar startDate y endDate en la query" });
    }

    try {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Validación de fechas
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Formato de fecha inválido" });
      }

      const result = await this.rechargeService.filterByDateRangePaginated(
        start,
        end,
        page
      );

      return res.status(200).json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  //5 ✅ Actualizar estado de una solicitud de recarga (ADMIN)
  updateStatus = async (req: Request, res: Response) => {
    const id = req.params.id;
    const {
      status,
      adminComment,
      bank_name,
      amount,
      transaction_date,
      receipt_number,
    } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ message: "El campo 'status' es obligatorio" });
    }

    try {
      const result = await this.rechargeService.updateStatus(
        id,
        status,
        adminComment,
        bank_name,
        amount,
        transaction_date,
        receipt_number
      );

      return res.status(200).json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  //6
  exportToCSVByDate = async (req: Request, res: Response) => {
    // Obtiene fechas desde query params
    const { startDate, endDate } = req.query;

    // Validación básica: ambas fechas deben estar presentes
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debe proporcionar startDate y endDate en la query",
      });
    }

    // Convierte a Date y valida formato
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Formato de fecha inválido" });
    }

    try {
      // Llama al service para obtener el CSV
      const csv = await this.rechargeService.exportToCSVByDate(start, end);

      // Configura cabeceras para descarga de archivo CSV
      res.header("Content-Type", "text/csv");
      res.attachment(`recharges_${startDate}_${endDate}.csv`);

      // Envía el CSV generado
      return res.send(csv);
    } catch (error) {
      // Maneja errores (puedes personalizar este método)
      return this.handleError(error, res);
    }
  };

  //7
  // recharge-request.controller.ts
  filterByStatusAdmin = async (req: Request, res: Response) => {
    const { status } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage as string) || 3;

    if (!Object.values(StatusRecarga).includes(status as StatusRecarga)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Valores permitidos: ${Object.values(
          StatusRecarga
        ).join(", ")}`,
      });
    }

    try {
      const result = await this.rechargeService.filterByStatusAdmin(
        status as StatusRecarga, // Tipo correcto
        page, // number
        itemsPerPage // number
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          itemsPerPage: itemsPerPage, // Usamos el valor del controlador
        },
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  // 8. Eliminar solicitudes de recarga viejas (más de 2 días como prueba)
  deleteOldRechargeRequests = async (_req: Request, res: Response) => {
    try {
      const result = await this.rechargeService.deleteOldRechargeRequests();

      return res.status(200).json({
        success: true,
        message: result.message,
        deleted: result.deleted,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };
}
