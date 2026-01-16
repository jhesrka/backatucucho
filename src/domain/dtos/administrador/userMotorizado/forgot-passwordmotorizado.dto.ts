export class ForgotPasswordMotorizadoDTO {
  constructor(public readonly cedula: string) {}

  static create(object: { [key: string]: any }): [string[]?, ForgotPasswordMotorizadoDTO?] {
    const { cedula } = object;
    const errors: string[] = [];

    if (!cedula || typeof cedula !== "string") {
      errors.push("La cédula es obligatoria.");
    } else {
      const trimmed = cedula.trim();

      if (!/^\d{9,12}$/.test(trimmed)) {
        errors.push("La cédula debe tener entre 9 y 12 dígitos numéricos.");
      }

      if (/\s/.test(trimmed)) {
        errors.push("La cédula no debe contener espacios.");
      }
    }

    return errors.length > 0 ? [errors] : [undefined, new ForgotPasswordMotorizadoDTO(cedula.trim())];
  }
}
