import {
  CategoriaNegocio,
  EstadoNegocio,
  ModeloMonetizacion,
  Negocio,
  StatusNegocio,
  User,
} from "../../data";
import { CustomError } from "../../domain";
import { CreateNegocioDTO } from "../../domain/dtos/negocios/CreateNegocioDTO";
import { envs, regularExp } from "../../config";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";

const DEFAULT_IMG_KEY = "ImgStore/imagenrota.jpg";

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class NegocioService {
  // ========================= CREATE =========================
  async createNegocio(dto: CreateNegocioDTO, img?: Express.Multer.File) {
    const categoria = await CategoriaNegocio.findOneBy({ id: dto.categoriaId });
    if (!categoria) throw CustomError.notFound("Categoría no encontrada");

    const usuario = await User.findOneBy({ id: dto.userId });
    if (!usuario) throw CustomError.notFound("Usuario no encontrado");

    if (categoria.soloComision && dto.modeloMonetizacion !== ModeloMonetizacion.COMISION_SUSCRIPCION) {
      throw CustomError.badRequest(
        `La categoría '${categoria.nombre}' solo permite el modelo COMISION + SUSCRIPCION`
      );
    }

    const nombreExistente = await Negocio.findOneBy({ nombre: dto.nombre });
    if (nombreExistente)
      throw CustomError.badRequest("Ese nombre ya está en uso");

    const negociosPendientes = await Negocio.count({
      where: {
        usuario: { id: dto.userId },
        statusNegocio: StatusNegocio.PENDIENTE,
      },
    });
    if (negociosPendientes >= 3) {
      throw CustomError.badRequest(
        "Ya tienes 3 negocios pendientes, espera aprobación"
      );
    }

    let key = DEFAULT_IMG_KEY;

    if (img) {
      const validMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!validMimeTypes.includes(img.mimetype)) {
        throw CustomError.badRequest(
          "Tipo de imagen no permitido. Usa JPG, PNG o WEBP."
        );
      }
      key = `negocios/${Date.now()}-${img.originalname}`;
      await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key,
        body: img.buffer,
        contentType: img.mimetype,
      });
    }

    const modelo = dto.modeloMonetizacion;

    // ⬇️ ⬇️ GUARDAMOS lat/long (y opcional direccionTexto si creas la columna)
    const negocio = Negocio.create({
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion.trim(),
      categoria,
      usuario,
      imagenNegocio: key,
      modeloMonetizacion: modelo,
      latitud: dto.latitud,
      longitud: dto.longitud,
      direccionTexto: dto.direccionTexto ?? null,
      banco: dto.banco,
      tipoCuenta: dto.tipoCuenta,
      numeroCuenta: dto.numeroCuenta,
      titularCuenta: dto.titularCuenta,
    });

    try {
      const saved = await negocio.save();
      return {
        id: saved.id,
        nombre: saved.nombre,
        descripcion: saved.descripcion,
        statusNegocio: saved.statusNegocio,
        created_at: saved.created_at,
        modeloMonetizacion: saved.modeloMonetizacion,
        latitud: saved.latitud,
        longitud: saved.longitud,
        categoria: {
          id: categoria.id,
          nombre: categoria.nombre,
          statusCategoria: categoria.statusCategoria,
        },
        usuario: { id: usuario.id },
      };
    } catch {
      throw CustomError.internalServer("No se pudo crear el negocio");
    }
  }

  // ========================= READ =========================
  // Función para barajar un array (Fisher-Yates Shuffle)

  async getNegociosByCategoria(categoriaId: string) {
    const categoria = await CategoriaNegocio.findOneBy({ id: categoriaId });
    if (!categoria) throw CustomError.notFound("Categoría no encontrada");

    const negocios = await Negocio.find({
      where: {
        categoria: { id: categoriaId },
        statusNegocio: StatusNegocio.ACTIVO,
        estadoNegocio: EstadoNegocio.ABIERTO, // 🔥 Nuevo filtro
      },
      relations: ["categoria"],
      // order: { nombre: "ASC" }, // Ya no necesario si vamos a barajar
    });

    const negociosConUrl = await Promise.all(
      negocios.map(async (negocio) => {
        let imagenUrl: string | null = null;

        if (negocio.imagenNegocio) {
          try {
            imagenUrl = await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: negocio.imagenNegocio,
            });
          } catch (error) {
            throw CustomError.internalServer(
              "Error obteniendo imagen del negocio"
            );
          }
        }

        return {
          id: negocio.id,
          nombre: negocio.nombre,
          descripcion: negocio.descripcion,
          statusNegocio: negocio.statusNegocio,
          estadoNegocio: negocio.estadoNegocio,
          created_at: negocio.created_at,
          categoria: {
            id: negocio.categoria.id,
            nombre: negocio.categoria.nombre,
            statusCategoria: negocio.categoria.statusCategoria,
          },
          imagenUrl,
        };
      })
    );

    // Barajar aleatoriamente antes de retornar
    return shuffleArray(negociosConUrl);
  }
  async toggleEstadoNegocio(negocioId: string) {
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

  async getNegociosFiltrados(status?: string) {
    let whereCondition: any = {};

    if (status === "VISIBLES") {
      whereCondition = {
        statusNegocio: [
          StatusNegocio.PENDIENTE,
          StatusNegocio.ACTIVO,
          StatusNegocio.SUSPENDIDO,
        ],
      };
    } else if (
      status &&
      Object.values(StatusNegocio).includes(status as StatusNegocio)
    ) {
      whereCondition = {
        statusNegocio: status,
      };
    }

    const negocios = await Negocio.find({
      where: whereCondition,
      relations: ["categoria", "usuario"],
      order: { nombre: "ASC" },
    });

    try {
      const negociosConUrl = await Promise.all(
        negocios.map(async (negocio) => {
          let imagenUrl: string | null = null;
          let userProfileUrl: string | null = null;

          if (negocio.imagenNegocio) {
            try {
              imagenUrl = await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: negocio.imagenNegocio,
              });
            } catch (error) {
              throw CustomError.internalServer(
                "Error obteniendo imagen del negocio"
              );
            }
          }

          if (negocio.usuario?.photoperfil) {
            try {
              userProfileUrl = await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: negocio.usuario.photoperfil,
              });
            } catch (error) {
              throw CustomError.internalServer(
                "Error obteniendo foto de perfil del usuario"
              );
            }
          }

          return {
            id: negocio.id,
            nombre: negocio.nombre,
            descripcion: negocio.descripcion,
            statusNegocio: negocio.statusNegocio,
            created_at: negocio.created_at,
            categoria: {
              id: negocio.categoria.id,
              nombre: negocio.categoria.nombre,
              statusCategoria: negocio.categoria.statusCategoria,
            },
            usuario: {
              id: negocio.usuario.id,
              name: negocio.usuario.name,
              surname: negocio.usuario.surname,
              whatsapp: negocio.usuario.whatsapp,
              photoperfil: userProfileUrl,
            },
            imagenUrl,
          };
        })
      );

      return negociosConUrl;
    } catch (error) {
      throw CustomError.internalServer("Error obteniendo datos de negocios");
    }
  }

  async getNegociosByUsuarioId(userId: string) {
    if (!regularExp.uuid.test(userId)) {
      throw CustomError.badRequest("ID de usuario inválido");
    }

    const negocios = await Negocio.find({
      where: { usuario: { id: userId } },
      relations: ["categoria"],
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
        } catch (error) {
          throw CustomError.internalServer(
            "Error al obtener la imagen del negocio"
          );
        }

        return {
          id: negocio.id,
          nombre: negocio.nombre,
          descripcion: negocio.descripcion,
          statusNegocio: negocio.statusNegocio,
          created_at: negocio.created_at,
          modeloMonetizacion: negocio.modeloMonetizacion,
          estadoNegocio: negocio.estadoNegocio,
          latitud: negocio.latitud ? Number(negocio.latitud) : null,
          longitud: negocio.longitud ? Number(negocio.longitud) : null,
          direccionTexto: negocio.direccionTexto,
          banco: negocio.banco,
          tipoCuenta: negocio.tipoCuenta,
          numeroCuenta: negocio.numeroCuenta,
          titularCuenta: negocio.titularCuenta,
          imagenUrl,
          categoria: {
            id: negocio.categoria.id,
            nombre: negocio.categoria.nombre,
            statusCategoria: negocio.categoria.statusCategoria,
            restriccionModeloMonetizacion:
              negocio.categoria.restriccionModeloMonetizacion,
          },
        };
      })
    );

    return negociosConImagen;
  }

  // ========================= UPDATE =========================

  // ✅ permitir actualizar lat/long en updateNegocio
  async updateNegocio(
    id: string,
    data: Partial<CreateNegocioDTO>,
    img?: Express.Multer.File
  ) {
    const negocio = await Negocio.findOne({
      where: { id },
      relations: ["categoria"],
    });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    if (data.nombre && data.nombre !== negocio.nombre) {
      const existe = await Negocio.findOneBy({ nombre: data.nombre });
      if (existe)
        throw CustomError.badRequest("Ya existe un negocio con ese nombre");
      negocio.nombre = data.nombre.trim();
    }

    if (data.descripcion) {
      negocio.descripcion = data.descripcion.trim();
    }

    if (data.categoriaId) {
      const categoria = await CategoriaNegocio.findOneBy({
        id: data.categoriaId,
      });
      if (!categoria) throw CustomError.notFound("Categoría no encontrada");
      negocio.categoria = categoria;

      if (
        data.modeloMonetizacion &&
        categoria.soloComision &&
        data.modeloMonetizacion !== ModeloMonetizacion.COMISION_SUSCRIPCION
      ) {
        throw CustomError.badRequest(
          "Esta categoría solo permite el modelo COMISION + SUSCRIPCION"
        );
      }
    }

    if (data.modeloMonetizacion) {
      if (
        negocio.categoria.soloComision &&
        data.modeloMonetizacion !== ModeloMonetizacion.COMISION_SUSCRIPCION
      ) {
        throw CustomError.badRequest(
          "Esta categoría solo permite el modelo COMISION + SUSCRIPCION"
        );
      }
      negocio.modeloMonetizacion = data.modeloMonetizacion;
    }

    // ⬇️ ⬇️ NUEVO: lat/long opcionales en update
    if (typeof data.latitud !== "undefined") {
      const lat = Number(data.latitud);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw CustomError.badRequest("Latitud inválida");
      }
      negocio.latitud = lat;
    }
    if (typeof data.longitud !== "undefined") {
      const lng = Number(data.longitud);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw CustomError.badRequest("Longitud inválida");
      }
      negocio.longitud = lng;
    }

    if (typeof (data as any).direccionTexto !== "undefined") {
      const dir = String((data as any).direccionTexto || "").trim();
      negocio.direccionTexto = dir.length ? dir.slice(0, 200) : null;
    }

    // ⬇️ Actualizar Datos Bancarios
    if (data.banco) negocio.banco = data.banco.trim();
    if (data.tipoCuenta) negocio.tipoCuenta = data.tipoCuenta.trim();
    if (data.numeroCuenta) negocio.numeroCuenta = data.numeroCuenta.trim();
    if (data.titularCuenta) negocio.titularCuenta = data.titularCuenta.trim();

    if (img) {
      const validMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!validMimeTypes.includes(img.mimetype)) {
        throw CustomError.badRequest(
          "Tipo de imagen no permitido. Usa JPG, PNG o WEBP."
        );
      }
      if (negocio.imagenNegocio !== DEFAULT_IMG_KEY) {
        await UploadFilesCloud.deleteFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: negocio.imagenNegocio,
        });
      }
      const newKey = `negocios/${Date.now()}-${img.originalname}`;
      await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: newKey,
        body: img.buffer,
        contentType: img.mimetype,
      });
      negocio.imagenNegocio = newKey;
    }

    const saved = await negocio.save();

    const imagenUrl = await UploadFilesCloud.getFile({
      bucketName: envs.AWS_BUCKET_NAME,
      key: saved.imagenNegocio,
    });

    return {
      id: saved.id,
      nombre: saved.nombre,
      descripcion: saved.descripcion,
      statusNegocio: saved.statusNegocio,
      modeloMonetizacion: saved.modeloMonetizacion,
      created_at: saved.created_at,
      latitud: saved.latitud,
      longitud: saved.longitud,
      categoria: {
        id: saved.categoria.id,
        nombre: saved.categoria.nombre,
        statusCategoria: saved.categoria.statusCategoria,
      },
      imagenUrl,
    };
  }

  // ========================= DELETE =========================
  async deleteIfNotActivo(id: string) {
    const negocio = await Negocio.findOneBy({ id });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    if (negocio.statusNegocio === StatusNegocio.ACTIVO) {
      throw CustomError.badRequest("No puedes eliminar un negocio ACTIVO");
    }

    if (negocio.imagenNegocio && negocio.imagenNegocio !== DEFAULT_IMG_KEY) {
      await UploadFilesCloud.deleteFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: negocio.imagenNegocio,
      });
    }

    await negocio.remove();
    return { message: "Negocio eliminado correctamente" };
  }

  async deleteNegocio(id: string) {
    const negocio = await Negocio.findOneBy({ id });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    if (negocio.imagenNegocio && negocio.imagenNegocio !== DEFAULT_IMG_KEY) {
      await UploadFilesCloud.deleteFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: negocio.imagenNegocio,
      });
    }

    await negocio.remove();
    return {
      message: "Negocio eliminado correctamente. Mensaje desde el backend",
    };
  }

  // ========================= TOGGLE STATUS =========================

  // ADMIN: Cambiar estado
  async changeStatusNegocioAdmin(id: string, status: StatusNegocio) {
    const negocio = await Negocio.findOneBy({ id });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    negocio.statusNegocio = status;

    await negocio.save();
    return { message: `Estado cambiado a ${status}`, status: negocio.statusNegocio };
  }

  // ADMIN: Purga definitiva
  async purgeNegocioAdmin(id: string) {
    return await this.deleteNegocio(id);
  }
}
