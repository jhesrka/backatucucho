export class UpdateSubcategoriaDTO {
  private constructor(
    public readonly nombre?: string,
    public readonly orden?: number
  ) { }

  static create(obj: { [key: string]: any }): [string?, UpdateSubcategoriaDTO?] {
    const { nombre, orden } = obj;

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || nombre.trim().length < 2) {
        return ["El nombre de la subcategoría debe tener al menos 2 caracteres"];
      }
    }

    return [
      undefined,
      new UpdateSubcategoriaDTO(
        nombre?.trim(),
        orden !== undefined ? Number(orden) : undefined
      ),
    ];
  }
}
