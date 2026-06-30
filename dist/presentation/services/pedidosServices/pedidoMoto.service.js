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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PedidoMotoService = void 0;
const data_1 = require("../../../data");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const socket_1 = require("../../../config/socket");
const domain_1 = require("../../../domain");
const typeorm_1 = require("typeorm");
const NotificationService_1 = require("../NotificationService");
const notificationService = new NotificationService_1.NotificationService();
class PedidoMotoService {
    static getSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.settings)
                return this.settings;
            let s = yield data_1.GlobalSettings.findOne({ where: {} });
            if (!s) {
                s = new data_1.GlobalSettings();
                yield s.save();
            }
            this.settings = s;
            return s;
        });
    }
    static getPriceSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.priceSettings)
                return this.priceSettings;
            let s = yield data_1.PriceSettings.findOne({ where: {} });
            if (!s) {
                s = new data_1.PriceSettings();
                yield s.save();
            }
            this.priceSettings = s;
            return s;
        });
    }
    static getTimeout() {
        return __awaiter(this, void 0, void 0, function* () {
            const s = yield this.getSettings();
            return s.timeoutRondaMs || 60000;
        });
    }
    static getMaxRondas() {
        return __awaiter(this, void 0, void 0, function* () {
            const s = yield this.getSettings();
            return s.maxRondasAsignacion || 4;
        });
    }
    // ============================================================
    // 🧠 HELPERS
    // ============================================================
    static isRondaExpirada(pedido) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pedido.fechaInicioRonda)
                return false;
            const timeout = yield this.getTimeout();
            return (Date.now() - pedido.fechaInicioRonda.getTime() >= timeout);
        });
    }
    static limpiarCamposRonda(pedido) {
        pedido.motorizadoEnEvaluacion = null;
        pedido.fechaInicioRonda = null;
        pedido.asignacionBloqueada = false;
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
            const moto = yield data_1.UserMotorizado.findOne({
                where: { id },
                relations: ["currentTier"]
            });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            return moto;
        });
    }
    /**
     * ✅ Elegibilidad profesional:
     * - FIFO por fechaHoraDisponible ASC
     */
    static obtenerMotorizadosElegibles() {
        return __awaiter(this, arguments, void 0, function* (excluidos = []) {
            const now = new Date();
            const query = data_1.UserMotorizado.createQueryBuilder("m")
                .where("m.estadoCuenta = :estadoCuenta", {
                estadoCuenta: data_1.EstadoCuentaMotorizado.ACTIVO,
            })
                .andWhere("m.estadoTrabajo = :estadoTrabajo", {
                estadoTrabajo: data_1.EstadoTrabajoMotorizado.DISPONIBLE,
            })
                .andWhere("m.quiereTrabajar = :quiereTrabajar", { quiereTrabajar: true })
                .andWhere(new typeorm_1.Brackets((qb) => {
                qb.where("m.noDisponibleHasta IS NULL").orWhere("m.noDisponibleHasta <= :now", { now });
            }));
            // Filtrar excluidos si existen
            if (excluidos && excluidos.length > 0 && (excluidos.length > 1 || (excluidos[0] !== "" && excluidos[0] !== null))) {
                query.andWhere("m.id NOT IN (:...excluidos)", { excluidos });
            }
            return query.orderBy("m.fechaHoraDisponible", "ASC").getMany();
        });
    }
    /**
     * Ajusta el estado del motorizado cuando queda libre (sin pedido activo),
     * mandándolo al final de la cola FIFO.
     */
    static normalizarEstadoLibreMotorizado(moto) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            // Forzamos la intención de trabajar si el sistema lo está liberando por mantenimiento
            // o si el motorizado simplemente terminó un pedido.
            moto.quiereTrabajar = true;
            moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.DISPONIBLE;
            moto.fechaHoraDisponible = now;
            moto.noDisponibleHasta = null; // Limpiar castigos si existen al liberar manualmente/por sistema
            yield moto.save();
            // 📢 Notificar en tiempo real al dashboard administrativo
            (0, socket_1.getIO)().emit("admin_live_update", {
                type: 'MOTORIZADO_UPDATED',
                motorizadoId: moto.id,
                estado: moto.estadoTrabajo,
                quiereTrabajar: moto.quiereTrabajar
            });
        });
    }
    /**
     * 🛡️ Mantenimiento Operativo:
     * - Libera pedidos bloqueados por errores de sistema.
     * - Libera motorizados que quedaron en EN_EVALUACION sin pedido real.
     * - Resuelve pedidos con motorizadoEnEvaluacion que expiraron (Fail-safe del CRON).
     */
    static mantenimientoOperativo() {
        return __awaiter(this, void 0, void 0, function* () {
            const timeout = yield this.getTimeout();
            const cutoff = new Date(Date.now() - timeout);
            const extremeCutoff = new Date(Date.now() - timeout * 3);
            // 1. Rescatar pedidos bloqueados por flags de asignación (Deadlocks lógicos)
            const pedidosBloqueados = yield data_1.Pedido.find({
                where: { asignacionBloqueada: true, updatedAt: (0, typeorm_1.LessThan)(cutoff) }
            });
            for (const p of pedidosBloqueados) {
                console.log(`[RESCATE] Desbloqueando asignación de pedido ${p.id}`);
                p.asignacionBloqueada = false;
                yield p.save();
            }
            // 2. Rescatar motorizados en "evaluación" fantasma
            const motosStuck = yield data_1.UserMotorizado.find({
                where: { estadoTrabajo: data_1.EstadoTrabajoMotorizado.EN_EVALUACION }
            });
            for (const moto of motosStuck) {
                // Buscamos si existe ALGÚN pedido que lo tenga como evaluador actual
                const pedidoActivoEvaluando = yield data_1.Pedido.findOne({
                    where: { motorizadoEnEvaluacion: moto.id, estado: data_1.EstadoPedido.PREPARANDO }
                });
                if (!pedidoActivoEvaluando) {
                    // Doble check: ¿Lleva más de 3 segundos en este estado? (Para evitar colisiones con transacciones en curso)
                    const diffMs = Date.now() - new Date(moto.updatedAt).getTime();
                    if (diffMs > 3000) {
                        console.log(`[RESCATE] Liberando motorizado ${moto.name} (${moto.id}) - No tiene pedido en evaluación.`);
                        // Usamos el método normalizado que garantiza quiereTrabajar = true y DISPONIBLE
                        yield this.normalizarEstadoLibreMotorizado(moto);
                        (0, socket_1.getIO)().to(moto.id).emit("evaluacion_terminada", {
                            mensaje: "Se ha restaurado tu disponibilidad automáticamente.",
                            code: 'AUTO_RELEASE'
                        });
                        // Notificar al dashboard admin
                        (0, socket_1.getIO)().emit("admin_live_update", { type: 'MOTORIZADO_UPDATED', motorizadoId: moto.id });
                    }
                }
            }
            // 3. Rescatar pedidos con motorizado asignado pero sin actividad (Timeouts no procesados)
            const pedidosStuck = yield data_1.Pedido.find({
                where: {
                    estado: data_1.EstadoPedido.PREPARANDO,
                    motorizadoEnEvaluacion: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
                    fechaInicioRonda: (0, typeorm_1.LessThan)(cutoff)
                }
            });
            for (const p of pedidosStuck) {
                console.log(`[RESCATE] Forzando timeout de pedido ${p.id} (Ronda: ${p.rondaAsignacion})`);
                yield this.finalizarRondaTimeout(p);
            }
        });
    }
    // ============================================================
    // 🟢 ASIGNACIÓN AUTOMÁTICA (LLAMADO POR EL CRON)
    // ============================================================
    static asignarPedidosAutomaticamente() {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Ejecutar autolimpieza
            try {
                yield this.mantenimientoOperativo();
            }
            catch (error) {
                console.error("Error en mantenimiento operativo:", error);
            }
            // 2. Obtener pedidos prioritarios
            const pedidos = yield data_1.Pedido.find({
                where: { estado: data_1.EstadoPedido.PREPARANDO },
                order: {
                    rondaAsignacion: "DESC", // Prioridad a los que llevan más rondas (o al revés según política)
                    createdAt: "ASC"
                },
                relations: ["negocio", "cliente"],
                take: 30
            });
            for (const pedido of pedidos) {
                // Si ya tiene un motorizado evaluando, saltar (ya lo manejó el mantenimiento o está en tiempo)
                if (pedido.motorizadoEnEvaluacion || pedido.asignacionBloqueada)
                    continue;
                // Intentar procesar asignación
                yield this.procesarPedido(pedido.id);
            }
        });
    }
    // ============================================================
    // 🟡 PROCESAR PEDIDO → ASIGNAR A SIGUIENTE MOTORIZADO ELEGIBLE
    // ============================================================
    static procesarPedido(pedidoId) {
        return __awaiter(this, void 0, void 0, function* () {
            let notifyData = null;
            yield data_1.Pedido.getRepository().manager.transaction((manager) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                // 1. Bloqueamos la fila del pedido de forma limpia (sin relaciones para evitar error de Postgres con LEFT JOIN)
                const pedido = yield manager.findOne(data_1.Pedido, {
                    where: { id: pedidoId, estado: data_1.EstadoPedido.PREPARANDO },
                    lock: { mode: "pessimistic_write" },
                });
                // Validaciones post-lock
                if (!pedido || pedido.motorizadoEnEvaluacion || pedido.asignacionBloqueada)
                    return;
                // Cargamos relaciones después del bloqueo si las necesitamos para las notificaciones
                const pedidoRelaciones = yield manager.findOne(data_1.Pedido, {
                    where: { id: pedidoId },
                    relations: ["negocio", "cliente"]
                });
                const disponibles = yield this.obtenerMotorizadosElegibles(pedido.motorizadosExcluidos);
                if (!disponibles.length)
                    return;
                const moto = disponibles[0];
                // Bloquear asignación
                pedido.asignacionBloqueada = true;
                pedido.motorizadoEnEvaluacion = moto.id;
                pedido.fechaInicioRonda = new Date();
                pedido.rondaAsignacion = pedido.rondaAsignacion || 1;
                yield manager.save(pedido);
                // Bloquear motorizado
                moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.EN_EVALUACION;
                yield manager.save(moto);
                pedido.asignacionBloqueada = false;
                yield manager.save(pedido);
                // Preparar datos para notificar fuera de la transacción
                const timeout = yield this.getTimeout();
                notifyData = {
                    motoId: moto.id,
                    pedidoParaTi: {
                        pedidoId: pedido.id,
                        negocioId: ((_a = pedidoRelaciones === null || pedidoRelaciones === void 0 ? void 0 : pedidoRelaciones.negocio) === null || _a === void 0 ? void 0 : _a.id) || null,
                        total: pedido.total,
                        expiresAt: Date.now() + timeout,
                        duration: timeout,
                        rondaAsignacion: pedido.rondaAsignacion || 1,
                    },
                    updateData: {
                        pedidoId: pedido.id,
                        estado: pedido.estado,
                        motorizadoEnEvaluacion: pedido.motorizadoEnEvaluacion,
                    },
                    clienteId: pedidoRelaciones === null || pedidoRelaciones === void 0 ? void 0 : pedidoRelaciones.cliente.id,
                    negocioId: pedidoRelaciones === null || pedidoRelaciones === void 0 ? void 0 : pedidoRelaciones.negocio.id
                };
            }));
            // 🚀 NOTIFICAR FUERA DE LA TRANSACCIÓN
            if (notifyData) {
                const io = (0, socket_1.getIO)();
                // Notificar al motorizado
                io.to(notifyData.motoId).emit("pedido_para_ti", notifyData.pedidoParaTi);
                // 🔔 Notificación Push al Motorizado
                yield notificationService.sendPushNotification(notifyData.motoId, "¡Nuevo Pedido Disponible!", `Tienes un nuevo pedido por $${notifyData.pedidoParaTi.total}. Tienes ${Math.round(notifyData.pedidoParaTi.duration / 1000)}s para aceptar.`, { url: '/motorizado' });
                // Notificar actualizaciones
                if (notifyData.clienteId)
                    io.to(notifyData.clienteId).emit("pedido_actualizado", notifyData.updateData);
                if (notifyData.negocioId)
                    io.to(notifyData.negocioId).emit("pedido_actualizado", notifyData.updateData);
                io.emit("pedido_actualizado", notifyData.updateData);
            }
        });
    }
    // ============================================================
    // 🔥 TIMEOUT DE RONDA (MOVER AL FINAL DE LA COLA)
    // ============================================================
    static finalizarRondaTimeout(pedido) {
        return __awaiter(this, void 0, void 0, function* () {
            const motoIdPrevio = pedido.motorizadoEnEvaluacion;
            if (motoIdPrevio) {
                const moto = yield data_1.UserMotorizado.findOneBy({ id: motoIdPrevio });
                if (moto && moto.estadoTrabajo === data_1.EstadoTrabajoMotorizado.EN_EVALUACION) {
                    yield this.normalizarEstadoLibreMotorizado(moto);
                }
            }
            const rondaActual = pedido.rondaAsignacion || 1;
            const maxRondas = yield this.getMaxRondas();
            if (rondaActual >= maxRondas) {
                pedido.estado = data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO;
                this.limpiarCamposRonda(pedido);
                pedido.noAssignedSince = new Date(); // Marca de tiempo para el tablero del admin
                yield pedido.save();
                (0, socket_1.getIO)().emit("pedido_actualizado", {
                    pedidoId: pedido.id,
                    estado: pedido.estado,
                });
                // 📢 Notificar a todos los motorizados que hay un pedido en espera manual
                (0, socket_1.getIO)().emit("tablero_operativo_update", {
                    type: 'PEDIDO_DISPONIBLE_MANUAL',
                    pedidoId: pedido.id
                });
                return false;
            }
            pedido.rondaAsignacion = rondaActual + 1;
            this.limpiarCamposRonda(pedido);
            yield pedido.save();
            const pRel = yield data_1.Pedido.findOne({ where: { id: pedido.id }, relations: ["cliente", "negocio"] });
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId: pedido.id,
                estado: pedido.estado,
            };
            if (pRel) {
                io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
                io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
            }
            io.emit("pedido_actualizado", updateData);
            return true;
        });
    }
    // ============================================================
    // 🟢 ACEPTAR PEDIDO
    // ============================================================
    static aceptarPedido(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado", "cliente", "negocio"]);
            if (pedido.motorizadoEnEvaluacion !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No puedes aceptar este pedido");
            }
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (moto.estadoTrabajo !== data_1.EstadoTrabajoMotorizado.EN_EVALUACION) {
                throw domain_1.CustomError.badRequest("Estado inválido para aceptar");
            }
            pedido.estado = data_1.EstadoPedido.PREPARANDO_ASIGNADO;
            pedido.motorizado = moto;
            // --- DINAMISMO POR MÉRITO O COMISIÓN MANUAL ---
            let porcentajeMoto = 80; // Default fallback
            if (moto.isManualCommission && moto.manualCommissionPercentage !== null) {
                porcentajeMoto = Number(moto.manualCommissionPercentage);
            }
            else if (moto.currentTier) {
                porcentajeMoto = Number(moto.currentTier.commissionPercentage);
            }
            else {
                const ps = yield this.getPriceSettings();
                porcentajeMoto = Number(ps.motorizadoPercentage || 80);
            }
            const costoEnvio = Number(pedido.costoEnvio);
            pedido.porcentaje_motorizado_aplicado = porcentajeMoto;
            pedido.porcentaje_app_aplicado = 100 - porcentajeMoto;
            pedido.ganancia_motorizado = Number((costoEnvio * (porcentajeMoto / 100)).toFixed(2));
            pedido.comision_app_domicilio = Number((costoEnvio - pedido.ganancia_motorizado).toFixed(2));
            pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
            pedido.pickup_verified = false;
            this.limpiarCamposRonda(pedido);
            yield pedido.save();
            moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.ENTREGANDO;
            yield moto.save();
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId,
                estado: pedido.estado,
                motorizado: {
                    id: moto.id,
                    name: moto.name,
                    surname: moto.surname,
                    whatsapp: moto.whatsapp
                },
                pickup_code: pedido.pickup_code,
            };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.emit("pedido_actualizado", updateData); // BROADCAST for counts
            // 🔔 Notificación Push al Cliente
            yield notificationService.sendPushNotification(pedido.cliente.id, "¡Pedido Aceptado!", `Tu pedido #${pedido.id.split('-')[0]} ha sido aceptado por el repartidor.`, { url: '/mis-pedidos' });
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
            // Castigo: Solo mandarlo al final de la cola
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (moto) {
                yield this.normalizarEstadoLibreMotorizado(moto);
            }
            const rondaActual = pedido.rondaAsignacion || 1;
            const maxRondas = yield this.getMaxRondas();
            if (rondaActual >= maxRondas) {
                pedido.estado = data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO;
                this.limpiarCamposRonda(pedido);
                pedido.noAssignedSince = new Date();
                yield pedido.save();
                (0, socket_1.getIO)().emit("pedido_actualizado", {
                    pedidoId: pedido.id,
                    estado: pedido.estado,
                });
                return pedido;
            }
            // Excluir a este motorizado de este pedido específico
            if (!pedido.motorizadosExcluidos) {
                pedido.motorizadosExcluidos = [];
            }
            if (!pedido.motorizadosExcluidos.includes(motorizadoId)) {
                pedido.motorizadosExcluidos.push(motorizadoId);
            }
            pedido.rondaAsignacion = rondaActual + 1;
            this.limpiarCamposRonda(pedido);
            yield pedido.save();
            // Reintentar asignación inmediatamente con otro motorizado
            setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.procesarPedido(pedido.id);
                }
                catch (e) { }
            }));
            return pedido;
        });
    }
    static marcarEnCamino(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado", "cliente", "negocio"]);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No autorizado");
            }
            if (!pedido.pickup_verified) {
                throw domain_1.CustomError.badRequest("No puedes marcar en camino sin antes validar el código con el restaurante");
            }
            pedido.estado = data_1.EstadoPedido.EN_CAMINO;
            pedido.delivery_code = Math.floor(1000 + Math.random() * 9000).toString();
            pedido.delivery_verified = false;
            yield pedido.save();
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId,
                estado: pedido.estado,
                delivery_code: pedido.delivery_code,
            };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            // 🔔 Notificación Push al Cliente
            yield notificationService.sendPushNotification(pedido.cliente.id, "¡Pedido en Camino!", `Tu pedido #${pedido.id.split('-')[0]} ya va en camino a tu ubicación.`, { url: '/mis-pedidos' });
            return pedido;
        });
    }
    static entregarPedido(pedidoId, motorizadoId, code, ageVerification) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado", "cliente", "negocio"]);
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No autorizado");
            }
            if (pedido.delivery_code !== code) {
                throw domain_1.CustomError.badRequest("El código de entrega es incorrecto");
            }
            // 🔞 VERIFICACIÓN DE EDAD PARA MOTORIZADO
            if (pedido.requiresAgeVerification) {
                if (!ageVerification || !ageVerification.preguntasAceptadas || !ageVerification.cedula) {
                    throw domain_1.CustomError.badRequest("Este pedido requiere verificación de edad obligatoria. Debes ingresar la cédula del receptor y aceptar las condiciones.");
                }
                const { EncryptionService } = require("../../../config/encryption");
                const encryptedCedula = EncryptionService.encrypt(ageVerification.cedula);
                pedido.ageVerificationLog = {
                    cedula_encriptada: encryptedCedula,
                    preguntas_aceptadas: true,
                    verificadoPorMotorizadoId: motorizadoId,
                    timestamp: new Date().toISOString()
                };
            }
            pedido.estado = data_1.EstadoPedido.ENTREGADO;
            pedido.delivery_verified = true;
            yield pedido.save();
            const ps = yield this.getPriceSettings();
            const porcentaje = Number(ps.motorizadoPercentage || 80);
            const gananciaMoto = Number(pedido.ganancia_motorizado || (pedido.costoEnvio * (porcentaje / 100)).toFixed(2));
            const saldoAnterior = Number(moto.saldo);
            const saldoNuevo = saldoAnterior + gananciaMoto;
            moto.saldo = saldoNuevo;
            const movement = new data_1.WalletMovement();
            movement.motorizado = moto;
            movement.pedido = pedido;
            movement.type = data_1.WalletMovementType.GANANCIA_ENVIO;
            movement.amount = gananciaMoto;
            movement.balanceAfter = saldoNuevo;
            movement.description = `Ganancia envío #${pedido.id.slice(-6).toUpperCase()}`;
            movement.status = data_1.WalletMovementStatus.COMPLETADO;
            yield movement.save();
            // Mantener TransaccionMotorizado por compatibilidad con panel admin actual si es necesario
            const tx = new data_1.TransaccionMotorizado();
            tx.motorizado = moto;
            tx.pedido = pedido;
            tx.tipo = data_1.TipoTransaccion.GANANCIA_ENVIO;
            tx.monto = gananciaMoto;
            tx.descripcion = `Ganancia envío #${pedido.id.slice(-6).toUpperCase()}`;
            tx.estado = data_1.EstadoTransaccion.COMPLETADA;
            tx.saldoAnterior = saldoAnterior;
            tx.saldoNuevo = saldoNuevo;
            yield tx.save();
            yield moto.save();
            yield this.normalizarEstadoLibreMotorizado(moto);
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId,
                estado: pedido.estado,
            };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            // 🔔 Notificación Push al Cliente
            yield notificationService.sendPushNotification(pedido.cliente.id, "¡Pedido Entregado!", `¡Buen provecho! Tu pedido #${pedido.id.split('-')[0]} ha sido entregado.`, { url: '/mis-pedidos' });
            return pedido;
        });
    }
    static cambiarDisponibilidad(motorizadoId, quiereTrabajar) {
        return __awaiter(this, void 0, void 0, function* () {
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            if (moto.estadoTrabajo === data_1.EstadoTrabajoMotorizado.ENTREGANDO ||
                moto.estadoTrabajo === data_1.EstadoTrabajoMotorizado.EN_EVALUACION) {
                throw domain_1.CustomError.badRequest("No puedes cambiar tu disponibilidad mientras tienes un pedido activo");
            }
            moto.quiereTrabajar = quiereTrabajar;
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
    static marcarLlegada(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado", "cliente"]);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No autorizado");
            }
            if (pedido.estado !== data_1.EstadoPedido.EN_CAMINO) {
                throw domain_1.CustomError.badRequest("Solo puedes marcar llegada cuando estás en camino");
            }
            // Solo establecer la fecha de llegada la primera vez para no reiniciar el cronómetro de espera
            if (!pedido.arrival_time) {
                pedido.arrival_time = new Date();
            }
            yield pedido.save();
            // Notificar al cliente (PWA)
            (0, socket_1.getIO)().to(pedido.cliente.id).emit("tu_pedido_llego", {
                pedidoId: pedido.id,
                mensaje: "El motorizado está afuera",
            });
            // 🔔 Notificación Push al Cliente
            yield notificationService.sendPushNotification(pedido.cliente.id, "¡El repartidor ha llegado!", `Tu repartidor está afuera con tu pedido #${pedido.id.split('-')[0]}.`, { url: '/mis-pedidos' });
            return { arrival_time: pedido.arrival_time };
        });
    }
    static cancelarPedido(pedidoId, motorizadoId, motivo) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado", "cliente", "negocio"]);
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.badRequest("No autorizado");
            }
            if (pedido.estado !== data_1.EstadoPedido.EN_CAMINO) {
                throw domain_1.CustomError.badRequest("Solo puedes cancelar pedidos cuando ya estás en camino.");
            }
            // Bloqueo del botón cancelar si ya marcó llegada
            if (pedido.arrival_time) {
                const settings = yield this.getSettings();
                const waitTimeMinutes = settings.driver_cancel_wait_time || 10;
                const now = new Date();
                const diffMinutes = (now.getTime() - pedido.arrival_time.getTime()) / (1000 * 60);
                if (diffMinutes < waitTimeMinutes) {
                    throw domain_1.CustomError.badRequest(`Debes esperar el tiempo mínimo (${waitTimeMinutes} min) antes de cancelar`);
                }
            }
            pedido.estado = data_1.EstadoPedido.CANCELADO;
            pedido.motivoCancelacion = motivo;
            pedido.ganancia_motorizado = 0;
            pedido.comision_app_domicilio = 0;
            pedido.costoEnvio = 0;
            yield pedido.save();
            yield this.normalizarEstadoLibreMotorizado(moto);
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId,
                estado: pedido.estado,
            };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.emit("pedido_actualizado", updateData); // Sync for dashboard counts
            return pedido;
        });
    }
    static obtenerPedidoActivo(motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
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
            // Autogenerar código si falta (Self-healing)
            if (pedido) {
                if (pedido.estado === data_1.EstadoPedido.PREPARANDO_ASIGNADO && !pedido.pickup_code) {
                    pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
                    pedido.pickup_verified = false;
                    yield pedido.save();
                }
                else if (pedido.estado === data_1.EstadoPedido.EN_CAMINO && !pedido.delivery_code) {
                    pedido.delivery_code = Math.floor(1000 + Math.random() * 9000).toString();
                    pedido.delivery_verified = false;
                    yield pedido.save();
                }
            }
            return pedido;
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
                ratingPromedio: Number(moto.ratingPromedio) || 0,
                totalResenas: Number(moto.totalResenas) || 0,
            };
        });
    }
    obtenerHistorial(motorizadoId_1, fecha_1) {
        return __awaiter(this, arguments, void 0, function* (motorizadoId, fecha, page = 1, limit = 10) {
            // 1. Buscamos qué pedidos tuvieron movimiento de billetera hoy para este motorizado
            const movementQuery = data_1.WalletMovement.createQueryBuilder("m")
                .select("m.orderId", "orderId")
                .where("m.motorizedId = :motorizadoId", { motorizadoId })
                .andWhere("m.type = :type", { type: data_1.WalletMovementType.GANANCIA_ENVIO });
            if (fecha) {
                const start = moment_timezone_1.default.tz(fecha, 'America/Guayaquil').startOf('day').toDate();
                const end = moment_timezone_1.default.tz(fecha, 'America/Guayaquil').endOf('day').toDate();
                movementQuery.andWhere("m.createdAt BETWEEN :start AND :end", { start, end });
            }
            const movementsToday = yield movementQuery.getRawMany();
            const orderIds = movementsToday.map(m => m.orderId).filter(id => !!id);
            // 2. Si no hay movimientos, no hay nada que mostrar en el historial de hoy
            if (orderIds.length === 0) {
                return {
                    pedidos: [],
                    totalPages: 0,
                    totalItems: 0,
                    gananciaDelDia: "0.00",
                };
            }
            // 3. Traemos solo los pedidos que coinciden con esos movimientos
            const query = data_1.Pedido.createQueryBuilder("pedido")
                .leftJoinAndSelect("pedido.negocio", "negocio")
                .leftJoinAndSelect("pedido.cliente", "cliente")
                .where("pedido.id IN (:...orderIds)", { orderIds })
                .orderBy("pedido.updatedAt", "DESC");
            const [pedidos, totalItems] = yield query
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount();
            const dailyEarningsQuery = data_1.WalletMovement.createQueryBuilder("movement")
                .where("movement.motorizedId = :motorizadoId", { motorizadoId })
                .andWhere("movement.type = :type", { type: data_1.WalletMovementType.GANANCIA_ENVIO })
                .andWhere("movement.status = :status", { status: data_1.WalletMovementStatus.COMPLETADO });
            if (fecha) {
                const start = moment_timezone_1.default.tz(fecha, 'America/Guayaquil').startOf('day').toDate();
                const end = moment_timezone_1.default.tz(fecha, 'America/Guayaquil').endOf('day').toDate();
                dailyEarningsQuery.andWhere("movement.createdAt BETWEEN :start AND :end", { start, end });
            }
            const dailyEarningsResult = yield dailyEarningsQuery
                .select("SUM(movement.amount)", "total")
                .getRawOne();
            const gananciaDelDia = Number((dailyEarningsResult === null || dailyEarningsResult === void 0 ? void 0 : dailyEarningsResult.total) || 0).toFixed(2);
            const pedidosMapped = pedidos.map((p) => {
                const isCancelled = p.estado === data_1.EstadoPedido.CANCELADO;
                return Object.assign(Object.assign({}, p), { gananciaEstimada: isCancelled ? "0.00" : Number(p.ganancia_motorizado || (p.costoEnvio * 0.8)).toFixed(2), comisionApp: isCancelled ? "0.00" : Number(p.comision_app_domicilio || (p.costoEnvio * 0.2)).toFixed(2), costoEnvio: isCancelled ? "0.00" : Number(p.costoEnvio).toFixed(2) });
            });
            return {
                pedidos: pedidosMapped,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                gananciaDelDia,
            };
        });
    }
    obtenerBilletera(motorizadoId_1, fecha_1) {
        return __awaiter(this, arguments, void 0, function* (motorizadoId, fecha, page = 1, limit = 10) {
            var _a, _b;
            const moto = yield data_1.UserMotorizado.findOne({
                where: { id: motorizadoId },
                relations: ['currentTier'],
            });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            // 1. FILTRO DE MOVIMIENTOS POR FECHA (Paginado)
            // Usamos el día especificado o hoy por defecto
            let queryDate;
            if (fecha) {
                // Formato esperado: YYYY-MM-DD
                const [year, month, day] = fecha.split('-').map(Number);
                queryDate = new Date(year, month - 1, day);
            }
            else {
                queryDate = new Date();
            }
            const startOfDay = moment_timezone_1.default.tz(fecha, 'America/Guayaquil').startOf('day').toDate();
            const endOfDay = moment_timezone_1.default.tz(fecha, 'America/Guayaquil').endOf('day').toDate();
            const skip = (page - 1) * limit;
            const [movements, totalMovements] = yield data_1.WalletMovement.findAndCount({
                where: {
                    motorizado: { id: motorizadoId },
                    createdAt: (0, typeorm_1.Between)(startOfDay, endOfDay)
                },
                relations: ["pedido", "admin"],
                order: { createdAt: "DESC" },
                skip,
                take: limit,
            });
            // 2. ENTREGAS TOTALES (HISTÓRICO)
            const totalEntregas = yield data_1.Pedido.count({
                where: {
                    motorizado: { id: motorizadoId },
                    estado: data_1.EstadoPedido.ENTREGADO
                }
            });
            // 3 & 4. PEDIDOS HOY E INGRESOS HOY
            const startOfToday = moment_timezone_1.default.tz('America/Guayaquil').startOf('day').toDate();
            const statsHoy = yield data_1.WalletMovement.createQueryBuilder("m")
                .where("m.motorizedId = :id", { id: motorizadoId })
                .andWhere("m.type = :type", { type: data_1.WalletMovementType.GANANCIA_ENVIO })
                .andWhere("m.status = :status", { status: data_1.WalletMovementStatus.COMPLETADO })
                .andWhere("m.createdAt >= :today", { today: startOfToday })
                .select("COUNT(m.id)", "count")
                .addSelect("SUM(m.amount)", "total")
                .getRawOne();
            const ps = yield PedidoMotoService.getPriceSettings();
            // Forzamos la interpretación como UTC puro para evitar que Node lo confunda con hora local
            const movementsMapped = movements.map(m => (Object.assign(Object.assign({}, m), { createdAt: moment_timezone_1.default.utc((0, moment_timezone_1.default)(m.createdAt).format('YYYY-MM-DD HH:mm:ss')).toDate() })));
            return {
                saldo: moto.saldo,
                // Comisión personal del motorizado según su liga actual o comisión manual
                porcentajeMotorizado: moto.isManualCommission && moto.manualCommissionPercentage !== null ? Number(moto.manualCommissionPercentage) : ((_b = (_a = moto.currentTier) === null || _a === void 0 ? void 0 : _a.commissionPercentage) !== null && _b !== void 0 ? _b : 80),
                datosBancarios: {
                    banco: moto.bancoNombre,
                    tipo: moto.bancoTipoCuenta,
                    numero: moto.bancoNumeroCuenta,
                    titular: moto.bancoTitular,
                    identificacion: moto.bancoIdentificacion,
                },
                movements: movementsMapped,
                totalMovements,
                currentPage: page,
                totalPages: Math.ceil(totalMovements / limit),
                stats: {
                    totalEntregas: Number(totalEntregas || 0),
                    todayOrders: Number((statsHoy === null || statsHoy === void 0 ? void 0 : statsHoy.count) || 0),
                    todayEarnings: Number((statsHoy === null || statsHoy === void 0 ? void 0 : statsHoy.total) || 0).toFixed(2),
                }
            };
        });
    }
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
    static solicitarRetiro(motorizadoId, monto) {
        return __awaiter(this, void 0, void 0, function* () {
            if (monto < 5) {
                throw domain_1.CustomError.badRequest("El monto mínimo de retiro es $5.00");
            }
            const moto = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
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
            // Deducir saldo inmediatamente
            const saldoNuevo = saldoActual - monto;
            moto.saldo = saldoNuevo;
            yield moto.save();
            const tx = new data_1.TransaccionMotorizado();
            tx.motorizado = moto;
            tx.tipo = data_1.TipoTransaccion.RETIRO;
            tx.monto = -monto;
            tx.descripcion = `Solicitud de Retiro`;
            tx.estado = data_1.EstadoTransaccion.PENDIENTE;
            tx.saldoAnterior = saldoActual;
            tx.saldoNuevo = saldoNuevo;
            tx.detalles = JSON.stringify({
                banco: moto.bancoNombre,
                cuenta: moto.bancoNumeroCuenta,
                tipo: moto.bancoTipoCuenta,
                titular: moto.bancoTitular,
                ci: moto.bancoIdentificacion,
            });
            yield tx.save();
            const movement = new data_1.WalletMovement();
            movement.motorizado = moto;
            movement.type = data_1.WalletMovementType.RETIRO_SOLICITADO;
            movement.amount = -monto;
            movement.balanceAfter = saldoNuevo;
            movement.description = `Solicitud de Retiro`;
            movement.referenceId = tx.id; // ID DE REFERENCIA PARA LA UI
            movement.status = data_1.WalletMovementStatus.PENDIENTE;
            yield movement.save();
            // Vincular movementId en la transaccion para reversiones futuras
            const detalles = JSON.parse(tx.detalles || '{}');
            detalles.movementId = movement.id;
            tx.detalles = JSON.stringify(detalles);
            yield tx.save();
            return tx;
            return tx;
        });
    }
    static obtenerTableroOperativo() {
        return __awaiter(this, void 0, void 0, function* () {
            const proximosASalirCount = yield data_1.Pedido.count({
                where: { estado: data_1.EstadoPedido.ACEPTADO }
            });
            const asignandoseCount = yield data_1.Pedido.createQueryBuilder("p")
                .where("p.estado = :estado", { estado: data_1.EstadoPedido.PREPARANDO })
                .andWhere("p.motorizadoEnEvaluacion IS NULL")
                .getCount();
            const startOfToday = moment_timezone_1.default.tz('America/Guayaquil').startOf('day').toDate();
            const endOfToday = moment_timezone_1.default.tz('America/Guayaquil').endOf('day').toDate();
            const pedidosEsperando = yield data_1.Pedido.find({
                where: {
                    estado: data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO,
                    createdAt: (0, typeorm_1.Between)(startOfToday, endOfToday)
                },
                order: { noAssignedSince: "ASC" },
                relations: ["negocio"]
            });
            return {
                conteos: {
                    proximosASalir: proximosASalirCount,
                    asignandose: asignandoseCount,
                    esperandoMotorizado: pedidosEsperando.length
                },
                pedidosEsperando: pedidosEsperando.map(p => {
                    var _a;
                    return ({
                        id: p.id,
                        negocioNombre: ((_a = p.negocio) === null || _a === void 0 ? void 0 : _a.nombre) || "Negocio",
                        noAssignedSince: p.noAssignedSince,
                        total: p.total
                    });
                })
            };
        });
    }
    static aceptarPedidoEnEspera(pedidoId, motorizadoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["cliente", "negocio"]);
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (pedido.estado !== data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO) {
                throw domain_1.CustomError.badRequest("Este pedido ya no está disponible para aceptación manual");
            }
            if (moto.estadoTrabajo !== data_1.EstadoTrabajoMotorizado.DISPONIBLE) {
                throw domain_1.CustomError.badRequest("No estás disponible para aceptar pedidos");
            }
            pedido.estado = data_1.EstadoPedido.PREPARANDO_ASIGNADO;
            pedido.motorizado = moto;
            pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
            pedido.pickup_verified = false;
            this.limpiarCamposRonda(pedido);
            yield pedido.save();
            moto.estadoTrabajo = data_1.EstadoTrabajoMotorizado.ENTREGANDO;
            yield moto.save();
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId,
                estado: pedido.estado,
                motorizado: {
                    id: moto.id,
                    name: moto.name,
                    surname: moto.surname,
                    whatsapp: moto.whatsapp
                },
                pickup_code: pedido.pickup_code,
            };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.emit("pedido_actualizado", updateData);
            return pedido;
        });
    }
    static cancelarPedidoPorAusencia(pedidoId, motorizadoId, evidenceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado", "cliente", "negocio"]);
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId)
                throw domain_1.CustomError.badRequest("No autorizado");
            if (pedido.estado !== data_1.EstadoPedido.EN_CAMINO)
                throw domain_1.CustomError.badRequest("Solo puedes reportar ausencia si estás en camino");
            if (!pedido.arrival_time)
                throw domain_1.CustomError.badRequest("Primero debes marcar que has llegado");
            // Verificar tiempo de espera (10 min)
            const settings = yield this.getSettings();
            const waitTimeMinutes = settings.driver_cancel_wait_time || 10;
            const now = new Date();
            const diffMinutes = (now.getTime() - pedido.arrival_time.getTime()) / (1000 * 60);
            if (diffMinutes < waitTimeMinutes) {
                throw domain_1.CustomError.badRequest(`Debes esperar el tiempo mínimo (${waitTimeMinutes} min) antes de cancelar`);
            }
            // 1. Guardar evidencia y cambiar estado
            pedido.estado = data_1.EstadoPedido.RETORNO_PENDIENTE;
            pedido.evidence_at_delivery = evidenceKey;
            pedido.motivoCancelacion = "CLIENTE_NO_RESPONDE";
            // 2. Incrementar Strikes al Cliente
            const cliente = pedido.cliente;
            cliente.cancellation_strikes = (Number(cliente.cancellation_strikes) || 0) + 1;
            let isBlocked = false;
            if (cliente.cancellation_strikes >= 3) {
                cliente.status = data_1.Status.BANNED;
                isBlocked = true;
            }
            yield cliente.save();
            // 3. Lógica Financiera (Anular ganancias motorizado/domicilio)
            pedido.ganancia_motorizado = 0;
            pedido.comision_app_domicilio = 0;
            pedido.costoEnvio = 0;
            yield pedido.save();
            // 4. Notificar a todos
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId,
                estado: pedido.estado,
                strikes: cliente.cancellation_strikes,
                isBlocked,
                motivo: pedido.motivoCancelacion
            };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.emit("pedido_actualizado", updateData);
            // Notificar strike al cliente por PWA
            yield notificationService.sendPushNotification(cliente.id, isBlocked ? "🚫 Cuenta Bloqueada" : "⚠️ Aviso de Cancelación", isBlocked
                ? "Tu cuenta ha sido bloqueada tras 3 pedidos no recibidos."
                : `No recibiste tu pedido. Tienes ${cliente.cancellation_strikes} avisos. Al llegar a 3, tu cuenta será bloqueada.`, { url: '/mis-pedidos' });
            return { strikes: cliente.cancellation_strikes, isBlocked };
        });
    }
    static confirmarRetornoLocal(pedidoId, motorizadoId, evidenceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield this.obtenerPedidoOrFail(pedidoId, ["motorizado", "negocio", "cliente"]);
            const moto = yield this.obtenerMotorizadoOrFail(motorizadoId);
            if (pedido.estado !== data_1.EstadoPedido.RETORNO_PENDIENTE) {
                throw domain_1.CustomError.badRequest("El pedido no está en espera de retorno");
            }
            pedido.estado = data_1.EstadoPedido.DEVUELTO_A_LOCAL;
            pedido.evidence_at_return = evidenceKey;
            yield pedido.save();
            // Liberar motorizado RECIÉN AQUÍ
            yield this.normalizarEstadoLibreMotorizado(moto);
            const io = (0, socket_1.getIO)();
            const updateData = { pedidoId, estado: pedido.estado };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.emit("pedido_actualizado", updateData);
            return { ok: true };
        });
    }
}
exports.PedidoMotoService = PedidoMotoService;
PedidoMotoService.settings = null;
PedidoMotoService.priceSettings = null;
