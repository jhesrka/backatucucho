export class CreateSubcategoriaDTO {
  private constructor(
    public readonly nombre: string,
    public readonly categoriaId: string,
    public readonly orden: number = 0
  ) { }

  static create(obj: { [key: string]: any }): [string?, CreateSubcategoriaDTO?] {
    const { nombre, categoriaId, orden } = obj;

    if (!nombre || typeof nombre !== "string" || nombre.trim().length < 2) {
      return ["El nombre de la subcategoría debe tener al menos 2 caracteres"];
    }

    if (!categoriaId || typeof categoriaId !== "string") {
      return ["El ID de la categoría es requerido"];
    }

    return [
      undefined,
      new CreateSubcategoriaDTO(
        nombre.trim(),
        categoriaId,
        orden ? Number(orden) : 0
      ),
    ];
  }
}
