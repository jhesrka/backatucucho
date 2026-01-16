import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { NegocioAdminService } from "../services/negocioAdmin.service";
import { StatusNegocio } from "../../data";
import { CreateNegocioDTO } from "../../domain/dtos/negocios/CreateNegocioDTO";
import { UpdateNegocioDTO } from "../../domain/dtos/negocios/UpdateNegocioDTO";

type UpdateNegocioData = {
  categoriaId?: string;
  statusNegocio?: string;
  modeloMonetizacion?: "COMISION" | "SUSCRIPCION";
  imagenNegocio?: string;
};
export class NegocioAdminController {
  constructor(private readonly negocioAdminService: NegocioAdminService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  // ===================== GET ALL CON FILTROS Y PAGINACIÓN =====================
  getNegociosAdmin = async (req: Request, res: Response) => {
    try {
      // Extraemos el status raw (string)
      const statusRaw = req.query.status as string | undefined;

      // Validamos que sea un valor válido del enum StatusNegocio
      const statusEnum =
        statusRaw &&
        Object.values(StatusNegocio).includes(statusRaw as StatusNegocio)
          ? (statusRaw as StatusNegocio)
          : undefined;

      const filtros = {
        status: statusEnum,
        categoriaId: req.query.categoriaId as string | undefined,
        userId: req.query.userId as string | undefined,
        search: req.query.search as string | undefined,
        limit: Number(req.query.limit) || 10,
        offset: Number(req.query.offset) || 0,
      };

      const data = await this.negocioAdminService.getNegociosAdmin(filtros);
      return res.status(200).json(data);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ========================= EXPORTAR A CSV =========================
  exportNegociosToCSV = async (req: Request, res: Response) => {
    try {
      const filtros = {
        status: req.query.status as string,
        categoriaId: req.query.categoriaId as string,
        userId: req.query.userId as string,
        search: req.query.search as string,
      };

      const buffer = await this.negocioAdminService.exportNegociosToCSV(
        filtros
      );

      res.setHeader("Content-Disposition", "attachment; filename=negocios.csv");
      res.setHeader("Content-Type", "text/csv");
      return res.send(buffer);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ========================= GET BY ID =========================
  getNegocioByIdAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const negocio = await this.negocioAdminService.getNegocioByIdAdmin(id);
      return res.status(200).json(negocio);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ========================= CREATE =========================
  createNegocioAdmin = async (req: Request, res: Response) => {
    const [error, dto] = CreateNegocioDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    try {
      const negocio = await this.negocioAdminService.createNegocioAdmin(
        dto!,
        req.file
      );
      return res.status(201).json(negocio);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ========================= UPDATE =========================
  updateNegocioAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;

    // Usamos el DTO que creamos
    const [error, dto] = UpdateNegocioDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    try {
      const negocioActualizado =
        await this.negocioAdminService.updateNegocioAdmin(id, dto!);

      return res.status(200).json(negocioActualizado);
    } catch (err) {
      this.handleError(err, res);
    }
  };

  // ========================= DELETE =========================
  deleteNegocioAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const result = await this.negocioAdminService.deleteNegocioAdmin(id);
      return res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };
  // ================== TOGGLE ABIERTO / CERRADO ======================
  toggleEstadoNegocioAdmin = (req: Request, res: Response) => {
    const { id } = req.params;

    this.negocioAdminService
      .toggleEstadoNegocioAdmin(id)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };
  // ================== NUEVO MÉTODO: ESTADÍSTICAS ======================
  getNegociosStatsAdmin = async (req: Request, res: Response) => {
    try {
      const stats = await this.negocioAdminService.getNegociosStatsAdmin();
      return res.status(200).json(stats);
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
