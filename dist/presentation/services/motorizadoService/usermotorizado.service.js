"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserMotorizadoService = void 0;
const domain_1 = require("../../../domain");
const data_1 = require("../../../data");
const config_1 = require("../../../config");
const typeorm_1 = require("typeorm");
class UserMotorizadoService {
    // ✅ Historial de Pedidos Avanzado (Filtrado y Paginado)
    getOrdersHistory(id, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { page = 1, limit = 20, search, status, startDate, endDate } = options;
            const skip = (page - 1) * limit;
            const query = data_1.Pedido.createQueryBuilder("pedido")
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
                query.andWhere(new typeorm_1.Brackets((qb) => {
                    qb.where("CAST(pedido.id AS TEXT) ILIKE :search", { search: `%${search}%` })
                        .orWhere("cliente.name ILIKE :search", { search: `%${search}%` })
                        .orWhere("cliente.surname ILIKE :search", { search: `%${search}%` })
                        .orWhere("negocio.nombre ILIKE :search", { search: `%${search}%` });
                }));
            }
            query.orderBy("pedido.createdAt", "DESC");
            // Paginación
            if (limit > 0) {
                query.skip(skip).take(limit);
            }
            const [pedidos, total] = yield query.getManyAndCount();
            return {
                pedidos: pedidos.map(p => {
                    var _a;
                    return ({
                        id: p.id,
                        createdAt: p.createdAt,
                        negocio: ((_a = p.negocio) === null || _a === void 0 ? void 0 : _a.nombre) || "N/A",
                        cliente: p.cliente ? `${p.cliente.name} ${p.cliente.surname}` : "Anónimo",
                        total: p.total,
                        comision: Number((Number(p.costoEnvio || 0) * 0.80).toFixed(2)), // El motorizado gana el 80% del costo de envío
                        estado: p.estado,
                        metodoPago: p.metodoPago,
                        direccion: p.direccionTexto || "Ubicación GPS",
                        // Si está entregado, la comisión ya se aplicó (asunción segura para MVP)
                        comisionAplicada: p.estado === data_1.EstadoPedido.ENTREGADO
                    });
                }),
                total,
                page,
                totalPages: limit > 0 ? Math.ceil(total / limit) : 1
            };
        });
    }
    // ✅ Cambio de Estado Manual (Con restricciones de seguridad)
    changeOrderStatus(pedidoId, newStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOneBy({ id: pedidoId });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            // 🔒 REGLA DE ORO: No tocar pedidos entregados
            if (pedido.estado === data_1.EstadoPedido.ENTREGADO) {
                throw domain_1.CustomError.badRequest("⛔ SEGURIDAD: No se puede modificar un pedido que ya fue ENTREGADO y comisionado.");
            }
            pedido.estado = newStatus;
            yield pedido.save();
            return { message: "Estado actualizado correctamente", nuevoEstado: pedido.estado };
        });
    }
    // ✅ Estadísticas de Rendimiento Mensual
    getMonthlyPerformance(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const pedidos = yield data_1.Pedido.find({
                where: {
                    motorizado: { id },
                    createdAt: (0, typeorm_1.Between)(startOfMonth, endOfMonth),
                },
                relations: ["negocio", "cliente"],
                order: { createdAt: "DESC" },
            });
            const total = pedidos.length;
            const entregados = pedidos.filter((p) => p.estado === data_1.EstadoPedido.ENTREGADO).length;
            const cancelados = pedidos.filter((p) => p.estado === data_1.EstadoPedido.CANCELADO).length;
            // Consideramos En Curso todo lo que no esté finalizado
            const enCurso = pedidos.filter((p) => p.estado !== data_1.EstadoPedido.ENTREGADO &&
                p.estado !== data_1.EstadoPedido.CANCELADO &&
                p.estado !== data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO).length;
            return {
                stats: {
                    total,
                    entregados,
                    cancelados,
                    enCurso,
                },
                pedidos: pedidos.map((p) => {
                    var _a;
                    return ({
                        id: p.id,
                        fecha: p.createdAt,
                        negocio: ((_a = p.negocio) === null || _a === void 0 ? void 0 : _a.nombre) || "N/A",
                        cliente: p.cliente ? `${p.cliente.name} ${p.cliente.surname}` : "Anónimo",
                        estado: p.estado,
                        monto: p.total,
                        tiempoEntrega: "N/A"
                    });
                }),
            };
        });
    }
    // ✅ Crear motorizado (Admin)
    createMotorizado(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = new data_1.UserMotorizado();
            motorizado.name = data.name.toLowerCase().trim();
            motorizado.surname = data.surname.toLowerCase().trim();
            motorizado.whatsapp = data.whatsapp.trim();
            motorizado.cedula = data.cedula.toString();
            // Fallback password a la cédula si no se proporciona
            motorizado.password = data.password || data.cedula.toString();
            // Configuración por defecto para creación por Admin
            motorizado.estadoCuenta = data_1.EstadoCuentaMotorizado.ACTIVO;
            motorizado.estadoTrabajo = data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
            motorizado.quiereTrabajar = false;
            try {
                const nuevo = yield motorizado.save();
                return {
                    id: nuevo.id,
                    name: nuevo.name,
                    surname: nuevo.surname,
                    whatsapp: nuevo.whatsapp,
                    cedula: nuevo.cedula,
                    estadoCuenta: nuevo.estadoCuenta,
                    createdAt: nuevo.createdAt,
                };
            }
            catch (error) {
                if (error.code === "23505") {
                    throw domain_1.CustomError.badRequest(`Ya existe un motorizado con esta cédula o WhatsApp`);
                }
                throw domain_1.CustomError.internalServer("Error al crear motorizado");
            }
        });
    }
    // ✅ Login del motorizado
    loginMotorizado(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const usermotorizado = yield this.findUserByCedula(data.cedula);
            const validPassword = config_1.encriptAdapter.compare(data.password, usermotorizado.password);
            if (!validPassword) {
                throw domain_1.CustomError.unAuthorized("Cédula o contraseña incorrectas");
            }
            const tokenmotorizado = yield config_1.JwtAdapterMotorizado.generateTokenMotorizado({
                id: usermotorizado.id,
                role: "MOTORIZADO"
            }, config_1.envs.JWT_EXPIRE_IN);
            const refreshToken = yield config_1.JwtAdapterMotorizado.generateTokenMotorizado({
                id: usermotorizado.id,
                role: "MOTORIZADO"
            }, config_1.envs.JWT_REFRESH_EXPIRE_IN);
            if (!tokenmotorizado || !refreshToken) {
                throw domain_1.CustomError.internalServer("Error generando Jwt");
            }
            return {
                tokenmotorizado,
                refreshToken,
                usermotorizado: {
                    id: usermotorizado.id,
                    name: usermotorizado.name,
                    surname: usermotorizado.surname,
                    cedula: usermotorizado.cedula,
                    whatsapp: usermotorizado.whatsapp,
                },
            };
        });
    }
    logoutMotorizado(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id });
            if (!motorizado) {
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            }
            // 🔒 1️⃣ BLOQUEO POR ESTADO DEL MOTORIZADO (FUENTE DE VERDAD)
            if (motorizado.estadoTrabajo === data_1.EstadoTrabajoMotorizado.ENTREGANDO ||
                motorizado.estadoTrabajo === data_1.EstadoTrabajoMotorizado.EN_EVALUACION) {
                throw domain_1.CustomError.badRequest("No puedes cerrar sesión mientras estés entregando o en evaluación");
            }
            // 🔒 2️⃣ BLOQUEO POR PEDIDO ACTIVO (SEGURIDAD EXTRA)
            const pedidoActivo = yield data_1.Pedido.findOne({
                where: {
                    motorizado: { id },
                    estado: (0, typeorm_1.In)([data_1.EstadoPedido.PREPARANDO_ASIGNADO, data_1.EstadoPedido.EN_CAMINO]),
                },
            });
            if (pedidoActivo) {
                throw domain_1.CustomError.badRequest("No puedes cerrar sesión mientras tengas un pedido en curso");
            }
            // ✅ 3️⃣ CAMBIOS DE ESTADO (LOGOUT REAL)
            motorizado.estadoTrabajo = data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
            motorizado.quiereTrabajar = false;
            motorizado.tokenVersion += 1;
            yield motorizado.save();
            return {
                message: "Sesión cerrada correctamente",
            };
        });
    }
    getMotorizadoFull(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const motorizado = yield data_1.UserMotorizado.findOne({
                where: { id },
                relations: ["pedidos"],
            });
            if (!motorizado) {
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
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
                pedidos: (_a = motorizado.pedidos) === null || _a === void 0 ? void 0 : _a.map((p) => ({
                    id: p.id,
                    estado: p.estado,
                    createdAt: p.createdAt,
                })),
                createdAt: motorizado.createdAt,
            };
        });
    }
    findUserByCedula(cedula) {
        return __awaiter(this, void 0, void 0, function* () {
            const usermotorizado = yield data_1.UserMotorizado.findOne({
                where: {
                    cedula: cedula,
                    estadoCuenta: data_1.EstadoCuentaMotorizado.ACTIVO,
                },
            });
            if (!usermotorizado) {
                throw domain_1.CustomError.notFound(`Usuario: ${usermotorizado} o contraseña no validos`);
            }
            return usermotorizado;
        });
    }
    // Genera y devuelve el link de recuperación para enviar por WhatsApp desde frontend
    forgotPassword(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            // Buscar motorizado por cédula
            const motorizado = yield data_1.UserMotorizado.findOne({
                where: {
                    cedula: dto.cedula,
                    estadoCuenta: data_1.EstadoCuentaMotorizado.ACTIVO,
                },
            });
            // Respuesta genérica para no revelar existencia
            if (!motorizado) {
                return {
                    message: "Si el usuario existe, se ha generado el enlace de recuperación.",
                };
            }
            // Generar token con id y resetTokenVersion
            const token = yield config_1.JwtAdapterMotorizado.generateTokenMotorizado({
                id: motorizado.id,
                resetTokenVersion: motorizado.resetTokenVersion,
            }, "5m");
            if (!token)
                throw domain_1.CustomError.internalServer("Error generando token");
            // Construir link para frontend
            const recoveryLink = `${config_1.envs.WEBSERVICE_URL_FRONT}/motorizado/restablecer?token=${token}`;
            yield motorizado.save();
            // Retornar el link para que el frontend lo use y abra WhatsApp con el mensaje
            return {
                message: "Enlace de recuperación generado",
                recoveryLink,
                whatsapp: motorizado.whatsapp,
            };
        });
    }
    // Validar token y cambiar contraseña
    resetPassword(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = yield config_1.JwtAdapterMotorizado.validateTokenMotorizado(dto.token);
            if (!payload || !payload.id || payload.resetTokenVersion === undefined) {
                throw domain_1.CustomError.unAuthorized("Token inválido o expirado");
            }
            const motorizado = yield data_1.UserMotorizado.findOne({
                where: { id: payload.id },
            });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            // Validar versión de token
            if (motorizado.resetTokenVersion !== payload.resetTokenVersion) {
                throw domain_1.CustomError.unAuthorized("Este enlace ya fue usado o es inválido");
            }
            // Actualizar contraseña (hasheada)
            motorizado.password = config_1.encriptAdapter.hash(dto.newPassword);
            // Incrementar versión del token para invalidar el actual
            motorizado.resetTokenVersion += 1;
            yield motorizado.save();
            return { message: "Contraseña actualizada correctamente" };
        });
    }
    // ✅ Ver todos los motorizados
    findAllMotorizados() {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizados = yield data_1.UserMotorizado.find();
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
        });
    }
    // ✅ Ver un motorizado por ID
    findMotorizadoById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
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
        });
    }
    // ✅ Editar motorizado (excepto contraseña)
    updateMotorizado(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            if (data.name)
                motorizado.name = data.name.toLowerCase().trim();
            if (data.surname)
                motorizado.surname = data.surname.toLowerCase().trim();
            if (data.whatsapp)
                motorizado.whatsapp = data.whatsapp.trim();
            if (data.cedula)
                motorizado.cedula = data.cedula.toString();
            // Campos administrativos extra
            if (data.estadoCuenta)
                motorizado.estadoCuenta = data.estadoCuenta;
            if (data.estadoTrabajo)
                motorizado.estadoTrabajo = data.estadoTrabajo;
            // Manejo robusto de quiereTrabajar
            if (data.quiereTrabajar !== undefined) {
                const q = data.quiereTrabajar;
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
            if (motorizado.estadoTrabajo === data_1.EstadoTrabajoMotorizado.DISPONIBLE) {
                motorizado.quiereTrabajar = true;
            }
            // 2. Si NO quiere trabajar, no puede estar DISPONIBLE.
            if (motorizado.quiereTrabajar === false && motorizado.estadoTrabajo === data_1.EstadoTrabajoMotorizado.DISPONIBLE) {
                motorizado.estadoTrabajo = data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
            }
            console.log("Saving Motorizado (Normalized):", {
                estadoTrabajo: motorizado.estadoTrabajo,
                quiereTrabajar: motorizado.quiereTrabajar
            });
            try {
                const actualizado = yield motorizado.save();
                return {
                    id: actualizado.id,
                    name: actualizado.name,
                    surname: actualizado.surname,
                    whatsapp: actualizado.whatsapp,
                    cedula: actualizado.cedula,
                    estadoCuenta: actualizado.estadoCuenta,
                };
            }
            catch (error) {
                if (error.code === "23505") {
                    throw domain_1.CustomError.badRequest(`Ya existe un motorizado con esa cédula o WhatsApp`);
                }
                throw domain_1.CustomError.internalServer("Error al actualizar motorizado");
            }
        });
    }
    // Activar / desactivar
    toggleActivo(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            motorizado.estadoCuenta =
                motorizado.estadoCuenta === data_1.EstadoCuentaMotorizado.ACTIVO
                    ? data_1.EstadoCuentaMotorizado.PENDIENTE
                    : data_1.EstadoCuentaMotorizado.ACTIVO;
            yield motorizado.save();
            return {
                id: motorizado.id,
                estadoCuenta: motorizado.estadoCuenta,
            };
        });
    }
    // Eliminar
    deleteMotorizado(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            motorizado.estadoCuenta = data_1.EstadoCuentaMotorizado.ELIMINADO; // 🔥 CORREGIDO
            yield motorizado.save();
            return { message: "Motorizado eliminado correctamente" };
        });
    }
    // ✅ Cambiar contraseña (desde el panel)
    cambiarPassword(id, nuevaPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            motorizado.password = config_1.encriptAdapter.hash(nuevaPassword);
            yield motorizado.save();
            return { message: "Contraseña actualizada correctamente" };
        });
    }
    // ✅ Historial de transacciones de billetera (Admin)
    getTransactions(motorizadoId_1) {
        return __awaiter(this, arguments, void 0, function* (motorizadoId, page = 1, limit = 20) {
            const skip = (page - 1) * limit;
            const [transactions, total] = yield data_1.TransaccionMotorizado.findAndCount({
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
        });
    }
    // ✅ Ajuste manual de saldo (Admin)
    adjustBalance(motorizadoId, amount, observation, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            if (amount === 0)
                throw domain_1.CustomError.badRequest("El monto no puede ser 0");
            // Calcular nuevo saldo
            const newBalance = Number(motorizado.saldo) + amount;
            // Crear transacción
            const transaction = new data_1.TransaccionMotorizado();
            transaction.motorizado = motorizado;
            transaction.monto = amount; // Puede ser negativo
            transaction.tipo = data_1.TipoTransaccion.AJUSTE;
            transaction.descripcion = `AJUSTE ADMIN: ${observation} (Admin ID: ${adminId})`;
            transaction.saldoAnterior = Number(motorizado.saldo);
            transaction.saldoNuevo = newBalance;
            // Guardar transacción y actualizar motorizado
            yield transaction.save();
            motorizado.saldo = newBalance;
            yield motorizado.save();
            return {
                newBalance: motorizado.saldo,
                transaction,
            };
        });
    }
    // ✅ Estadísticas de billetera
    getWalletStats(motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            // Calcular total ganado (SOLO GANANCIAS)
            const totalIngresos = yield data_1.TransaccionMotorizado.sum("monto", {
                motorizado: { id: motorizadoId },
                tipo: data_1.TipoTransaccion.GANANCIA_ENVIO
            });
            // Calcular total retirado
            const totalEgresos = yield data_1.TransaccionMotorizado.sum("monto", {
                motorizado: { id: motorizadoId },
                tipo: data_1.TipoTransaccion.RETIRO
            });
            // Calcular pedidos entregados
            const deliveredOrders = yield data_1.TransaccionMotorizado.count({
                where: {
                    motorizado: { id: motorizadoId },
                    tipo: data_1.TipoTransaccion.GANANCIA_ENVIO
                }
            });
            // Calcular ganancia mensual
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthlyEarnings = yield data_1.TransaccionMotorizado.createQueryBuilder("t")
                .where("t.motorizadoId = :id", { id: motorizadoId })
                .andWhere("t.tipo = :tipo", { tipo: data_1.TipoTransaccion.GANANCIA_ENVIO })
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
                monthlyEarnings: Number((monthlyEarnings === null || monthlyEarnings === void 0 ? void 0 : monthlyEarnings.total) || 0),
            };
        });
    }
    deleteForce(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOne({ where: { id } });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            // Borrar transacciones
            yield data_1.TransaccionMotorizado.delete({ motorizado: { id } });
            // Borrar pedidos asociados
            yield data_1.Pedido.delete({ motorizado: { id } });
            // Borrar motorizado
            yield data_1.UserMotorizado.delete(id);
            return { message: "Motorizado y todos sus datos eliminados definitivamente" };
        });
    }
    // ✅ Obtener solicitudes de retiro
    getWithdrawals(motorizadoId_1) {
        return __awaiter(this, arguments, void 0, function* (motorizadoId, page = 1, limit = 20, status) {
            const skip = (page - 1) * limit;
            const query = data_1.TransaccionMotorizado.createQueryBuilder("t")
                .where("t.motorizadoId = :id", { id: motorizadoId })
                .andWhere("t.tipo = :tipo", { tipo: data_1.TipoTransaccion.RETIRO })
                .orderBy("t.createdAt", "DESC")
                .skip(skip)
                .take(limit);
            if (status) {
                query.andWhere("t.estado = :status", { status });
            }
            const [withdrawals, total] = yield query.getManyAndCount();
            return {
                withdrawals,
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
            };
        });
    }
    // ✅ Aprobar retiro
    approveWithdrawal(transactionId, adminId, proofUrl, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield data_1.TransaccionMotorizado.findOne({
                where: { id: transactionId },
                relations: ["motorizado"],
            });
            if (!transaction)
                throw domain_1.CustomError.notFound("Transacción no encontrada");
            if (transaction.tipo !== data_1.TipoTransaccion.RETIRO)
                throw domain_1.CustomError.badRequest("No es una solicitud de retiro");
            if (transaction.estado !== data_1.EstadoTransaccion.PENDIENTE)
                throw domain_1.CustomError.badRequest("La solicitud no está pendiente");
            // 1. Descontar saldo AHORA (Flujo corregido: se descuenta al aprobar)
            const motorizado = transaction.motorizado;
            const withdrawalAmount = Math.abs(Number(transaction.monto));
            if (Number(motorizado.saldo) < withdrawalAmount) {
                throw domain_1.CustomError.badRequest(`Saldo insuficiente en billetera del motorizado al momento de aprobar. Saldo: ${motorizado.saldo}, Retiro: ${withdrawalAmount}`);
            }
            motorizado.saldo = Number(motorizado.saldo) - withdrawalAmount;
            yield motorizado.save();
            // 2. Actualizar transacción
            transaction.estado = data_1.EstadoTransaccion.COMPLETADA;
            transaction.descripcion = `${transaction.descripcion || ''} | APROBADO por Admin: ${comment}`;
            transaction.saldoNuevo = motorizado.saldo;
            transaction.detalles = JSON.stringify(Object.assign(Object.assign({}, JSON.parse(transaction.detalles || '{}')), { adminId,
                proofUrl, approvedAt: new Date() }));
            yield transaction.save();
            return { message: "Retiro aprobado y saldo descontado", transaction };
        });
    }
    // ✅ Rechazar retiro (Reembolsar saldo)
    rejectWithdrawal(transactionId, adminId, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield data_1.TransaccionMotorizado.findOne({
                where: { id: transactionId },
                relations: ["motorizado"],
            });
            if (!transaction)
                throw domain_1.CustomError.notFound("Transacción no encontrada");
            if (transaction.tipo !== data_1.TipoTransaccion.RETIRO)
                throw domain_1.CustomError.badRequest("No es una solicitud de retiro");
            if (transaction.estado !== data_1.EstadoTransaccion.PENDIENTE)
                throw domain_1.CustomError.badRequest("La solicitud no está pendiente");
            // 1. NO Reembolsar saldo (porque NO se descontó al solicitar en el nuevo flujo)
            const motorizado = transaction.motorizado;
            // motorizado.saldo = Number(motorizado.saldo) + refundAmount;
            // await motorizado.save();
            // 2. Actualizar transacción
            transaction.estado = data_1.EstadoTransaccion.RECHAZADA;
            transaction.descripcion = `${transaction.descripcion || ''} | RECHAZADO por Admin: ${comment}`;
            transaction.saldoNuevo = motorizado.saldo;
            transaction.detalles = JSON.stringify(Object.assign(Object.assign({}, JSON.parse(transaction.detalles || '{}')), { adminId, rejectedAt: new Date(), refundAmount: 0 }));
            yield transaction.save();
            return { message: "Retiro rechazado", transaction, newBalance: motorizado.saldo };
        });
    }
    // ✅ Obtener estadísticas globales de la wallet de motorizados
    getGlobalWalletStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalGanado = yield data_1.TransaccionMotorizado.sum("monto", { tipo: data_1.TipoTransaccion.GANANCIA_ENVIO });
            const totalPagado = yield data_1.TransaccionMotorizado.sum("monto", { tipo: data_1.TipoTransaccion.RETIRO, estado: data_1.EstadoTransaccion.COMPLETADA }); // Egresos son negativos, sumar valores absolutos si se quiere total
            // Total pendiente (suma de solicitudes PENDIENTES)
            const totalPendiente = yield data_1.TransaccionMotorizado.sum("monto", { tipo: data_1.TipoTransaccion.RETIRO, estado: data_1.EstadoTransaccion.PENDIENTE });
            // Total saldo acumulado en billeteras (suma de saldos de todos los motorizados)
            const { totalSaldo } = yield data_1.UserMotorizado.createQueryBuilder("m")
                .select("SUM(m.saldo)", "totalSaldo")
                .getRawOne();
            // Use query builder for > 0 count if typeorm utilities not imported
            const countSaldoDisponible = yield data_1.UserMotorizado.createQueryBuilder("m")
                .where("m.saldo > 0")
                .getCount();
            const countRetiroPendiente = yield data_1.TransaccionMotorizado.createQueryBuilder("t")
                .where("t.tipo = :tipo", { tipo: data_1.TipoTransaccion.RETIRO })
                .andWhere("t.estado = :estado", { estado: data_1.EstadoTransaccion.PENDIENTE })
                .select("COUNT(DISTINCT t.motorizadoId)", "count")
                .getRawOne();
            return {
                totalGanado: Number(totalGanado || 0),
                totalPagado: Math.abs(Number(totalPagado || 0)),
                totalPendiente: Math.abs(Number(totalPendiente || 0)),
                totalSaldoAcumulado: Number(totalSaldo || 0),
                countSaldoDisponible,
                countRetiroPendiente: Number((countRetiroPendiente === null || countRetiroPendiente === void 0 ? void 0 : countRetiroPendiente.count) || 0)
            };
        });
    }
    // ✅ Obtener TODAS las solicitudes de retiro (Global)
    getAllGlobalWithdrawals(status) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = data_1.TransaccionMotorizado.createQueryBuilder("t")
                .leftJoinAndSelect("t.motorizado", "m")
                .where("t.tipo = :tipo", { tipo: data_1.TipoTransaccion.RETIRO })
                .orderBy("t.createdAt", "DESC");
            if (status) {
                query.andWhere("t.estado = :status", { status });
            }
            const withdrawals = yield query.getMany();
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
        });
    }
}
exports.UserMotorizadoService = UserMotorizadoService;
