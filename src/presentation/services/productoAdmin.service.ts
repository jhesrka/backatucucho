import { Producto, StatusProducto, ProductoPedido, GlobalSettings, Negocio, TipoProducto } from "../../data";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs, encriptAdapter } from "../../config";
import { ILike } from "typeorm";
import { CustomError } from "../../domain";
import { getIO } from "../../config/socket";

export class ProductoServiceAdmin {
  async getProductosAdmin({
    limit = 5,
    offset = 0,
    status,
    search,
    negocioId,
    tipoId,
  }: {
    limit?: number;
    offset?: number;
    status?: StatusProducto;
    search?: string;
    negocioId?: string;
    tipoId?: string;
  }) {
    const where: any = {};

    if (status && Object.values(StatusProducto).includes(status)) {
      where.statusProducto = status;
    }

    if (negocioId) where.negocio = { id: negocioId };
    if (tipoId) where.tipo = { id: tipoId };
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
          imagenUrl = await UploadFilesCloud.getOptimizedUrls({
            bucketName: envs.AWS_BUCKET_NAME,
            key: p.imagen,
          }) as any;
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
          precio_venta: p.precio_venta,
          precio_app: p.precio_app ?? null,
          comision_producto: Number(p.precio_venta) - Number(p.precio_app || p.precio_venta),
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
      precio_venta,
      precio_app,
      disponible,
      statusProducto,
      imagen,
    }: {
      nombre?: string;
      descripcion?: string;
      precio_venta?: number;
      precio_app?: number;
      disponible?: boolean;
      statusProducto?: StatusProducto;
      imagen?: Express.Multer.File;
    }
  ) {
    const producto = await Producto.findOne({ where: { id }, relations: ["negocio", "tipo"] });
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
      const savedKey = await UploadFilesCloud.uploadSingleFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key,
        body: imagen.buffer,
        contentType: imagen.mimetype,
      });

      producto.imagen = savedKey;
    }

    // 🔹 Actualizar campos opcionales
    if (nombre !== undefined) producto.nombre = nombre;
    if (descripcion !== undefined) producto.descripcion = descripcion;
    if (precio_venta !== undefined) {
      producto.precio_venta = precio_venta;
      // Auto-update comision if app price already exists
      producto.comision_producto = Number(precio_venta) - Number(producto.precio_app || precio_venta);
    }
    if (precio_app !== undefined) {
      producto.precio_app = precio_app;
      producto.comision_producto = Number(producto.precio_venta) - Number(precio_app);
    }
    if (disponible !== undefined) producto.disponible = disponible;
    if (
      statusProducto &&
      Object.values(StatusProducto).includes(statusProducto)
    ) {
      producto.statusProducto = statusProducto;
    }

    await producto.save();

    // 📡 Notificar por WebSockets
    await this.emitProductUpdate(producto);

    // 🔹 Obtener la URL de la imagen actualizada (si aplica)
    let imagenUrl: string | null = null;
    if (producto.imagen) {
      try {
        imagenUrl = await UploadFilesCloud.getOptimizedUrls({
          bucketName: envs.AWS_BUCKET_NAME,
          key: producto.imagen,
        }) as any;
      } catch { }
    }


    return {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio_venta: producto.precio_venta,
      precio_app: producto.precio_app,
      comision_producto: producto.comision_producto,
      disponible: producto.disponible,
      statusProducto: producto.statusProducto,
      imagenUrl,
    };
  }

  // ADMIN: Change status only
  async changeStatusProductoAdmin(id: string, status: StatusProducto) {
    const producto = await Producto.findOne({ where: { id }, relations: ["negocio", "tipo"] });
    if (!producto) throw new Error("Producto no encontrado");

    producto.statusProducto = status;
    if (status === StatusProducto.SUSPENDIDO || status === StatusProducto.BLOQUEADO) {
      producto.disponible = false;
    }
    const saved = await producto.save();

    // 📡 Notificar por WebSockets
    await this.emitProductUpdate(saved);

    return { message: `Estado cambiado a ${status}`, status: producto.statusProducto };
  }

  // ADMIN: Purge definitive
  async deleteProductoAdmin(id: string, pin: string) {
    if (!pin) throw CustomError.badRequest("El PIN maestro es obligatorio");

    // 1. Obtener validación de PIN desde settings
    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings?.masterPin) {
      throw CustomError.internalServer("El PIN maestro no está configurado en el sistema.");
    }

    const isPinValid = encriptAdapter.compare(pin, settings.masterPin);
    if (!isPinValid) {
      throw CustomError.badRequest("El PIN maestro ingresado es incorrecto.");
    }

    const producto = await Producto.findOne({ where: { id }, relations: ["negocio"] });
    if (!producto) throw CustomError.notFound("Producto no encontrado");

    // 🛑 VALIDACIÓN CRÍTICA: No borrar si tiene pedidos (Integridad Referencial)
    const tienePedidos = await ProductoPedido.count({ where: { producto: { id: producto.id } } });
    if (tienePedidos > 0) {
      throw CustomError.badRequest("Este producto no puede eliminarse porque tiene historial de pedidos. Te sugerimos suspenderlo o marcarlo como agotado.");
    }

    const negocioId = producto.negocio.id;

    if (producto.imagen) {
      await UploadFilesCloud.deleteFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: producto.imagen
      }).catch(() => null);
    }

    await Producto.remove(producto);

    // 📡 Notificar por WebSockets
    getIO().emit("product_deleted", {
      productId: id,
      negocioId: negocioId,
    });
    return { message: "Producto eliminado definitivamente del catálogo actual" };
  }

  // ========================= BULK CREATE =========================
  async bulkCreateProductosAdmin(negocioId: string, productosData: any[], pin: string) {
    if (!pin) throw CustomError.badRequest("El PIN maestro es obligatorio");

    // 1. Validar PIN
    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings?.masterPin) {
      throw CustomError.internalServer("El PIN maestro no está configurado.");
    }
    const isPinValid = encriptAdapter.compare(pin, settings.masterPin);
    if (!isPinValid) throw CustomError.badRequest("PIN maestro incorrecto.");

    // 2. Validar Negocio
    const negocio = await Negocio.findOneBy({ id: negocioId });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    const createdProducts = [];
    const errors = [];

    // 3. Procesamiento en lote
    for (const data of productosData) {
      try {
        if (!data.nombre) throw new Error("Falta el nombre del producto");

        // Resolver Categoría (TipoProducto)
        let tipoId = null;
        if (data.categoria) {
          let tipo = await TipoProducto.findOneBy({ 
            nombre: data.categoria.trim(), 
            negocio: { id: negocioId } 
          });
          
          if (!tipo) {
            tipo = TipoProducto.create({ 
              nombre: data.categoria.trim(), 
              negocio: { id: negocioId } 
            });
            await tipo.save();
          }
          tipoId = tipo;
        }

        const precioVenta = Number(data.precio_venta) || 0;
        const precioApp = Number(data.precio_app) || precioVenta;

        const product = new Producto();
        product.nombre = data.nombre.trim();
        product.descripcion = data.descripcion?.trim() || "";
        product.precio_venta = precioVenta;
        product.precio_app = precioApp;
        product.comision_producto = precioVenta - precioApp;
        product.disponible = false; // 🛑 Requisito: disponible false
        product.statusProducto = StatusProducto.ACTIVO; // Admin lo sube directo como activo
        product.negocio = negocio!;
        if (tipoId) product.tipo = tipoId;

        await product.save();
        createdProducts.push(product.nombre);
      } catch (err: any) {
        errors.push({ nombre: data.nombre || "Desconocido", error: err.message });
      }
    }

    return {
      message: `Proceso completado. ${createdProducts.length} productos creados.`,
      created: createdProducts,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // ========================= SOCKET UPDATE HELPER =========================
  private async emitProductUpdate(producto: Producto) {
    let formattedProduct = null;

    if (producto.statusProducto === StatusProducto.ACTIVO) {
      const imageUrl = producto.imagen
        ? await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: producto.imagen,
          })
        : null;

      formattedProduct = {
        id: producto.id,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio_venta: producto.precio_venta,
        precio_app: producto.precio_app,
        comision_producto: producto.comision_producto,
        imagen: imageUrl,
        disponible: producto.disponible,
        created_at: producto.created_at,
        statusProducto: producto.statusProducto,
        tipo: producto.tipo
          ? {
            id: producto.tipo.id,
            nombre: producto.tipo.nombre,
          }
          : null,
        negocioId: producto.negocio.id
      };
    }

    getIO().emit("product_status_changed", {
      productId: producto.id,
      negocioId: producto.negocio.id,
      disponible: producto.disponible,
      statusProducto: producto.statusProducto,
      product: formattedProduct, // Enviar objeto completo para inserción en vivo
    });
  }
}
