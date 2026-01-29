import { addDays } from "date-fns";
import { StatusStorie, Storie } from "../../data";
import { CreateStorieDTO } from "../../domain/dtos/stories/CreateStorie.dto";
import { envs } from "../../config";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { getIO } from "../../config/socket";
import { CustomError } from "../../domain";
import { UserService } from "./usuario/user.service";
import { WalletService } from "./postService/wallet.service";
import { PriceService } from "./priceService/price-service.service";
import { LessThan, LessThanOrEqual, IsNull, MoreThan, Between, Like } from "typeorm";
import { validate as uuidValidate } from "uuid";

export class StorieService {
  constructor(
    private readonly userService: UserService,
    private readonly walletService: WalletService,
    private readonly priceService: PriceService
  ) { }

  async createStorie(
    storieData: CreateStorieDTO,
    file: Express.Multer.File | undefined
  ) {
    if (!file) {
      throw CustomError.badRequest(
        "La imagen es obligatoria para crear una historia"
      );
    }

    // Buscar el usuario
    const user = await this.userService.findOneUser(storieData.userId);

    // Obtener configuración de precios
    const config = await this.priceService.getCurrentPriceSettings();
    const costo = this.priceService.calcularPrecio(
      storieData.dias,
      config.basePrice,
      config.extraDayPrice
    );

    // Validar y descontar de wallet
    await this.walletService.subtractFromWallet(user.id, costo, "Pago por publicación de historia", "STORIE");

    // Subir la imagen
    let key: string;
    let url: string;

    try {
      key = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: `stories/${Date.now()}-${file.originalname}`,
        body: file.buffer,
        contentType: file.mimetype,
      });

      url = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key,
      });
    } catch {
      throw CustomError.internalServer(
        "Error subiendo la imagen de la historia"
      );
    }

    // Crear la historia
    const storie = new Storie();
    storie.description = storieData.description.trim();
    storie.imgstorie = key;
    storie.user = user;
    storie.expires_at = addDays(new Date(), storieData.dias);
    storie.showWhatsapp = storieData.showWhatsapp;

    // Guardar snapshot de precios
    storie.val_primer_dia = config.basePrice;
    storie.val_dias_adicionales = config.extraDayPrice;
    storie.total_pagado = costo;

    try {
      const savedStorie = await storie.save();

      // Solo en respuesta: mostrar URL pública
      savedStorie.imgstorie = url;

      // Emitir evento de socket
      getIO().emit("storieChanged", savedStorie);

      return savedStorie;
    } catch (error) {
      throw CustomError.internalServer("Error creando la historia");
    }
  }
  //funcionado
  async findAllStorie() {
    try {
      const now = new Date();

      // 1️⃣ Traer solo stories activas que no hayan expirado
      const stories = await Storie.find({
        where: {
          statusStorie: StatusStorie.PUBLISHED,
          expires_at: MoreThan(now),
        },
        relations: ["user"],
        select: {
          user: {
            id: true,
            name: true,
            surname: true,
            photoperfil: true,
            whatsapp: true,
          },
        },
        order: { createdAt: "DESC" },
      });

      // 2️⃣ Convertir imágenes a URLs públicas
      const storiesWithUrls = await Promise.all(
        stories.map(async (story) => {
          const imgstorieUrl = story.imgstorie
            ? await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: story.imgstorie,
            })
            : null;

          const photoperfilUrl = story.user?.photoperfil
            ? await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: story.user.photoperfil,
            })
            : null;

          return {
            ...story,
            imgstorie: imgstorieUrl,
            user: {
              ...story.user,
              photoperfil: photoperfilUrl,
            },
          };
        })
      );

      // 3️⃣ Procesar stories expiradas en segundo plano
      this.processExpiredStories().catch((error) => {
        console.error("Error procesando stories expiradas:", error);
      });

      return storiesWithUrls;
    } catch (error) {
      throw CustomError.internalServer("Error obteniendo datos de stories");
    }
  }

  // 🔁 Método para manejar stories expiradas
  private async processExpiredStories() {
    const now = new Date();

    // Buscar stories que hayan expirado y aún estén publicadas
    const expiredStories = await Storie.find({
      where: {
        statusStorie: StatusStorie.PUBLISHED,
        expires_at: LessThanOrEqual(now),
      },
      relations: ["user"],
    });

    if (expiredStories.length > 0) {
      await Promise.all(
        expiredStories.map(async (story) => {
          // Aquí aplicamos la misma lógica soft/hard delete
          await this.deleteStorie(story.id, story.user.id);
        })
      );
    }
  }

  // 🔹 Método de eliminar story (soft/hard) similar a tus posts
  async deleteStorie(id: string, userId: string): Promise<{ message: string }> {
    const story = await Storie.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!story) throw CustomError.notFound("Story no encontrada");
    if (story.user.id !== userId)
      throw CustomError.forbiden("No autorizado para eliminar esta story");

    return story.statusStorie === StatusStorie.DELETED
      ? await this.hardDeleteStorie(story)
      : await this.softDeleteStorie(story);
  }

  private async softDeleteStorie(story: Storie): Promise<{ message: string }> {
    story.statusStorie = StatusStorie.DELETED;
    story.deletedAt = new Date();
    await story.save();

    getIO().emit("storieChanged", {
      action: "delete",
      storieId: story.id,
    });

    return { message: "Story marcada como eliminada" };
  }

  public async hardDeleteStorie(story: Storie): Promise<{ message: string }> {
    if (story.imgstorie) {
      await UploadFilesCloud.deleteFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: story.imgstorie,
      });
    }

    await Storie.remove(story);

    getIO().emit("storieChanged", {
      action: "hardDelete",
      storieId: story.id,
    });

    return { message: "Story eliminada permanentemente" };
  }
  async getStoriesByUser(userId: string) {
    if (!userId) {
      throw CustomError.badRequest("ID de usuario no proporcionado");
    }

    try {
      const now = new Date();

      const stories = await Storie.find({
        where: {
          statusStorie: StatusStorie.PUBLISHED,
          expires_at: MoreThan(now),
          user: { id: userId },
        },
        relations: ["user"],
        select: {
          user: {
            id: true,
            name: true,
            surname: true,
            photoperfil: true,
            whatsapp: true,
          },
        },
        order: { createdAt: "DESC" },
      });

      const storiesWithUrls = await Promise.all(
        stories.map(async (story) => {
          const imgstorieUrl = story.imgstorie
            ? await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: story.imgstorie,
            }).catch(() => null)
            : null;

          const photoperfilUrl = story.user?.photoperfil
            ? await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: story.user.photoperfil,
            }).catch(() => null)
            : null;

          return {
            ...story,
            imgstorie: imgstorieUrl,
            user: {
              ...story.user,
              photoperfil: photoperfilUrl,
            },
          };
        })
      );

      return storiesWithUrls.filter((story) => story.imgstorie !== null);
    } catch {
      throw CustomError.internalServer(
        "Error obteniendo historias del usuario"
      );
    }
  }
  //ADMINISTRADOR
  async findStorieByIdAdmin(storieId: string) {
    try {
      if (!storieId || !uuidValidate(storieId)) {
        throw CustomError.badRequest("ID de story inválido");
      }

      const story = await Storie.findOne({
        where: { id: storieId },
        relations: ["user"],
        select: {
          user: {
            id: true,
            name: true,
            surname: true,
            photoperfil: true,
            whatsapp: true,
            email: true,
          },
        },
      });

      if (!story) throw CustomError.notFound("Story no encontrada");

      // Resolver URLs
      const [imgUrl, userImgUrl] = await Promise.all([
        story.imgstorie
          ? UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: story.imgstorie,
          }).catch(() => null)
          : null,
        story.user?.photoperfil
          ? UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: story.user.photoperfil,
          }).catch(() => null)
          : null,
      ]);

      return {
        id: story.id,
        description: story.description,
        statusStorie: story.statusStorie,
        createdAt: story.createdAt,
        expires_at: story.expires_at,
        imgstorie: imgUrl,
        user: {
          id: story.user.id,
          name: story.user.name,
          surname: story.user.surname,
          whatsapp: story.user.whatsapp,
          photoperfil: userImgUrl,
          email: story.user.email,
        },
      };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer(
        "Error buscando la story por ID (admin)"
      );
    }
  }
  async blockStorieAdmin(
    storieId: string
  ): Promise<{ message: string; status: StatusStorie }> {
    try {
      if (!storieId || !uuidValidate(storieId)) {
        throw CustomError.badRequest("ID de story inválido");
      }

      const story = await Storie.findOne({ where: { id: storieId } });
      if (!story) throw CustomError.notFound("Story no encontrada");

      const wasBanned = story.statusStorie === StatusStorie.BANNED;

      story.statusStorie = wasBanned
        ? StatusStorie.PUBLISHED
        : StatusStorie.BANNED;
      await story.save();

      getIO().emit("storieChanged", {
        action: wasBanned ? "unban" : "ban",
        storieId: story.id,
        status: story.statusStorie,
      });

      return {
        message: wasBanned
          ? "Story desbloqueada correctamente"
          : "Story bloqueada correctamente",
        status: story.statusStorie,
      };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer(
        "Error al bloquear/desbloquear la story"
      );
    }
  }

  // ADMIN: Cambiar estado explicitamente
  async changeStatusStorieAdmin(storieId: string, status: StatusStorie) {
    const story = await Storie.findOne({ where: { id: storieId } });
    if (!story) throw CustomError.notFound("Story no encontrada");

    story.statusStorie = status;
    if (status === StatusStorie.DELETED) {
      story.deletedAt = new Date();
    } else {
      story.deletedAt = null!;
    }

    await story.save();
    getIO().emit("storieChanged", { action: "update", storieId: story.id, status: story.statusStorie });
    return { message: `Estado cambiado a ${status}`, status: story.statusStorie };
  }

  // ADMIN: Purga definitiva
  async purgeStorieAdmin(storieId: string) {
    const story = await Storie.findOne({ where: { id: storieId } });
    if (!story) throw CustomError.notFound("Story no encontrada");

    return await this.hardDeleteStorie(story);
  }
  async purgeDeletedStoriesOlderThan3Days(): Promise<{ deletedCount: number }> {
    try {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Buscar stories en DELETED con deletedAt <= cutoff
      const stories = await Storie.find({
        where: {
          statusStorie: StatusStorie.DELETED,
          deletedAt: LessThan(cutoff),
        },
      });

      if (stories.length === 0) {
        return { deletedCount: 0 };
      }

      let deletedCount = 0;

      for (const story of stories) {
        try {
          // 1) Borrar imagen en S3 si existe
          if (story.imgstorie) {
            await UploadFilesCloud.deleteFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: story.imgstorie,
            }).catch(() => undefined);
          }

          // 2) Eliminar definitivamente el registro
          await Storie.remove(story);
          deletedCount++;
        } catch {
          continue; // tolerante a fallos por historia
        }
      }

      getIO().emit("storiesPurged", { count: deletedCount });
      return { deletedCount };
    } catch {
      throw CustomError.internalServer(
        "Error al purgar stories eliminadas mayores a 3 días"
      );
    }
  }
  // Total de historias pagadas publicadas (todas son pagadas por individual)
  async countPaidStories(): Promise<number> {
    try {
      // Publicadas y no expiradas (expires_at NULL o > now)
      const now = new Date();
      const total = await Storie.count({
        where: [
          { statusStorie: StatusStorie.PUBLISHED, expires_at: IsNull() },
          { statusStorie: StatusStorie.PUBLISHED, expires_at: MoreThan(now) },
        ],
      });
      return total;
    } catch (error) {
      console.error("[StorieService.countPaidStories]", error);
      throw CustomError.internalServer(
        "Error al contar historias pagadas publicadas"
      );
    }
  }

  // Historias publicadas en las últimas 24h (y activas)
  async countPaidStoriesLast24h(): Promise<number> {
    try {
      const now = new Date();
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const total = await Storie.count({
        where: [
          {
            statusStorie: StatusStorie.PUBLISHED,
            createdAt: MoreThan(since),
            expires_at: IsNull(),
          },
          {
            statusStorie: StatusStorie.PUBLISHED,
            createdAt: MoreThan(since),
            expires_at: MoreThan(now),
          },
        ],
      });
      return total;
    } catch (error) {
      console.error("[StorieService.countPaidStoriesLast24h]", error);
      throw CustomError.internalServer(
        "Error al contar historias pagadas de las últimas 24 horas"
      );
    }
  }

  // ==========================================
  // 🛡️ ADMIN PANEL METHODS
  // ==========================================

  async getAdminStats() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Total stories (including soft deleted)
      const totalStories = await Storie.count({ withDeleted: true });

      // By Status
      const published = await Storie.count({ where: { statusStorie: StatusStorie.PUBLISHED } });
      const blocked = await Storie.count({ where: { statusStorie: StatusStorie.BANNED } });
      const hidden = await Storie.count({ where: { statusStorie: StatusStorie.HIDDEN } });

      // Soft Deleted
      const deleted = await Storie.count({
        where: { statusStorie: StatusStorie.DELETED },
        withDeleted: true
      });

      // Purge Candidates (Deleted +30 days ago)
      const purgeCandidates = await Storie.count({
        where: {
          statusStorie: StatusStorie.DELETED,
          deletedAt: LessThan(thirtyDaysAgo)
        },
        withDeleted: true
      });

      // Paid vs Free (assuming total_pagado > 0 is paid)
      const paid = await Storie.count({ where: { total_pagado: MoreThan(0) }, withDeleted: true });
      const free = await Storie.count({ where: { total_pagado: 0 }, withDeleted: true });

      // Expiring Soon (Published and expires in < 24h)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const expiringSoon = await Storie.count({
        where: {
          statusStorie: StatusStorie.PUBLISHED,
          expires_at: Between(now, tomorrow)
        }
      });

      return {
        totalStories,
        published,
        deleted,
        blocked,
        hidden,
        paid,
        free,
        expiringSoon,
        purgeCandidates
      };
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      throw CustomError.internalServer("Error calculando estadísticas de historias");
    }
  }

  async getAllStoriesAdmin(options: {
    page: number;
    limit: number;
    id?: string;
    status?: string;
    type?: 'PAGADO' | 'GRATIS';
    startDate?: string;
    endDate?: string;
    userId?: string; // Optional filter by user
  }) {
    const { page = 1, limit = 10, id, status, type, startDate, endDate, userId } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filters
    if (id) where.id = id;
    if (status) where.statusStorie = status;
    if (userId) where.user = { id: userId };

    // Date Range (Creation)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = Between(start, end);
    } else if (startDate) {
      const start = new Date(startDate);
      where.createdAt = MoreThan(start);
    }

    // Type (Paid/Free)
    if (type === 'PAGADO') {
      where.total_pagado = MoreThan(0);
    } else if (type === 'GRATIS') {
      where.total_pagado = 0;
    }

    try {
      const [stories, total] = await Storie.findAndCount({
        where,
        relations: ["user"],
        order: { createdAt: "DESC" },
        take: limit,
        skip,
        withDeleted: true // Important to see soft deleted ones
      });

      // Enrich with signed URLs
      const enrichedStories = await Promise.all(
        stories.map(async (story) => {
          const imgUrl = story.imgstorie
            ? await UploadFilesCloud.getFile({ bucketName: envs.AWS_BUCKET_NAME, key: story.imgstorie }).catch(() => null)
            : null;

          const userImg = story.user?.photoperfil
            ? await UploadFilesCloud.getFile({ bucketName: envs.AWS_BUCKET_NAME, key: story.user.photoperfil }).catch(() => null)
            : null;

          return {
            ...story,
            imgstorie: imgUrl,
            user: { ...story.user, photoperfil: userImg }
          };
        })
      );

      return {
        stories: enrichedStories,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    } catch (error) {
      console.error("Error in getAllStoriesAdmin:", error);
      throw CustomError.internalServer("Error listando historias para admin");
    }
  }

  async purgeOldDeletedStories(days: number = 30): Promise<{ deletedCount: number }> {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // 1. Find candidates (Status DELETED + deletedAt < cutoff) OR (Status BANNED + createdAt < cutoff)
      const stories = await Storie.find({
        where: [
          {
            statusStorie: StatusStorie.DELETED,
            deletedAt: LessThan(cutoff),
          },
          {
            statusStorie: StatusStorie.BANNED,
            createdAt: LessThan(cutoff),
          }
        ],
        withDeleted: true
      });

      if (stories.length === 0) return { deletedCount: 0 };

      let deletedCount = 0;

      for (const story of stories) {
        try {
          // A. Delete from S3
          if (story.imgstorie) {
            await UploadFilesCloud.deleteFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: story.imgstorie,
            }).catch(err => console.warn(`Failed to delete S3 file ${story.imgstorie}`, err));
          }

          // B. Delete from DB (Hard Delete)
          await Storie.remove(story);
          deletedCount++;
        } catch (err) {
          console.error(`Error purging story ${story.id}`, err);
        }
      }

      getIO().emit("storiesPurged", { count: deletedCount });
      return { deletedCount };

    } catch (error) {
      throw CustomError.internalServer(`Error en purga de historias (+${days} días)`);
    }
  }
  // ADMIN: Get all stories for a user (Pagination + Admin View)
  async getStoriesByUserAdmin(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [stories, total] = await Storie.findAndCount({
        where: { user: { id: userId } },
        relations: ["user"],
        order: { createdAt: "DESC" },
        take: limit,
        skip: skip,
        withDeleted: true // Include soft deleted if applicable
      });

      // Process images
      const formattedStories = await Promise.all(
        stories.map(async (story) => {
          const resolvedImg = story.imgstorie
            ? await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: story.imgstorie
            }).catch(() => null)
            : null;

          const isExpired = new Date(story.expires_at) < new Date();
          const isVisible = story.statusStorie === StatusStorie.PUBLISHED && !isExpired;

          return {
            ...story,
            imgstorie: resolvedImg,
            isExpired,
            isVisible
          };
        })
      );

      return {
        stories: formattedStories,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };

    } catch (error) {
      console.error("Error in getStoriesByUserAdmin:", error);
      throw CustomError.internalServer("Error fetching user stories for admin");
    }
  }
}
