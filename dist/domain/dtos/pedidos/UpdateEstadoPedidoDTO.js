"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEstadoPedidoDTO = void 0;
const data_1 = require("../../../data");
class UpdateEstadoPedidoDTO {
    constructor(pedidoId, nuevoEstado, userId, // 👈 NUEVO Y OBLIGATORIO
    motivoCancelacion) {
        this.pedidoId = pedidoId;
        this.nuevoEstado = nuevoEstado;
        this.userId = userId;
        this.motivoCancelacion = motivoCancelacion;
    }
    static create(object) {
        const { pedidoId, nuevoEstado, userId, motivoCancelacion } = object;
        // Validaciones mínimas
        if (!pedidoId)
            return ["El ID del pedido es obligatorio"];
        if (!userId)
            return ["El ID del usuario es obligatorio"];
        if (!Object.values(data_1.EstadoPedido).includes(nuevoEstado)) {
            return ["El estado del pedido no es válido"];
        }
        return [undefined, new UpdateEstadoPedidoDTO(pedidoId, nuevoEstado, userId, motivoCancelacion)];
    }
}
exports.UpdateEstadoPedidoDTO = UpdateEstadoPedidoDTO;
