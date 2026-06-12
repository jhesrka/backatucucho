import { CustomError } from "../../../domain";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { envs } from "../../../config";
import { Servicio, StatusServicio, CategoriaServicio, SubcategoriaServicio } from "../../../data/postgres/models/index";
import { User, Wallet, Transaction, TransactionReason, TransactionOrigin, GlobalSettings } from "../../../data/postgres/models/index";
import { DataSource, Not } from "typeorm";

export class UserServiceService {
  constructor() {}

  // ==================================
  // USER METHODS
  // ==================================

  async createService(userId: string, data: any) {
    // data: { categoriaId, subcategoriaId, descripcion, precio }
    try {
      const user = await User.findOne({ where: { id: userId }, relations: ["wallet"] });
      if (!user) throw CustomError.notFound("Usuario no encontrado");

      const settings = await GlobalSettings.findOne({ where: {} });
      if (!settings) throw CustomError.internalServer("Configuración global no encontrada");

      const price = Number(settings.servicePublicationPrice);

      const wallet = user.wallet;
      if (!wallet) throw CustomError.badRequest("El usuario no tiene una billetera configurada");

      if (Number(wallet.balance) < price) {
        throw CustomError.badRequest("Saldo insuficiente en la billetera para publicar este servicio");
      }

      const categoria = await CategoriaServicio.findOne({ where: { id: data.categoriaId } });
      const subcategoria = await SubcategoriaServicio.findOne({ where: { id: data.subcategoriaId } });

      if (!categoria || !subcategoria) {
        throw CustomError.badRequest("Categoría o subcategoría inválida");
      }

      if (data.imagenServicio && data.videoUrl) {
        throw CustomError.badRequest("No puedes enviar una imagen y un video al mismo tiempo. Elige solo una opción.");
      }

      // Descontar saldo y crear servicio en una transacción
      const servicio = await Servicio.getRepository().manager.transaction(async (manager: any) => {
        const previousBalance = Number(wallet.balance);
        const newBalance = previousBalance - price;

        wallet.balance = newBalance;
        await manager.save(wallet);

        const servicio = new Servicio();
        servicio.user = user;
        servicio.categoria = categoria;
        servicio.subcategoria = subcategoria;
        servicio.nombres = user.name;
        servicio.apellidos = user.surname;
        servicio.whatsapp = user.whatsapp;
        servicio.descripcion = data.descripcion || "";
        servicio.imagenServicio = data.imagenServicio || null;
        servicio.videoUrl = data.videoUrl || null;
        servicio.statusServicio = StatusServicio.PENDIENTE;
        servicio.autorenovacion = true; // Por defecto

        await manager.save(servicio);

        const transaction = new Transaction();
        transaction.wallet = wallet;
        transaction.amount = price;
        transaction.type = "debit";
        transaction.reason = TransactionReason.SERVICE_SUBSCRIPTION;
        transaction.origin = TransactionOrigin.USER;
        transaction.status = "APPROVED";
        transaction.previousBalance = previousBalance;
        transaction.resultingBalance = newBalance;
        transaction.reference = servicio.id;
        transaction.observation = "Pago por publicación de servicio (Pendiente de aprobación)";
        
        await manager.save(transaction);

        return servicio;
      });

      return servicio;
    } catch (error: any) {
      console.error("Error original en createService:", error);
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer(error.message || "Error al crear el servicio");
    }
  }

  async getMyServices(userId: string) {
    try {
      const servicios = await Servicio.find({
        where: { user: { id: userId } },
        relations: ["categoria", "subcategoria"],
        order: { createdAt: "DESC" }
      });
      return servicios;
    } catch (error: any) {
      console.error("Error original getMyServices:", error);
      throw CustomError.internalServer(error.message || "Error al obtener los servicios");
    }
  }

  async toggleAutoRenewal(userId: string, servicioId: string) {
    try {
      const servicio = await Servicio.findOne({ where: { id: servicioId, user: { id: userId } } });
      if (!servicio) throw CustomError.notFound("Servicio no encontrado");

      servicio.autorenovacion = !servicio.autorenovacion;
      await servicio.save();

      return servicio;
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al cambiar autorenovación");
    }
  }

  async updatePendingService(userId: string, serviceId: string, data: any) {
    try {
      const servicio = await Servicio.findOne({
        where: { id: serviceId, user: { id: userId } },
        relations: ["categoria", "subcategoria"]
      });

      if (!servicio) throw CustomError.notFound("Servicio no encontrado");

      if (servicio.statusServicio !== StatusServicio.PENDIENTE) {
        throw CustomError.badRequest("Solo puedes editar servicios que se encuentren en estado PENDIENTE");
      }

      if (data.categoriaId) {
        const categoria = await CategoriaServicio.findOne({ where: { id: data.categoriaId } });
        if (!categoria) throw CustomError.badRequest("Categoría inválida");
        servicio.categoria = categoria;
      }

      if (data.subcategoriaId) {
        const subcategoria = await SubcategoriaServicio.findOne({ where: { id: data.subcategoriaId } });
        if (!subcategoria) throw CustomError.badRequest("Subcategoría inválida");
        servicio.subcategoria = subcategoria;
      }

      if (data.descripcion !== undefined) {
        servicio.descripcion = data.descripcion;
      }

      if (data.imagenServicio && data.videoUrl) {
        throw CustomError.badRequest("No puedes enviar una imagen y un video al mismo tiempo. Elige solo una opción.");
      }

      // Eliminar multimedia anterior si cambia
      const isNewImage = data.imagenServicio !== undefined && data.imagenServicio !== servicio.imagenServicio;
      const isNewVideo = data.videoUrl !== undefined && data.videoUrl !== servicio.videoUrl;

      if (isNewImage || isNewVideo) {
        if (servicio.imagenServicio) {
          // Extraer la key si es S3
          const keyMatch = servicio.imagenServicio.match(/amazonaws\.com\/(.+)$/);
          if (keyMatch && keyMatch[1]) {
            await UploadFilesCloud.deleteFile({ bucketName: envs.AWS_BUCKET_NAME, key: keyMatch[1] })
              .catch((e: any) => console.error("Error al borrar imagen de S3:", e));
          }
        }
        if (servicio.videoUrl) {
          const keyMatch = servicio.videoUrl.match(/amazonaws\.com\/(.+)$/);
          if (keyMatch && keyMatch[1]) {
            await UploadFilesCloud.deleteFile({ bucketName: envs.AWS_BUCKET_NAME, key: keyMatch[1] })
              .catch((e: any) => console.error("Error al borrar video de S3:", e));
          }
        }

        servicio.imagenServicio = data.imagenServicio || null;
        servicio.videoUrl = data.videoUrl || null;
      }

      await servicio.save();
      return servicio;

    } catch (error: any) {
      console.error("Error original en updatePendingService:", error);
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer(error.message || "Error al actualizar el servicio");
    }
  }

  // ==================================
  // ADMIN METHODS
  // ==================================

  async getAllPendingServices() {
    try {
      const servicios = await Servicio.find({
        where: { statusServicio: StatusServicio.PENDIENTE },
        relations: ["user", "categoria", "subcategoria"],
        order: { createdAt: "ASC" }
      });
      return servicios;
    } catch (error) {
      throw CustomError.internalServer("Error al obtener servicios pendientes");
    }
  }

  async approveService(adminId: string, servicioId: string) {
    try {
      const servicio = await Servicio.findOne({ where: { id: servicioId } });
      if (!servicio) throw CustomError.notFound("Servicio no encontrado");

      if (servicio.statusServicio !== StatusServicio.PENDIENTE) {
        throw CustomError.badRequest("El servicio no está en estado pendiente");
      }

      servicio.statusServicio = StatusServicio.APROBADO;
      servicio.fechaInicioSuscripcion = new Date();
      // 30 días después
      const fechaFin = new Date();
      fechaFin.setDate(fechaFin.getDate() + 30);
      servicio.fechaFinSuscripcion = fechaFin;

      await servicio.save();
      return servicio;
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al aprobar el servicio");
    }
  }

  async rejectService(adminId: string, servicioId: string, motivo: string) {
    try {
      const servicio = await Servicio.findOne({ where: { id: servicioId }, relations: ["user", "user.wallet"] });
      if (!servicio) throw CustomError.notFound("Servicio no encontrado");

      if (servicio.statusServicio !== StatusServicio.PENDIENTE) {
        throw CustomError.badRequest("Solo se pueden rechazar servicios pendientes");
      }

      const settings = await GlobalSettings.findOne({ where: {} });
      const price = Number(settings?.servicePublicationPrice || 0);

      // Reembolso en transacción
      await Servicio.getRepository().manager.transaction(async (manager: any) => {
        servicio.statusServicio = StatusServicio.RECHAZADO;
        await manager.save(servicio);

        const wallet = servicio.user.wallet;
        if (wallet) {
          const previousBalance = Number(wallet.balance);
          const newBalance = previousBalance + price;

          wallet.balance = newBalance;
          await manager.save(wallet);

          const transaction = new Transaction();
          transaction.wallet = wallet;
          transaction.amount = price;
          transaction.type = "credit";
          transaction.reason = TransactionReason.REFUND;
          transaction.origin = TransactionOrigin.ADMIN;
          transaction.status = "APPROVED";
          transaction.previousBalance = previousBalance;
          transaction.resultingBalance = newBalance;
          transaction.reference = servicio.id;
          transaction.observation = "Reembolso por rechazo de servicio: " + motivo;
          
          await manager.save(transaction);
        }
      });

      return servicio;
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al rechazar el servicio");
    }
  }

  // ==================================
  // PUBLIC METHODS
  // ==================================

  async getPublicServicesByCategory(categoriaId: string) {
    try {
      const now = new Date();
      const servicios = await Servicio.find({
        where: {
          categoria: { id: categoriaId },
          statusServicio: StatusServicio.APROBADO,
          // Debería usarse un builder para filtrar fechaFinSuscripcion > now
        },
        relations: ["subcategoria", "user"],
      });

      // Filtro manual temporal
      const validos = servicios.filter(s => s.fechaFinSuscripcion && s.fechaFinSuscripcion > now);

      return validos;
    } catch (error) {
      throw CustomError.internalServer("Error al obtener servicios públicos");
    }
  }
}
