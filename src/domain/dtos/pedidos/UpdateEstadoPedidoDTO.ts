import { EstadoPedido } from "../../../data";

export class UpdateEstadoPedidoDTO {
  constructor(
    public readonly pedidoId: string,
    public readonly nuevoEstado: EstadoPedido,
    public readonly userId: string, // 👈 NUEVO Y OBLIGATORIO
    public readonly motivoCancelacion?: string
  ) {}

  static create(object: { [key: string]: any }): [string?, UpdateEstadoPedidoDTO?] {
    const { pedidoId, nuevoEstado, userId, motivoCancelacion } = object;

    // Validaciones mínimas
    if (!pedidoId) return ["El ID del pedido es obligatorio"];

    if (!userId) return ["El ID del usuario es obligatorio"];

    if (!Object.values(EstadoPedido).includes(nuevoEstado)) {
      return ["El estado del pedido no es válido"];
    }

    return [undefined, new UpdateEstadoPedidoDTO(pedidoId, nuevoEstado, userId, motivoCancelacion)];
  }
}
