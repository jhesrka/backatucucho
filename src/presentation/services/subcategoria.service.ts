import { CategoriaNegocio, SubcategoriaNegocio } from "../../data";
import { CustomError } from "../../domain";
import { CreateSubcategoriaDTO, UpdateSubcategoriaDTO } from "../../domain/dtos/subcategorias";
import { GlobalSettings } from "../../data/postgres/models/global-settings.model";
import bcrypt from "bcryptjs";

export class SubcategoriaService {
  
  async create(dto: CreateSubcategoriaDTO, masterPin: string) {
    await this.verifyMasterPin(masterPin);

    const categoria = await CategoriaNegocio.findOneBy({ id: dto.categoriaId });
    if (!categoria) throw CustomError.notFound("Categoría padre no encontrada");

    const subcategoria = SubcategoriaNegocio.create({
      nombre: dto.nombre,
      orden: dto.orden,
      categoria: categoria,
    });

    try {
      return await subcategoria.save();
    } catch (error) {
      throw CustomError.internalServer("No se pudo guardar la subcategoría");
    }
  }

  async getAllByCategoria(categoriaId: string) {
    const subcategorias = await SubcategoriaNegocio.find({
      where: { categoria: { id: categoriaId } },
      order: { orden: "ASC", created_at: "ASC" },
    });
    return subcategorias;
  }

  async update(id: string, dto: UpdateSubcategoriaDTO, masterPin: string) {
    await this.verifyMasterPin(masterPin);

    const subcategoria = await SubcategoriaNegocio.findOneBy({ id });
    if (!subcategoria) throw CustomError.notFound("Subcategoría no encontrada");

    if (dto.nombre) subcategoria.nombre = dto.nombre;
    if (dto.orden !== undefined) subcategoria.orden = dto.orden;

    try {
      return await subcategoria.save();
    } catch (error) {
      throw CustomError.internalServer("No se pudo actualizar la subcategoría");
    }
  }

  async delete(id: string, masterPin: string) {
    await this.verifyMasterPin(masterPin);

    const subcategoria = await SubcategoriaNegocio.findOneBy({ id });
    if (!subcategoria) throw CustomError.notFound("Subcategoría no encontrada");

    try {
      return await subcategoria.remove();
    } catch (error) {
      throw CustomError.internalServer("No se pudo eliminar la subcategoría");
    }
  }

  private async verifyMasterPin(pin: string) {
    if (!pin) throw CustomError.unAuthorized("Master PIN requerido");

    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings || !settings.masterPin) {
      throw CustomError.internalServer("Error de seguridad: Master PIN no configurado en el sistema");
    }

    const isValid = bcrypt.compareSync(pin, settings.masterPin);
    if (!isValid) {
      throw CustomError.unAuthorized("Master PIN incorrecto");
    }
  }
}
