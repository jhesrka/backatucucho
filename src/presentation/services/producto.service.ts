import {
  Producto,
  Negocio,
  TipoProducto,
  StatusProducto,
  StatusNegocio,
} from "../../data";
import { CustomError } from "../../domain";
import { CreateProductoDTO } from "../../domain/dtos/productos/CreateProductoDTO";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs } from "../../config";

export class ProductoService {

  // ========================= CREATE =========================
  async createProducto(dto: CreateProductoDTO, file?: Express.Multer.File) {
    if (!file) {
      throw CustomError.badRequest("La imagen del producto es obligatoria");
    }

    const negocio = await Negocio.findOneBy({ id: dto.negocioId });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    // === Verificar si ya existe un producto con el mismo nombre en este negocio ===
    const productoExistente = await Producto.findOne({
      where: {
        nombre: dto.nombre.trim(),
        negocio: { id: negocio.id },
      },
    });

    if (productoExistente) {
      throw CustomError.conflict(
        "Ya existe un producto con ese nombre en este negocio. Usa otro nombre."
      );
    }

    // === Manejo de tipo de producto ===
    const tipo = await this.resolveTipo(dto.tipoId);
    if (!tipo)
      throw CustomError.internalServer(
        "No se pudo asignar el tipo de producto"
      );

    let key: string;
    let imageUrl: string;

    try {
      key = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: `productos/${Date.now()}-${file.originalname}`,
        body: file.buffer,
        contentType: file.mimetype,
      });

      imageUrl = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key,
      });
    } catch (error) {
      throw CustomError.internalServer("Error subiendo la imagen del producto");
    }

    const producto = Producto.create({
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion.trim(),
      precio: dto.precio,
      precioParaApp: dto.precioParaApp ?? null,
      imagen: key,
      disponible: true,
      negocio,
      tipo,
    });

    try {
      const saved = await producto.save();

      return {
        id: saved.id,
        nombre: saved.nombre,
        descripcion: saved.descripcion,
        precio: saved.precio,
        precioParaApp: saved.precioParaApp,
        imagen: imageUrl,
        disponible: saved.disponible,
        created_at: saved.created_at,
        tipo: {
          id: tipo.id,
          nombre: tipo.nombre,
        },
      };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        const pgError = error as { code?: string };
        if (pgError.code === "23505") {
          throw CustomError.conflict(
            "Ya existe un producto con ese nombre en este negocio. Usa otro nombre."
          );
        }
      }

      throw CustomError.internalServer("No se pudo guardar el producto");
    }
  }

  // ========================= UPDATE =========================
  async updateProducto(
    id: string,
    data: Partial<CreateProductoDTO>,
    file?: Express.Multer.File
  ) {
    const producto = await Producto.findOne({
      where: { id },
      relations: ["negocio", "tipo"],
    });
    if (!producto) throw CustomError.notFound("Producto no encontrado");

    if (data.nombre) producto.nombre = data.nombre.trim();
    if (data.descripcion) producto.descripcion = data.descripcion.trim();
    if (typeof data.precio === "number") producto.precio = data.precio;
    if (typeof data.precioParaApp === "number")
      producto.precioParaApp = data.precioParaApp;

    if (data.tipoId) {
      const tipo = await this.resolveTipo(data.tipoId);
      producto.tipo = tipo;
    }

    if (file) {
      try {
        const key = await UploadFilesCloud.uploadSingleFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: `productos/${Date.now()}-${file.originalname}`,
          body: file.buffer,
          contentType: file.mimetype,
        });
        producto.imagen = key;
      } catch (error) {
        throw CustomError.internalServer(
          "Error subiendo la imagen del producto"
        );
      }
    }

    await producto.save();

    const imageUrl = await UploadFilesCloud.getFile({
      bucketName: envs.AWS_BUCKET_NAME,
      key: producto.imagen,
    });

    return {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      precioParaApp: producto.precioParaApp,
      imagen: imageUrl,
      disponible: producto.disponible,
      created_at: producto.created_at,
      tipo: producto.tipo
        ? {
          id: producto.tipo.id,
          nombre: producto.tipo.nombre,
        }
        : null,
    };
  }

  // ========================= READ =========================
  async getProductosByNegocio(negocioId: string) {
    const negocio = await Negocio.findOneBy({ id: negocioId });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    const productos = await Producto.find({
      where: { negocio: { id: negocioId } },
      relations: ["tipo"],
      order: { created_at: "DESC" },
    });

    return await Promise.all(
      productos.map(async (p) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: p.imagen,
        });

        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: p.precio,
          precioParaApp: p.precioParaApp ?? null,
          imagen: imageUrl,
          disponible: p.disponible,
          created_at: p.created_at,
          statusProducto: p.statusProducto,
          tipo: p.tipo
            ? {
              id: p.tipo.id,
              nombre: p.tipo.nombre,
            }
            : null,
        };
      })
    );
  }

  async getProductosDisponiblesByNegocio(negocioId: string) {
    const negocio = await Negocio.findOne({
      where: { id: negocioId },
      relations: ["usuario"], // relación con el User
    });

    if (!negocio) {
      throw CustomError.notFound("Negocio no encontrado");
    }

    if (negocio.statusNegocio !== StatusNegocio.ACTIVO) {
      throw CustomError.badRequest("El negocio no está activo");
    }

    const productos = await Producto.find({
      where: {
        negocio: { id: negocioId },
        disponible: true,
        statusProducto: StatusProducto.ACTIVO,
      },
      relations: ["tipo"],
      order: { created_at: "DESC" },
    });

    const productosFormateados = await Promise.all(
      productos.map(async (p) => {
        const imageUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: p.imagen,
        });

        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: p.precio,
          precioParaApp: p.precioParaApp ?? null,
          imagen: imageUrl,
          disponible: p.disponible,
          created_at: p.created_at,
          statusProducto: p.statusProducto,
          tipo: p.tipo
            ? {
              id: p.tipo.id,
              nombre: p.tipo.nombre,
            }
            : null,
        };
      })
    );

    // 🔧 Obtener la imagen del negocio
    const imagenNegocio = negocio.imagenNegocio
      ? await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: negocio.imagenNegocio,
      })
      : null;

    // ✅ Devolver datos completos del negocio
    return {
      negocio: {
        id: negocio.id,
        nombre: negocio.nombre,
        imagenNegocio: imagenNegocio,
        banco: negocio.banco,
        tipoCuenta: negocio.tipoCuenta,
        numeroCuenta: negocio.numeroCuenta,
        titularCuenta: negocio.titularCuenta,
      },
      usuario: {
        id: negocio.usuario.id,
        nombre: negocio.usuario.name,
        apellido: negocio.usuario.surname,
      },
      productos: productosFormateados,
    };
  }

  // ========================= DELETE =========================
  async deleteProducto(id: string) {
    const producto = await Producto.findOneBy({ id });
    if (!producto) throw CustomError.notFound("Producto no encontrado");

    await Producto.remove(producto); // o setear disponible = false si quieres soft-delete

    return { message: "Producto eliminado correctamente" };
  }

  // ========================= TOGGLE =========================
  async toggleDisponible(id: string, disponible: boolean) {
    const producto = await Producto.findOneBy({ id });
    if (!producto) throw CustomError.notFound("Producto no encontrado");

    producto.disponible = disponible;
    return await producto.save();
  }

  // ========================= HELPER =========================
  private async resolveTipo(tipoId?: string) {
    if (!tipoId) {
      throw CustomError.badRequest("Debe proporcionar un tipoId");
    }
    const tipoExistente = await TipoProducto.findOneBy({ id: tipoId });
    if (!tipoExistente)
      throw CustomError.notFound("Tipo de producto no encontrado");
    return tipoExistente;
  }
}
