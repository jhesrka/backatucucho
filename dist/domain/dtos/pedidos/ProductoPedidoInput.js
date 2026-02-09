"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductoPedidoInput = void 0;
class ProductoPedidoInput {
    constructor(productoId, cantidad, precio_venta, precio_app) {
        this.productoId = productoId;
        this.cantidad = cantidad;
        this.precio_venta = precio_venta;
        this.precio_app = precio_app;
    }
    static create(object) {
        const { productoId, cantidad, precio_venta, precio_app } = object !== null && object !== void 0 ? object : {};
        if (!productoId || typeof productoId !== "string") {
            return ["productoId es obligatorio"];
        }
        const cant = Number(cantidad);
        if (!Number.isFinite(cant) || cant <= 0 || !Number.isInteger(cant)) {
            return ["cantidad inválida (entero positivo)"];
        }
        const pv = precio_venta !== undefined ? Number(precio_venta) : undefined;
        const pa = precio_app !== undefined ? Number(precio_app) : undefined;
        return [undefined, new ProductoPedidoInput(productoId, cant, pv, pa)];
    }
}
exports.ProductoPedidoInput = ProductoPedidoInput;
