export class ForgotPasswordDTO {
  constructor(public readonly email: string) {}

  static create(object: { [key: string]: any }): [string[]?, ForgotPasswordDTO?] {
    const errors: string[] = [];

    if (!object || typeof object.email !== "string") {
      errors.push("El correo es obligatorio.");
      return [errors];
    }

    const email = object.email.trim();

    if (email.length < 5) {
      errors.push("El correo es demasiado corto.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("El correo ingresado no es válido.");
    }

    if (/\s/.test(email)) {
      errors.push("El correo no debe contener espacios.");
    }

    if (/[A-Z]/.test(email)) {
      errors.push("El correo no debe contener letras mayúsculas.");
    }

    if (errors.length > 0) return [errors];

    return [undefined, new ForgotPasswordDTO(email.toLowerCase())];
  }
}
