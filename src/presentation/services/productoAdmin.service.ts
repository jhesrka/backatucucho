import { Producto, StatusProducto, ProductoPedido } from "../../data";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs } from "../../config";
import { ILike } from "typeorm";

export class ProductoServiceAdmin {
  async getProductosAdmin({
    limit = 5,
    offset = 0,
    status,
    search,
    negocioId,
  }: {
    limit?: number;
    offset?: number;
    status?: StatusProducto;
    search?: string;
    negocioId?: string;
  }) {
    const where: any = {};

    if (status && Object.values(StatusProducto).includes(status)) {
      where.statusProducto = status;
    }

    if (negocioId) where.negocio = { id: negocioId };
    if (search) where.nombre = ILike(`%${search}%`);

    const [productos, total] = await Producto.findAndCount({
      where,
      relations: ["negocio", "negocio.categoria", "negocio.usuario", "tipo"],
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    });

    const productosConDatos = await Promise.all(
      productos.map(async (p) => {
        let imagenUrl: string | null = null;

        try {
          imagenUrl = await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: p.imagen,
          });
        } catch { }

        // 🔹 Contar total de unidades pedidas del producto
        const { total } = (await ProductoPedido.createQueryBuilder("pp")
          .select("COALESCE(SUM(pp.cantidad), 0)", "total")
          .where("pp.productoId = :id", { id: p.id })
          .getRawOne()) || { total: 0 };

        const vecesPedidoApp = Number(total);

        const dueño = p.negocio?.usuario
          ? {
            id: p.negocio.usuario.id,
            nombre: p.negocio.usuario.name,
            apellido: p.negocio.usuario.surname,
            whatsapp: p.negocio.usuario.whatsapp,
          }
          : null;

        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: p.precio,
          precioParaApp: p.precioParaApp ?? null,
          disponible: p.disponible,
          statusProducto: p.statusProducto,
          created_at: p.created_at,
          tipo: p.tipo ? { id: p.tipo.id, nombre: p.tipo.nombre } : null,
          negocio: p.negocio
            ? {
              id: p.negocio.id,
              nombre: p.negocio.nombre,
              estado: p.negocio.statusNegocio || null,
              categoria: p.negocio.categoria
                ? {
                  id: p.negocio.categoria.id,
                  nombre: p.negocio.categoria.nombre,
                }
                : null,
              dueño,
            }
            : null,
          imagenUrl,
          vecesPedidoApp,
        };
      })
    );

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.ceil((offset + 1) / limit);

    return { total, productos: productosConDatos, totalPages, currentPage };
  }
  async updateProductoAdmin(
    id: string,
    {
      nombre,
      descripcion,
      precio,
      precioParaApp,
      disponible,
      statusProducto,
      imagen,
    }: {
      nombre?: string;
      descripcion?: string;
      precio?: number;
      precioParaApp?: number;
      disponible?: boolean;
      statusProducto?: StatusProducto;
      imagen?: Express.Multer.File;
    }
  ) {
    const producto = await Producto.findOne({ where: { id } });
    if (!producto) throw new Error("Producto no encontrado");

    // 🔹 Si llega una nueva imagen, eliminar la anterior y subir la nueva
    if (imagen) {
      if (producto.imagen) {
        await UploadFilesCloud.deleteFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: producto.imagen,
        });
      }

      const key = `productos/${Date.now()}-${imagen.originalname}`;
      await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key,
        body: imagen.buffer,
        contentType: imagen.mimetype,
      });

      producto.imagen = key;
    }

    // 🔹 Actualizar campos opcionales
    if (nombre !== undefined) producto.nombre = nombre;
    if (descripcion !== undefined) producto.descripcion = descripcion;
    if (precio !== undefined) producto.precio = precio;
    if (precioParaApp !== undefined) producto.precioParaApp = precioParaApp;
    if (disponible !== undefined) producto.disponible = disponible;
    if (
      statusProducto &&
      Object.values(StatusProducto).includes(statusProducto)
    ) {
      producto.statusProducto = statusProducto;
    }

    await producto.save();

    // 🔹 Obtener la URL de la imagen actualizada (si aplica)
    let imagenUrl: string | null = null;
    if (producto.imagen) {
      try {
        imagenUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: producto.imagen,
        });
      } catch { }
    }

    return {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      precioParaApp: producto.precioParaApp,
      disponible: producto.disponible,
      statusProducto: producto.statusProducto,
      imagenUrl,
    };
  }

  // ADMIN: Change status only
  async changeStatusProductoAdmin(id: string, status: StatusProducto) {
    const producto = await Producto.findOne({ where: { id } });
    if (!producto) throw new Error("Producto no encontrado");

    producto.statusProducto = status;
    if (status === StatusProducto.SUSPENDIDO || status === StatusProducto.BLOQUEADO) {
      producto.disponible = false;
    }
    await producto.save();
    return { message: `Estado cambiado a ${status}`, status: producto.statusProducto };
  }

  // ADMIN: Purge definitive
  async deleteProductoAdmin(id: string) {
    const producto = await Producto.findOne({ where: { id } });
    if (!producto) throw new Error("Producto no encontrado");

    if (producto.imagen) {
      await UploadFilesCloud.deleteFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: producto.imagen
      }).catch(() => null);
    }

    await Producto.remove(producto);
    return { message: "Producto eliminado correctamente" };
  }
}
