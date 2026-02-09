"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePedidoDTO = void 0;
const ProductoPedidoInput_1 = require("./ProductoPedidoInput");
class CreatePedidoDTO {
    constructor(clienteId, negocioId, productos, ubicacionCliente, metodoPago, montoVuelto, comprobantePagoUrl) {
        this.clienteId = clienteId;
        this.negocioId = negocioId;
        this.productos = productos;
        this.ubicacionCliente = ubicacionCliente;
        this.metodoPago = metodoPago;
        this.montoVuelto = montoVuelto;
        this.comprobantePagoUrl = comprobantePagoUrl;
    }
    static create(object) {
        const { clienteId, negocioId, productos, ubicacionCliente } = object !== null && object !== void 0 ? object : {};
        // Requeridos básicos
        if (!clienteId)
            return ["El ID del cliente es obligatorio"];
        if (!negocioId)
            return ["El ID del negocio es obligatorio"];
        // Productos
        if (!Array.isArray(productos) || productos.length === 0) {
            return ["Debe enviar al menos un producto"];
        }
        const items = [];
        for (const prod of productos) {
            const [err, ok] = ProductoPedidoInput_1.ProductoPedidoInput.create(prod);
            if (err)
                return [err];
            items.push(ok);
        }
        // Ubicación
        if (!ubicacionCliente)
            return ["La ubicación del cliente es obligatoria"];
        const { lat, lng, direccionTexto } = ubicacionCliente;
        const nlat = Number(lat);
        const nlng = Number(lng);
        if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) {
            return ["Coordenadas de ubicación inválidas (lat/lng numéricos)"];
        }
        // Metodo de Pago (opcionales)
        const { metodoPago, montoVuelto, comprobantePagoUrl } = object;
        return [
            undefined,
            new CreatePedidoDTO(String(clienteId), String(negocioId), items, { lat: nlat, lng: nlng, direccionTexto: direccionTexto ? String(direccionTexto) : undefined }, metodoPago, montoVuelto ? Number(montoVuelto) : undefined, comprobantePagoUrl ? String(comprobantePagoUrl) : undefined),
        ];
    }
}
exports.CreatePedidoDTO = CreatePedidoDTO;
