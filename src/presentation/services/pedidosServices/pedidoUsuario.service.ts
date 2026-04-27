import { addDays } from "date-fns";
import { In, Brackets, Raw } from "typeorm";
import moment from "moment-timezone";
import { getIO } from "../../../config/socket";

import {
  Pedido,
  ProductoPedido,
  Negocio,
  User,
  EstadoPedido,
  PriceSettings,
  Producto,
  UserMotorizado,
} from "../../../data";
import {
  CreatePedidoDTO,
  CustomError,
  UpdateEstadoPedidoDTO,
  CalificarPedidoDTO,
} from "../../../domain";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { envs } from "../../../config/env";
import { CalcularEnvioService } from "./calcularEnvio.service";
import { PedidoMotoService } from "./pedidoMoto.service";
import { PayphoneService } from "../payphone.service";
import { NotificationService } from "../NotificationService";

const notificationService = new NotificationService();

export class PedidoUsuarioService {
  static async calcularEnvio(dto: {
    negocioId: string;
    lat: number;
    lng: number;
  }) {
    const negocio = await Negocio.findOneBy({ id: dto.negocioId });
    if (!negocio) throw CustomError.notFound("Negocio no encontrado");
    if (!dto.lat || !dto.lng) throw CustomError.badRequest("Coordenadas inválidas");

    const { distanciaKm, costoEnvio } = await CalcularEnvioService.calcularParaPedido({
      negocio,
      latCliente: dto.lat,
      lngCliente: dto.lng,
    });
    return { distanciaKm, costoEnvio };
  }

  async confirmarPago(id: number | string, clientTxId: string) {
    const realOrderId = clientTxId.includes('--') ? clientTxId.split('--')[0] : clientTxId;
    const pedido = await Pedido.findOne({
      where: { id: realOrderId },
      relations: ["negocio", "cliente", "productos", "productos.producto"]
    });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");
    if (!pedido.negocio.payphone_token) throw CustomError.badRequest("Negocio sin token Payphone");

    const result = await PayphoneService.confirmPayment(id, clientTxId, pedido.negocio.payphone_token);
    
    if (result && (
      result.transactionStatus === "Approved" || 
      result.status === "Approved" ||
      result.transactionStatus === "approved" ||
      result.status === "approved" ||
      Number(result.statusCode) === 3
    )) {
      pedido.estado = EstadoPedido.PENDIENTE;
      pedido.estadoPago = "PAGADO" as any;
      pedido.referenciaPago = id.toString();
      await pedido.save();
      
      getIO().to(pedido.negocio.id).emit("nuevo_pedido", {
        id: pedido.id, estado: pedido.estado, total: pedido.total, productos: pedido.productos,
        cliente: { id: pedido.cliente.id, name: pedido.cliente.name, surname: pedido.cliente.surname },
        createdAt: pedido.createdAt
      });

      // 🔔 Notificación Push al Dueño de Negocio
      if (pedido.negocio.usuario) {
        await notificationService.sendPushNotification(
          pedido.negocio.usuario.id,
          "¡Nuevo Pedido Recibido!",
          `Has recibido un nuevo pedido (#${pedido.id.split('-')[0]}) por $${pedido.total}`,
          { url: `/business/dashboard/${pedido.negocio.id}/orders/pending` }
        );
      }

      return { success: true, status: result.transactionStatus || result.status };
    }
    return { success: false, status: result.transactionStatus || result.status, message: "El pago no fue aprobado por el banco." };
  }

  async crearPedido(dto: CreatePedidoDTO) {
    const { clienteId, negocioId, productos, ubicacionCliente, metodoPago, comprobantePagoUrl } = dto;
    const cliente = await User.findOneBy({ id: clienteId });
    const negocio = await Negocio.findOneBy({ id: negocioId });
    if (!cliente || !negocio) throw CustomError.notFound("No encontrado");

    const config = await PriceSettings.findOne({ where: {} });
    const percMoto = config ? Number(config.motorizadoPercentage) : 80;
    const percApp = config ? Number(config.appPercentage) : 20;

    const dbStore = await Producto.findBy({ id: In(productos.map(p => p.productoId)) });
    let totalVP = 0; let totalApp = 0; let comAppProd = 0;

    const items = productos.map(item => {
      const p = dbStore.find(db => db.id === item.productoId);
      if (!p) throw CustomError.notFound("Producto no encontrado");
      const pp = new ProductoPedido();
      pp.producto = p; pp.cantidad = item.cantidad;
      pp.precio_venta = p.precio_venta; pp.precio_app = p.precio_app;
      // ✅ Snapshot para históricos invariables
      pp.producto_nombre = p.nombre;
      pp.producto_imagen = p.imagen;
      
      pp.subtotal = +(pp.cantidad * p.precio_app).toFixed(2);
      totalVP += (p.precio_venta * pp.cantidad);
      totalApp += (p.precio_app * pp.cantidad);
      comAppProd += ((p.precio_venta - p.precio_app) * pp.cantidad);
      return pp;
    });

    const { costoEnvio, distanciaKm } = await CalcularEnvioService.calcularParaPedido({
      negocio, latCliente: ubicacionCliente.lat, lngCliente: ubicacionCliente.lng,
    });

    const gananciaMoto = +(costoEnvio * (percMoto / 100)).toFixed(2);
    const comisionAppEnvio = +(costoEnvio - gananciaMoto).toFixed(2);

    const total = +(totalVP + costoEnvio).toFixed(2);
    let recargo = 0;
    if (metodoPago === "TARJETA") {
      recargo = +(total * ((Number(negocio.porcentaje_recargo_tarjeta) || 0) / 100)).toFixed(2);
    }

    const pedido = new Pedido();
    pedido.cliente = cliente; pedido.negocio = negocio;
    pedido.estado = metodoPago === "TARJETA" ? "PENDIENTE_PAGO" as any : EstadoPedido.PENDIENTE;
    pedido.total = +(total + recargo).toFixed(2);
    pedido.costoEnvio = costoEnvio;
    pedido.distanciaKm = distanciaKm;
    pedido.latCliente = ubicacionCliente.lat;
    pedido.lngCliente = ubicacionCliente.lng;
    pedido.direccionTexto = ubicacionCliente.direccionTexto || null;
    pedido.metodoPago = metodoPago as any;
    pedido.comprobantePagoUrl = comprobantePagoUrl || null;
    pedido.productos = items;
    // ... audit fields
    pedido.ganancia_app_producto = comAppProd;
    pedido.totalNegocio = totalApp;
    pedido.total_precio_venta_publico = totalVP;
    pedido.total_precio_app = totalApp;
    pedido.total_comision_productos = comAppProd;
    pedido.ganancia_motorizado = gananciaMoto;
    pedido.comision_app_domicilio = comisionAppEnvio;

    const guardado = await pedido.save();
    
    let payphone = null;
    if (metodoPago === "TARJETA") {
      payphone = {
        token: negocio.payphone_token, storeId: negocio.payphone_store_id,
        clientTransactionId: `${guardado.id}--${Math.random().toString(36).substring(7)}`,
        amount: Math.round(pedido.total * 100), currency: "USD"
      };
    }

    if (metodoPago !== "TARJETA") {
      getIO().to(negocio.id).emit("nuevo_pedido", { id: guardado.id, estado: guardado.estado, total: guardado.total });
      
      // 🔔 Notificación Push al Dueño de Negocio
      if (negocio.usuario) {
        await notificationService.sendPushNotification(
          negocio.usuario.id,
          "¡Nuevo Pedido Recibido!",
          `Has recibido un nuevo pedido (#${guardado.id.split('-')[0]}) por $${pedido.total}`,
          { url: `/business/dashboard/${negocio.id}/orders/pending` }
        );
      }
    }

    return { id: guardado.id, estado: guardado.estado, total: guardado.total, payphoneConfig: payphone };
  }

  async obtenerPedidosCliente(clienteId: string, page = 1, limit = 5, filters: { estado?: string; startDate?: string; endDate?: string } = {}) {
    const skip = (page - 1) * limit;

    const query = Pedido.createQueryBuilder("pedido")
      .leftJoinAndSelect("pedido.negocio", "negocio")
      .leftJoinAndSelect("pedido.productos", "productos")
      .leftJoinAndSelect("productos.producto", "producto")
      .leftJoinAndSelect("pedido.cliente", "cliente")
      .leftJoinAndSelect("pedido.motorizado", "motorizado");

    // 🛡️ FILTRO PRINCIPAL: CLIENTE + FECHA (Prioritario)
    query.where("pedido.clienteId = :clienteId", { clienteId });

    if (filters.startDate) {
        // 🚀 Filtro ultra-explícito: Forzamos el casteo en ambos lados de la igualdad
        query.andWhere(`CAST("pedido"."createdAt" AS DATE) = :startDate::date`, { 
            startDate: filters.startDate 
        });
    }

    if (filters.estado) {
      query.andWhere("pedido.estado = :estado", { estado: filters.estado });
    }

    query
      .orderBy("pedido.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    const [pedidos, total] = await query.getManyAndCount();

    const pedidosMapeados = await Promise.all(pedidos.map(async (p) => {
      let url = p.comprobantePagoUrl;
      if (url && !url.startsWith('http')) {
        url = await UploadFilesCloud.getFile({ bucketName: envs.AWS_BUCKET_NAME, key: p.comprobantePagoUrl! });
      }

      return {
        id: p.id, estado: p.estado, total: p.total, costoEnvio: p.costoEnvio,
        createdAt: p.createdAt, fecha: p.createdAt,
        negocio: { id: p.negocio.id, nombre: p.negocio.nombre },
        productos: p.productos.map(pp => ({
          nombre: pp.producto?.nombre || pp.producto_nombre || "Producto no disponible", 
          cantidad: pp.cantidad, 
          subtotal: pp.subtotal, 
          precio_venta: pp.precio_venta,
          imagen: pp.producto_imagen // Snapshot de imagen
        })),
        metodoPago: p.metodoPago, comprobantePagoUrl: url,
        delivery_code: p.delivery_code, arrival_time: p.arrival_time,
        pickup_code: p.pickup_code,
        cliente: p.cliente ? { 
          id: p.cliente.id, 
          name: p.cliente.name, 
          surname: p.cliente.surname, 
          whatsapp: p.cliente.whatsapp,
          strikes: p.cliente.cancellation_strikes || 0 
        } : null,
        motorizado: p.motorizado ? { name: p.motorizado.name, surname: p.motorizado.surname, whatsapp: p.motorizado.whatsapp, id: p.motorizado.id } : null
      };
    }));

    return { total, page, totalPages: Math.ceil(total / limit), pedidos: pedidosMapeados };
  }

  async notificarYaVoy(pedidoId: string, clienteId: string) {
    const pedido = await Pedido.findOne({
      where: { id: pedidoId, cliente: { id: clienteId } },
      relations: ["cliente", "motorizado"]
    });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    pedido.cliente_confirmo_llegada = true;
    await pedido.save();

    if (pedido.motorizado) {
      getIO().to(pedido.motorizado.id).emit("cliente_ya_va", {
        pedidoId: pedido.id,
        mensaje: "¡El cliente ya confirmó que sale a recibirte!"
      });
    }

    return { success: true };
  }

  async calificarPedido(dto: CalificarPedidoDTO) {
    const { pedidoId, ratingNegocio, ratingMotorizado } = dto;
    const pedido = await Pedido.findOne({
      where: { id: pedidoId },
      relations: ["negocio", "motorizado"]
    });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    if (ratingNegocio !== undefined) pedido.ratingNegocio = ratingNegocio;
    if (ratingMotorizado !== undefined) pedido.ratingMotorizado = ratingMotorizado;

    await pedido.save();
    return { success: true };
  }

  async eliminarPedidoCliente(pedidoId: string, clienteId: string) {
    const p = await Pedido.findOne({ where: { id: pedidoId, cliente: { id: clienteId } } });
    if (!p || p.estado !== EstadoPedido.PENDIENTE) throw CustomError.notFound("No encontrado o no cancelable");
    
    // 🔔 Notificación Push al Negocio (Cancelación por Cliente)
    const orderWithBusiness = await Pedido.findOne({ where: { id: pedidoId }, relations: ["negocio", "negocio.usuario"] });
    if (orderWithBusiness?.negocio?.usuario) {
      await notificationService.sendPushNotification(
        orderWithBusiness.negocio.usuario.id,
        "Pedido Cancelado por Cliente",
        `El cliente ha cancelado el pedido #${pedidoId.split('-')[0]}.`,
        { url: `/business/dashboard/${orderWithBusiness.negocio.id}/orders/history` }
      );
    }

    await Pedido.remove(p);
    return { ok: true };
  }

  async refreshTimer(id: string) {
    const p = await Pedido.findOneBy({ id });
    if (p) { p.createdAt = new Date(); await p.save(); }
    return { success: true };
  }

  async subirComprobante(file: any) {
    const key = `comprobantes/${Date.now()}-${file.originalname}`;
    const uploaded = await UploadFilesCloud.uploadSingleFile({
      bucketName: envs.AWS_BUCKET_NAME, key, body: file.buffer, contentType: file.mimetype
    });
    const url = await UploadFilesCloud.getFile({ bucketName: envs.AWS_BUCKET_NAME, key: uploaded });
    return { url, key: uploaded };
  }

  static startMaintenanceJob() {
    setInterval(async () => {
      try {
        await Pedido.getRepository().query(`UPDATE pedido SET estado = 'CANCELADO' WHERE estado = 'PENDIENTE_PAGO' AND "createdAt" < NOW() - INTERVAL '6 minutes'`);
      } catch (e) {}
    }, 60000);
  }
}
