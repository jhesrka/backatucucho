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
} from "../../../data";
import { JwtAdapterMotorizado, encriptAdapter, envs } from "../../../config";
import { In } from "typeorm";

export class UserMotorizadoService {
  // ✅ Crear motorizado
  async createMotorizado(data: CreateMotorizadoDTO) {
    const motorizado = new UserMotorizado();
    motorizado.name = data.name.toLowerCase().trim();
    motorizado.surname = data.surname.toLowerCase().trim();
    motorizado.whatsapp = data.whatsapp.trim();
    motorizado.cedula = data.cedula.toString();
    motorizado.password = data.password; // se encripta automáticamente en @BeforeInsert
    motorizado.estadoCuenta = EstadoCuentaMotorizado.PENDIENTE;

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
}
