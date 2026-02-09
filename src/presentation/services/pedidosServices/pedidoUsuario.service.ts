import { addDays } from "date-fns";
import { In } from "typeorm";
import { getIO } from "../../../config/socket";
import {
  Pedido,
  ProductoPedido,
  Negocio,
  User,
  EstadoPedido,
  PriceSettings,
  Producto,
} from "../../../data";
import {
  CreatePedidoDTO,
  CustomError,
  UpdateEstadoPedidoDTO,
} from "../../../domain";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { envs } from "../../../config/env";
import { CalcularEnvioService } from "./calcularEnvio.service";
import { PedidoMotoService } from "./pedidoMoto.service";

export class PedidoUsuarioService {
  static async calcularEnvio(dto: {
    negocioId: string;
    lat: number;
    lng: number;
  }) {
    const negocio = await Negocio.findOneBy({ id: dto.negocioId });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    if (!dto.lat || !dto.lng) {
      throw CustomError.badRequest("Coordenadas inválidas");
    }

    const { distanciaKm, costoEnvio } =
      await CalcularEnvioService.calcularParaPedido({
        negocio,
        latCliente: dto.lat,
        lngCliente: dto.lng,
      });

    return { distanciaKm, costoEnvio };
  }


  // Crear un pedido desde el frontend del cliente
  async crearPedido(dto: CreatePedidoDTO) {
    console.log("🚀 [DEBUG] Creating Pedido:", dto); // Debug log
    // ... (validation logic identical to original)
    const {
      clienteId,
      negocioId,
      productos,
      ubicacionCliente,
      metodoPago,
      montoVuelto,
      comprobantePagoUrl,
    } = dto;

    const cliente = await User.findOneBy({ id: clienteId });
    if (!cliente) throw CustomError.notFound("Cliente no encontrado");

    const negocio = await Negocio.findOneBy({ id: negocioId });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");

    if (!productos || productos.length === 0) {
      throw CustomError.badRequest("Debe incluir al menos un producto");
    }

    if (!dto.ubicacionCliente?.lat || !dto.ubicacionCliente?.lng) {
      throw CustomError.badRequest(
        "Ubicación del cliente es obligatoria para calcular el envío"
      );
    }

    // 🛒 1. Obtener porcentajes de comisión actuales
    const config = await PriceSettings.findOne({ where: {} });
    const percMoto = config ? Number(config.motorizadoPercentage) : 80;
    const percApp = config ? Number(config.appPercentage) : 20;

    // 🛒 2. Obtener productos de la BD para auditoría de precios y comisiones
    const productIds = dto.productos.map(p => p.productoId);
    const dbProductos = await Producto.findBy({ id: In(productIds) });

    // Subtotal y comisiones de productos
    let calculatedSubtotal = 0;
    let comisionProductosApp = 0;

    let totalPrecioVentaPublico = 0;
    let totalPrecioApp = 0;
    let totalComisionProductos = 0;

    const productosDetalle = dto.productos.map((item) => {
      const dbProd = dbProductos.find((p: any) => p.id === item.productoId);
      if (!dbProd) throw CustomError.notFound(`Producto ${item.productoId} no encontrado`);

      const pp = new ProductoPedido();
      pp.producto = dbProd;
      pp.cantidad = Number(item.cantidad);
      pp.precio_venta = dbProd.precio_venta;
      pp.precio_app = dbProd.precio_app;
      pp.comision_producto = Number(dbProd.precio_venta) - Number(dbProd.precio_app);

      pp.subtotal = +(pp.cantidad * pp.precio_app).toFixed(2);

      calculatedSubtotal += pp.subtotal;
      comisionProductosApp += (pp.comision_producto * pp.cantidad);

      // Accumulate totals for Pedido
      totalPrecioVentaPublico += (pp.precio_venta * pp.cantidad);
      totalPrecioApp += (pp.precio_app * pp.cantidad);
      totalComisionProductos += (pp.comision_producto * pp.cantidad);

      return pp;
    });

    // 🚚 3. Calcular distancia y envío (server-side, confiable)
    const { distanciaKm, costoEnvio } =
      await CalcularEnvioService.calcularParaPedido({
        negocio,
        latCliente: dto.ubicacionCliente.lat,
        lngCliente: dto.ubicacionCliente.lng,
      });

    // 💰 4. Desglose Financiero (Persistencia)
    const gananciaMoto = +(costoEnvio * (percMoto / 100)).toFixed(2);
    const comisionAppDom = +(costoEnvio * (percApp / 100)).toFixed(2);

    // Domicilio / motorizado specific fields
    const pago_motorizado = gananciaMoto; // Based on percMoto
    const comision_moto_app = +(costoEnvio - pago_motorizado).toFixed(2);

    // Total final pagado por el usuario (Precio Público + Envío)
    const total = +(totalPrecioVentaPublico + costoEnvio).toFixed(2);

    // Ganancia total de la APP (Comisión de Productos + Comisión Domicilio)
    const comisionTotalApp = +(totalComisionProductos + comisionAppDom).toFixed(2);

    // Lo que le queda al negocio (Equivalente a total_precio_app)
    const totalNegocio = +totalPrecioApp.toFixed(2);

    // Construir pedido + items (cascade)
    const pedido = new Pedido();
    pedido.cliente = cliente;
    pedido.negocio = negocio;
    pedido.estado = EstadoPedido.PENDIENTE;
    pedido.costoEnvio = costoEnvio;
    pedido.total = total;

    // Asignar auditoría financiera
    pedido.porcentaje_motorizado_aplicado = percMoto;
    pedido.porcentaje_app_aplicado = percApp;
    pedido.ganancia_motorizado = gananciaMoto;
    pedido.comision_app_domicilio = comisionAppDom;
    pedido.ganancia_app_producto = comisionProductosApp;
    pedido.comisionTotal = comisionTotalApp;
    pedido.totalNegocio = totalNegocio;

    // New Pedido financial fields
    pedido.total_precio_venta_publico = +totalPrecioVentaPublico.toFixed(2);
    pedido.total_precio_app = +totalPrecioApp.toFixed(2);
    pedido.total_comision_productos = +totalComisionProductos.toFixed(2);
    pedido.pago_motorizado = pago_motorizado;
    pedido.comision_moto_app = comision_moto_app;

    pedido.distanciaKm = distanciaKm;
    pedido.latCliente = dto.ubicacionCliente.lat;
    pedido.lngCliente = dto.ubicacionCliente.lng;
    pedido.direccionTexto = dto.ubicacionCliente.direccionTexto ?? null;

    // 💶 Datos de Pago
    if (dto.metodoPago) {
      pedido.metodoPago = dto.metodoPago as any;
    }
    if (dto.montoVuelto !== undefined) pedido.montoVuelto = dto.montoVuelto;
    if (dto.comprobantePagoUrl) pedido.comprobantePagoUrl = dto.comprobantePagoUrl; // Saves Key if provided

    pedido.productos = productosDetalle;

    const nuevo = await pedido.save();

    getIO().to(negocio.id).emit("nuevo_pedido", {
      id: nuevo.id,
      estado: nuevo.estado,
      total: nuevo.total,
      productos: nuevo.productos,
      cliente: {
        id: cliente.id,
        name: cliente.name,
        surname: cliente.surname
      },
      createdAt: nuevo.createdAt
    });

    // Resolve URL for response (WhatsApp link)
    let solvedUrl = nuevo.comprobantePagoUrl;
    if (nuevo.comprobantePagoUrl && !nuevo.comprobantePagoUrl.startsWith('http')) {
      solvedUrl = await UploadFilesCloud.getFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: nuevo.comprobantePagoUrl
      });
    }

    return {
      id: nuevo.id,
      estado: nuevo.estado,
      total: nuevo.total,
      costoEnvio: nuevo.costoEnvio,
      distanciaKm: nuevo.distanciaKm,
      createdAt: nuevo.createdAt,
      metodoPago: nuevo.metodoPago,
      montoVuelto: nuevo.montoVuelto,
      comprobantePagoUrl: solvedUrl
    };
  }

  // ... (cambiarEstado remains same)

  // Ver los pedidos de un cliente
  async obtenerPedidosCliente(clienteId: string, page = 1, limit = 5, filters: { estado?: string; startDate?: string; endDate?: string } = {}) {
    const skip = (page - 1) * limit;

    const query = Pedido.createQueryBuilder("pedido")
      .leftJoinAndSelect("pedido.negocio", "negocio")
      .leftJoinAndSelect("pedido.productos", "productos")
      .leftJoinAndSelect("productos.producto", "producto")
      .leftJoinAndSelect("pedido.motorizado", "motorizado")
      .where("pedido.clienteId = :clienteId", { clienteId })
      .orderBy("pedido.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    if (filters.estado) {
      query.andWhere("pedido.estado = :estado", { estado: filters.estado });
    }

    if (filters.startDate) {
      query.andWhere("pedido.createdAt >= :startDate", { startDate: filters.startDate });
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere("pedido.createdAt <= :endDate", { endDate: end });
    }

    const [pedidos, total] = await query.getManyAndCount();

    const pedidosMapeados = await Promise.all(pedidos.map(async (p) => {
      let solvedUrl = p.comprobantePagoUrl;
      if (p.comprobantePagoUrl && !p.comprobantePagoUrl.startsWith('http')) {
        solvedUrl = await UploadFilesCloud.getFile({
          bucketName: envs.AWS_BUCKET_NAME,
          key: p.comprobantePagoUrl
        });
      }

      return {
        id: p.id,
        estado: p.estado,
        total: p.total,
        costoEnvio: p.costoEnvio,
        motivoCancelacion: p.motivoCancelacion,

        negocio: {
          id: p.negocio.id,
          nombre: p.negocio.nombre,
        },
        productos: p.productos.map((pp) => ({
          id: pp.id,
          productoId: pp.producto.id,
          nombre: pp.producto.nombre,
          cantidad: pp.cantidad,
          precio_venta: pp.precio_venta,
          precio_app: pp.precio_app,
          subtotal: pp.subtotal,
        })),
        fecha: p.createdAt,
        metodoPago: p.metodoPago,
        vuelto: p.montoVuelto ? true : false,
        montoVuelto: p.montoVuelto,
        comprobantePagoUrl: solvedUrl,
        motorizado: p.motorizado ? {
          id: p.motorizado.id,
          name: p.motorizado.name,
          surname: p.motorizado.surname,
          telefono: p.motorizado.whatsapp,
          whatsapp: p.motorizado.whatsapp,
        } : null,
      };
    }));

    return {
      total,
      page,
      totalPages: Math.ceil(total / limit),
      pedidos: pedidosMapeados,
    };
  }

  // Eliminar pedido del cliente (solo si está pendiente)
  async eliminarPedidoCliente(pedidoId: string, clienteId: string) {
    const pedido = await Pedido.findOne({
      where: { id: pedidoId },
      relations: ["cliente"],
    });

    if (!pedido) throw CustomError.notFound("Pedido no encontrado");
    if (pedido.cliente.id !== clienteId)
      throw CustomError.unAuthorized(
        "No tiene permiso para eliminar este pedido"
      );

    if (pedido.estado !== EstadoPedido.PENDIENTE)
      throw CustomError.badRequest("Solo puede eliminar pedidos pendientes");

    await Pedido.remove(pedido);



    return { message: "Pedido eliminado correctamente" };
  }

  // Subir comprobante (servicio)
  // Subir comprobante (AWS S3)
  async subirComprobante(file: any) {
    if (!file) throw CustomError.badRequest("No se recibió ningún archivo");

    // Generar path único para S3: comprobantes/TIMESTAMP-name
    const originalName = file.originalname || file.name || "comprobante.jpg";
    // Limpieza básica del nombre
    const cleanName = originalName.replace(/\s+/g, "_");
    const pathKey = `comprobantes/${Date.now()}-${cleanName}`;

    // Obtener buffer (Multer usa .buffer, express-fileupload usa .data)
    const fileContent = file.buffer || file.data;
    const contentType = file.mimetype || "image/jpeg";

    if (!fileContent) {
      throw CustomError.badRequest("El archivo está vacío o corrupto");
    }

    // Subir a AWS S3
    const uploadedKey = await UploadFilesCloud.uploadSingleFile({
      bucketName: envs.AWS_BUCKET_NAME,
      key: pathKey,
      body: fileContent,
      contentType: contentType,
    });

    // Retonar la URL firmada para que el frontend pueda visualizarlo inmediatamente
    const url = await UploadFilesCloud.getFile({
      bucketName: envs.AWS_BUCKET_NAME,
      key: uploadedKey
    });

    return { url, key: uploadedKey };
  }
}
