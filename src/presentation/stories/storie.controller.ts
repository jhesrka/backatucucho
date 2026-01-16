import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { CreateStorieDTO } from "../../domain/dtos/stories/CreateStorie.dto";
import { StorieService } from "../services/storie.service";

export class StorieController {
  constructor(private readonly storieService: StorieService) {}
  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  createStorie = (req: Request, res: Response) => {
    const [error, createStorieDto] = CreateStorieDTO.create(req.body);
    if (error) {
      return res.status(422).json({ message: error });
    }
    this.storieService
      .createStorie(createStorieDto!, req.file as Express.Multer.File)
      .then((data) => {
        res.status(201).json(data);
      })
      .catch((error: unknown) => {
        console.error("Error en createStorie:", error);
        return res
          .status(500)
          .json({ message: (error as any).message || "Unknown error" });
      });
  };
  findAllStorie = (req: Request, res: Response) => {
    this.storieService
      .findAllStorie()
      .then((data) => {
        res.status(201).json(data);
      })
      .catch((error: unknown) => this.handleError(error, res));
  };
  // 🆕 Eliminar historia (soft o hard delete)
  deleteStorie = (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.body.sessionUser?.id; // Igual que en posts

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    this.storieService
      .deleteStorie(id, userId)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };
  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
  getStoriesByUser = async (req: Request, res: Response) => {
    const sessionUser = req.body.sessionUser;

    if (!sessionUser?.id) {
      return res.status(401).json({
        success: false,
        message: "Usuario no autenticado o sesión inválida",
      });
    }

    if (!this.isValidUUID(sessionUser.id)) {
      return res.status(400).json({
        success: false,
        message: "ID de usuario no válido",
      });
    }

    try {
      const stories = await this.storieService.getStoriesByUser(sessionUser.id);
      return res.status(200).json({
        success: true,
        stories,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  // --------- ADMIN ---------

  // 1) Buscar story por ID (admin)
  findStorieByIdAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!this.isValidUUID(id)) {
      return res.status(400).json({ message: "ID de story inválido" });
    }

    try {
      const story = await this.storieService.findStorieByIdAdmin(id);
      return res.status(200).json({ success: true, story });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // 2) Bloquear / Desbloquear story (toggle)
  blockStorieAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!this.isValidUUID(id)) {
      return res.status(400).json({ message: "ID de story inválido" });
    }

    try {
      const { message, status } = await this.storieService.blockStorieAdmin(id);
      return res.status(200).json({ success: true, status, message });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // 3) Purgar stories DELETED (>3 días)
  purgeDeletedStoriesOlderThan3Days = async (_req: Request, res: Response) => {
    try {
      const { deletedCount } =
        await this.storieService.purgeDeletedStoriesOlderThan3Days();

      return res.status(200).json({ success: true, deletedCount });
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  // Total de historias publicadas (activas: no expiradas)
  countPaidStories = async (_req: Request, res: Response) => {
    try {
      const total = await this.storieService.countPaidStories();
      return res.status(200).json({ success: true, total });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // Historias publicadas en las últimas 24 horas (y activas)
  countPaidStoriesLast24h = async (_req: Request, res: Response) => {
    try {
      const total = await this.storieService.countPaidStoriesLast24h();
      return res.status(200).json({ success: true, total, windowHours: 24 });
    } catch (error) {
      return this.handleError(error, res);
    }
  };
}
