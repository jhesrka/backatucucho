import { RechargeRequest, StatusRecarga, Wallet } from "../../../data";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { envs } from "../../../config";
import { CreateRechargeRequestDTO, CustomError } from "../../../domain";
import { UserService } from "../usuario/user.service";
import { Parser } from "json2csv";
import { Between, LessThan } from "typeorm";

export class RechargeRequestService {
  constructor(private readonly userService: UserService) {}
  //USUARIO

  //CREAR UNA RECARGA
  async createRecharge(
    rechargeData: CreateRechargeRequestDTO,
    file: Express.Multer.File
  ) {
    if (!file) {
      throw CustomError.badRequest("El comprobante de banco es obligatorio");
    }
    const recharge = new RechargeRequest();
    let key: string;
    let url: string;

    const user = await this.userService.findOneUser(rechargeData.userId);

    try {
      key = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: `recharge/${Date.now()}-${file.originalname}`,
        body: file.buffer,
        contentType: file.mimetype,
      });
      recharge.receipt_image = key;

      url = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key,
      });
    } catch (error) {
      throw CustomError.internalServer(
        "Error subiendo la imagen del comprobante de banco"
      );
    }
    (recharge.amount = rechargeData.amount),
      (recharge.bank_name = rechargeData.bank_name),
      (recharge.transaction_date = rechargeData.transaction_date),
      (recharge.receipt_number = rechargeData.receipt_number),
      (recharge.user = user);

    try {
      const savedRecharge = await recharge.save();
      savedRecharge.receipt_image = url;
      return savedRecharge;
    } catch (error) {
      throw CustomError.internalServer("Error creando la solicitud de recarga");
    }
  }

  //OBTENER RECARGAS POR USUARIO ID CON PAGINACION 3
  async getByUser(userId: string, page: number = 1) {
    const take = 3;
    const skip = (page - 1) * take;

    const [requests, total] = await RechargeRequest.findAndCount({
      where: { user: { id: userId } },
      relations: ["user"],
      order: { created_at: "DESC" },
      take,
      skip,
    });

    const data = await Promise.all(
      requests.map(async (req) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: req.receipt_image,
        });

        return {
          id: req.id,
          amount: req.amount,
          bank_name: req.bank_name,
          transaction_date: req.transaction_date,
          receipt_number: req.receipt_number,
          status: req.status,
          admin_comment: req.admin_comment,
          created_at: req.created_at,
          resolved_at: req.resolved_at,
          receiptImage: imageUrl,
        };
      })
    );

    return {
      total,
      currentPage: page,
      totalPages: Math.ceil(total / take),
      data,
    };
  }

  //Filtrar por estado
  async filterByStatus(
    status: StatusRecarga,
    userId: string, // Hacer el userId opcional para mantener compatibilidad
    page: number = 1,
    itemsPerPage: number = 3
  ) {
    const skip = (page - 1) * itemsPerPage;

    // Crear objeto where dinámico
    const where: any = { status };

    // Si se proporciona userId, filtrar también por usuario
    if (userId) {
      where.user = { id: userId };
    }

    const [requests, total] = await RechargeRequest.findAndCount({
      where,
      relations: ["user"],
      order: { created_at: "DESC" },
      skip,
      take: itemsPerPage,
    });

    // Optimización: Obtener todas las imágenes en paralelo
    const data = await Promise.all(
      requests.map(async (r) => {
        const [imageUrl, photoUrl] = await Promise.all([
          UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: r.receipt_image,
          }),
          r.user.photoperfil
            ? UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: r.user.photoperfil,
              })
            : Promise.resolve(null),
        ]);

        return {
          id: r.id,
          amount: Number(r.amount),
          bank_name: r.bank_name,
          transaction_date: r.transaction_date,
          receipt_number: r.receipt_number,
          status: r.status,
          admin_comment: r.admin_comment,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          receiptImage: imageUrl,
          user: {
            id: r.user.id,
            name: r.user.name,
            surname: r.user.surname,
            email: r.user.email,
            photoperfil: photoUrl,
            whatsapp: r.user.whatsapp,
            status: r.user.status,
          },
        };
      })
    );

    return {
      total,
      currentPage: page,
      totalPages: Math.ceil(total / itemsPerPage),
      data,
    };
  }

  //Filtrar por rango de fechas
  async filterByDateRangeForUser(
    userId: string,
    startDate: Date,
    endDate: Date,
    page: number = 1,
    itemsPerPage: number = 9
  ) {
    // Ajustar las fechas para reflejar correctamente el rango en UTC-5 (Ecuador)
    const start = new Date(startDate);
    start.setUTCHours(5, 0, 0, 0); // 00:00 en Ecuador es 05:00 UTC

    const end = new Date(endDate);
    end.setUTCHours(28, 59, 59, 999); // 23:59 en Ecuador es 04:59 UTC del día siguiente

    const [userRequests, total] = await RechargeRequest.findAndCount({
      where: {
        user: { id: userId }, // Filtro por usuario
        created_at: Between(start, end), // Filtro por rango de fechas
      },
      relations: ["user"],
      order: { created_at: "DESC" },
      skip: (page - 1) * itemsPerPage,
      take: itemsPerPage,
    });

    const data = await Promise.all(
      userRequests.map(async (r) => {
        const [imageUrl, photoUrl] = await Promise.all([
          UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: r.receipt_image,
          }),
          UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: r.user.photoperfil,
          }),
        ]);

        return {
          id: r.id,
          amount: Number(r.amount),
          bank_name: r.bank_name,
          transaction_date: r.transaction_date,
          receipt_number: r.receipt_number,
          status: r.status,
          admin_comment: r.admin_comment,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          receiptImage: imageUrl,
          user: {
            id: r.user.id,
            name: r.user.name,
            surname: r.user.surname,
            email: r.user.email,
            photoperfil: photoUrl,
            whatsapp: r.user.whatsapp,
            status: r.user.status,
          },
        };
      })
    );

    return {
      total,
      currentPage: page,
      totalPages: Math.ceil(total / itemsPerPage),
      data,
    };
  }

  //ADMINISTRADOR

  //1 Obtener todas las recargas con paginación (para admins)
  async getAllRequestsPaginated(page: number = 1) {
    const take = 10;
    const skip = (page - 1) * take;

    const [requests, total] = await RechargeRequest.findAndCount({
      relations: ["user"],
      order: { created_at: "DESC" },
      skip,
      take,
    });

    const data = await Promise.all(
      requests.map(async (r) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.receipt_image,
        });

        const photoUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.user.photoperfil,
        });

        return {
          id: r.id,
          amount: Number(r.amount),
          bank_name: r.bank_name,
          transaction_date: r.transaction_date,
          receipt_number: r.receipt_number,
          status: r.status,
          admin_comment: r.admin_comment,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          receiptImage: imageUrl,
          user: {
            id: r.user.id,
            name: r.user.name,
            surname: r.user.surname,
            email: r.user.email,
            photoperfil: photoUrl,
            whatsapp: r.user.whatsapp,
            status: r.user.status,
          },
        };
      })
    );

    return {
      total,
      currentPage: page,
      totalPages: Math.ceil(total / take),
      data,
    };
  }

  //2 Buscar por nombre de banco, ID, monto o comprobante
  async searchRechargeRequests(term: string) {
    const allRequests = await RechargeRequest.find({
      relations: ["user"],
      order: { created_at: "DESC" },
    });

    const termLower = term.toLowerCase();

    const filtered = allRequests.filter((r) => {
      return (
        r.bank_name.toLowerCase().includes(termLower) ||
        r.id === term ||
        r.receipt_number === term ||
        r.amount.toString().includes(term)
      );
    });

    return await Promise.all(
      filtered.map(async (r) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.receipt_image,
        });

        const photoUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.user.photoperfil,
        });

        return {
          id: r.id,
          amount: Number(r.amount),
          bank_name: r.bank_name,
          transaction_date: r.transaction_date,
          receipt_number: r.receipt_number,
          status: r.status,
          admin_comment: r.admin_comment,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          receiptImage: imageUrl,
          user: {
            id: r.user.id,
            name: r.user.name,
            surname: r.user.surname,
            email: r.user.email,
            photoperfil: photoUrl,
            whatsapp: r.user.whatsapp,
            status: r.user.status,
          },
        };
      })
    );
  }

  //3 OBTENER TODAS LAS RECARGAS SOLO EN ESTADO PEDIENTE
  async getAllRechargeRequests() {
    const requests = await RechargeRequest.find({
      relations: ["user"],
      order: { created_at: "DESC" },
      where: { status: StatusRecarga.PENDIENTE }, // solo solicitudes pendientes
    });

    return await Promise.all(
      requests.map(async (req) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: req.receipt_image,
        });

        const photoUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: req.user.photoperfil,
        });

        return {
          id: req.id,
          amount: Number(req.amount),
          bank_name: req.bank_name,
          transaction_date: req.transaction_date,
          receipt_number: req.receipt_number,
          status: req.status,
          admin_comment: req.admin_comment,
          created_at: req.created_at,
          resolved_at: req.resolved_at,
          receiptImage: imageUrl,
          user: {
            id: req.user.id,
            name: req.user.name,
            surname: req.user.surname,
            email: req.user.email,
            photoperfil: photoUrl,
            whatsapp: req.user.whatsapp,
            status: req.user.status,
          },
        };
      })
    );
  }

  //4  Filtrar por rango de fechas con paginación y opción de exportar
  async filterByDateRangePaginated(
    startDate: Date,
    endDate: Date,
    page: number = 1
  ) {
    const take = 9;
    const skip = (page - 1) * take;

    // Ajustar las fechas para reflejar correctamente el rango en UTC-5 (Ecuador)
    const start = new Date(startDate);
    start.setUTCHours(5, 0, 0, 0); // 00:00 en Ecuador es 05:00 UTC

    const end = new Date(endDate);
    end.setUTCHours(28, 59, 59, 999); // 23:59 en Ecuador es 04:59 UTC del día siguiente

    const [allRequests, total] = await RechargeRequest.findAndCount({
      relations: ["user"],
      order: { created_at: "DESC" },
      where: {
        created_at: Between(start, end),
      },
      skip,
      take,
    });

    const data = await Promise.all(
      allRequests.map(async (r) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.receipt_image,
        });

        const photoUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.user.photoperfil,
        });

        return {
          id: r.id,
          amount: Number(r.amount),
          bank_name: r.bank_name,
          transaction_date: r.transaction_date,
          receipt_number: r.receipt_number,
          status: r.status,
          admin_comment: r.admin_comment,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          receiptImage: imageUrl,
          user: {
            id: r.user.id,
            name: r.user.name,
            surname: r.user.surname,
            email: r.user.email,
            photoperfil: photoUrl,
            whatsapp: r.user.whatsapp,
            status: r.user.status,
          },
        };
      })
    );

    return {
      total,
      currentPage: page,
      totalPages: Math.ceil(total / take),
      data,
    };
  }
  // 5 ACTUALIZA SOLO EL ESTADO PEDIENTE DE UN USUARIO
  async updateStatus(
    id: string,
    status: StatusRecarga,
    adminComment?: string,
    bank_name?: string,
    amount?: number,
    transaction_date?: string,
    receipt_number?: string
  ) {
    const request = await RechargeRequest.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!request)
      throw CustomError.notFound("Solicitud de recarga no encontrada");

    if (request.status !== StatusRecarga.PENDIENTE)
      throw CustomError.badRequest("La solicitud ya fue procesada");

    // Validar que el nuevo estado sea APROBADO o RECHAZADO
    if (![StatusRecarga.APROBADO, StatusRecarga.RECHAZADO].includes(status)) {
      throw CustomError.badRequest(
        "Estado inválido. Debe ser 'APROBADO' o 'RECHAZADO'"
      );
    }

    // Actualizar campos opcionales
    if (bank_name) request.bank_name = bank_name;
    if (amount !== undefined) request.amount = Number(amount);
    if (transaction_date) request.transaction_date = new Date(transaction_date);
    if (receipt_number) request.receipt_number = receipt_number;

    request.status = status;
    request.admin_comment = adminComment ?? "";
    request.resolved_at = new Date();
    await request.save();

    // Si fue aprobado, actualizar la wallet del usuario
    if (status === StatusRecarga.APROBADO) {
      const wallet = await Wallet.findOne({
        where: { user: { id: request.user.id } },
      });

      if (!wallet)
        throw CustomError.notFound("Wallet del usuario no encontrada");

      wallet.balance = Number(wallet.balance) + Number(request.amount);
      await wallet.save();
    }

    return {
      id: request.id,
      amount: Number(request.amount),
      bank_name: request.bank_name,
      transaction_date: request.transaction_date,
      receipt_number: request.receipt_number,
      receipt_image: request.receipt_image,
      status: request.status,
      admin_comment: request.admin_comment,
      created_at: request.created_at,
      resolved_at: request.resolved_at,
    };
  }

  //6
  async exportToCSVByDate(startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    start.setUTCHours(5, 0, 0, 0); // 00:00 hora Ecuador (UTC-5)

    const end = new Date(endDate);
    end.setUTCHours(28, 59, 59, 999); // 23:59 hora Ecuador (UTC-5) => 04:59 UTC del día siguiente

    const allRequests = await RechargeRequest.find({
      relations: ["user"],
      where: {
        created_at: Between(start, end), // 🔥 corregido aquí también
      },
      order: {
        created_at: "DESC",
      },
    });

    const data = await Promise.all(
      allRequests.map(async (r) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.receipt_image,
        });

        const photoUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: r.user.photoperfil,
        });

        return {
          id: r.id,
          amount: Number(r.amount),
          bank_name: r.bank_name,
          transaction_date: r.transaction_date,
          receipt_number: r.receipt_number,
          status: r.status,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          "user.name": r.user.name,
          "user.email": r.user.email,
          "user.whatsapp": r.user.whatsapp,
        };
      })
    );

    const csvFields = [
      "id",
      "amount",
      "bank_name",
      "transaction_date",
      "receipt_number",
      "status",
      "created_at",
      "resolved_at",
      "user.name",
      "user.email",
      "user.whatsapp",
    ];

    const parser = new Parser({ fields: csvFields });
    const csv = parser.parse(data);

    return csv;
  }

  //7 FILTRAR POR ESTADO

  async filterByStatusAdmin(
    status: StatusRecarga,
    page: number = 1,
    itemsPerPage: number = 3
  ) {
    const skip = (page - 1) * itemsPerPage;

    // Objeto where simplificado - solo filtra por estado
    const where = { status }; // ← Eliminamos el filtro por usuario

    const [requests, total] = await RechargeRequest.findAndCount({
      where, // Solo aplica { status }
      relations: ["user"], // Mantenemos la relación para traer datos del usuario
      order: { created_at: "DESC" },
      skip,
      take: itemsPerPage,
    });

    // Optimización: Obtener imágenes en paralelo (igual que antes)
    const data = await Promise.all(
      requests.map(async (r) => {
        const [imageUrl, photoUrl] = await Promise.all([
          UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: r.receipt_image,
          }),
          r.user.photoperfil
            ? UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: r.user.photoperfil,
              })
            : Promise.resolve(null),
        ]);

        return {
          id: r.id,
          amount: Number(r.amount),
          bank_name: r.bank_name,
          transaction_date: r.transaction_date,
          receipt_number: r.receipt_number,
          status: r.status,
          admin_comment: r.admin_comment,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          receiptImage: imageUrl,
          user: {
            id: r.user.id,
            name: r.user.name,
            surname: r.user.surname,
            email: r.user.email,
            photoperfil: photoUrl,
            whatsapp: r.user.whatsapp,
            status: r.user.status,
          },
        };
      })
    );

    return {
      total,
      currentPage: page,
      totalPages: Math.ceil(total / itemsPerPage),
      data,
    };
  }
  // 8. Eliminar solicitudes de recarga más antiguas a X días (ejemplo: 2 días)
  async deleteOldRechargeRequests() {
    // 🧪 Por ahora usamos 2 días, después puedes cambiarlo a 60 días para "2 meses"
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - 60); // 👈 Aquí cambiarás a -60 para 2 meses

    // Encontramos solicitudes anteriores a esa fecha
    const oldRequests = await RechargeRequest.find({
      where: {
        created_at: LessThan(cutoffDate),
      },
    });

    if (!oldRequests.length) {
      return {
        deleted: 0,
        message: "No hay solicitudes antiguas para eliminar.",
      };
    }

    // Eliminamos en lote
    const result = await RechargeRequest.remove(oldRequests);

    return {
      deleted: result.length,
      message: `${result.length} solicitudes eliminadas correctamente.`,
    };
  }
}
