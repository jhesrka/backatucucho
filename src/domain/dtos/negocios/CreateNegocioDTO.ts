import { regularExp } from "../../../config";
import { ModeloMonetizacion } from "../../../data";

export class CreateNegocioDTO {
  private constructor(
    public readonly nombre: string,
    public readonly descripcion: string,
    public readonly categoriaId: string,
    public readonly userId: string,
    public readonly modeloMonetizacion: ModeloMonetizacion,
    public readonly latitud: number,
    public readonly longitud: number,
    public readonly banco: string,
    public readonly tipoCuenta: string,
    public readonly numeroCuenta: string,
    public readonly titularCuenta: string,
    public readonly direccionTexto?: string | null,
    public readonly valorSuscripcion: number = 0,
    public readonly diaPago: number = 1
  ) { }

  static create(obj: { [key: string]: any }): [string?, CreateNegocioDTO?] {
    const {
      nombre,
      descripcion,
      categoriaId,
      userId,
      modeloMonetizacion,
      latitud,
      longitud,
      direccionTexto,
      banco,
      tipoCuenta,
      numeroCuenta,
      titularCuenta,
      valorSuscripcion,
      diaPago
    } = obj;

    if (!nombre || typeof nombre !== "string" || nombre.trim().length < 3) {
      return ["El nombre del negocio debe tener al menos 3 caracteres"];
    }

    if (!descripcion || typeof descripcion !== "string" || descripcion.trim().length < 10) {
      return ["La descripción debe tener al menos 10 caracteres"];
    }

    if (!categoriaId || typeof categoriaId !== "string" || !regularExp.uuid.test(categoriaId)) {
      return ["El ID de categoría no es válido"];
    }

    if (!userId || typeof userId !== "string" || !regularExp.uuid.test(userId)) {
      return ["El ID de usuario no es válido"];
    }

    if (!modeloMonetizacion || !Object.values(ModeloMonetizacion).includes(modeloMonetizacion)) {
      return ["Debes seleccionar un modelo de monetización válido"];
    }

    // Validar Datos Bancarios
    if (!banco || typeof banco !== "string" || banco.trim().length < 2) {
      return ["El nombre del banco es obligatorio"];
    }
    if (!tipoCuenta || typeof tipoCuenta !== "string" || tipoCuenta.trim().length < 2) {
      return ["El tipo de cuenta es obligatorio"];
    }
    if (!numeroCuenta || typeof numeroCuenta !== "string" || numeroCuenta.trim().length < 5) {
      return ["El número de cuenta es obligatorio"];
    }
    if (!titularCuenta || typeof titularCuenta !== "string" || titularCuenta.trim().length < 3) {
      return ["El titular de la cuenta es obligatorio"];
    }

    // ✅ Ubicación obligatoria para crear
    const lat = Number(latitud);
    const lng = Number(longitud);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return ["Latitud inválida"];
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return ["Longitud inválida"];
    }

    if (valorSuscripcion !== undefined) {
      const val = Number(valorSuscripcion);
      if (isNaN(val) || val < 0) {
        return ["El valor de suscripción debe ser un número positivo"];
      }
    }

    if (diaPago !== undefined) {
      const dia = Number(diaPago);
      if (isNaN(dia) || dia < 1 || dia > 31) {
        return ["El día de pago debe ser entre 1 y 31"];
      }
    }

    // opcional, pero si viene validamos tamaño
    const dirTxt =
      typeof direccionTexto === "string" && direccionTexto.trim().length > 0
        ? direccionTexto.trim().slice(0, 200)
        : undefined;

    return [
      undefined,
      new CreateNegocioDTO(
        nombre.trim(),
        descripcion.trim(),
        categoriaId,
        userId,
        modeloMonetizacion,
        lat,
        lng,
        banco.trim(),
        tipoCuenta.trim(),
        numeroCuenta.trim(),
        titularCuenta.trim(),
        dirTxt,
        valorSuscripcion !== undefined ? Number(valorSuscripcion) : 0,
        diaPago !== undefined ? Number(diaPago) : 1
      ),
    ];
  }
}
