import { getIO } from "../../../config/socket";
import {
  Pedido,
  ProductoPedido,
  Negocio,
  User,
  EstadoPedido,
} from "../../../data";
import {
  CreatePedidoDTO,
  CustomError,
  UpdateEstadoPedidoDTO,
} from "../../../domain";
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

    // Subtotal
    let subtotal = 0;
    for (const p of dto.productos) {
      const pu = Number(p.precioUnitario);
      const cant = Number(p.cantidad);
      if (!Number.isFinite(pu) || !Number.isFinite(cant) || cant <= 0) {
        throw CustomError.badRequest("Producto inválido");
      }
      subtotal += pu * cant;
    }

    // Calcular distancia y envío (server-side, confiable)
    const { distanciaKm, costoEnvio } =
      await CalcularEnvioService.calcularParaPedido({
        negocio,
        latCliente: dto.ubicacionCliente.lat,
        lngCliente: dto.ubicacionCliente.lng,
      });

    const total = +(subtotal + costoEnvio).toFixed(2);

    // Construir pedido + items (cascade)
    const pedido = new Pedido();
    pedido.cliente = cliente;
    pedido.negocio = negocio;
    pedido.estado = EstadoPedido.PENDIENTE;
    pedido.costoEnvio = costoEnvio;
    pedido.total = total;

    pedido.distanciaKm = distanciaKm;
    pedido.latCliente = dto.ubicacionCliente.lat;
    pedido.lngCliente = dto.ubicacionCliente.lng;
    pedido.direccionTexto = dto.ubicacionCliente.direccionTexto ?? null;

    // 💶 Datos de Pago
    if (dto.metodoPago) {
      // Simple casting or validation could be added
      pedido.metodoPago = dto.metodoPago as any;
    }
    if (dto.montoVuelto !== undefined) pedido.montoVuelto = dto.montoVuelto;
    if (dto.comprobantePagoUrl) pedido.comprobantePagoUrl = dto.comprobantePagoUrl;

    pedido.productos = dto.productos.map((item) => {
      const pp = new ProductoPedido();
      (pp as any).producto = { id: item.productoId }; // evitar carga completa
      pp.cantidad = Number(item.cantidad);
      pp.precioUnitario = Number(item.precioUnitario);
      pp.subtotal = +(pp.cantidad * pp.precioUnitario).toFixed(2);
      return pp;
    });

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

    return {
      id: nuevo.id,
      estado: nuevo.estado,
      total: nuevo.total,
      costoEnvio: nuevo.costoEnvio,
      distanciaKm: nuevo.distanciaKm,
      createdAt: nuevo.createdAt,
      metodoPago: nuevo.metodoPago,
      montoVuelto: nuevo.montoVuelto,
      comprobantePagoUrl: nuevo.comprobantePagoUrl
    };
  }
  async cambiarEstado(dto: UpdateEstadoPedidoDTO) {
    const { pedidoId, nuevoEstado, userId } = dto;

    const pedido = await Pedido.findOne({
      where: { id: pedidoId },
      relations: ["negocio", "motorizado", "negocio.usuario"],
    });

    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    // 🔥 1. VALIDAR QUE EL USUARIO SEA EL DUEÑO DEL NEGOCIO
    if (pedido.negocio.usuario.id !== userId) {
      throw CustomError.unAuthorized(
        "No tiene permisos para modificar este pedido"
      );
    }

    const estadoAnterior = pedido.estado;

    // 🔥 2. VALIDAR TRANSICIONES PERMITIDAS
    if (
      estadoAnterior === EstadoPedido.PENDIENTE &&
      nuevoEstado !== EstadoPedido.PREPARANDO
    ) {
      throw CustomError.badRequest(
        "Desde PENDIENTE solo puede cambiar a PREPARANDO"
      );
    }

    if (
      estadoAnterior === EstadoPedido.PREPARANDO &&
      nuevoEstado === EstadoPedido.PENDIENTE
    ) {
      throw CustomError.badRequest("No puede volver a PENDIENTE");
    }

    // 🔥 3. ACTUALIZAR ESTADO
    pedido.estado = nuevoEstado;

    // 🔥 4. SI PASA DE PENDIENTE → PREPARANDO → inicializar asignación automática
    if (
      estadoAnterior === EstadoPedido.PENDIENTE &&
      nuevoEstado === EstadoPedido.PREPARANDO
    ) {
      pedido.rondaAsignacion = 1;
      pedido.fechaInicioRonda = new Date();
      pedido.motorizadoEnEvaluacion = null;
      pedido.asignacionBloqueada = false;
    }

    await pedido.save();

    getIO().emit("pedido_actualizado", {
      pedidoId: pedido.id,
      estado: pedido.estado,
    });

    // 🔥 6. Si ahora está PREPARANDO → iniciar proceso de asignación automática
    if (
      estadoAnterior === EstadoPedido.PENDIENTE &&
      nuevoEstado === EstadoPedido.PREPARANDO
    ) {
      await PedidoMotoService.asignarPedidosAutomaticamente();
    }

    return pedido;
  }

  // Ver los pedidos de un cliente
  async obtenerPedidosCliente(clienteId: string, page = 1, limit = 8) {
    const skip = (page - 1) * limit;

    const [pedidos, total] = await Pedido.findAndCount({
      where: { cliente: { id: clienteId } },
      relations: ["negocio", "productos", "productos.producto", "motorizado"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    const pedidosMapeados = pedidos.map((p) => ({
      id: p.id,
      estado: p.estado,
      total: p.total,
      costoEnvio: p.costoEnvio,

      negocio: {
        id: p.negocio.id,
        nombre: p.negocio.nombre,
      },
      productos: p.productos.map((pp) => ({
        id: pp.id,
        productoId: pp.producto.id,
        nombre: pp.producto.nombre,
        cantidad: pp.cantidad,
        precioUnitario: pp.precioUnitario,
        subtotal: pp.subtotal,
      })),
      fecha: p.createdAt,
      metodoPago: p.metodoPago,
      vuelto: p.montoVuelto ? true : false, // Simple flag
      montoVuelto: p.montoVuelto,
      comprobantePagoUrl: p.comprobantePagoUrl,
      motorizado: p.motorizado ? {
        id: p.motorizado.id,
        name: p.motorizado.name,
        surname: p.motorizado.surname,
        telefono: p.motorizado.whatsapp,
        whatsapp: p.motorizado.whatsapp,
        // placa: p.motorizado.placa // Property does not exist on entity
      } : null,
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
  // Subir comprobante (Local File System)
  async subirComprobante(file: any) {
    console.log("📂 [DEBUG] Recibiendo archivo:", file); // Debug log
    const path = await import("path");
    const fs = await import("fs");

    // 1. Definir directorio de destino (mismo que en server.ts)
    const uploadDir = path.resolve(__dirname, "../../uploads/comprobantes");

    // 2. Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 3. Generar nombre único
    // Multer/Express-fileupload structure difference: 'originalname' vs 'name'
    const originalName = file.originalname || file.name || "comprobante.jpg";
    const fileExtension = path.extname(originalName) || ".jpg";
    const fileName = `${Date.now()}_${originalName.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadDir, fileName);

    // 4. Mover/Guardar archivo
    // file.data used by express-fileupload
    // file.buffer used by multer (memory storage)
    const fileContent = file.data || file.buffer;

    if (fileContent) {
      fs.writeFileSync(filePath, fileContent);
    } else if (typeof file.mv === 'function') {
      await new Promise((resolve, reject) => {
        file.mv(filePath, (err: any) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
    } else {
      // Fallback si es path temporal (multer diskStorage)
      if (file.path) {
        fs.copyFileSync(file.path, filePath);
        fs.unlinkSync(file.path);
      }
    }

    // 5. Retornar URL relativa (coincide con static routing en server.ts)
    // URL format: comprobantes/filename.ext
    return `comprobantes/${fileName}`;
  }


}
