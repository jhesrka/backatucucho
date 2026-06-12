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
exports.PedidoAdminService = void 0;
const data_1 = require("../../../data");
const global_settings_model_1 = require("../../../data/postgres/models/global-settings.model");
const socket_1 = require("../../../config/socket");
const domain_1 = require("../../../domain");
const typeorm_1 = require("typeorm");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const pedidoMoto_service_1 = require("./pedidoMoto.service");
const NotificationService_1 = require("../NotificationService");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const upload_files_cloud_adapter_1 = require("../../../config/upload-files-cloud-adapter");
const env_1 = require("../../../config/env");
const notificationService = new NotificationService_1.NotificationService();
class PedidoAdminService {
    // ✅ 1. Obtener todos los pedidos con filtros
    getPedidosAdmin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ estado, negocioId, motorizadoId, clienteId, desde, hasta, search, limit = 10, offset = 0, }) {
            const where = {};
            const hasSearch = !!search && search.trim().length > 0;
            if (hasSearch) {
                // Si hay búsqueda por ID, ignoramos el resto de filtros según requerimiento
                // Usamos Raw para castear el UUID a TEXT y permitir búsqueda ILIKE sin errores de Postgres
                where.id = (0, typeorm_1.Raw)((alias) => `CAST(${alias} AS TEXT) ILIKE :search`, { search: `%${search}%` });
            }
            else {
                if (estado)
                    where.estado = estado;
                if (negocioId)
                    where.negocio = { id: negocioId };
                if (motorizadoId)
                    where.motorizado = { id: motorizadoId };
                if (clienteId)
                    where.cliente = { id: clienteId };
                if (desde && hasta)
                    where.createdAt = (0, typeorm_1.Between)(desde, hasta);
            }
            const [pedidos, total] = yield data_1.Pedido.findAndCount({
                where,
                take: limit,
                skip: offset,
                order: { createdAt: "DESC" },
                relations: ["cliente", "motorizado", "negocio", "negocio.usuario", "productos", "productos.producto"],
            });
            const mappedPedidos = yield Promise.all(pedidos.map((p) => __awaiter(this, void 0, void 0, function* () {
                let resolvedComprobante = p.comprobantePagoUrl;
                if (resolvedComprobante && !resolvedComprobante.startsWith('http')) {
                    resolvedComprobante = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: env_1.envs.AWS_BUCKET_NAME, key: resolvedComprobante });
                }
                return Object.assign(Object.assign({}, p), { comprobantePagoUrl: resolvedComprobante, productos: p.productos.map(pp => (Object.assign(Object.assign({}, pp), { producto: pp.producto || {
                            nombre: pp.producto_nombre || "P. Eliminado",
                            id: 'deleted',
                            tipoProducto: 'NORMAL' // 👈 Aseguramos que no se oculte el timer por falta de info
                        } }))) });
            })));
            return { total, pedidos: mappedPedidos };
        });
    }
    // ✅ 2. Ver pedido por ID
    getPedidoById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
                where: { id },
                relations: ["cliente", "motorizado", "negocio", "negocio.usuario", "productos", "productos.producto"],
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            // ✅ Transformar para soportar productos eliminados (usando snapshot)
            pedido.productos = pedido.productos.map(pp => (Object.assign(Object.assign({}, pp), { producto: pp.producto || {
                    nombre: pp.producto_nombre || "Producto ya no disponible",
                    id: 'deleted',
                    imagen: pp.producto_imagen,
                    tipoProducto: 'NORMAL' // 👈 Fallback
                } })));
            return pedido;
        });
    }
    // ✅ 3. Cambiar estado de pedido
    cambiarEstado(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
                where: { id: dto.pedidoId },
                relations: ["motorizado"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            const estadoAnterior = pedido.estado;
            pedido.estado = dto.nuevoEstado;
            if (dto.nuevoEstado === data_1.EstadoPedido.ACEPTADO && !pedido.fecha_aceptado) {
                pedido.fecha_aceptado = new Date();
            }
            // Si hay motivo de cancelación (Emergencia Admin)
            if (dto.nuevoEstado === data_1.EstadoPedido.CANCELADO && dto.motivoCancelacion) {
                pedido.motivoCancelacion = dto.motivoCancelacion;
                // Detener cualquier algoritmo automático
                pedidoMoto_service_1.PedidoMotoService.limpiarCamposRonda(pedido);
                // Si tenía motorizado asignado, liberarlo (opcional, pero buena práctica si ya estaba en PREPARANDO_ASIGNADO)
                if (pedido.motorizado) {
                    const motorizado = pedido.motorizado;
                    motorizado.estadoTrabajo = motorizado.quiereTrabajar ? data_1.EstadoTrabajoMotorizado.DISPONIBLE : data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
                    motorizado.fechaHoraDisponible = new Date();
                    yield motorizado.save();
                    // Notificar al motorizado
                    (0, socket_1.getIO)().to(motorizado.id).emit("estado_reset", { mensaje: "El pedido asignado ha sido cancelado por la administración." });
                }
            }
            // Generar códigos si faltan al cambiar de estado manualmente
            if (pedido.estado === data_1.EstadoPedido.PREPARANDO_ASIGNADO && !pedido.pickup_code) {
                pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
                pedido.pickup_verified = false;
            }
            if (pedido.estado === data_1.EstadoPedido.EN_CAMINO && !pedido.delivery_code) {
                pedido.delivery_code = Math.floor(1000 + Math.random() * 9000).toString();
                pedido.delivery_verified = false;
            }
            yield pedido.save();
            const pRel = yield data_1.Pedido.findOne({ where: { id: pedido.id }, relations: ["cliente", "negocio"] });
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId: pedido.id,
                estado: pedido.estado,
                timestamp: new Date().toISOString(),
            };
            if (pRel) {
                io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
                io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
            }
            io.emit("pedido_actualizado", updateData);
            return pedido;
        });
    }
    /**
     * ✅ 3.5. Entregar pedido (EMERGENCIA ADMIN)
     * Fuerza el estado a ENTREGADO sin necesidad del código PIN,
     * y ejecuta la misma liquidación de comisiones que la app del motorizado.
     */
    entregarPedidoEmergencia(pedidoId, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
                where: { id: pedidoId },
                relations: ["motorizado", "cliente", "negocio"]
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (!pedido.motorizado) {
                throw domain_1.CustomError.badRequest("El pedido no tiene un motorizado asignado");
            }
            if (pedido.estado !== data_1.EstadoPedido.EN_CAMINO && pedido.estado !== data_1.EstadoPedido.PREPARANDO_ASIGNADO) {
                throw domain_1.CustomError.badRequest(`El pedido no se puede entregar desde el estado ${pedido.estado}`);
            }
            const moto = yield data_1.UserMotorizado.findOneBy({ id: pedido.motorizado.id });
            if (!moto)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            pedido.estado = data_1.EstadoPedido.ENTREGADO;
            pedido.delivery_verified = true; // Forzado por admin
            yield pedido.save();
            // 1. Calcular Ganancia
            const ps = yield pedidoMoto_service_1.PedidoMotoService.getPriceSettings();
            const porcentaje = Number(ps.motorizadoPercentage || 80);
            const gananciaMoto = Number(pedido.ganancia_motorizado || (pedido.costoEnvio * (porcentaje / 100)).toFixed(2));
            const saldoAnterior = Number(moto.saldo);
            const saldoNuevo = saldoAnterior + gananciaMoto;
            // 2. Acreditar Billetera
            moto.saldo = saldoNuevo;
            const movement = new data_1.WalletMovement();
            movement.motorizado = moto;
            movement.pedido = pedido;
            movement.type = data_1.WalletMovementType.GANANCIA_ENVIO;
            movement.amount = gananciaMoto;
            movement.balanceAfter = saldoNuevo;
            movement.description = `Ganancia envío (Admin Force) #${pedido.id.slice(-6).toUpperCase()}`;
            movement.status = data_1.WalletMovementStatus.COMPLETADO;
            yield movement.save();
            const tx = new data_1.TransaccionMotorizado();
            tx.motorizado = moto;
            tx.pedido = pedido;
            tx.tipo = data_1.TipoTransaccion.GANANCIA_ENVIO;
            tx.monto = gananciaMoto;
            tx.descripcion = `Ganancia envío (Admin Force) #${pedido.id.slice(-6).toUpperCase()}`;
            tx.estado = data_1.EstadoTransaccion.COMPLETADA;
            tx.saldoAnterior = saldoAnterior;
            tx.saldoNuevo = saldoNuevo;
            yield tx.save();
            yield moto.save();
            // 3. Liberar al Motorizado
            yield pedidoMoto_service_1.PedidoMotoService.normalizarEstadoLibreMotorizado(moto);
            // 4. Notificaciones
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId,
                estado: pedido.estado,
                timestamp: new Date().toISOString(),
            };
            io.to(pedido.cliente.id).emit("pedido_actualizado", updateData);
            io.to(pedido.negocio.id).emit("pedido_actualizado", updateData);
            io.emit("pedido_actualizado", updateData);
            io.emit("admin_live_update", { type: 'ORDER_UPDATED', pedidoId: pedido.id });
            yield notificationService.sendPushNotification(pedido.cliente.id, "¡Pedido Entregado!", `¡Buen provecho! Tu pedido #${pedido.id.split('-')[0]} ha sido entregado (Confirmación Admin).`, { url: '/mis-pedidos' });
            return pedido;
        });
    }
    /**
     * ✅ 4. Asignar motorizado (MANUAL ADMIN)
     * Usa transacciones para asegurar compatibilidad con el algoritmo automático
     */
    asignarMotorizado(dto, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield data_1.Pedido.getRepository().manager.transaction((manager) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                // 1. Bloquear pedido para evitar conflicto con el Cron
                const pedido = yield manager.findOne(data_1.Pedido, {
                    where: { id: dto.pedidoId },
                    lock: { mode: "pessimistic_write" }
                });
                if (!pedido)
                    throw domain_1.CustomError.notFound("Pedido no encontrado");
                const motorizado = yield manager.findOne(data_1.UserMotorizado, {
                    where: { id: dto.motorizadoId },
                    lock: { mode: "pessimistic_write" }
                });
                if (!motorizado)
                    throw domain_1.CustomError.notFound("El motorizado ya no existe");
                // 2. Validar aptitud del motorizado
                if (motorizado.estadoCuenta !== "ACTIVO") {
                    throw domain_1.CustomError.badRequest("El motorizado no está activo administrativamente");
                }
                const estadosPermitidos = [
                    data_1.EstadoTrabajoMotorizado.DISPONIBLE,
                    data_1.EstadoTrabajoMotorizado.EN_EVALUACION,
                    data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO
                ];
                if (motorizado.estadoTrabajo === data_1.EstadoTrabajoMotorizado.ENTREGANDO) {
                    throw domain_1.CustomError.badRequest("El motorizado ya tiene un pedido en camino/entrega");
                }
                // 3. Validar estado del pedido
                const estadosAsignables = [
                    data_1.EstadoPedido.PREPARANDO,
                    data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO,
                    data_1.EstadoPedido.PREPARANDO_ASIGNADO, // Reasignación
                    data_1.EstadoPedido.EN_CAMINO // Reasignación
                ];
                if (!estadosAsignables.includes(pedido.estado)) {
                    throw domain_1.CustomError.badRequest(`El pedido no es asignable en su estado actual: ${pedido.estado}`);
                }
                // 4. Ejecutar Asignación
                const motorizadoAnteriorId = (_a = pedido.motorizado) === null || _a === void 0 ? void 0 : _a.id;
                // SI HABÍA UN MOTORIZADO ANTERIOR, LIBERARLO
                if (motorizadoAnteriorId) {
                    const motorizadoAnterior = yield manager.findOne(data_1.UserMotorizado, { where: { id: motorizadoAnteriorId } });
                    if (motorizadoAnterior) {
                        motorizadoAnterior.quiereTrabajar = true;
                        motorizadoAnterior.estadoTrabajo = data_1.EstadoTrabajoMotorizado.DISPONIBLE;
                        motorizadoAnterior.fechaHoraDisponible = new Date();
                        motorizadoAnterior.noDisponibleHasta = null;
                        yield manager.save(motorizadoAnterior);
                        // Notificar al motorizado anterior que ya no tiene el pedido
                        (0, socket_1.getIO)().to(motorizadoAnterior.id).emit("pedido_desvinculado", {
                            pedidoId: pedido.id,
                            mensaje: "El administrador ha reasignado este pedido a otro repartidor. Ya no es tu responsabilidad."
                        });
                    }
                }
                const estadoOriginal = pedido.estado;
                pedido.motorizado = motorizado;
                // ESCENARIO A: Estaba asignado pero no retirado del local (o sin asignar)
                if (estadoOriginal === data_1.EstadoPedido.PREPARANDO ||
                    estadoOriginal === data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO ||
                    estadoOriginal === data_1.EstadoPedido.PREPARANDO_ASIGNADO) {
                    pedido.estado = data_1.EstadoPedido.PREPARANDO_ASIGNADO;
                    // SEGURIDAD: Generar NUEVO código de retiro para el nuevo motorizado
                    pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
                    pedido.pickup_verified = false;
                }
                // ESCENARIO B: Estaba EN_CAMINO (Ya retiró, traspaso físico entre motos)
                else if (estadoOriginal === data_1.EstadoPedido.EN_CAMINO) {
                    // Mantenemos el estado EN_CAMINO para que le aparezca directo en la app al nuevo
                    // Mantenemos el delivery_code que ya tiene el cliente para no generar confusión
                    // pickup_verified sigue siendo true porque el pedido ya está en la calle
                }
                // Limpiar campos de ronda para que el algoritmo automático no lo toque más
                pedidoMoto_service_1.PedidoMotoService.limpiarCamposRonda(pedido);
                yield manager.save(pedido);
                // Actualizar estado del motorizado nuevo
                motorizado.estadoTrabajo = data_1.EstadoTrabajoMotorizado.ENTREGANDO;
                yield manager.save(motorizado);
                // Notificar a las partes
                const io = (0, socket_1.getIO)();
                const updateData = {
                    pedidoId: pedido.id,
                    estado: pedido.estado,
                    motorizadoId: motorizado.id,
                    timestamp: new Date().toISOString(),
                };
                const pRel = yield manager.findOne(data_1.Pedido, {
                    where: { id: pedido.id },
                    relations: ["cliente", "negocio"]
                });
                if (pRel) {
                    io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
                    io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
                }
                io.emit("pedido_actualizado", updateData);
                io.emit("admin_live_update", { type: 'ORDER_UPDATED', pedidoId: pedido.id });
                // Notificar específicamente al motorizado
                (0, socket_1.getIO)().to(motorizado.id).emit("nueva_asignacion_manual", {
                    pedidoId: pedido.id,
                    mensaje: "Un administrador te ha asignado un pedido directamente."
                });
                yield notificationService.sendPushNotification(motorizado.id, "¡Nueva Asignación Manual!", `Un administrador te ha asignado el pedido #${pedido.id.split('-')[0]} directamente.`, { url: '/motorizado' });
                return pedido;
            }));
        });
    }
    // ✅ 7. Liberar motorizado atascado
    liberarMotorizado(motorizadoId, adminId, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id: motorizadoId });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            const estadoAnterior = motorizado.estadoTrabajo;
            motorizado.estadoTrabajo = motorizado.quiereTrabajar
                ? data_1.EstadoTrabajoMotorizado.DISPONIBLE
                : data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO;
            motorizado.fechaHoraDisponible = new Date();
            yield motorizado.save();
            const io = (0, socket_1.getIO)();
            io.emit("admin_live_update", { type: 'MOTORIZADO_UPDATED', motorizadoId });
            io.to(motorizadoId).emit("estado_reset", { mensaje: "Tu estado ha sido restablecido por un administrador." });
            return { message: "Motorizado liberado correctamente" };
        });
    }
    // ✅ 8. Obtener datos en vivo del Centro Operativo
    getLiveControlData() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
            const fifteenMinAgo = new Date(now.getTime() - (15 * 60 * 1000));
            // Configurar rango de hoy en la zona horaria de Guayaquil
            const startOfToday = moment_timezone_1.default.tz('America/Guayaquil').startOf('day').toDate();
            const endOfToday = moment_timezone_1.default.tz('America/Guayaquil').endOf('day').toDate();
            // 1. Pedidos del día (Activos sin límite de tiempo, Finalizados solo HOY)
            const pedidosActivos = yield data_1.Pedido.find({
                where: [
                    // Estados ACTIVOS: Mostrar todos los que existan en el sistema (no importa la fecha)
                    { estado: data_1.EstadoPedido.PENDIENTE },
                    { estado: data_1.EstadoPedido.ACEPTADO },
                    { estado: data_1.EstadoPedido.PREPARANDO },
                    { estado: data_1.EstadoPedido.PREPARANDO_ASIGNADO },
                    { estado: data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO },
                    { estado: data_1.EstadoPedido.EN_CAMINO },
                    { estado: data_1.EstadoPedido.PENDIENTE_PAGO },
                    // Estados FINALIZADOS o INCIDENCIAS: Mostrar solo los de HOY para no saturar el tablero
                    { estado: data_1.EstadoPedido.ENTREGADO, createdAt: (0, typeorm_1.Between)(startOfToday, endOfToday) },
                    { estado: data_1.EstadoPedido.CANCELADO, createdAt: (0, typeorm_1.Between)(startOfToday, endOfToday) },
                    { estado: data_1.EstadoPedido.RETORNO_PENDIENTE, createdAt: (0, typeorm_1.Between)(startOfToday, endOfToday) },
                    { estado: data_1.EstadoPedido.DEVUELTO_A_LOCAL, createdAt: (0, typeorm_1.Between)(startOfToday, endOfToday) },
                ],
                relations: ["cliente", "motorizado", "negocio", "negocio.usuario", "productos", "productos.producto"],
                order: { createdAt: "DESC" }
            });
            // 2. Motorizados Conectados / Activos
            const motorizados = yield data_1.UserMotorizado.find({
                where: {
                    estadoCuenta: data_1.EstadoCuentaMotorizado.ACTIVO
                },
                select: ["id", "name", "surname", "whatsapp", "estadoTrabajo", "quiereTrabajar", "fechaHoraDisponible", "ratingPromedio", "lastSeenAt", "estadoCuenta", "noDisponibleHasta", "photoperfil"]
            });
            // 3. Enriquecer motorizados con su pedido actual, pedido en evaluación y métricas del día
            const motorizadosFull = yield Promise.all(motorizados.map((m) => __awaiter(this, void 0, void 0, function* () {
                let pedidoActualId = null;
                let pedidoEnEvaluacionId = null;
                // 1. Verificar si realmente tiene un pedido asignado actualmente usando los pedidos en memoria
                const pedidoOcupado = pedidosActivos.find(pa => {
                    var _a;
                    return ((_a = pa.motorizado) === null || _a === void 0 ? void 0 : _a.id) === m.id &&
                        [data_1.EstadoPedido.PREPARANDO_ASIGNADO, data_1.EstadoPedido.EN_CAMINO, data_1.EstadoPedido.RETORNO_PENDIENTE].includes(pa.estado);
                });
                if (pedidoOcupado) {
                    pedidoActualId = pedidoOcupado.id;
                    // Forzamos el estado de visualización a ENTREGANDO ya que tiene un pedido asignado real
                    m.estadoTrabajo = data_1.EstadoTrabajoMotorizado.ENTREGANDO;
                }
                // 2. Verificar si está evaluando un pedido
                const pEval = pedidosActivos.find(pa => pa.motorizadoEnEvaluacion === m.id);
                if (pEval) {
                    pedidoEnEvaluacionId = pEval.id;
                    if (!pedidoOcupado) {
                        m.estadoTrabajo = data_1.EstadoTrabajoMotorizado.EN_EVALUACION;
                    }
                }
                const entregasHoy = yield data_1.Pedido.count({
                    where: {
                        motorizado: { id: m.id },
                        estado: data_1.EstadoPedido.ENTREGADO,
                        updatedAt: (0, typeorm_1.Between)(startOfToday, new Date())
                    }
                });
                let photoperfilUrls = m.photoperfil;
                if (m.photoperfil && !m.photoperfil.startsWith('http')) {
                    photoperfilUrls = (yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({ bucketName: env_1.envs.AWS_BUCKET_NAME, key: m.photoperfil }));
                }
                return Object.assign(Object.assign({}, m), { pedidoActualId, pedidoEnEvaluacionId, entregasHoy, photoperfil: photoperfilUrls });
            })));
            // Enriquecer pedidos con nombre del motorizado en evaluación
            const pedidosEnriquecidos = yield Promise.all(pedidosActivos.map((p) => __awaiter(this, void 0, void 0, function* () {
                let motorizadoEvalNombre = null;
                if (p.motorizadoEnEvaluacion) {
                    const moto = motorizados.find(m => m.id === p.motorizadoEnEvaluacion);
                    motorizadoEvalNombre = moto ? `${moto.name} ${moto.surname}` : "Desconocido";
                }
                let resolvedComprobante = p.comprobantePagoUrl;
                if (resolvedComprobante && !resolvedComprobante.startsWith('http')) {
                    resolvedComprobante = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: env_1.envs.AWS_BUCKET_NAME, key: resolvedComprobante });
                }
                return Object.assign(Object.assign({}, p), { comprobantePagoUrl: resolvedComprobante, motorizadoEvalNombre, negocio: p.negocio, motorizado: p.motorizado, cliente: p.cliente });
            })));
            // 4. Calcular Métricas de Resumen
            const sinMotorizado = pedidosActivos.filter(p => p.estado === data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO).length;
            const motorizadosDisponibles = motorizadosFull.filter(m => m.estadoTrabajo === data_1.EstadoTrabajoMotorizado.DISPONIBLE &&
                m.quiereTrabajar &&
                (!m.noDisponibleHasta || new Date(m.noDisponibleHasta) <= now)).length;
            const motorizadosEntregando = motorizadosFull.filter(m => m.estadoTrabajo === data_1.EstadoTrabajoMotorizado.ENTREGANDO).length;
            const pedidosTrabados = pedidosActivos.filter(p => p.updatedAt < fifteenMinAgo).length;
            // 5. Generar Alertas
            const alertas = [];
            motorizadosFull.forEach((m) => {
                if (m.estadoTrabajo === data_1.EstadoTrabajoMotorizado.ENTREGANDO && !m.pedidoActualId) {
                    alertas.push({ type: 'INCONSISTENCY', severity: 'CRITICAL', message: `Motorizado ${m.name} figura "Entregando" sin pedido activo.` });
                }
                const lastSeen = m.lastSeenAt ? new Date(m.lastSeenAt).getTime() : 0;
                if (m.quiereTrabajar && (Date.now() - lastSeen > 10 * 60 * 1000)) {
                    alertas.push({ type: 'OFFLINE', severity: 'WARNING', message: `${m.name} está activo pero no reporta ubicación hace >10 min.` });
                }
            });
            pedidosActivos.forEach(p => {
                if (p.estado === data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO && p.createdAt < fifteenMinAgo) {
                    alertas.push({ type: 'STUCK', severity: 'CRITICAL', message: `Pedido #${p.id.slice(-6)} lleva >15 min sin motorizado.` });
                }
            });
            const retornosActivos = pedidosActivos.filter(p => [data_1.EstadoPedido.RETORNO_PENDIENTE, data_1.EstadoPedido.DEVUELTO_A_LOCAL].includes(p.estado)).length;
            const finalizadosHoy = pedidosActivos.filter(p => [data_1.EstadoPedido.ENTREGADO, data_1.EstadoPedido.CANCELADO].includes(p.estado)).length;
            return {
                pedidos: pedidosEnriquecidos,
                motorizados: motorizadosFull,
                summary: {
                    totalActivos: pedidosActivos.length,
                    sinMotorizado,
                    motorizadosDisponibles,
                    motorizadosEntregando,
                    pedidosTrabados,
                    retornosActivos,
                    finalizadosHoy
                },
                alertas
            };
        });
    }
    // ✅ Helper: Verificar PIN Maestro
    verifyMasterPin(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            if (!settings || !settings.masterPin)
                return true; // Si no hay PIN configurado, permitir (o podrías bloquearlo)
            const isMatch = yield bcryptjs_1.default.compare(pin, settings.masterPin);
            if (!isMatch)
                throw domain_1.CustomError.badRequest("PIN Maestro incorrecto");
            return true;
        });
    }
    // ✅ 5. Eliminar pedidos finalizados antiguos (Configurable)
    purgeOldOrders(masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            if (masterPin) {
                yield this.verifyMasterPin(masterPin);
            }
            let settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            if (!settings) {
                settings = new global_settings_model_1.GlobalSettings();
                yield settings.save();
            }
            const retentionDays = settings.orderRetentionDays;
            const cutoffDateOrders = new Date();
            cutoffDateOrders.setDate(cutoffDateOrders.getDate() - retentionDays);
            // 2. Purgar Pedidos antiguos
            const pedidos = yield data_1.Pedido.find({
                where: [
                    {
                        estado: data_1.EstadoPedido.ENTREGADO,
                        createdAt: (0, typeorm_1.LessThan)(cutoffDateOrders),
                    },
                    {
                        estado: data_1.EstadoPedido.CANCELADO,
                        createdAt: (0, typeorm_1.LessThan)(cutoffDateOrders),
                    },
                ],
            });
            if (pedidos.length === 0)
                return { deletedCount: 0 };
            const deleted = yield data_1.Pedido.remove(pedidos);
            return { deletedCount: deleted.length };
        });
    }
    // ✅ 6. Actualizar Configuración de Purga
    updateRetentionDays(days, masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.verifyMasterPin(masterPin);
            let settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            if (!settings) {
                settings = new global_settings_model_1.GlobalSettings();
            }
            settings.orderRetentionDays = days;
            yield settings.save();
            return settings;
        });
    }
    actualizarEstadoPorMotorizado(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pedidoId, nuevoEstado, motorizadoId } = dto;
            if (![data_1.EstadoPedido.ENTREGADO, data_1.EstadoPedido.CANCELADO].includes(nuevoEstado)) {
                throw domain_1.CustomError.badRequest("El motorizado sólo puede cambiar estado a ENTREGADO o CANCELADO");
            }
            const pedido = yield data_1.Pedido.findOne({
                where: { id: pedidoId },
                relations: ["motorizado"],
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            if (!pedido.motorizado || pedido.motorizado.id !== motorizadoId) {
                throw domain_1.CustomError.forbiden("No tienes permiso para modificar este pedido");
            }
            if (pedido.estado !== data_1.EstadoPedido.EN_CAMINO) {
                throw domain_1.CustomError.badRequest("El pedido no está en estado EN_CAMINO");
            }
            const estadoAnterior = pedido.estado;
            pedido.estado = nuevoEstado;
            yield pedido.save();
            const pRel = yield data_1.Pedido.findOne({ where: { id: pedido.id }, relations: ["cliente", "negocio"] });
            const io = (0, socket_1.getIO)();
            const updateData = {
                pedidoId: pedido.id,
                estado: pedido.estado,
                timestamp: new Date().toISOString(),
            };
            if (pRel) {
                io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
                io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
            }
            io.emit("pedido_actualizado", updateData);
            return pedido;
        });
    }
}
exports.PedidoAdminService = PedidoAdminService;
