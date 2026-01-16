import { regularExp } from "../../../../config";

export class LoginMotorizadoUserDTO {
  constructor(
    public readonly cedula: string,
    public readonly password: string
  ) {}

  static create(object: { [key: string]: any }): [string[]?, LoginMotorizadoUserDTO?] {
    const { cedula, password } = object;
    const errors: string[] = [];

    // Validaciones internas
    const isCedulaValid =
      typeof cedula === "string" && regularExp.cedula.test(cedula.trim());

    const isPasswordValid =
      typeof password === "string" &&
      regularExp.password.test(password.trim());

    // Mensaje genérico si algo está mal
    if (!isCedulaValid || !isPasswordValid) {
      errors.push("Credenciales inválidas");
      return [errors];
    }

    return [undefined, new LoginMotorizadoUserDTO(cedula.trim(), password.trim())];
  }
}
