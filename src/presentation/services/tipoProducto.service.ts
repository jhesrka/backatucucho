// src/services/TipoProductoService.ts

import { Negocio, TipoProducto } from "../../data";
import { CustomError } from "../../domain";

export class TipoProductoService {
  // ========================= CREATE =========================
  async createTipoProducto(nombre: string, negocioId: string) {
  if (!nombre || nombre.trim().length < 3)
    throw CustomError.badRequest("El nombre del tipo debe tener al menos 3 caracteres");

  const negocio = await Negocio.findOneBy({ id: negocioId });
  if (!negocio) throw CustomError.notFound("Negocio no encontrado");

  const existing = await TipoProducto.findOneBy({
    nombre: nombre.trim(),
    negocio: { id: negocioId },
  });
  if (existing) throw CustomError.badRequest("Este tipo de producto ya existe para este negocio");

  const tipo = TipoProducto.create({
    nombre: nombre.trim(),
    negocio,
  });

  try {
    return await tipo.save();
  } catch (err) {
    console.error("❌ Error exacto:", err);
    throw CustomError.internalServer("Error guardando el tipo de producto");
  }
}


  // ========================= READ =========================
  // 🔒 Solo devuelve los tipos del negocio indicado
  async getTiposByNegocio(negocioId: string) {
    if (!negocioId) throw CustomError.badRequest("Falta el ID del negocio");

    const tipos = await TipoProducto.find({
      where: { negocio: { id: negocioId } },
      order: { nombre: "ASC" },
      relations: ["negocio"],
    });

    return tipos;
  }

  // ========================= DELETE =========================
  async deleteTipo(id: string) {
    const tipo = await TipoProducto.findOneBy({ id });
    if (!tipo) {
      throw CustomError.notFound("Tipo de producto no encontrado");
    }

    try {
      await TipoProducto.remove(tipo);
      return { message: "Tipo de producto eliminado correctamente" };
    } catch {
      throw CustomError.internalServer("No se pudo eliminar el tipo de producto");
    }
  }
}
