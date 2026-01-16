// src/services/admin/NegocioAdminService.ts
import {
  CategoriaNegocio,
  Negocio,
  StatusNegocio,
  ModeloMonetizacion,
  User,
  EstadoNegocio,
} from "../../data";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { CustomError } from "../../domain";
import { envs, regularExp } from "../../config";
import { ILike, MoreThan } from "typeorm";
import { Parser } from "json2csv";
import { CreateNegocioDTO } from "../../domain/dtos/negocios/CreateNegocioDTO";
import { UpdateNegocioDTO } from "../../domain/dtos/negocios/UpdateNegocioDTO";

export class NegocioAdminService {
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
      relations: ["categoria", "usuario"],
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
        } catch (error) {}

        // 🔒 Filtrar datos del usuario
        const usuarioSeguro = negocio.usuario
          ? {
              id: negocio.usuario.id,
              name: negocio.usuario.name,
              surname: negocio.usuario.surname,
              whatsapp: negocio.usuario.whatsapp,
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
      relations: ["categoria", "usuario", "productos"],
    });

    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    const imagenUrl = await UploadFilesCloud.getFile({
      bucketName: envs.AWS_BUCKET_NAME,
      key: negocio.imagenNegocio,
    });

    return { ...negocio, imagenUrl };
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
      key = `negocios/${Date.now()}-${img.originalname}`;
      await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key,
        body: img.buffer,
        contentType: img.mimetype,
      });
    }

    const modelo =
      dto.modeloMonetizacion === "COMISION"
        ? ModeloMonetizacion.COMISION
        : ModeloMonetizacion.SUSCRIPCION;

    const negocio = Negocio.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      categoria,
      usuario,
      imagenNegocio: key,
      modeloMonetizacion: modelo,
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
      relations: ["categoria"],
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
      if (
        negocio.categoria.soloComision &&
        dto.modeloMonetizacion !== "COMISION"
      ) {
        throw CustomError.badRequest(
          `La categoría '${negocio.categoria.nombre}' solo permite modelo COMISION`
        );
      }
      negocio.modeloMonetizacion =
        dto.modeloMonetizacion === "COMISION"
          ? ModeloMonetizacion.COMISION
          : ModeloMonetizacion.SUSCRIPCION;
    }

    // ========================= ACTUALIZAR STATUS =========================
    if (dto.statusNegocio) {
      if (!Object.values(StatusNegocio).includes(dto.statusNegocio)) {
        throw CustomError.badRequest("Estado de negocio inválido");
      }
      negocio.statusNegocio = dto.statusNegocio;
    }

    const saved = await negocio.save();

    return {
      id: saved.id,
      nombre: saved.nombre,
      statusNegocio: saved.statusNegocio,
      modeloMonetizacion: saved.modeloMonetizacion,
      categoria: {
        id: saved.categoria.id,
        nombre: saved.categoria.nombre,
        statusCategoria: saved.categoria.statusCategoria,
        soloComision: saved.categoria.soloComision,
      },
      updated_at: saved.updated_at,
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
  }


}
