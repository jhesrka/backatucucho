import { regularExp } from "../../../../config";

export class LoginAdminUserDTO {
  constructor(
    public readonly username: string,
    public readonly password: string
  ) {}

  static create(object: { [key: string]: any }): [string[]?, LoginAdminUserDTO?] {
    const { username, password } = object;
    const errors: string[] = [];

    // Validaciones internas, pero sin detallar al usuario
    const isUsernameValid = typeof username === "string" && username.trim().length >= 4;
    const isPasswordValid = typeof password === "string" && regularExp.password.test(password.trim());

    if (!isUsernameValid || !isPasswordValid) {
      errors.push("Credenciales inválidas"); // Mensaje genérico
      return [errors];
    }

    return [undefined, new LoginAdminUserDTO(username.trim(), password.trim())];
  }
}
