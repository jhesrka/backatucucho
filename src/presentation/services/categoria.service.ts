import { CategoriaNegocio } from "../../data";
import { CustomError } from "../../domain";
import { CreateCategoriaDTO } from "../../domain/dtos/categoriaProductos/CreateCategoriaDTO";
import { UpdateCategoriaDTO } from "../../domain/dtos/categoriaProductos/UpdateCategoriaDTO";

export class CategoriaService {
  // Crear categoría
  async createCategoria(dto: CreateCategoriaDTO) {
    const categoria = CategoriaNegocio.create({
      nombre: dto.name,
      icono: dto.icon,
      restriccionModeloMonetizacion: dto.restriccionModeloMonetizacion ?? null,
      soloComision: dto.soloComision ?? false,
    });

    try {
      return await categoria.save();
    } catch {
      throw CustomError.internalServer("No se pudo guardar la categoría");
    }
  }

  // Obtener todas las categorías
  async getAllCategorias() {
    return await CategoriaNegocio.find({
      order: { created_at: "ASC" },
    });
  }

  // Obtener categoría por ID
  async getCategoriaById(id: string) {
    const categoria = await CategoriaNegocio.findOneBy({ id });
    if (!categoria) throw CustomError.notFound("Categoría no encontrada");
    return categoria;
  }

  // Actualizar categoría
  async updateCategoria(id: string, dto: UpdateCategoriaDTO) {
    const categoria = await this.getCategoriaById(id);

    if (dto.name) categoria.nombre = dto.name;
    if (dto.icon) categoria.icono = dto.icon;
    if (dto.restriccionModeloMonetizacion !== undefined) {
      categoria.restriccionModeloMonetizacion =
        dto.restriccionModeloMonetizacion;
    }
    if (dto.soloComision !== undefined) {
      categoria.soloComision = dto.soloComision;
    }
    try {
      return await categoria.save();
    } catch {
      throw CustomError.internalServer("No se pudo actualizar la categoría");
    }
  }

  // Eliminar categoría
  async deleteCategoria(id: string) {
    const categoria = await this.getCategoriaById(id);
    try {
      return await categoria.remove();
    } catch {
      throw CustomError.internalServer("No se pudo eliminar la categoría");
    }
  }
}
