import { ProductoPedidoInput } from "./ProductoPedidoInput";

type UbicacionCliente = {
  lat: number;
  lng: number;
  direccionTexto?: string;
};

export class CreatePedidoDTO {
  constructor(
    public readonly clienteId: string,
    public readonly negocioId: string,
    public readonly productos: ProductoPedidoInput[],
    public readonly ubicacionCliente: UbicacionCliente,
    public readonly metodoPago?: string,
    public readonly montoVuelto?: number,
    public readonly comprobantePagoUrl?: string,
  ) { }

  static create(object: { [key: string]: any }): [string?, CreatePedidoDTO?] {
    const { clienteId, negocioId, productos, ubicacionCliente } = object ?? {};

    // Requeridos básicos
    if (!clienteId) return ["El ID del cliente es obligatorio"];
    if (!negocioId) return ["El ID del negocio es obligatorio"];

    // Productos
    if (!Array.isArray(productos) || productos.length === 0) {
      return ["Debe enviar al menos un producto"];
    }
    const items: ProductoPedidoInput[] = [];
    for (const prod of productos) {
      const [err, ok] = ProductoPedidoInput.create(prod);
      if (err) return [err];
      items.push(ok!);
    }

    // Ubicación
    if (!ubicacionCliente) return ["La ubicación del cliente es obligatoria"];
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
      new CreatePedidoDTO(
        String(clienteId),
        String(negocioId),
        items,
        { lat: nlat, lng: nlng, direccionTexto: direccionTexto ? String(direccionTexto) : undefined },
        metodoPago,
        montoVuelto ? Number(montoVuelto) : undefined,
        comprobantePagoUrl ? String(comprobantePagoUrl) : undefined,
      ),
    ];
  }
}
