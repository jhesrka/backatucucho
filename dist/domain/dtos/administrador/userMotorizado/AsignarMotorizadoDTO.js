"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsignarMotorizadoDTO = void 0;
class AsignarMotorizadoDTO {
    constructor(pedidoId, motorizadoId) {
        this.pedidoId = pedidoId;
        this.motorizadoId = motorizadoId;
    }
    static create(object) {
        const { pedidoId, motorizadoId } = object;
        if (!pedidoId)
            return ["El ID del pedido es obligatorio"];
        if (!motorizadoId)
            return ["El ID del motorizado es obligatorio"];
        return [undefined, new AsignarMotorizadoDTO(pedidoId, motorizadoId)];
    }
}
exports.AsignarMotorizadoDTO = AsignarMotorizadoDTO;
