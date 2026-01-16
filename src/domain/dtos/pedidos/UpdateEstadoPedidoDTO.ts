import { EstadoPedido } from "../../../data";

export class UpdateEstadoPedidoDTO {
  constructor(
    public readonly pedidoId: string,
    public readonly nuevoEstado: EstadoPedido,
    public readonly userId: string, // 👈 NUEVO Y OBLIGATORIO
  ) {}

  static create(object: { [key: string]: any }): [string?, UpdateEstadoPedidoDTO?] {
    const { pedidoId, nuevoEstado, userId } = object;

    // Validaciones mínimas
    if (!pedidoId) return ["El ID del pedido es obligatorio"];

    if (!userId) return ["El ID del usuario es obligatorio"];

    if (!Object.values(EstadoPedido).includes(nuevoEstado)) {
      return ["El estado del pedido no es válido"];
    }

    return [undefined, new UpdateEstadoPedidoDTO(pedidoId, nuevoEstado, userId)];
  }
}
