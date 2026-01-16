export class AsignarMotorizadoDTO {
  constructor(
    public readonly pedidoId: string,
    public readonly motorizadoId: string
  ) {}

  static create(object: {
    [key: string]: any;
  }): [string?, AsignarMotorizadoDTO?] {
    const { pedidoId, motorizadoId } = object;

    if (!pedidoId) return ["El ID del pedido es obligatorio"];
    if (!motorizadoId) return ["El ID del motorizado es obligatorio"];

    return [undefined, new AsignarMotorizadoDTO(pedidoId, motorizadoId)];
  }
}
