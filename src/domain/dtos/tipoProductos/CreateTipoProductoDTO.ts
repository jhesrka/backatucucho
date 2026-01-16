// src/data/dtos/CreateTipoProductoDTO.ts
export class CreateTipoProductoDTO {
  private constructor(public readonly nombre: string) {}

  static create(obj: { [key: string]: any }): [string?, CreateTipoProductoDTO?] {
    const { nombre } = obj;

    if (!nombre || typeof nombre !== "string" || nombre.trim().length < 3) {
      return ["El nombre del tipo de producto debe tener al menos 3 caracteres"];
    }

    return [undefined, new CreateTipoProductoDTO(nombre.trim())];
  }
}
