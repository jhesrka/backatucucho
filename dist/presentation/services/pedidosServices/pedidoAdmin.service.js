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
exports.PedidoAdminService = void 0;
const data_1 = require("../../../data");
const global_settings_model_1 = require("../../../data/postgres/models/global-settings.model");
const socket_1 = require("../../../config/socket");
const domain_1 = require("../../../domain");
const typeorm_1 = require("typeorm");
const pedidoMoto_service_1 = require("./pedidoMoto.service");
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
                relations: ["cliente", "motorizado", "negocio", "productos", "productos.producto"],
            });
            return { total, pedidos };
        });
    }
    // ✅ 2. Ver pedido por ID
    getPedidoById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOne({
                where: { id },
                relations: ["cliente", "motorizado", "negocio", "productos", "productos.producto"],
            });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            return pedido;
        });
    }
    // ✅ 3. Cambiar estado de pedido
    cambiarEstado(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOneBy({ id: dto.pedidoId });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            pedido.estado = dto.nuevoEstado;
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
     * ✅ 4. Asignar motorizado (MANUAL ADMIN)
     * Usa transacciones para asegurar compatibilidad con el algoritmo automático
     */
    asignarMotorizado(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield data_1.Pedido.getRepository().manager.transaction((manager) => __awaiter(this, void 0, void 0, function* () {
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
                // En asignación manual permitimos reasignar aunque no esté estrictamente "DISPONIBLE" 
                // si el admin así lo decide (por ejemplo, si se quedó atascado en EN_EVALUACION)
                const estadosPermitidos = [
                    data_1.EstadoTrabajoMotorizado.DISPONIBLE,
                    data_1.EstadoTrabajoMotorizado.EN_EVALUACION,
                    data_1.EstadoTrabajoMotorizado.NO_TRABAJANDO // El admin puede forzarlo
                ];
                if (motorizado.estadoTrabajo === data_1.EstadoTrabajoMotorizado.ENTREGANDO) {
                    throw domain_1.CustomError.badRequest("El motorizado ya tiene un pedido en camino/entrega");
                }
                // 3. Validar estado del pedido
                const estadosAsignables = [
                    data_1.EstadoPedido.PREPARANDO,
                    data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO,
                    data_1.EstadoPedido.EN_CAMINO // Reasignación
                ];
                if (!estadosAsignables.includes(pedido.estado)) {
                    throw domain_1.CustomError.badRequest(`El pedido no es asignable en su estado actual: ${pedido.estado}`);
                }
                // 4. Ejecutar Asignación
                pedido.motorizado = motorizado;
                if (pedido.estado === data_1.EstadoPedido.PREPARANDO || pedido.estado === data_1.EstadoPedido.PREPARANDO_NO_ASIGNADO) {
                    pedido.estado = data_1.EstadoPedido.PREPARANDO_ASIGNADO;
                    pedido.pickup_code = Math.floor(1000 + Math.random() * 9000).toString();
                    pedido.pickup_verified = false;
                }
                // Limpiar campos de ronda para que el algoritmo automático no lo toque más
                pedidoMoto_service_1.PedidoMotoService.limpiarCamposRonda(pedido);
                yield manager.save(pedido);
                // Actualizar estado del motorizado
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
                // Tenemos relaciones en el pedido (cargadas vía manager si fuera necesario, 
                // pero aquí el pedido viene del transaction)
                // Necesitamos cargar relaciones para las salas
                const pRel = yield manager.findOne(data_1.Pedido, {
                    where: { id: pedido.id },
                    relations: ["cliente", "negocio"]
                });
                if (pRel) {
                    io.to(pRel.cliente.id).emit("pedido_actualizado", updateData);
                    io.to(pRel.negocio.id).emit("pedido_actualizado", updateData);
                }
                io.emit("pedido_actualizado", updateData);
                // Notificar específicamente al motorizado
                (0, socket_1.getIO)().to(motorizado.id).emit("nueva_asignacion_manual", {
                    pedidoId: pedido.id,
                    mensaje: "Un administrador te ha asignado un pedido directamente."
                });
                return pedido;
            }));
        });
    }
    // ✅ 5. Eliminar pedidos finalizados antiguos (Configurable)
    purgeOldOrders() {
        return __awaiter(this, void 0, void 0, function* () {
            let settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            if (!settings) {
                settings = new global_settings_model_1.GlobalSettings();
                yield settings.save();
            }
            const retentionDays = settings.orderRetentionDays;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            const pedidos = yield data_1.Pedido.find({
                where: [
                    {
                        estado: data_1.EstadoPedido.ENTREGADO,
                        createdAt: (0, typeorm_1.LessThan)(cutoffDate),
                    },
                    {
                        estado: data_1.EstadoPedido.CANCELADO,
                        createdAt: (0, typeorm_1.LessThan)(cutoffDate),
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
    updateRetentionDays(days) {
        return __awaiter(this, void 0, void 0, function* () {
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
