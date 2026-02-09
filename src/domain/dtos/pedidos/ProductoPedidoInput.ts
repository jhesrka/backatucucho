export class ProductoPedidoInput {
  constructor(
    public readonly productoId: string,
    public readonly cantidad: number,
    public readonly precio_venta?: number,
    public readonly precio_app?: number,
  ) { }

  static create(object: { [key: string]: any }): [string?, ProductoPedidoInput?] {
    const { productoId, cantidad, precio_venta, precio_app } = object ?? {};

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
