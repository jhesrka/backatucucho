export class ProductoPedidoInput {
  constructor(
    public readonly productoId: string,
    public readonly cantidad: number,
    public readonly precioUnitario: number, // snapshot que vio el usuario
  ) {}

  static create(object: { [key: string]: any }): [string?, ProductoPedidoInput?] {
    const { productoId, cantidad, precioUnitario } = object ?? {};

    if (!productoId || typeof productoId !== "string") {
      return ["productoId es obligatorio"];
    }
    const cant = Number(cantidad);
    if (!Number.isFinite(cant) || cant <= 0 || !Number.isInteger(cant)) {
      return ["cantidad inválida (entero positivo)"];
    }
    const pu = Number(precioUnitario);
    if (!Number.isFinite(pu) || pu < 0) {
      return ["precioUnitario inválido (número >= 0)"];
    }

    return [undefined, new ProductoPedidoInput(productoId, cant, pu)];
  }
}
