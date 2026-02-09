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
const domain_1 = require("../../../domain");
const typeorm_1 = require("typeorm");
class PedidoAdminService {
    // ✅ 1. Obtener todos los pedidos con filtros
    getPedidosAdmin(_a) {
        return __awaiter(this, arguments, void 0, function* ({ estado, negocioId, motorizadoId, clienteId, desde, hasta, search, limit = 10, offset = 0, }) {
            const where = {};
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
            yield pedido.save();
            return pedido;
        });
    }
    // ✅ 4. Asignar motorizado
    asignarMotorizado(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const pedido = yield data_1.Pedido.findOneBy({ id: dto.pedidoId });
            if (!pedido)
                throw domain_1.CustomError.notFound("Pedido no encontrado");
            const motorizado = yield data_1.UserMotorizado.findOneBy({ id: dto.motorizadoId });
            if (!motorizado)
                throw domain_1.CustomError.notFound("Motorizado no encontrado");
            if (motorizado.estadoCuenta !== "ACTIVO") {
                throw domain_1.CustomError.badRequest("Solo se pueden asignar motorizados con estado ACTIVO");
            }
            if (pedido.estado === data_1.EstadoPedido.PREPARANDO) {
                // Primera asignación: asignar motorizado y cambiar estado a EN_CAMINO
                pedido.motorizado = motorizado;
                pedido.estado = data_1.EstadoPedido.EN_CAMINO;
            }
            else if (pedido.estado === data_1.EstadoPedido.EN_CAMINO) {
                // Reasignación permitida solo si ya está en EN_CAMINO
                pedido.motorizado = motorizado;
                // El estado no cambia
            }
            else {
                throw domain_1.CustomError.badRequest("Solo se puede asignar o reasignar motorizado si el pedido está en estado PREPARANDO o EN_CAMINO");
            }
            yield pedido.save();
            return pedido;
        });
    }
    // ✅ 5. Eliminar pedidos finalizados antiguos (más de 7 días)
    // ✅ 5. Eliminar pedidos finalizados antiguos (Configurable)
    purgeOldOrders() {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Obtener días de retención desde configuración
            let settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            if (!settings) {
                settings = new global_settings_model_1.GlobalSettings(); // Default 20 days
                yield settings.save();
            }
            const retentionDays = settings.orderRetentionDays;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            // 2. Buscar pedidos ANTIGUOS que estén ENTREGADOS o CANCELADOS
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
            // 3. Eliminar (Hard Delete)
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
            // Opcional: validar que el estado actual sea EN_CAMINO (o cualquier estado válido antes de entregado/cancelado)
            if (pedido.estado !== data_1.EstadoPedido.EN_CAMINO) {
                throw domain_1.CustomError.badRequest("El pedido no está en estado EN_CAMINO, no puede ser actualizado por el motorizado");
            }
            pedido.estado = nuevoEstado;
            yield pedido.save();
            return pedido;
        });
    }
}
exports.PedidoAdminService = PedidoAdminService;
