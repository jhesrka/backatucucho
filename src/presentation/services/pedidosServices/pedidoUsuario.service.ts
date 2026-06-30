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
    if (pedido.estadoPago === "PAGADO") return { success: true, message: "Pedido ya procesado concurrentemente" };
    if (!pedido.negocio.payphone_token) throw CustomError.badRequest("Negocio sin token Payphone");

    const result = await PayphoneService.confirmPayment(id, clientTxId, pedido.negocio.payphone_token);
    
    if (result && (
      result.transactionStatus === "Approved" || 
      result.status === "Approved" ||
      result.transactionStatus === "approved" ||
      result.status === "approved" ||
      Number(result.statusCode) === 3
    )) {
      // 🛡️ Validar monto
      const amountPaid = Number(result.amount);
      const expectedAmount = Math.round(pedido.total * 100);
      if (amountPaid !== expectedAmount) {
        console.error(`❌ [Payphone Service] ALERTA DE FRAUDE: Monto pagado (${amountPaid}) no coincide con el total esperado (${expectedAmount}) para el pedido ${pedido.id}`);
        throw CustomError.badRequest("Monto incorrecto. Operación rechazada por seguridad");
      }

      // 🚀 Actualización atómica para evitar carrera de notificaciones
      const updateResult = await Pedido.createQueryBuilder()
        .update(Pedido)
        .set({
          estado: EstadoPedido.PENDIENTE,
          estadoPago: "PAGADO" as any,
          referenciaPago: id.toString()
        })
        .where("id = :id AND estadoPago != 'PAGADO'", { id: pedido.id })
        .execute();

      if (updateResult.affected === 0) {
        console.warn(`⚠️ [Payphone Service] Carrera detectada: El pedido ${pedido.id} ya fue procesado.`);
        return { success: true, message: "Pedido ya procesado concurrentemente" };
      }

      // Actualizar variables locales para que los sockets envíen la data correcta
      pedido.estado = EstadoPedido.PENDIENTE;
      pedido.estadoPago = "PAGADO" as any;
      pedido.referenciaPago = id.toString();
      
      getIO().to(pedido.negocio.id).emit("nuevo_pedido", {
        id: pedido.id, estado: pedido.estado, total: pedido.total, productos: pedido.productos,
        cliente: { id: pedido.cliente.id, name: pedido.cliente.name, surname: pedido.cliente.surname },
        createdAt: pedido.createdAt,
        notaGeneral: pedido.notaGeneral
      });

      getIO().to(pedido.cliente.id).emit("pedido_actualizado", {
        id: pedido.id,
        estado: pedido.estado,
        estadoPago: pedido.estadoPago,
        referenciaPago: pedido.referenciaPago
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
    const negocio = await Negocio.findOne({ 
      where: { id: negocioId }, 
      relations: ["subcategoria"] 
    });
    if (!cliente || !negocio) throw CustomError.notFound("No encontrado");

    const config = await PriceSettings.findOne({ where: {} });
    const percMoto = config ? Number(config.motorizadoPercentage) : 80;
    const percApp = config ? Number(config.appPercentage) : 20;

    const dbStore = await Producto.findBy({ id: In(productos.map(p => p.productoId)) });
    let totalVP = 0; let totalApp = 0; let comAppProd = 0;

    const items = productos.map(item => {
      const p = dbStore.find(db => db.id === item.productoId);
      if (!p) throw CustomError.notFound("Producto no encontrado");

      // 🛡️ Regla de Negocio: Pedidos Programados no aceptan EFECTIVO
      if (p.tipoProducto === 'PROGRAMADO' && metodoPago === 'EFECTIVO') {
        throw CustomError.badRequest("Los pedidos programados solo aceptan Transferencia o Tarjeta. No se permite efectivo.");
      }

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

    const { costoEnvio, distanciaKm, recargoPico, isPeakHour } = await CalcularEnvioService.calcularParaPedido({
      negocio, latCliente: ubicacionCliente.lat, lngCliente: ubicacionCliente.lng,
    });

    const costoEnvioBase = costoEnvio - (recargoPico || 0);
    const gananciaMotoBase = +(costoEnvioBase * (percMoto / 100)).toFixed(2);
    const comisionAppEnvioBase = +(costoEnvioBase - gananciaMotoBase).toFixed(2);

    let peakHourSurchargeMoto = 0;
    let peakHourSurchargeApp = 0;

    if (isPeakHour && recargoPico > 0) {
      peakHourSurchargeMoto = +(recargoPico * (percMoto / 100)).toFixed(2);
      peakHourSurchargeApp = +(recargoPico - peakHourSurchargeMoto).toFixed(2);
    }

    const gananciaMoto = +(gananciaMotoBase + peakHourSurchargeMoto).toFixed(2);
    const comisionAppEnvio = +(comisionAppEnvioBase + peakHourSurchargeApp).toFixed(2);

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
    pedido.notaGeneral = dto.notaGeneral || null;
    pedido.metodoPago = metodoPago as any;
    pedido.comprobantePagoUrl = comprobantePagoUrl || null;
    pedido.productos = items;
    pedido.requiresAgeVerification = negocio.subcategoria?.isAgeRestricted || false;
    // ... audit fields
    pedido.ganancia_app_producto = comAppProd;
    pedido.totalNegocio = totalApp;
    pedido.total_precio_venta_publico = totalVP;
    pedido.total_precio_app = totalApp;
    pedido.total_comision_productos = comAppProd;
    pedido.ganancia_motorizado = gananciaMoto;
    pedido.comision_app_domicilio = comisionAppEnvio;

    pedido.isPeakHourSurchargeApplied = isPeakHour || false;
    pedido.peakHourSurchargeAmount = recargoPico || 0;
    pedido.peakHourSurchargeMoto = peakHourSurchargeMoto || 0;
    pedido.peakHourSurchargeApp = peakHourSurchargeApp || 0;

    const guardado = await pedido.save();
    
    let payphone = null;
    if (metodoPago === "TARJETA") {
      const amountInCents = Math.round(pedido.total * 100);
      const generatedClientTxId = `${guardado.id}--${Math.random().toString(36).substring(7)}`;
      
      guardado.referenciaPago = generatedClientTxId;
      await guardado.save();

      payphone = {
        token: negocio.payphone_token, storeId: negocio.payphone_store_id,
        clientTransactionId: generatedClientTxId,
        amount: amountInCents,
        amountWithoutTax: amountInCents,
        amountWithTax: 0,
        tax: 0,
        reference: `Pedido #${guardado.id.split('-')[0]}`,
        currency: "USD"
      };
    }

    if (metodoPago !== "TARJETA") {
      getIO().to(negocio.id).emit("nuevo_pedido", { id: guardado.id, estado: guardado.estado, total: guardado.total, notaGeneral: guardado.notaGeneral });
      
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
      .leftJoin("pedido.negocio", "negocio")
      .leftJoin("pedido.productos", "productos")
      .leftJoin("productos.producto", "producto")
      .leftJoin("pedido.cliente", "cliente")
      .leftJoin("pedido.motorizado", "motorizado")
      .select([
        "pedido.id", "pedido.estado", "pedido.estadoPago", "pedido.referenciaPago", "pedido.total", "pedido.costoEnvio", "pedido.createdAt", "pedido.fecha_aceptado",
        "pedido.tiempoPreparacionElegido", "pedido.latCliente", "pedido.lngCliente", "pedido.metodoPago", "pedido.comprobantePagoUrl",
        "pedido.delivery_code", "pedido.arrival_time", "pedido.pickup_code", "pedido.motivoCancelacion", "pedido.ratingNegocio", "pedido.ratingMotorizado",
        "pedido.isPeakHourSurchargeApplied", "pedido.peakHourSurchargeAmount", "pedido.peakHourSurchargeMoto", "pedido.peakHourSurchargeApp", "pedido.notaGeneral",
        "pedido.requiresAgeVerification", "pedido.ageVerificationLog",
        "negocio.id", "negocio.nombre", "negocio.latitud", "negocio.longitud", "negocio.tiempoPreparacionMax",
        "productos.id", "productos.cantidad", "productos.subtotal", "productos.precio_venta", "productos.producto_nombre", "productos.producto_imagen",
        "producto.id", "producto.nombre", "producto.tipoProducto",
        "cliente.id", "cliente.name", "cliente.surname", "cliente.whatsapp", "cliente.cancellation_strikes",
        "motorizado.id", "motorizado.name", "motorizado.surname", "motorizado.whatsapp"
      ]);

    // 🛡️ FILTRO PRINCIPAL: CLIENTE + FECHA (Prioritario)
    query.where("pedido.clienteId = :clienteId", { clienteId });

    if (filters.startDate) {
        // 🚀 Búsqueda optimizada por rango (Index-Friendly)
        const nextDay = new Date(filters.startDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        query.andWhere(`pedido.createdAt >= :startDate AND pedido.createdAt < :endDate`, { 
            startDate: `${filters.startDate} 00:00:00`,
            endDate: `${nextDayStr} 00:00:00`
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
      let resolvedComprobante = p.comprobantePagoUrl;
      if (resolvedComprobante && !resolvedComprobante.startsWith('http')) {
          resolvedComprobante = await UploadFilesCloud.getFile({ bucketName: envs.AWS_BUCKET_NAME, key: resolvedComprobante });
      }

      return {
        id: p.id, estado: p.estado, total: p.total, costoEnvio: p.costoEnvio,
        createdAt: p.createdAt, fecha: p.createdAt, fecha_aceptado: p.fecha_aceptado,
        tiempoPreparacionElegido: p.tiempoPreparacionElegido,
        latCliente: p.latCliente, lngCliente: p.lngCliente,
        negocio: { 
          id: p.negocio.id, 
          nombre: p.negocio.nombre, 
          latitud: p.negocio?.latitud, 
          longitud: p.negocio?.longitud,
          tiempoPreparacionMax: p.negocio?.tiempoPreparacionMax
        },
        isProgrammed: p.productos?.some(pp => pp.producto?.tipoProducto === 'PROGRAMADO') || false,
        metodoPago: p.metodoPago, comprobantePagoUrl: resolvedComprobante,
        estadoPago: p.estadoPago, referenciaPago: p.referenciaPago,
        delivery_code: p.delivery_code, arrival_time: p.arrival_time,
        pickup_code: p.pickup_code,
        motivoCancelacion: p.motivoCancelacion,
        notaGeneral: p.notaGeneral,
        cliente: p.cliente ? { 
          id: p.cliente.id, 
          name: p.cliente.name, 
          surname: p.cliente.surname, 
          whatsapp: p.cliente.whatsapp,
          cancellation_strikes: p.cliente.cancellation_strikes
        } : null,
        motorizado: p.motorizado ? { 
          id: p.motorizado.id, 
          name: p.motorizado.name, 
          surname: p.motorizado.surname,
          whatsapp: p.motorizado.whatsapp 
        } : null,
        ratingNegocio: p.ratingNegocio,
        ratingMotorizado: p.ratingMotorizado,
        isPeakHourSurchargeApplied: p.isPeakHourSurchargeApplied,
        peakHourSurchargeAmount: p.peakHourSurchargeAmount,
        peakHourSurchargeMoto: p.peakHourSurchargeMoto,
        peakHourSurchargeApp: p.peakHourSurchargeApp
      };
    }));

    return { total, page, totalPages: Math.ceil(total / limit), pedidos: pedidosMapeados };
  }

  async obtenerProductosPorPedido(pedidoId: string, clienteId: string) {
    const pedido = await Pedido.createQueryBuilder("pedido")
      .where("pedido.id = :pedidoId", { pedidoId })
      .andWhere("pedido.clienteId = :clienteId", { clienteId })
      .leftJoinAndSelect("pedido.productos", "productos")
      .leftJoinAndSelect("productos.producto", "producto")
      .getOne();

    if (!pedido) {
      throw CustomError.notFound("Pedido no encontrado o no pertenece a este cliente");
    }

    return pedido.productos.map(pp => ({
      nombre: pp.producto?.nombre || pp.producto_nombre || "Producto no disponible", 
      cantidad: pp.cantidad, 
      subtotal: pp.subtotal, 
      precio_venta: pp.precio_venta,
      imagen: pp.producto_imagen, 
      tipoProducto: pp.producto?.tipoProducto || 'NORMAL'
    }));
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

  async cancelarPedidoPorDemora(pedidoId: string, clienteId: string) {
    const pedido = await Pedido.findOne({
      where: { id: pedidoId, cliente: { id: clienteId } },
      relations: ["negocio", "negocio.usuario", "productos", "productos.producto"]
    });

    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    if (pedido.estado !== EstadoPedido.ACEPTADO) {
      throw CustomError.badRequest("Solo se pueden cancelar por demora los pedidos en estado ACEPTADO");
    }

    // Validar si tiene productos programados
    const tieneProgramados = pedido.productos.some(p => p.producto?.tipoProducto === 'PROGRAMADO');
    if (tieneProgramados) {
      throw CustomError.badRequest("Los pedidos con productos programados no permiten cancelación por demora");
    }

    // Validar tiempo (Eliminado tiempo de gracia de 10 min a petición del usuario)
    const fechaBase = pedido.fecha_aceptado || pedido.createdAt;
    const prepTimeMax = pedido.tiempoPreparacionElegido || pedido.negocio?.tiempoPreparacionMax || 30;
    const ahora = new Date();
    const limite = new Date(fechaBase.getTime() + prepTimeMax * 60000);

    if (ahora < limite) {
      throw CustomError.badRequest("Aún no se ha cumplido el tiempo de gracia para cancelar por demora");
    }

    // Proceder con cancelación
    pedido.estado = EstadoPedido.CANCELADO;
    pedido.motivoCancelacion = "Cancelación por demora excesiva en la preparación";
    await pedido.save();

    // Notificar al Negocio
    const io = getIO();
    const updateData = {
      pedidoId: pedido.id,
      estado: pedido.estado,
      motivoCancelacion: pedido.motivoCancelacion,
      timestamp: ahora.toISOString()
    };

    io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
    io.to(clienteId).emit("pedido_actualizado", updateData);

    if (pedido.negocio.usuario) {
      await notificationService.sendPushNotification(
        pedido.negocio.usuario.id,
        "Pedido Cancelado por Demora",
        `El cliente canceló el pedido #${pedido.id.split('-')[0]} debido a demora en la preparación.`,
        { url: `/business/dashboard/${pedido.negocio.id}/orders/history` }
      );
    }

    return { ok: true };
  }

  async refreshTimer(id: string, minutosExtras: number = 0) {
    const pedido = await Pedido.findOne({ 
      where: { id },
      relations: ['negocio', 'cliente'] 
    });

    if (!pedido) return { success: false, message: "Pedido no encontrado" };

    // 1. Obtener horario de cierre global
    const { GlobalSettings } = require("../../../data");
    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: 'DESC' } });
    const horaCierreStr = settings?.hora_cierre || "22:00:00"; // Fallback 10 PM

    // 2. Validar que no pase la hora de cierre
    const ahora = new Date();
    const [h, m, s] = horaCierreStr.split(':').map(Number);
    const limiteCierre = new Date();
    limiteCierre.setHours(h, m, s, 0);

    const nuevaFechaExpira = new Date(ahora.getTime() + (minutosExtras * 60000));

    if (nuevaFechaExpira > limiteCierre) {
      return { 
        success: false, 
        message: `No puedes extender el tiempo más allá de la hora de cierre (${horaCierreStr.substring(0, 5)})` 
      };
    }

    // 3. Actualizar tiempos y elección del usuario
    const nuevaFechaBase = new Date();
    pedido.createdAt = nuevaFechaBase;
    pedido.fecha_aceptado = nuevaFechaBase;
    pedido.tiempoPreparacionElegido = minutosExtras; // Guardamos la elección del usuario
    await pedido.save();

    // 4. Notificar vía Sockets
    const io = require("../../../config/socket").getIO();
    const updateData = {
      pedidoId: pedido.id,
      id: pedido.id,
      newCreatedAt: nuevaFechaBase.toISOString(),
      fecha_aceptado: nuevaFechaBase.toISOString(),
      tiempoPreparacionElegido: minutosExtras
    };

    io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
    io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);

    return { 
      success: true, 
      newCreatedAt: nuevaFechaBase.toISOString() 
    };
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
    console.log("🕒 [Mantenimiento] Iniciando vigilante de pedidos...");
    
    // Tarea 1: Auto-cancelación de pedidos (Cada 1 minuto)
    setInterval(async () => {
      try {
        const ahora = new Date();
        const horaEcuador = ahora.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Guayaquil' });
        
        // --- INICIO: VERIFICADOR AUTOMÁTICO DE PAYPHONE (POLLING) ---
        try {
           const { WalletService } = await import("../wallet.service");
           const { UserService } = await import("../usuario/user.service");
           const { EmailService } = await import("../email.service");
           const { envs } = await import("../../../config/env");
           const { GlobalSettings, RechargeRequest, StatusRecarga } = await import("../../../data");
           
           // 1. RECONCILIACIÓN DE PEDIDOS (TARJETA)
           const pedidosPendientes = await Pedido.find({
              where: { estado: EstadoPedido.PENDIENTE_PAGO, metodoPago: 'TARJETA' as any },
              relations: ["negocio"]
           });
           
           for (const pedidoPendiente of pedidosPendientes) {
              try {
                   if (pedidoPendiente.negocio?.payphone_token) {
                     const clientTxIdForSearch = pedidoPendiente.referenciaPago || pedidoPendiente.id;
                     const txInfo = await PayphoneService.getTransactionByClientTxId(clientTxIdForSearch, pedidoPendiente.negocio.payphone_token);
                     if (txInfo && (txInfo.transactionStatus === "Approved" || txInfo.status === "Approved")) {
                         console.log(`[Auto-Reconcile] 🔄 Pedido ${pedidoPendiente.id} rescatado y pagado en PayPhone.`);
                         const pedidoService = new PedidoUsuarioService();
                         await pedidoService.confirmarPago(txInfo.transactionId || txInfo.transactionIdBase, clientTxIdForSearch);
                     }
                  }
              } catch (e) {
                  console.error(`[Auto-Reconcile] Error verificando pedido ${pedidoPendiente.id}:`, e);
              }
           }

           // 2. RECONCILIACIÓN DE RECARGAS DE BILLETERA (TARJETA)
           const recargasPendientes = await RechargeRequest.find({
              where: { status: StatusRecarga.PENDIENTE, payment_method: 'CARD' as any }
           });
           
           if (recargasPendientes.length > 0) {
               const settings = await GlobalSettings.findOne({ where: {} });
               if (settings?.payphoneToken) {
                   const emailService = new EmailService(envs.MAILER_SERVICE, envs.MAILER_EMAIL, envs.MAILER_SECRET_KEY, envs.SEND_EMAIL);
                   const userService = new UserService(emailService);
                   const walletService = new WalletService(userService);

                   for (const recargaPend of recargasPendientes) {
                      try {
                          const shortIdForSearch = recargaPend.id.replace(/-/g, '').slice(0, 20);
                          let txInfo = await PayphoneService.getTransactionByClientTxId(shortIdForSearch, settings.payphoneToken);
                          
                          if (!txInfo) {
                             txInfo = await PayphoneService.getTransactionByClientTxId(recargaPend.id, settings.payphoneToken);
                          }
                          
                          if (txInfo && (txInfo.transactionStatus === "Approved" || txInfo.status === "Approved")) {
                              console.log(`[Auto-Reconcile] 🔄 Recarga ${recargaPend.id} rescatada y cobrada en PayPhone.`);
                              await walletService.confirmPayphoneRecharge(recargaPend.id, txInfo.transactionId || txInfo.transactionIdBase);
                          }
                      } catch (e) {
                          console.error(`[Auto-Reconcile] Error verificando recarga ${recargaPend.id}:`, e);
                      }
                   }
               }
           }
        } catch (e) {
           console.error("[Auto-Reconcile] Error general en el verificador de PayPhone:", e);
        }
        // --- FIN: VERIFICADOR AUTOMÁTICO DE PAYPHONE (POLLING) ---

        // 1. Limpieza rápida de PENDIENTE_PAGO (6 minutos)
        await Pedido.getRepository().query(`UPDATE pedido SET estado = 'CANCELADO', "motivoCancelacion" = 'Pago no registrado en el tiempo límite.' WHERE estado = 'PENDIENTE_PAGO' AND "createdAt" < NOW() - INTERVAL '6 minutes'`);

        const { GlobalSettings } = require("../../../data");
        const settings = await GlobalSettings.findOne({ where: {} });
        const graceMinutes = settings?.acceptedOrderGraceMinutes || 10;

        // 2. Vigilante de ACEPTADOS (Optimizado: Query Filtering + Lazy Loading)
        const pedidosExpirados = await Pedido.createQueryBuilder('p')
          .leftJoinAndSelect('p.negocio', 'n')
          .leftJoinAndSelect('n.usuario', 'u')
          .where('p.estado = :estado', { estado: EstadoPedido.ACEPTADO })
          // 🛡️ Filtro 1: Excluir pedidos con productos PROGRAMADOS (Subquery para no cargar relaciones innecesarias)
          .andWhere((qb) => {
            const subQuery = qb.subQuery()
              .select('1')
              .from(ProductoPedido, 'pp')
              .innerJoin('pp.producto', 'prod')
              .where('pp."pedidoId" = p.id')
              .andWhere('prod."tipoProducto" = :tipo', { tipo: 'PROGRAMADO' })
              .getQuery();
            return `NOT EXISTS ${subQuery}`;
          })
          // 🛡️ Filtro 2: Solo pedidos cuya fecha (aceptado o creado) + tiempo de preparación + graceMinutes min sea menor a NOW()
          .andWhere(`
            (COALESCE(p.fecha_aceptado, p.createdAt) + 
            (COALESCE(p.tiempoPreparacionElegido, n.tiempoPreparacionMax, 30) + :graceMinutes) * INTERVAL '1 minute') < NOW()
          `, { graceMinutes })
          .getMany();

        const io = getIO();
        const notificationService = new NotificationService();

        for (const pedido of pedidosExpirados) {
          try {
            // Si es medianoche (23:30 - 23:59), es un barrido nocturno
            const isNightSweepTime = horaEcuador.startsWith("23:3") || horaEcuador.startsWith("23:4") || horaEcuador.startsWith("23:5");

            console.log(`[Auto-Cancel] 🚨 Pedido ${pedido.id} cancelando por expiración...`);
            
            pedido.estado = EstadoPedido.CANCELADO;
            pedido.motivoCancelacion = isNightSweepTime 
              ? "Cierre operativo nocturno: Pedido expirado sin finalizar."
              : "Cancelación automática por demora excesiva en la preparación sin respuesta del cliente.";
            await pedido.save();

            io.emit("pedido_actualizado", { id: pedido.id, estado: pedido.estado });
            io.emit("admin_live_update", { type: 'ORDER_UPDATED', pedidoId: pedido.id });
            
            if (pedido.negocio?.usuario?.id) {
               await notificationService.sendPushNotification(
                  pedido.negocio.usuario.id,
                  "🚨 Pedido Auto-Cancelado",
                  `El pedido #${pedido.id.substring(0,8)} fue cancelado por demora excesiva.`,
                  { url: `/business/dashboard/${pedido.negocio.id}/orders/history` }
               );
            }
          } catch (err) {
            console.error(`[Auto-Cancel] Error procesando pedido ${pedido?.id}:`, err);
          }
        }
      } catch (error) {
        console.error("❌ [Mantenimiento] Error en tarea de auto-cancelación:", error);
      }
    }, 60000);

    // Tarea 2: Cobro de Suscripciones (Cada hora)
    setInterval(async () => {
      try {
        const { SubscriptionService } = await import("../subscription.service");
        const subService = new SubscriptionService();
        const results = await subService.processDailySubscriptions();
        if (results.totalProcessed > 0) {
            console.log(`[Maintenance] Suscripciones procesadas: ${results.successful} exitosas, ${results.failed} fallidas.`);
        }
      } catch (e) {
        console.error("[Maintenance] Error procesando suscripciones:", e);
      }
    }, 3600000); 
  }

  static async manualCleanup() {
      console.log("🧹 [Mantenimiento] Ejecutando limpieza manual de pedidos...");
      const pedidosExpirados = await Pedido.find({
        where: { estado: EstadoPedido.ACEPTADO },
        relations: ["negocio", "negocio.usuario", "productos", "productos.producto"]
      });

      let cancelados = 0;
      const ahora = new Date();
      const io = getIO();

      for (const pedido of pedidosExpirados) {
        // 🛡️ Saltar pedidos programados (ellos no expiran por tiempo de aceptación normal)
        const esProgramado = pedido.productos?.some(p => p.producto?.tipoProducto === 'PROGRAMADO');
        if (esProgramado) continue;

        const { GlobalSettings } = require("../../../data");
        const settings = await GlobalSettings.findOne({ where: {} });
        const graceMinutes = settings?.acceptedOrderGraceMinutes || 10;
        
        const fechaBase = pedido.fecha_aceptado || pedido.createdAt;
        const prepTimeMax = Number(pedido.tiempoPreparacionElegido || pedido.negocio?.tiempoPreparacionMax || 30);
        const totalLimitMinutes = prepTimeMax + graceMinutes;
        const limiteAutoCancel = new Date(fechaBase.getTime() + totalLimitMinutes * 60000);

        if (ahora > limiteAutoCancel) {
            pedido.estado = EstadoPedido.CANCELADO;
            pedido.motivoCancelacion = "Limpieza manual de pedidos expirados.";
            await pedido.save();
            io.emit("pedido_actualizado", { id: pedido.id, estado: pedido.estado });
            cancelados++;
        }
      }
      return { success: true, count: cancelados };
  }
}
