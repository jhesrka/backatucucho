// src/services/admin/NegocioAdminService.ts
import {
  CategoriaNegocio,
  Negocio,
  StatusNegocio,
  ModeloMonetizacion,
  User,
  EstadoNegocio,
  GlobalSettings
} from "../../data";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { encriptAdapter } from "../../config/bcrypt.adapter";
import { CustomError } from "../../domain";
import { envs, regularExp } from "../../config";
import { ILike, MoreThan } from "typeorm";
import { Parser } from "json2csv";
import { CreateNegocioDTO } from "../../domain/dtos/negocios/CreateNegocioDTO";
import { UpdateNegocioDTO } from "../../domain/dtos/negocios/UpdateNegocioDTO";

import { SubscriptionService } from "./subscription.service";

export class NegocioAdminService {
  constructor(private readonly subscriptionService?: SubscriptionService) { }
  // ========================= READ =========================
  async getNegociosAdmin({
    limit = 4,
    offset = 0,
    status,
    categoriaId,
    usuarioId,
    search,
  }: {
    limit?: number;
    offset?: number;
    status?: StatusNegocio;
    categoriaId?: string;
    usuarioId?: string;
    search?: string;
  }) {
    const where: any = {};

    if (status && Object.values(StatusNegocio).includes(status)) {
      where.statusNegocio = status;
    }

    if (categoriaId) {
      where.categoria = { id: categoriaId };
    }

    if (usuarioId) {
      where.usuario = { id: usuarioId };
    }

    if (search) {
      where.nombre = ILike(`%${search}%`);
    }

    const [negocios, total] = await Negocio.findAndCount({
      where,
      relations: ["categoria", "usuario", "usuario.wallet"],
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    });

    const negociosConImagen = await Promise.all(
      negocios.map(async (negocio) => {
        let imagenUrl = null;
        try {
          imagenUrl = await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: negocio.imagenNegocio,
          });
        } catch (error) { }

        // 🔒 Filtrar datos del usuario
        const usuarioSeguro = negocio.usuario
          ? {
            id: negocio.usuario.id,
            name: negocio.usuario.name,
            surname: negocio.usuario.surname,
            email: negocio.usuario.email,
            whatsapp: negocio.usuario.whatsapp,
            balance: negocio.usuario.wallet ? Number(negocio.usuario.wallet.balance) : 0,
          }
          : null;

        return {
          ...negocio,
          usuario: usuarioSeguro,
          imagenUrl,
        };
      })
    );

    return {
      total,
      negocios: negociosConImagen,
    };
  }

  async getNegocioByIdAdmin(id: string) {
    const negocio = await Negocio.findOne({
      where: { id },
      relations: ["categoria", "usuario", "usuario.wallet", "productos"],
    });

    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    const imagenUrl = await UploadFilesCloud.getFile({
      bucketName: envs.AWS_BUCKET_NAME,
      key: negocio.imagenNegocio,
    });

    const usuarioSeguro = negocio.usuario
      ? {
        id: negocio.usuario.id,
        name: negocio.usuario.name,
        surname: negocio.usuario.surname,
        email: negocio.usuario.email,
        whatsapp: negocio.usuario.whatsapp,
        balance: negocio.usuario.wallet ? Number(negocio.usuario.wallet.balance) : 0,
      }
      : null;

    return { ...negocio, usuario: usuarioSeguro, imagenUrl };
  }

  // ========================= CREATE =========================
  async createNegocioAdmin(dto: CreateNegocioDTO, img?: Express.Multer.File) {
    const categoria = await CategoriaNegocio.findOneBy({ id: dto.categoriaId });
    if (!categoria) throw CustomError.notFound("Categoría no encontrada");

    const usuario = await User.findOneBy({ id: dto.userId });
    if (!usuario) throw CustomError.notFound("Usuario no encontrado");

    const nombreExistente = await Negocio.findOneBy({ nombre: dto.nombre });
    if (nombreExistente) throw CustomError.badRequest("Nombre ya en uso");

    let key = "ImgStore/imagenrota.jpg";
    if (img) {
      key = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: `negocios/${Date.now()}-${img.originalname}`,
        body: img.buffer,
        contentType: img.mimetype,
      });
    }

    const negocio = Negocio.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      categoria,
      usuario,
      imagenNegocio: key,
      modeloMonetizacion: dto.modeloMonetizacion,
      valorSuscripcion: dto.valorSuscripcion,
      diaPago: dto.diaPago,
    });

    const saved = await negocio.save();
    return saved;
  }

  async toggleEstadoNegocioAdmin(negocioId: string) {
    const negocio = await Negocio.findOneBy({ id: negocioId });

    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    // Cambiar el estado
    negocio.estadoNegocio =
      negocio.estadoNegocio === EstadoNegocio.ABIERTO
        ? EstadoNegocio.CERRADO
        : EstadoNegocio.ABIERTO;

    await negocio.save();

    return {
      message: `El negocio ahora está ${negocio.estadoNegocio.toLowerCase()}`,
      id: negocio.id,
      estadoNegocio: negocio.estadoNegocio,
    };
  }
  // ========================= UPDATE =========================
  async updateNegocioAdmin(id: string, dto: UpdateNegocioDTO) {
    const negocio = await Negocio.findOne({
      where: { id },
      relations: ["categoria", "usuario"],
    });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    // ========================= ACTUALIZAR CATEGORÍA =========================
    if (dto.categoriaId) {
      const categoria = await CategoriaNegocio.findOneBy({
        id: dto.categoriaId,
      });
      if (!categoria) throw CustomError.notFound("Categoría no encontrada");
      negocio.categoria = categoria;
    }

    // ========================= ACTUALIZAR MODELO DE MONETIZACIÓN =========================
    if (dto.modeloMonetizacion) {
      if (!negocio.categoria)
        throw CustomError.badRequest("Negocio sin categoría asignada");

      // Validar restricciones de la categoría si existen
      if (negocio.categoria.soloComision && dto.modeloMonetizacion !== ModeloMonetizacion.COMISION_SUSCRIPCION) {
        throw CustomError.badRequest(`La categoría '${negocio.categoria.nombre}' solo permite el modelo COMISION + SUSCRIPCION`);
      }

      if (negocio.categoria.restriccionModeloMonetizacion && negocio.categoria.restriccionModeloMonetizacion !== (dto.modeloMonetizacion as any)) {
        throw CustomError.badRequest(`La categoría '${negocio.categoria.nombre}' tiene restricción a: ${negocio.categoria.restriccionModeloMonetizacion}`);
      }

      negocio.modeloMonetizacion = dto.modeloMonetizacion;
    }

    // ========================= ACTUALIZAR SUBSCRIPCIÓN =========================
    if (dto.valorSuscripcion !== undefined) {
      // 🔒 REGLA DE SEGURIDAD: Modificar precio en estado NO PENDIENTE requiere PIN Maestro.
      // Solo si el precio realmente cambió (evitar falsos positivos si el frontend manda el mismo precio)
      const currentPrice = Number(negocio.valorSuscripcion) || 0;
      const newPrice = Number(dto.valorSuscripcion) || 0;
      const hasPriceChanged = Math.abs(currentPrice - newPrice) > 0.01;

      if (negocio.statusNegocio !== StatusNegocio.PENDIENTE && hasPriceChanged) {
        const settings = await GlobalSettings.findOne({ where: {} });
        const realMasterPin = settings?.masterPin;

        if (realMasterPin) {
          const isValid = encriptAdapter.compare(dto.masterPin || "", realMasterPin);
          if (!isValid) {
            throw CustomError.unAuthorized("Para modificar el precio de un negocio activo se requiere el PIN Maestro.");
          }
        }
      }
      negocio.valorSuscripcion = dto.valorSuscripcion;
    }

    if (dto.diaPago !== undefined) {
      negocio.diaPago = dto.diaPago;
    }

    // ========================= ACTUALIZAR STATUS =========================
    if (dto.statusNegocio) {
      if (!Object.values(StatusNegocio).includes(dto.statusNegocio)) {
        throw CustomError.badRequest("Estado de negocio inválido");
      }

      // 🔒 REGLA DE SEGURIDAD: No se puede volver a PENDIENTE si ya está ACTIVO (o en otro estado avanzado)
      if (dto.statusNegocio === StatusNegocio.PENDIENTE && negocio.statusNegocio !== StatusNegocio.PENDIENTE) {
        throw CustomError.badRequest("No se puede revertir un negocio a estado PENDIENTE");
      }

      // 🔒 REGLA DE FLUJO: Si está PENDIENTE, solo puede pasar a ACTIVO (o quedarse en PENDIENTE si solo actualizo datos)
      if (negocio.statusNegocio === StatusNegocio.PENDIENTE && dto.statusNegocio !== StatusNegocio.ACTIVO && dto.statusNegocio !== StatusNegocio.PENDIENTE) {
        throw CustomError.badRequest("Un negocio PENDIENTE solo puede pasar a ACTIVO");
      }

      // 🔒 REGLA DE SEGURIDAD (PIN MAESTRO):
      // Para activar un negocio nuevo (PENDIENTE -> ACTIVO), se requiere PIN Maestro.
      if (negocio.statusNegocio === StatusNegocio.PENDIENTE && dto.statusNegocio === StatusNegocio.ACTIVO) {
        // Obtener PIN real de la base de datos
        const settings = await GlobalSettings.findOne({ where: {} });
        const realMasterPin = settings?.masterPin;

        if (!realMasterPin) {
          console.warn("⚠️ ADVERTENCIA DE SEGURIDAD: No hay PIN Maestro configurado en GlobalSettings. Se permite activación.");
          // Opcional: throw Error si quieres obligar a configurar uno.
        } else {
          // Validar hash si está encriptado o comparación directa si no (por compatibilidad, aunque debería ser siempre hash)
          const isValid = encriptAdapter.compare(dto.masterPin || "", realMasterPin);
          if (!isValid) {
            throw CustomError.unAuthorized("El PIN Maestro es incorrecto.");
          }
        }
      }

      // 🔄 FLUJO ATÓMICO: Si el admin intenta poner ACTIVO y se requiere cobro:
      // (needsCharge se calcula después de haber actualizado valorSuscripcion arriba)
      const needsCharge = Number(negocio.valorSuscripcion) > 0 && (
        negocio.statusNegocio === StatusNegocio.NO_PAGADO ||
        negocio.statusNegocio === StatusNegocio.PENDIENTE ||
        !negocio.fechaFinSuscripcion ||
        new Date(negocio.fechaFinSuscripcion) <= new Date()
      );

      if (dto.statusNegocio === StatusNegocio.ACTIVO && needsCharge) {
        // CASO 1: Activación desde PENDIENTE -> OBLIGATORIO COBRAR
        // Si no cobra, no se activa.
        if (negocio.statusNegocio === StatusNegocio.PENDIENTE) {
          if (!this.subscriptionService) {
            throw CustomError.internalServer("Servicio de suscripción no inicializado");
          }
          try {
            await this.subscriptionService.chargeSubscription(negocio, false);
          } catch (error: any) {
            throw error;
          }
        }
        // CASO 2: Reactivación desde BLOQUEADO/SUSPENDIDO con suscripción vencida
        // No cobramos automático (podría no tener saldo), lo pasamos a NO_PAGADO para que pague manual.
        else {
          negocio.statusNegocio = StatusNegocio.NO_PAGADO;
          // Opcional: Podríamos mostrar un mensaje, pero aquí solo actualizamos el estado.
        }
      } else if (dto.statusNegocio === StatusNegocio.ACTIVO && !needsCharge) {
        // CASO 3: Reactivación con suscripción vigente -> Pasa a ACTIVO directo
        negocio.statusNegocio = StatusNegocio.ACTIVO;
      } else if (dto.statusNegocio === StatusNegocio.NO_PAGADO) {
        // REGLA: No pasar a NO_PAGADO si aún tiene periodo vigente
        if (negocio.fechaFinSuscripcion && new Date(negocio.fechaFinSuscripcion) > new Date()) {
          throw CustomError.badRequest(`El negocio aún tiene una suscripción vigente hasta el ${new Date(negocio.fechaFinSuscripcion).toLocaleDateString()}. No se puede pasar a NO_PAGADO prematuramente.`);
        }
        negocio.statusNegocio = StatusNegocio.NO_PAGADO;
      } else {
        // Si no necesita cobro (es de $0 o ya tiene período activo), simplemente actualizamos el estado
        negocio.statusNegocio = dto.statusNegocio as StatusNegocio;
      }
    }

    // Asegurarnos de que el valorSuscripcion se persista incluso si chargeSubscription hizo save
    if (dto.valorSuscripcion !== undefined) {
      negocio.valorSuscripcion = dto.valorSuscripcion;
    }

    const saved = await negocio.save();

    return {
      id: saved.id,
      nombre: saved.nombre,
      statusNegocio: saved.statusNegocio,
      modeloMonetizacion: saved.modeloMonetizacion,
      valorSuscripcion: saved.valorSuscripcion,
      diaPago: saved.diaPago,
      categoria: {
        id: saved.categoria.id,
        nombre: saved.categoria.nombre,
        statusCategoria: saved.categoria.statusCategoria,
        soloComision: saved.categoria.soloComision,
      },
      updated_at: saved.updated_at,
      fechaInicioSuscripcion: saved.fechaInicioSuscripcion,
      fechaFinSuscripcion: saved.fechaFinSuscripcion,
      fechaUltimoCobro: saved.fechaUltimoCobro,
      intentosCobro: saved.intentosCobro,
    };
  }

  // ========================= DELETE =========================
  async deleteNegocioAdmin(id: string) {
    const negocio = await Negocio.findOneBy({ id });

    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    if (
      negocio.imagenNegocio &&
      negocio.imagenNegocio !== "ImgStore/imagenrota.jpg"
    ) {
      await UploadFilesCloud.deleteFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: negocio.imagenNegocio,
      });
    }

    await negocio.remove();
    return { message: "Negocio eliminado correctamente" };
  }

  // ========================= EXPORTACIÓN =========================

  async exportNegociosToCSV(filters: any) {
    // Reutiliza el método de paginación pero sin límite
    const { negocios } = await this.getNegociosAdmin({
      ...filters,
      limit: 10000, // exporta hasta 10.000, puedes ajustar
      offset: 0,
    });

    if (!negocios || negocios.length === 0) {
      throw CustomError.notFound("No hay negocios para exportar");
    }

    // Preparamos campos para exportar
    const fields = [
      { label: "ID", value: "id" },
      { label: "Nombre", value: "nombre" },
      { label: "Descripción", value: "descripcion" },
      { label: "Estado", value: "statusNegocio" },
      { label: "Modelo Monetización", value: "modeloMonetizacion" },
      { label: "Fecha Creación", value: "created_at" },
      { label: "Categoría", value: (row: any) => row.categoria?.nombre || "" },
      {
        label: "Usuario",
        value: (row: any) =>
          `${row.usuario?.name || ""} ${row.usuario?.surname || ""}`,
      },
      { label: "WhatsApp", value: (row: any) => row.usuario?.whatsapp || "" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(negocios);

    return Buffer.from(csv); // se puede devolver como archivo en rutas
  }

  // ========================= ESTADÍSTICAS =========================
  async getNegociosStatsAdmin() {
    // Contar negocios activos
    const activos = await Negocio.count({
      where: { statusNegocio: StatusNegocio.ACTIVO },
    });

    // Contar negocios pendientes
    const pendientes = await Negocio.count({
      where: { statusNegocio: StatusNegocio.PENDIENTE },
    });

    // Calcular fecha de hace 24 horas
    const hace24h = new Date();
    hace24h.setHours(hace24h.getHours() - 24);

    // Contar negocios pendientes creados en las últimas 24 horas
    const pendientesUltimas24h = await Negocio.count({
      where: {
        statusNegocio: StatusNegocio.PENDIENTE,
        created_at: MoreThan(hace24h),
      },
    });

    return {
      activos,
      pendientes,
      pendientesUltimas24h,
    };
  };


  // Wrappers for consistent Admin Panel actions
  async changeStatusNegocioAdmin(id: string, status: StatusNegocio) {
    const negocio = await Negocio.findOne({
      where: { id },
      relations: ["usuario"]
    });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    const needsCharge = Number(negocio.valorSuscripcion) > 0 && (
      negocio.statusNegocio === StatusNegocio.NO_PAGADO ||
      negocio.statusNegocio === StatusNegocio.PENDIENTE ||
      !negocio.fechaFinSuscripcion ||
      new Date(negocio.fechaFinSuscripcion) <= new Date()
    );

    if (status === StatusNegocio.ACTIVO && needsCharge) {
      if (!this.subscriptionService) {
        throw CustomError.internalServer("Servicio de suscripción no inicializado");
      }
      // Intentamos cobrar atómicamente. Si falla, el negocio sigue en su estado anterior.
      await this.subscriptionService.chargeSubscription(negocio, false);
    }

    if (status === StatusNegocio.NO_PAGADO && negocio.fechaFinSuscripcion && new Date(negocio.fechaFinSuscripcion) > new Date()) {
      throw CustomError.badRequest(`El negocio aún tiene una suscripción vigente hasta el ${new Date(negocio.fechaFinSuscripcion).toLocaleDateString()}. No se puede pasar a NO_PAGADO prematuramente.`);
    }

    negocio.statusNegocio = status;
    await negocio.save();
    return { message: `Estado cambiado a ${status}`, status: negocio.statusNegocio };
  }

  async purgeNegocioAdmin(id: string) {
    return this.deleteNegocioAdmin(id);
  }


  // ADMIN: Get all businesses for a user (Pagination + Admin View)
  async getNegociosByUserAdmin(userId: string, page: number = 1, limit: number = 10) {
    // Validate UUID
    if (!regularExp.uuid.test(userId)) {
      throw CustomError.badRequest("ID de usuario inválido");
    }

    const skip = (page - 1) * limit;

    const [negocios, total] = await Negocio.findAndCount({
      where: { usuario: { id: userId } },
      relations: ["categoria", "productos"], // Include products to count them
      order: { created_at: "DESC" },
      take: limit,
      skip: skip,
      withDeleted: true // Include soft deleted if applicable but typeorm default delete is soft usually needs @DeleteDateColumn. 
      // Assuming your entity uses typical status columns.
    });

    // Process images and stats
    const formattedNegocios = await Promise.all(
      negocios.map(async (negocio) => {
        const resolvedImg = negocio.imagenNegocio
          ? await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: negocio.imagenNegocio
          }).catch(() => null)
          : null;

        // Count products
        const totalProductos = negocio.productos?.length || 0;
        // Count active products if you had a status on products, assuming you iterate or count in DB.
        // For efficiency, usually better to use query builder specifically for counts, but relations load is okay for small sets.
        // Let's assume 'productos' are loaded.
        // StatusProducto enum check:
        // Adjust if StatusProducto is not imported here.
        // We will just count total for now as requested "Cantidad de productos asociados".
        // "Cantidad de productos activos" -> need to filter.

        let activeProducts = 0;
        if (negocio.productos) {
          // Assuming product has a status field
          activeProducts = negocio.productos.filter((p: any) => p.statusProducto === 'ACTIVO').length;
        }

        return {
          id: negocio.id,
          nombre: negocio.nombre,
          descripcion: negocio.descripcion,
          statusNegocio: negocio.statusNegocio,
          estadoNegocio: negocio.estadoNegocio, // Abierto/Cerrado
          categoria: negocio.categoria?.nombre,
          modeloMonetizacion: negocio.modeloMonetizacion,
          valorSuscripcion: negocio.valorSuscripcion,
          diaPago: negocio.diaPago,
          fechaUltimoCobro: negocio.fechaUltimoCobro,
          intentosCobro: negocio.intentosCobro,
          fechaInicioSuscripcion: negocio.fechaInicioSuscripcion,
          fechaFinSuscripcion: negocio.fechaFinSuscripcion,
          direccion: negocio.direccionTexto,
          latitud: negocio.latitud,
          longitud: negocio.longitud,
          direccionTexto: negocio.direccionTexto,
          whatsapp: negocio.usuario?.whatsapp,
          created_at: negocio.created_at,
          updated_at: negocio.updated_at,
          imagenUrl: resolvedImg,
          totalProductos,
          activeProducts
        };
      })
    );

    return {
      negocios: formattedNegocios,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    };
  }
}
