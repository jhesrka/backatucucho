import {
  CreateMotorizadoDTO,
  CustomError,
  ForgotPasswordMotorizadoDTO,
  LoginMotorizadoUserDTO,
  ResetPasswordMotorizadoDTO,
} from "../../../domain";
import {
  UserMotorizado,
  EstadoCuentaMotorizado,
  EstadoTrabajoMotorizado,
  EstadoPedido,
  Pedido,
  TransaccionMotorizado,
  TipoTransaccion,
  EstadoTransaccion,
} from "../../../data";
import { JwtAdapterMotorizado, encriptAdapter, envs } from "../../../config";
import { In, Between, Brackets } from "typeorm";

export class UserMotorizadoService {

  // ✅ Historial de Pedidos Avanzado (Filtrado y Paginado)
  async getOrdersHistory(
    id: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const { page = 1, limit = 20, search, status, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const query = Pedido.createQueryBuilder("pedido")
      .leftJoinAndSelect("pedido.negocio", "negocio")
      .leftJoinAndSelect("pedido.cliente", "cliente")
      .where("pedido.motorizadoId = :id", { id });

    if (status) {
      query.andWhere("pedido.estado = :status", { status });
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere("pedido.createdAt BETWEEN :start AND :end", { start, end });
    }

    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where("CAST(pedido.id AS TEXT) ILIKE :search", { search: `%${search}%` })
            .orWhere("cliente.name ILIKE :search", { search: `%${search}%` })
            .orWhere("cliente.surname ILIKE :search", { search: `%${search}%` })
            .orWhere("negocio.nombre ILIKE :search", { search: `%${search}%` });
        })
      );
    }

    query.orderBy("pedido.createdAt", "DESC");

    // Paginación
    if (limit > 0) {
      query.skip(skip).take(limit);
    }

    const [pedidos, total] = await query.getManyAndCount();

    return {
      pedidos: pedidos.map(p => ({
        id: p.id,
        createdAt: p.createdAt,
        negocio: p.negocio?.nombre || "N/A",
        cliente: p.cliente ? `${p.cliente.name} ${p.cliente.surname}` : "Anónimo",
        total: p.total,
        comision: Number((Number(p.costoEnvio || 0) * 0.80).toFixed(2)), // El motorizado gana el 80% del costo de envío
        estado: p.estado,
        metodoPago: p.metodoPago,
        direccion: p.direccionTexto || "Ubicación GPS",
        // Si está entregado, la comisión ya se aplicó (asunción segura para MVP)
        comisionAplicada: p.estado === EstadoPedido.ENTREGADO
      })),
      total,
      page,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1
    };
  }

  // ✅ Cambio de Estado Manual (Con restricciones de seguridad)
  async changeOrderStatus(pedidoId: string, newStatus: EstadoPedido) {
    const pedido = await Pedido.findOneBy({ id: pedidoId });
    if (!pedido) throw CustomError.notFound("Pedido no encontrado");

    // 🔒 REGLA DE ORO: No tocar pedidos entregados
    if (pedido.estado === EstadoPedido.ENTREGADO) {
      throw CustomError.badRequest("⛔ SEGURIDAD: No se puede modificar un pedido que ya fue ENTREGADO y comisionado.");
    }

    pedido.estado = newStatus;
    await pedido.save();

    return { message: "Estado actualizado correctamente", nuevoEstado: pedido.estado };
  }

  // ✅ Estadísticas de Rendimiento Mensual
  async getMonthlyPerformance(id: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const pedidos = await Pedido.find({
      where: {
        motorizado: { id },
        createdAt: Between(startOfMonth, endOfMonth),
      },
      relations: ["negocio", "cliente"],
      order: { createdAt: "DESC" },
    });

    const total = pedidos.length;
    const entregados = pedidos.filter((p) => p.estado === EstadoPedido.ENTREGADO).length;
    const cancelados = pedidos.filter((p) => p.estado === EstadoPedido.CANCELADO).length;
    // Consideramos En Curso todo lo que no esté finalizado
    const enCurso = pedidos.filter((p) =>
      p.estado !== EstadoPedido.ENTREGADO &&
      p.estado !== EstadoPedido.CANCELADO &&
      p.estado !== EstadoPedido.PREPARANDO_NO_ASIGNADO
    ).length;

    return {
      stats: {
        total,
        entregados,
        cancelados,
        enCurso,
      },
      pedidos: pedidos.map((p) => ({
        id: p.id,
        fecha: p.createdAt,
        negocio: p.negocio?.nombre || "N/A",
        cliente: p.cliente ? `${p.cliente.name} ${p.cliente.surname}` : "Anónimo",
        estado: p.estado,
        monto: p.total,
        tiempoEntrega: "N/A"
      })),
    };
  }
  // ✅ Crear motorizado (Admin)
  async createMotorizado(data: CreateMotorizadoDTO) {
    const motorizado = new UserMotorizado();
    motorizado.name = data.name.toLowerCase().trim();
    motorizado.surname = data.surname.toLowerCase().trim();
    motorizado.whatsapp = data.whatsapp.trim();
    motorizado.cedula = data.cedula.toString();

    // Fallback password a la cédula si no se proporciona
    motorizado.password = data.password || data.cedula.toString();

    // Configuración por defecto para creación por Admin
    motorizado.estadoCuenta = EstadoCuentaMotorizado.ACTIVO;
    motorizado.estadoTrabajo = EstadoTrabajoMotorizado.NO_TRABAJANDO;
    motorizado.quiereTrabajar = false;

    try {
      const nuevo = await motorizado.save();
      return {
        id: nuevo.id,
        name: nuevo.name,
        surname: nuevo.surname,
        whatsapp: nuevo.whatsapp,
        cedula: nuevo.cedula,
        estadoCuenta: nuevo.estadoCuenta,
        createdAt: nuevo.createdAt,
      };
    } catch (error: any) {
      if (error.code === "23505") {
        throw CustomError.badRequest(
          `Ya existe un motorizado con esta cédula o WhatsApp`
        );
      }
      throw CustomError.internalServer("Error al crear motorizado");
    }
  }
  // ✅ Login del motorizado
  async loginMotorizado(data: LoginMotorizadoUserDTO) {
    const usermotorizado = await this.findUserByCedula(data.cedula);

    const validPassword = encriptAdapter.compare(
      data.password,
      usermotorizado.password
    );

    if (!validPassword) {
      throw CustomError.unAuthorized("Cédula o contraseña incorrectas");
    }

    const tokenmotorizado = await JwtAdapterMotorizado.generateTokenMotorizado(
      {
        id: usermotorizado.id,
      },
      envs.JWT_EXPIRE_IN
    );

    if (!tokenmotorizado) {
      throw CustomError.internalServer("Error generando Jwt");
    }

    return {
      tokenmotorizado,
      usermotorizado: {
        id: usermotorizado.id,
        name: usermotorizado.name,
        surname: usermotorizado.surname,
        cedula: usermotorizado.cedula,
        whatsapp: usermotorizado.whatsapp,
      },
    };
  }

  async logoutMotorizado(id: string) {
    const motorizado = await UserMotorizado.findOneBy({ id });

    if (!motorizado) {
      throw CustomError.notFound("Motorizado no encontrado");
    }

    // 🔒 1️⃣ BLOQUEO POR ESTADO DEL MOTORIZADO (FUENTE DE VERDAD)
    if (
      motorizado.estadoTrabajo === EstadoTrabajoMotorizado.ENTREGANDO ||
      motorizado.estadoTrabajo === EstadoTrabajoMotorizado.EN_EVALUACION
    ) {
      throw CustomError.badRequest(
        "No puedes cerrar sesión mientras estés entregando o en evaluación"
      );
    }

    // 🔒 2️⃣ BLOQUEO POR PEDIDO ACTIVO (SEGURIDAD EXTRA)
    const pedidoActivo = await Pedido.findOne({
      where: {
        motorizado: { id },
        estado: In([EstadoPedido.PREPARANDO_ASIGNADO, EstadoPedido.EN_CAMINO]),
      },
    });

    if (pedidoActivo) {
      throw CustomError.badRequest(
        "No puedes cerrar sesión mientras tengas un pedido en curso"
      );
    }

    // ✅ 3️⃣ CAMBIOS DE ESTADO (LOGOUT REAL)
    motorizado.estadoTrabajo = EstadoTrabajoMotorizado.NO_TRABAJANDO;
    motorizado.quiereTrabajar = false;
    motorizado.tokenVersion += 1;

    await motorizado.save();

    return {
      message: "Sesión cerrada correctamente",
    };
  }

  async getMotorizadoFull(id: string) {
    const motorizado = await UserMotorizado.findOne({
      where: { id },
      relations: ["pedidos"],
    });

    if (!motorizado) {
      throw CustomError.notFound("Motorizado no encontrado");
    }

    return {
      id: motorizado.id,
      name: motorizado.name,
      surname: motorizado.surname,
      whatsapp: motorizado.whatsapp,
      cedula: motorizado.cedula,

      estadoCuenta: motorizado.estadoCuenta,
      estadoTrabajo: motorizado.estadoTrabajo,
      quiereTrabajar: motorizado.quiereTrabajar,
      noDisponibleHasta: motorizado.noDisponibleHasta,
      fechaHoraDisponible: motorizado.fechaHoraDisponible,

      pedidos: motorizado.pedidos?.map((p) => ({
        id: p.id,
        estado: p.estado,
        createdAt: p.createdAt,
      })),

      createdAt: motorizado.createdAt,
    };
  }

  async findUserByCedula(cedula: string) {
    const usermotorizado = await UserMotorizado.findOne({
      where: {
        cedula: cedula,
        estadoCuenta: EstadoCuentaMotorizado.ACTIVO,
      },
    });
    if (!usermotorizado) {
      throw CustomError.notFound(
        `Usuario: ${usermotorizado} o contraseña no validos`
      );
    }
    return usermotorizado;
  }
  // Genera y devuelve el link de recuperación para enviar por WhatsApp desde frontend
  async forgotPassword(dto: ForgotPasswordMotorizadoDTO) {
    // Buscar motorizado por cédula
    const motorizado = await UserMotorizado.findOne({
      where: {
        cedula: dto.cedula,
        estadoCuenta: EstadoCuentaMotorizado.ACTIVO,
      },
    });

    // Respuesta genérica para no revelar existencia
    if (!motorizado) {
      return {
        message:
          "Si el usuario existe, se ha generado el enlace de recuperación.",
      };
    }

    // Generar token con id y resetTokenVersion
    const token = await JwtAdapterMotorizado.generateTokenMotorizado(
      {
        id: motorizado.id,
        resetTokenVersion: motorizado.resetTokenVersion,
      },
      "5m"
    );

    if (!token) throw CustomError.internalServer("Error generando token");

    // Construir link para frontend
    const recoveryLink = `${envs.WEBSERVICE_URL_FRONT}/motorizado/restablecer?token=${token}`;

    await motorizado.save();

    // Retornar el link para que el frontend lo use y abra WhatsApp con el mensaje
    return {
      message: "Enlace de recuperación generado",
      recoveryLink,
      whatsapp: motorizado.whatsapp,
    };
  }

  // Validar token y cambiar contraseña
  async resetPassword(dto: ResetPasswordMotorizadoDTO) {
    const payload: any = await JwtAdapterMotorizado.validateTokenMotorizado(
      dto.token
    );

    if (!payload || !payload.id || payload.resetTokenVersion === undefined) {
      throw CustomError.unAuthorized("Token inválido o expirado");
    }

    const motorizado = await UserMotorizado.findOne({
      where: { id: payload.id },
    });
    if (!motorizado) throw CustomError.notFound("Usuario no encontrado");

    // Validar versión de token
    if (motorizado.resetTokenVersion !== payload.resetTokenVersion) {
      throw CustomError.unAuthorized("Este enlace ya fue usado o es inválido");
    }

    // Actualizar contraseña (hasheada)
    motorizado.password = encriptAdapter.hash(dto.newPassword);

    // Incrementar versión del token para invalidar el actual
    motorizado.resetTokenVersion += 1;

    await motorizado.save();

    return { message: "Contraseña actualizada correctamente" };
  }

  // ✅ Ver todos los motorizados
  async findAllMotorizados() {
    const motorizados = await UserMotorizado.find();
    return motorizados.map((m) => ({
      id: m.id,
      name: m.name,
      surname: m.surname,
      whatsapp: m.whatsapp,
      cedula: m.cedula,
      estadoCuenta: m.estadoCuenta,
      estadoTrabajo: m.estadoTrabajo,
      fechaHoraDisponible: m.fechaHoraDisponible,
      quiereTrabajar: m.quiereTrabajar,
      saldo: m.saldo,
      createdAt: m.createdAt,
    }));
  }

  // ✅ Ver un motorizado por ID
  async findMotorizadoById(id: string) {
    const motorizado = await UserMotorizado.findOneBy({ id });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    return {
      id: motorizado.id,
      name: motorizado.name,
      surname: motorizado.surname,
      whatsapp: motorizado.whatsapp,
      cedula: motorizado.cedula,
      estadoCuenta: motorizado.estadoCuenta,
      estadoTrabajo: motorizado.estadoTrabajo,
      quiereTrabajar: motorizado.quiereTrabajar,
      saldo: motorizado.saldo,
      fechaHoraDisponible: motorizado.fechaHoraDisponible,
      createdAt: motorizado.createdAt,
    };
  }

  // ✅ Editar motorizado (excepto contraseña)
  async updateMotorizado(id: string, data: Partial<CreateMotorizadoDTO>) {
    const motorizado = await UserMotorizado.findOneBy({ id });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    if (data.name) motorizado.name = data.name.toLowerCase().trim();
    if (data.surname) motorizado.surname = data.surname.toLowerCase().trim();
    if (data.whatsapp) motorizado.whatsapp = data.whatsapp.trim();
    if (data.cedula) motorizado.cedula = data.cedula.toString();

    // Campos administrativos extra
    if ((data as any).estadoCuenta) motorizado.estadoCuenta = (data as any).estadoCuenta;
    if ((data as any).estadoTrabajo) motorizado.estadoTrabajo = (data as any).estadoTrabajo;

    // Manejo robusto de quiereTrabajar
    if ((data as any).quiereTrabajar !== undefined) {
      const q = (data as any).quiereTrabajar;
      // Convertir a booleano real si viene como string
      motorizado.quiereTrabajar = (q === true || q === 'true');
    }

    console.log("Updating Motorizado:", {
      id,
      recibido: data,
      estadoCuenta: motorizado.estadoCuenta,
      estadoTrabajo: motorizado.estadoTrabajo,
      quiereTrabajar: motorizado.quiereTrabajar
    });

    // Lógica de Consistencia y Reglas de Negocio
    // 1. Si está DISPONIBLE, obligatoriamente quiere trabajar.
    if (motorizado.estadoTrabajo === EstadoTrabajoMotorizado.DISPONIBLE) {
      motorizado.quiereTrabajar = true;
    }
    // 2. Si NO quiere trabajar, no puede estar DISPONIBLE.
    if (motorizado.quiereTrabajar === false && motorizado.estadoTrabajo === EstadoTrabajoMotorizado.DISPONIBLE) {
      motorizado.estadoTrabajo = EstadoTrabajoMotorizado.NO_TRABAJANDO;
    }

    console.log("Saving Motorizado (Normalized):", {
      estadoTrabajo: motorizado.estadoTrabajo,
      quiereTrabajar: motorizado.quiereTrabajar
    });

    try {
      const actualizado = await motorizado.save();
      return {
        id: actualizado.id,
        name: actualizado.name,
        surname: actualizado.surname,
        whatsapp: actualizado.whatsapp,
        cedula: actualizado.cedula,
        estadoCuenta: actualizado.estadoCuenta,
      };
    } catch (error: any) {
      if (error.code === "23505") {
        throw CustomError.badRequest(
          `Ya existe un motorizado con esa cédula o WhatsApp`
        );
      }
      throw CustomError.internalServer("Error al actualizar motorizado");
    }
  }

  // Activar / desactivar
  async toggleActivo(id: string) {
    const motorizado = await UserMotorizado.findOneBy({ id });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    motorizado.estadoCuenta =
      motorizado.estadoCuenta === EstadoCuentaMotorizado.ACTIVO
        ? EstadoCuentaMotorizado.PENDIENTE
        : EstadoCuentaMotorizado.ACTIVO;

    await motorizado.save();

    return {
      id: motorizado.id,
      estadoCuenta: motorizado.estadoCuenta,
    };
  }

  // Eliminar
  async deleteMotorizado(id: string) {
    const motorizado = await UserMotorizado.findOneBy({ id });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    motorizado.estadoCuenta = EstadoCuentaMotorizado.ELIMINADO; // 🔥 CORREGIDO
    await motorizado.save();

    return { message: "Motorizado eliminado correctamente" };
  }

  // ✅ Cambiar contraseña (desde el panel)
  async cambiarPassword(id: string, nuevaPassword: string) {
    const motorizado = await UserMotorizado.findOneBy({ id });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    motorizado.password = encriptAdapter.hash(nuevaPassword);
    await motorizado.save();
    return { message: "Contraseña actualizada correctamente" };
  }

  // ✅ Historial de transacciones de billetera (Admin)
  async getTransactions(motorizadoId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await TransaccionMotorizado.findAndCount({
      where: { motorizado: { id: motorizadoId } },
      order: { createdAt: "DESC" },
      skip,
      take: limit,
      relations: ['pedido'] // Incluir pedido si existe
    });

    return {
      transactions,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ✅ Ajuste manual de saldo (Admin)
  async adjustBalance(
    motorizadoId: string,
    amount: number,
    observation: string,
    adminId: string
  ) {
    const motorizado = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    if (amount === 0) throw CustomError.badRequest("El monto no puede ser 0");

    // Calcular nuevo saldo
    const newBalance = Number(motorizado.saldo) + amount;

    // Crear transacción
    const transaction = new TransaccionMotorizado();
    transaction.motorizado = motorizado;
    transaction.monto = amount; // Puede ser negativo
    transaction.tipo = TipoTransaccion.AJUSTE;
    transaction.descripcion = `AJUSTE ADMIN: ${observation} (Admin ID: ${adminId})`;
    transaction.saldoAnterior = Number(motorizado.saldo);
    transaction.saldoNuevo = newBalance;

    // Guardar transacción y actualizar motorizado
    await transaction.save();

    motorizado.saldo = newBalance;
    await motorizado.save();

    return {
      newBalance: motorizado.saldo,
      transaction,
    };
  }

  // ✅ Estadísticas de billetera
  async getWalletStats(motorizadoId: string) {
    const motorizado = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    // Calcular total ganado (SOLO GANANCIAS)
    const totalIngresos = await TransaccionMotorizado.sum("monto", {
      motorizado: { id: motorizadoId },
      tipo: TipoTransaccion.GANANCIA_ENVIO
    });

    // Calcular total retirado
    const totalEgresos = await TransaccionMotorizado.sum("monto", {
      motorizado: { id: motorizadoId },
      tipo: TipoTransaccion.RETIRO
    });

    // Calcular pedidos entregados
    const deliveredOrders = await TransaccionMotorizado.count({
      where: {
        motorizado: { id: motorizadoId },
        tipo: TipoTransaccion.GANANCIA_ENVIO
      }
    });

    // Calcular ganancia mensual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyEarnings = await TransaccionMotorizado.createQueryBuilder("t")
      .where("t.motorizadoId = :id", { id: motorizadoId })
      .andWhere("t.tipo = :tipo", { tipo: TipoTransaccion.GANANCIA_ENVIO })
      .andWhere("t.createdAt >= :start", { start: startOfMonth })
      .select("SUM(t.monto)", "total")
      .getRawOne();

    const earnings = Number(totalIngresos || 0);

    return {
      saldo: motorizado.saldo,
      totalIngresos: earnings,
      totalEgresos: totalEgresos || 0,
      deliveredOrders,
      averagePerOrder: deliveredOrders > 0 ? (earnings / deliveredOrders).toFixed(2) : 0,
      monthlyEarnings: Number(monthlyEarnings?.total || 0),
    };
  }
  async deleteForce(id: string) {
    const motorizado = await UserMotorizado.findOne({ where: { id } });
    if (!motorizado) throw CustomError.notFound("Motorizado no encontrado");

    // Borrar transacciones
    await TransaccionMotorizado.delete({ motorizado: { id } });

    // Borrar pedidos asociados
    await Pedido.delete({ motorizado: { id } });

    // Borrar motorizado
    await UserMotorizado.delete(id);

    return { message: "Motorizado y todos sus datos eliminados definitivamente" };
  }

  // ✅ Obtener solicitudes de retiro
  async getWithdrawals(motorizadoId: string, page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;

    const query = TransaccionMotorizado.createQueryBuilder("t")
      .where("t.motorizadoId = :id", { id: motorizadoId })
      .andWhere("t.tipo = :tipo", { tipo: TipoTransaccion.RETIRO })
      .orderBy("t.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    if (status) {
      query.andWhere("t.estado = :status", { status });
    }

    const [withdrawals, total] = await query.getManyAndCount();

    return {
      withdrawals,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ✅ Aprobar retiro
  async approveWithdrawal(transactionId: string, adminId: string, proofUrl: string, comment: string) {
    const transaction = await TransaccionMotorizado.findOne({
      where: { id: transactionId },
      relations: ["motorizado"],
    });

    if (!transaction) throw CustomError.notFound("Transacción no encontrada");
    if (transaction.tipo !== TipoTransaccion.RETIRO) throw CustomError.badRequest("No es una solicitud de retiro");
    if (transaction.estado !== EstadoTransaccion.PENDIENTE) throw CustomError.badRequest("La solicitud no está pendiente");

    // 1. Descontar saldo AHORA (Flujo corregido: se descuenta al aprobar)
    const motorizado = transaction.motorizado;
    const withdrawalAmount = Math.abs(Number(transaction.monto));

    if (Number(motorizado.saldo) < withdrawalAmount) {
      throw CustomError.badRequest(`Saldo insuficiente en billetera del motorizado al momento de aprobar. Saldo: ${motorizado.saldo}, Retiro: ${withdrawalAmount}`);
    }

    motorizado.saldo = Number(motorizado.saldo) - withdrawalAmount;
    await motorizado.save();

    // 2. Actualizar transacción
    transaction.estado = EstadoTransaccion.COMPLETADA;
    transaction.descripcion = `${transaction.descripcion || ''} | APROBADO por Admin: ${comment}`;
    transaction.saldoNuevo = motorizado.saldo;
    transaction.detalles = JSON.stringify({
      ...JSON.parse(transaction.detalles || '{}'),
      adminId,
      proofUrl,
      approvedAt: new Date(),
    });

    await transaction.save();

    return { message: "Retiro aprobado y saldo descontado", transaction };
  }

  // ✅ Rechazar retiro (Reembolsar saldo)
  async rejectWithdrawal(transactionId: string, adminId: string, comment: string) {
    const transaction = await TransaccionMotorizado.findOne({
      where: { id: transactionId },
      relations: ["motorizado"],
    });

    if (!transaction) throw CustomError.notFound("Transacción no encontrada");
    if (transaction.tipo !== TipoTransaccion.RETIRO) throw CustomError.badRequest("No es una solicitud de retiro");
    if (transaction.estado !== EstadoTransaccion.PENDIENTE) throw CustomError.badRequest("La solicitud no está pendiente");

    // 1. NO Reembolsar saldo (porque NO se descontó al solicitar en el nuevo flujo)
    const motorizado = transaction.motorizado;

    // motorizado.saldo = Number(motorizado.saldo) + refundAmount;
    // await motorizado.save();

    // 2. Actualizar transacción
    transaction.estado = EstadoTransaccion.RECHAZADA;
    transaction.descripcion = `${transaction.descripcion || ''} | RECHAZADO por Admin: ${comment}`;
    transaction.saldoNuevo = motorizado.saldo;
    transaction.detalles = JSON.stringify({
      ...JSON.parse(transaction.detalles || '{}'),
      adminId,
      rejectedAt: new Date(),
      refundAmount: 0
    });

    await transaction.save();

    return { message: "Retiro rechazado", transaction, newBalance: motorizado.saldo };
  }

  // ✅ Obtener estadísticas globales de la wallet de motorizados
  async getGlobalWalletStats() {
    const totalGanado = await TransaccionMotorizado.sum("monto", { tipo: TipoTransaccion.GANANCIA_ENVIO });
    const totalPagado = await TransaccionMotorizado.sum("monto", { tipo: TipoTransaccion.RETIRO, estado: EstadoTransaccion.COMPLETADA }); // Egresos son negativos, sumar valores absolutos si se quiere total

    // Total pendiente (suma de solicitudes PENDIENTES)
    const totalPendiente = await TransaccionMotorizado.sum("monto", { tipo: TipoTransaccion.RETIRO, estado: EstadoTransaccion.PENDIENTE });

    // Total saldo acumulado en billeteras (suma de saldos de todos los motorizados)
    const { totalSaldo } = await UserMotorizado.createQueryBuilder("m")
      .select("SUM(m.saldo)", "totalSaldo")
      .getRawOne();

    // Use query builder for > 0 count if typeorm utilities not imported
    const countSaldoDisponible = await UserMotorizado.createQueryBuilder("m")
      .where("m.saldo > 0")
      .getCount();

    const countRetiroPendiente = await TransaccionMotorizado.createQueryBuilder("t")
      .where("t.tipo = :tipo", { tipo: TipoTransaccion.RETIRO })
      .andWhere("t.estado = :estado", { estado: EstadoTransaccion.PENDIENTE })
      .select("COUNT(DISTINCT t.motorizadoId)", "count")
      .getRawOne();

    return {
      totalGanado: Number(totalGanado || 0),
      totalPagado: Math.abs(Number(totalPagado || 0)),
      totalPendiente: Math.abs(Number(totalPendiente || 0)),
      totalSaldoAcumulado: Number(totalSaldo || 0),
      countSaldoDisponible,
      countRetiroPendiente: Number(countRetiroPendiente?.count || 0)
    };
  }

  // ✅ Obtener TODAS las solicitudes de retiro (Global)
  async getAllGlobalWithdrawals(status?: string) {
    const query = TransaccionMotorizado.createQueryBuilder("t")
      .leftJoinAndSelect("t.motorizado", "m")
      .where("t.tipo = :tipo", { tipo: TipoTransaccion.RETIRO })
      .orderBy("t.createdAt", "DESC");

    if (status) {
      query.andWhere("t.estado = :status", { status });
    }

    const withdrawals = await query.getMany();

    return withdrawals.map(w => ({
      id: w.id,
      createdAt: w.createdAt,
      monto: w.monto,
      estado: w.estado,
      motorizado: {
        id: w.motorizado.id,
        name: w.motorizado.name,
        surname: w.motorizado.surname,
        // email: w.motorizado.email, // Removed as it doesn't exist
        whatsapp: w.motorizado.whatsapp,
        saldo: w.motorizado.saldo,
      },
      detalles: w.detalles ? JSON.parse(w.detalles) : {}
    }));
  }
}
