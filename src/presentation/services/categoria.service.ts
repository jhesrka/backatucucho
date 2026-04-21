import { CategoriaNegocio } from "../../data";
import { CustomError } from "../../domain";
import { CreateCategoriaDTO } from "../../domain/dtos/categoriaProductos/CreateCategoriaDTO";
import { UpdateCategoriaDTO } from "../../domain/dtos/categoriaProductos/UpdateCategoriaDTO";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs } from "../../config";
import { GlobalSettings } from "../../data/postgres/models/global-settings.model";
import bcrypt from "bcryptjs";

export class CategoriaService {
  // Crear categoría
  async createCategoria(dto: CreateCategoriaDTO, iconFile: Express.Multer.File, masterPin: string, coverFile?: Express.Multer.File) {
    await this.verifyMasterPin(masterPin);
    let key: string;

    try {
      key = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: `categorias/${Date.now()}-${iconFile.originalname}`,
        body: iconFile.buffer,
        contentType: iconFile.mimetype,
      });
    } catch (error) {
      throw CustomError.internalServer("Error subiendo la imagen de la categoría");
    }

    let cover = dto.cover;
    if (coverFile) {
      try {
        const coverKey = await UploadFilesCloud.uploadSingleFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: `categorias/covers/${Date.now()}-${coverFile.originalname}`,
          body: coverFile.buffer,
          contentType: coverFile.mimetype,
        });
        if (!cover) cover = { type: "image", imageUrl: coverKey };
        else cover.imageUrl = coverKey;
      } catch (error) {
        throw CustomError.internalServer("Error subiendo la imagen de portada");
      }
    }

    const categoria = CategoriaNegocio.create({
      nombre: dto.name,
      icono: key,
      restriccionModeloMonetizacion: dto.restriccionModeloMonetizacion ?? null,
      soloComision: dto.soloComision ?? false,
      orden: dto.orden ?? 0,
      modeloBloqueado: dto.modeloBloqueado ?? false,
      modeloMonetizacionDefault: dto.modeloMonetizacionDefault ?? null,
      cover: cover ?? null,
    });

    try {
      const saved = await categoria.save();
      const imageUrl = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: saved.icono,
      });

      let coverResult = saved.cover;
      if (coverResult?.imageUrl) {
        try {
          coverResult.imageUrl = await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: coverResult.imageUrl,
          });
        } catch (e) { console.error(e); }
      }

      return { ...saved, icono: imageUrl, cover: coverResult };
    } catch {
      throw CustomError.internalServer("No se pudo guardar la categoría");
    }
  }

  // Obtener todas las categorías
  async getAllCategorias(status?: string) {
    const whereCondition: any = {};
    if (status) {
      whereCondition.statusCategoria = status;
    }

    const categorias = await CategoriaNegocio.find({
      where: whereCondition,
      order: { orden: "ASC", created_at: "ASC" },
      relations: ["subcategorias"]
    });

    return await Promise.all(
      categorias.map(async (cat) => {
        let imageUrl = cat.icono;
        // Solo obtener URL firmada si no es un icono de texto (para compatibilidad o nuevos uploads)
        // Pero el requerimiento dice "Siempre debe existir una imagen activa".
        // Asumimos que todo lo nuevo es imagen/key. Si es viejo (FaIcon), getFile devolverá el key o fallará si trata de buscar en S3?
        // UploadFilesCloud.getFile retorna key si empieza con http. Si no, busca en S3.
        // Si el key es "FaIcon", S3 lanzará error o devolverá URL firmada a un objeto inexistente.
        // Vamos a asumir que el frontend maneja fallback si la imagen falla, o que migramos todo.
        // Pero para no romper, intentemos obtener URL solo si parece un path de archivo o S3 key.
        // Un simple check: si no tiene espacios y empieza con "Fa", quizas es legacy.
        // Pero mejor usar getFile que maneja la logica.
        try {
          // Si el icono es un string corto sin '/' ni '.', probablemente es un icono legacy (FaIcon)
          // OJO: UploadFilesCloud.getFile intentará firmarlo.
          // Para evitar romper los iconos actuales en dev mientras migramos:
          if (cat.icono.startsWith("Fa") && !cat.icono.includes("/")) {
            // Legacy behavior: return as is, frontend handles resolution? NO. User wants images.
            // But existing DB has "Fa...". If we return signed URL for "FaStore", it's broken.
            // Let's just return it as is if it looks legacy, frontend will try to render as img src, fail, fallback?
            // Or better: let's try to resolve it.
            imageUrl = cat.icono;
          } else {
            imageUrl = await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: cat.icono,
            });
          }
        } catch (error) {
          console.error(`Error resolving image for category ${cat.id}`, error);
        }

        let coverResult = cat.cover;
        if (coverResult?.imageUrl) {
          try {
            coverResult.imageUrl = await UploadFilesCloud.getFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: coverResult.imageUrl,
            });
          } catch (e) {
            console.error(`Error resolving cover image for category ${cat.id}`, e);
          }
        }

        return {
          ...cat,
          icono: imageUrl,
          cover: coverResult
        };
      })
    );
  }

  // Obtener categoría por ID
  async getCategoriaById(id: string) {
    const categoria = await CategoriaNegocio.findOneBy({ id });
    if (!categoria) throw CustomError.notFound("Categoría no encontrada");

    let imageUrl = categoria.icono;
    if (!categoria.icono.startsWith("Fa") || categoria.icono.includes("/")) {
      imageUrl = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: categoria.icono,
      });
    }

    let coverResult = categoria.cover;
    if (coverResult?.imageUrl) {
      try {
        coverResult.imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: coverResult.imageUrl,
        });
      } catch (e) { console.error(e); }
    }

    return { ...categoria, icono: imageUrl, cover: coverResult };
  }

  // Actualizar categoría
  async updateCategoria(id: string, dto: UpdateCategoriaDTO, iconFile: Express.Multer.File | undefined, masterPin: string, coverFile?: Express.Multer.File) {
    await this.verifyMasterPin(masterPin);
    const categoria = await CategoriaNegocio.findOneBy({ id });
    if (!categoria) throw CustomError.notFound("Categoría no encontrada");

    if (dto.name) categoria.nombre = dto.name;
    // if (dto.icon) categoria.icono = dto.icon; // Icon string update is disabled/legacy

    if (dto.restriccionModeloMonetizacion !== undefined) {
      categoria.restriccionModeloMonetizacion =
        dto.restriccionModeloMonetizacion;
    }
    if (dto.soloComision !== undefined) {
      categoria.soloComision = dto.soloComision;
    }
    if (dto.statusCategoria !== undefined) {
      categoria.statusCategoria = dto.statusCategoria;
    }
    if (dto.orden !== undefined) {
      categoria.orden = dto.orden;
    }
    if (dto.modeloBloqueado !== undefined) {
      categoria.modeloBloqueado = dto.modeloBloqueado;
    }
    if (dto.modeloMonetizacionDefault !== undefined) {
      categoria.modeloMonetizacionDefault = dto.modeloMonetizacionDefault;
    }

    if (dto.cover !== undefined) {
      // Si el DTO trae cover, lo usamos (o lo mantenemos si es string/obj parcial)
      // Pero ojo, si coverFile viene, sobreescribiremos el imageUrl luego
      categoria.cover = dto.cover;
    }

    if (iconFile) {
      try {
        // Borrar imagen anterior si no es legacy
        if (categoria.icono && (!categoria.icono.startsWith("Fa") || categoria.icono.includes("/"))) {
          try {
            await UploadFilesCloud.deleteFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: categoria.icono
            });
            console.log(`[CategoriaService] Imagen anterior eliminada: ${categoria.icono}`);
          } catch (error) {
            console.error(`[CategoriaService] Error eliminando imagen anterior ${categoria.icono}:`, error);
          }
        }

        const key = await UploadFilesCloud.uploadSingleFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: `categorias/${Date.now()}-${iconFile.originalname}`,
          body: iconFile.buffer,
          contentType: iconFile.mimetype,
        });
        categoria.icono = key;
      } catch (error) {
        throw CustomError.internalServer("Error actualizando la imagen de la categoría");
      }
    }

    if (coverFile) {
      try {
        // Borrar imagen de portada anterior si existe
        if (categoria.cover?.imageUrl) {
          try {
            await UploadFilesCloud.deleteFile({
              bucketName: envs.AWS_BUCKET_NAME,
              key: categoria.cover.imageUrl
            });
          } catch (e) {
            console.error("[CategoriaService] Error eliminando cover anterior:", e);
          }
        }

        const coverKey = await UploadFilesCloud.uploadSingleFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: `categorias/covers/${Date.now()}-${coverFile.originalname}`,
          body: coverFile.buffer,
          contentType: coverFile.mimetype,
        });

        if (!categoria.cover) categoria.cover = { type: "image", imageUrl: coverKey };
        else categoria.cover = { ...categoria.cover, imageUrl: coverKey };
      } catch (error) {
        throw CustomError.internalServer("Error actualizando la imagen de portada");
      }
    }

    try {
      const saved = await categoria.save();

      let imageUrl = saved.icono;
      if (!saved.icono.startsWith("Fa") || saved.icono.includes("/")) {
        imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: saved.icono,
        });
      }

      let coverResult = saved.cover;
      if (coverResult?.imageUrl) {
        try {
          coverResult.imageUrl = await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: coverResult.imageUrl,
          });
        } catch (e) { console.error(e); }
      }

      return { ...saved, icono: imageUrl, cover: coverResult };
    } catch {
      throw CustomError.internalServer("No se pudo actualizar la categoría");
    }
  }

  // Eliminar categoría
  async deleteCategoria(id: string, masterPin: string) {
    await this.verifyMasterPin(masterPin);
    const categoria = await CategoriaNegocio.findOneBy({ id });
    if (!categoria) throw CustomError.notFound("Categoría no encontrada");

    if (categoria.icono && (!categoria.icono.startsWith("Fa") || categoria.icono.includes("/"))) {
      try {
        await UploadFilesCloud.deleteFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: categoria.icono
        });
        console.log(`[CategoriaService] Imagen eliminada: ${categoria.icono}`);
      } catch (error) {
        console.error(`[CategoriaService] Error eliminando imagen ${categoria.icono}:`, error);
      }
    }

    if (categoria.cover?.imageUrl) {
      try {
        await UploadFilesCloud.deleteFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: categoria.cover.imageUrl
        });
        console.log(`[CategoriaService] Cover eliminado: ${categoria.cover.imageUrl}`);
      } catch (error) {
        console.error(`[CategoriaService] Error eliminando cover ${categoria.cover.imageUrl}:`, error);
      }
    }

    try {
      return await categoria.remove();
    } catch {
      throw CustomError.internalServer("No se pudo eliminar la categoría");
    }
  }
  private async verifyMasterPin(pin: string) {
    if (!pin) throw CustomError.unAuthorized("Master PIN requerido");

    const settings = await GlobalSettings.findOne({ where: {} });
    // Si no hay configuración o no hay PIN configurado, prohibir acción por seguridad
    if (!settings || !settings.masterPin) {
      throw CustomError.internalServer("Error de seguridad: Master PIN no configurado en el sistema");
    }

    const isValid = bcrypt.compareSync(pin, settings.masterPin);
    if (!isValid) {
      throw CustomError.unAuthorized("Master PIN incorrecto");
    }
  }
}
