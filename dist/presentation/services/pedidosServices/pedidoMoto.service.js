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
exports.PedidoMotoService = void 0;
const data_1 = require("../../../data");
const socket_1 = require("../../../config/socket");
const domain_1 = require("../../../domain");
const typeorm_1 = require("typeorm");
class PedidoMotoService {
    // ============================================================
    // 🧠 HELPERS
    // ============================================================
    static isRondaExpirada(pedido) {
        if (!pedido.fechaInicioRonda)
            return false;
        return (Date.now() - pedido.fechaInicioRonda.getTime() >= this.TIMEOUT_RONDA_MS);
    }
    static limpiarCamposRonda(pedido) {
        pedido.motorizadoEnEvaluacion = null;
        pedido.fechaInicioRonda = null;
    }
    static obtenerPedidoOrFail(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, relations = []) {
            const pedido = yield data_1.Pedido.findOne({ where: { id }, relations });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            return pedido;
        });
    }
    static obtenerMotorizadoOrFail(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const moto = yield data_1.UserMotorizado.findOneBy({ id });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            return moto;
        });
    }
    /**
     * ✅ Elegibilidad profesional (sin ONLINE/OFFLINE):
     * - Cuenta ACTIVA
     * - Trabajo DISPONIBLE
     * - Quiere trabajar = true (switch)
     * - No está castigado (noDisponibleHasta null o ya venció)
     * - FIFO por fechaHoraDisponible ASC
     */
    static obtenerMotorizadosElegibles() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            return data_1.UserMotorizado.createQueryBuilder("m")
                .where("m.estadoCuenta = :estadoCuenta", {
                estadoCuenta: data_1.EstadoCuentaMotorizado.ACTIVO,
            })
                .andWhere("m.estadoTrabajo = :estadoTrabajo", {
                estadoTrabajo: data_1.EstadoTrabajoMotorizado.DISPONIBLE,
            })
                .andWhere("m.quiereTrabajar = :quiereTrabajar", { quiereTrabajar: true })
                .andWhere(new typeorm_1.Brackets((qb) => {
                qb.where("m.noDisponibleHasta IS NULL").orWhere("m.noDisponibleHasta <= :now", { now });
            }))
                .orderBy("m.fechaHoraDisponible", "ASC")
                .getMany();
        });
    }
    /**
     * Ajusta el estado del motorizado cuando queda libre (sin pedido activo),
     * respetando el switch y el castigo persistente.
     */
    static normalizarEstadoLibreMotorizado(moto) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const castigado = moto.noDisponibleHasta &&
                moto.noDisponibleHasta.getTime() > now.getTime();
            if (moto.quiereTrabajar && !castigado) {
                moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.DISPONIBLE;
            }
            else {
                moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
            }
            moto.fechaHoraDisponible = now; // lo manda al final de la cola FIFO
            yield moto.save();
        });
    }
    // ============================================================
    // 🧩 REPARADOR DE PEDIDOS CONGELADOS
    // ============================================================
    static rescatarPedidosCongelados() {
        return __awaiter(this, void 0, void 0, function* () {
            const pedidos = yield data_1.Pedido.find({
                where: {
                    estado: data_1.EstadoPedido.PREPARANDO,
                    motorizadoEnEvaluacion: (0, typeorm_1.IsNull)(),
                    asignacionBloqueada: false,
                },
            });
            for (const pedido of pedidos) {
                if (!pedido.fechaInicioRonda) {
                    pedido.fechaInicioRonda = new Date();
                    pedido.rondaAsignacion = pedido.rondaAsignacion || 1;
                    yield pedido.save();
                }
                yield this.procesarPedido(pedido);
            }
        });
    }
    // ============================================================
    // 🟢 ASIGNACIÓN AUTOMÁTICA (LLAMADO POR EL CRON)
    // ============================================================
    static asignarPedidosAutomaticamente() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.rescatarPedidosCongelados();
            const pedidos = yield data_1.Pedido.find({
                where: { estado: data_1.EstadoPedido.PREPARANDO },
                order: { createdAt: "ASC" },
                relations: ["negocio", "cliente"],
            });
            for (const pedido of pedidos) {
                if (pedido.asignacionBloqueada)
                    continue;
                // Si está en evaluación → revisar expiración
                if (pedido.motorizadoEnEvaluacion) {
                    if (!this.isRondaExpirada(pedido))
                        continue;
                    const continuar = yield this.finalizarRondaTimeout(pedido);
                    if (!continuar)
                        continue;
                }
                yield this.procesarPedido(pedido);
            }
        });
    }
    // ============================================================
    // 🟡 PROCESAR PEDIDO → ASIGNAR A SIGUIENTE MOTORIZADO ELEGIBLE
    // ============================================================
    static procesarPedido(pedido) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (pedido.estado !== data_1.EstadoPedido.PREPARANDO)
                return;
            pedido.asignacionBloqueada = true;
            yield pedido.save();
            try {
                const disponibles = yield this.obtenerMotorizadosElegibles();
                if (!disponibles.length)
                    return;
                const moto = disponibles[0];
                // Marca al motorizado en evaluación (no debe recibir otro pedido)
                moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.EN_EVALUACION;
                yield moto.save();
                // Marca el pedido en evaluación
                pedido.motorizadoEnEvaluacion = moto.id;
                pedido.fechaInicioRonda = new Date();
                pedido.rondaAsignacion = pedido.rondaAsignacion || 1;
                yield pedido.save();
                // Notificación al motorizado
                (0, socket_1.getIO)()
                    .to(moto.id)
                    .emit("pedido_para_ti", {
                    pedidoId: pedido.id,
                    negocioId: ((_a = pedido.negocio) === null || _a === void 0 ? void 0 : _a.id) || null,
                    total: pedido.total,
                    expiresAt: Date.now() + this.TIMEOUT_RONDA_MS,
                });
            }
            finally {
                // Siempre liberar el lock
                pedido.asignacionBloqueada = false;
                yield pedido.save();
            }
        });
    }
    // ============================================================
    // 🔥 TIMEOUT DE RONDA (SIN CASTIGO, PERO MOVER AL FINAL)
    // ============================================================
    static finalizarRondaTimeout(pedido) {
        return __awaiter(this, void 0, void 0, function* () {
            const motoIdPrevio = pedido.motorizadoEnEvaluacion;
            // Si dejó expirar: el motorizado vuelve a "libre" según su intención (switch) y castigo vigente si existiera
            if (motoIdPrevio) {
                const moto = yield data_1.UserMotorizado.findOneBy({ id: motoIdPrevio });
                if (moto &&
                    moto.estadoTrabajo === data_1.EstadoTrabajoMotorizado.EN_EVALUACION) {
                    yield this.normalizarEstadoLibreMotorizado(moto);
                }
            }
            const rondaActual = pedido.rondaAsignacion || 1;
            // Si ya completó todas las rondas → NO ASIGNADO (admin lo asigna manualmente)
            if (rondaActual >= this.MAX_RONDAS) {
                pedido.estado = data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO;
                this.limpiarCamposRonda(pedido);
                yield pedido.save();
                (0, socket_1.getIO)().emit("pedido_actualizado", {
                    pedidoId: pedido.id,
                    estado: pedido.estado,
                });
                return false;
            }
            // Siguiente ronda
            pedido.rondaAsignacion = rondaActual + 1;
            this.limpiarCamposRonda(pedido);
            yield pedido.save();
            return true;
        });
    }
    // ============================================================
    // ❌ RECHAZAR → CASTIGO PERSISTENTE (SIN setTimeout)
    // ============================================================
    static bloquearPrevio(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!id)
                return;
            const moto = yield data_1.UserMotorizado.findOneBy({ id });
            if (!moto)
                return;
            // Castigo persistente:
            // - Lo sacas de la cola (NO_TRABAJANDO)
            // - Le apagas el "quiero trabajar" (para evitar que vuelva solo por switch)
            // - Guardas hasta cuándo dura el castigo
            moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
            moto.quiereTrabajar = false;
            moto.noDisponibleHasta = new Date(Date.now() + this.TIMEOUT_RONDA_MS);
            yield moto.save();
        });
    }
    // ============================================================
    // 🟢 ACEPTAR PEDIDO
    // ============================================================
    static aceptarPedido(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);
            if (pedido.motorizadoEnEvaluacion !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No puedes aceptar este pedido");
            }
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            // (Opcional pero recomendado) Si ya no está en evaluación, algo raro pasó
            if (moto.estadoTrabajo !== data_1.EstadoTrabajoMotorizado.EN_EVALUACION) {
                throw domain_1.CustomError.badRequest("Estado inválido para aceptar");
            }
            pedido.estado = data_1.EstadoPedido.PREPARANDO_ASIGNADO;
            pedido.motorizado = moto;
            this.limpiarCamposRonda(pedido);
            yield pedido.save();
            moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.ENTREGANDO;
            yield moto.save();
            (0, socket_1.getIO)().emit("pedido_actualizado", {
                pedidoId,
                estado: pedido.estado,
                motorizadoId,
            });
            return pedido;
        });
    }
    // ============================================================
    // ❌ RECHAZAR PEDIDO
    // ============================================================
    static rechazarPedido(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId);
            if (pedido.motorizadoEnEvaluacion !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No puedes rechazar este pedido");
            }
            // CASTIGO AQUÍ (persistente)
            yield this.bloquearPrevio(motorizadoId);
            const rondaActual = pedido.rondaAsignacion || 1;
            if (rondaActual >= this.MAX_RONDAS) {
                pedido.estado = data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO;
                this.limpiarCamposRonda(pedido);
                yield pedido.save();
                (0, socket_1.getIO)().emit("pedido_actualizado", {
                    pedidoId: pedido.id,
                    estado: pedido.estado,
                });
                return pedido;
            }
            pedido.rondaAsignacion = rondaActual + 1;
            this.limpiarCamposRonda(pedido);
            yield pedido.save();
            yield this.procesarPedido(pedido);
            return pedido;
        });
    }
    // ============================================================
    // 🚚 MARCAR EN CAMINO
    // ============================================================
    static marcarEnCamino(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No autorizado");
            }
            pedido.estado = data_1.EstadoPedido.EN_CAMINO;
            yield pedido.save();
            (0, socket_1.getIO)().emit("pedido_actualizado", {
                pedidoId,
                estado: pedido.estado,
            });
            return pedido;
        });
    }
    // ============================================================
    // 🏁 ENTREGAR
    // ============================================================
    static entregarPedido(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No autorizado");
            }
            pedido.estado = data_1.EstadoPedido.ENTREGADO;
            yield pedido.save();
            // ===========================
            // 💰 USAR GANANCIA PERSISTIDA (Snapshot en el pedido)
            // ===========================
            const gananciaMoto = Number(pedido.ganancia_motorizado || (pedido.costoEnvio * 0.8).toFixed(2));
            const saldoAnterior = Number(moto.saldo);
            const saldoNuevo = saldoAnterior + gananciaMoto;
            moto.saldo = saldoNuevo;
            const tx = new data_1.TransaccionMotorizado();
            tx.motorizado = moto;
            tx.pedido = pedido;
            tx.tipo = data_1.TipoTransaccion.GANANCIA_ENVIO;
            tx.monto = gananciaMoto;
            tx.descripcion = `Ganancia envío #${pedido.id.slice(0, 8)}`;
            tx.estado = data_1.EstadoTransaccion.COMPLETADA;
            tx.saldoAnterior = saldoAnterior;
            tx.saldoNuevo = saldoNuevo;
            yield tx.save();
            yield moto.save();
            // Al terminar, el estado depende del switch y del castigo persistente
            yield this.normalizarEstadoLibreMotorizado(moto);
            (0, socket_1.getIO)().emit("pedido_actualizado", {
                pedidoId,
                estado: pedido.estado,
            });
            return pedido;
        });
    }
    static cambiarDisponibilidad(motorizadoId, quiereTrabajar) {
        return __awaiter(this, void 0, void 0, function* () {
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            // 🔒 Estados críticos NO se pueden cambiar
            if (moto.estadoTrabajo === data_1.EstadoTrabajoMotorizado.ENTREGANDO ||
                moto.estadoTrabajo === data_1.EstadoTrabajoMotorizado.EN_EVALUACION) {
                throw domain_1.CustomError.badRequest("No puedes cambiar tu disponibilidad mientras tienes un pedido activo");
            }
            moto.quiereTrabajar = quiereTrabajar;
            // 🔁 Ajustar estado operativo
            if (quiereTrabajar) {
                moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.DISPONIBLE;
                moto.fechaHoraDisponible = new Date();
            }
            else {
                moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
            }
            yield moto.save();
            return {
                quiereTrabajar: moto.quiereTrabajar,
                estadoTrabajo: moto.estadoTrabajo,
            };
        });
    }
    // ============================================================
    // 🚫 CANCELAR (MOTORIZADO)
    // ============================================================
    static cancelarPedido(pedidoId, motorizadoId, motivo) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado"]);
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No autorizado");
            }
            if (pedido.estado !== data_1.EstadoPedido.EN_CAMINO) {
                throw domain_1.CustomError.badRequest("Solo puedes cancelar pedidos cuando ya estás en camino.");
            }
            pedido.estado = data_1.EstadoPedido.CANCELADO;
            pedido.motivoCancelacion = motivo;
            yield pedido.save();
            // Liberar motorizado
            yield this.normalizarEstadoLibreMotorizado(moto);
            (0, socket_1.getIO)().emit("pedido_actualizado", {
                pedidoId,
                estado: pedido.estado,
            });
            return pedido;
        });
    }
    static obtenerPedidoActivo(motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            return data_1.Pedido.findOne({
                where: [
                    {
                        motorizado: { id: motorizadoId },
                        estado: data_1.EstadoPedido.PREPARANDO_ASIGNADO,
                    },
                    {
                        motorizado: { id: motorizadoId },
                        estado: data_1.EstadoPedido.EN_CAMINO,
                    },
                ],
                relations: ["negocio", "negocio.usuario", "cliente", "productos", "motorizado"],
            });
        });
    }
    static obtenerEstadoMotorizado(motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            return {
                quiereTrabajar: moto.quiereTrabajar,
                estadoTrabajo: moto.estadoTrabajo,
            };
        });
    }
    // ============================================================
    // 📜 HISTORIAL DE PEDIDOS
    // ============================================================
    static obtenerHistorial(motorizadoId, fechaInicio, fechaFin) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = data_1.Pedido.createQueryBuilder("pedido")
                .leftJoinAndSelect("pedido.negocio", "negocio")
                .leftJoinAndSelect("pedido.cliente", "cliente")
                .leftJoinAndSelect("pedido.productos", "productos") // opcional, si queremos ver productos
                .leftJoinAndSelect("productos.producto", "productoRef")
                .where("pedido.motorizadoId = :motorizadoId", { motorizadoId })
                .andWhere("pedido.estado IN (:...estados)", {
                estados: [data_1.EstadoPedido.ENTREGADO, data_1.EstadoPedido.CANCELADO],
            })
                .orderBy("pedido.createdAt", "DESC");
            if (fechaInicio) {
                query.andWhere("pedido.createdAt >= :fechaInicio", {
                    fechaInicio: new Date(fechaInicio),
                });
            }
            if (fechaFin) {
                // Ajustar fin del día para fechaFin
                const fin = new Date(fechaFin);
                fin.setHours(23, 59, 59, 999);
                query.andWhere("pedido.createdAt <= :fechaFin", { fechaFin: fin });
            }
            const pedidos = yield query.getMany();
            // Enriquecer con cálculo de ganancia visual persistida
            return pedidos.map((p) => (Object.assign(Object.assign({}, p), { gananciaEstimada: Number(p.ganancia_motorizado || (p.costoEnvio * 0.8)).toFixed(2), comisionApp: Number(p.comision_app_domicilio || (p.costoEnvio * 0.2)).toFixed(2) })));
        });
    }
    // ============================================================
    // 💰 BILLETERA
    // ============================================================
    static obtenerBilletera(motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            const transacciones = yield data_1.TransaccionMotorizado.find({
                where: { motorizado: { id: motorizadoId } },
                relations: ["pedido", "pedido.cliente"],
                order: { createdAt: "DESC" },
                take: 50, // Últimas 50
            });
            // Calcular stats
            const totalIngresos = yield data_1.TransaccionMotorizado.sum("monto", {
                motorizado: { id: motorizadoId },
                tipo: data_1.TipoTransaccion.GANANCIA_ENVIO
            });
            const earnings = Number(totalIngresos || 0);
            const deliveredOrders = yield data_1.TransaccionMotorizado.count({
                where: {
                    motorizado: { id: motorizadoId },
                    tipo: data_1.TipoTransaccion.GANANCIA_ENVIO
                }
            });
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthlyEarnings = yield data_1.TransaccionMotorizado.createQueryBuilder("t")
                .where("t.motorizadoId = :id", { id: motorizadoId })
                .andWhere("t.tipo = :tipo", { tipo: data_1.TipoTransaccion.GANANCIA_ENVIO })
                .andWhere("t.createdAt >= :start", { start: startOfMonth })
                .select("SUM(t.monto)", "total")
                .getRawOne();
            return {
                saldo: moto.saldo,
                datosBancarios: {
                    banco: moto.bancoNombre,
                    tipo: moto.bancoTipoCuenta,
                    numero: moto.bancoNumeroCuenta,
                    titular: moto.bancoTitular,
                    identificacion: moto.bancoIdentificacion,
                },
                transacciones,
                stats: {
                    deliveredOrders,
                    averagePerOrder: deliveredOrders > 0 ? (earnings / deliveredOrders).toFixed(2) : 0,
                    monthlyEarnings: Number((monthlyEarnings === null || monthlyEarnings === void 0 ? void 0 : monthlyEarnings.total) || 0),
                    totalIngresos: earnings
                }
            };
        });
    }
    // ============================================================
    // 🏦 DATOS BANCARIOS
    // ============================================================
    static guardarDatosBancarios(motorizadoId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            moto.bancoNombre = data.banco;
            moto.bancoTipoCuenta = data.tipo;
            moto.bancoNumeroCuenta = data.numero;
            moto.bancoTitular = data.titular;
            moto.bancoIdentificacion = data.identificacion;
            yield moto.save();
            return { message: "Datos actualizados" };
        });
    }
    // ============================================================
    // 💸 SOLICITAR RETIRO
    // ============================================================
    static solicitarRetiro(motorizadoId, monto) {
        return __awaiter(this, void 0, void 0, function* () {
            if (monto < 5) {
                throw domain_1.CustomError.badRequest("El monto mínimo de retiro es $5.00");
            }
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            // Validar saldo suficiente (Saldo Actual - Retiros Pendientes)
            const saldoActual = Number(moto.saldo);
            const pendingWithdrawals = yield data_1.TransaccionMotorizado.sum("monto", {
                motorizado: { id: motorizadoId },
                tipo: data_1.TipoTransaccion.RETIRO,
                estado: data_1.EstadoTransaccion.PENDIENTE
            });
            const totalPending = Math.abs(pendingWithdrawals || 0);
            if ((saldoActual - totalPending) < monto) {
                throw domain_1.CustomError.badRequest(`Saldo insuficiente. Tienes $${totalPending.toFixed(2)} en solicitudes pendientes.`);
            }
            if (!moto.bancoNumeroCuenta || !moto.bancoNombre) {
                throw domain_1.CustomError.badRequest("Debes registrar tus datos bancarios antes de retirar");
            }
            // NO Descontar saldo aquí (se descuenta al aprobar)
            // const saldoNuevo = saldoActual - monto;
            // moto.saldo = saldoNuevo;
            const tx = new data_1.TransaccionMotorizado();
            tx.motorizado = moto;
            tx.tipo = data_1.TipoTransaccion.RETIRO;
            tx.monto = -monto;
            tx.descripcion = `Solicitud de Retiro`;
            tx.estado = data_1.EstadoTransaccion.PENDIENTE;
            tx.saldoAnterior = saldoActual;
            tx.saldoNuevo = saldoActual; // Se mantiene igual
            tx.detalles = JSON.stringify({
                banco: moto.bancoNombre,
                cuenta: moto.bancoNumeroCuenta,
                tipo: moto.bancoTipoCuenta,
                titular: moto.bancoTitular,
                ci: moto.bancoIdentificacion,
            });
            yield tx.save();
            // await moto.save(); // No actualizamos saldo
            return tx;
        });
    }
}
exports.PedidoMotoService = PedidoMotoService;
PedidoMotoService.TIMEOUT_RONDA_MS = 60000; // 1 min (castigo SOLO en rechazar)
PedidoMotoService.MAX_RONDAS = 4;
