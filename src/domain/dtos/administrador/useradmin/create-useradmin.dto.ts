import { regularExp } from "../../../../config";
import { UserRoleAdmin } from "../../../../data";

export class CreateUseradminDTO {
  constructor(
    public readonly username: string,
    public readonly name: string,
    public readonly surname: string,
    public readonly email: string,
    public readonly password: string,
    public readonly whatsapp: string,
    public readonly rol: UserRoleAdmin
  ) {}
  static create(object: {
    [key: string]: any;
  }): [string?, CreateUseradminDTO?] {
    const { username, name, surname, email, password, whatsapp, rol } = object;
    if (!username || username.trim().length < 2) {
      return ["El usuario es obligatorio y debe tener al menos 2 caracteres"];
    }
    // Validación de nombre
    if (!name || name.trim().length < 2) {
      return ["El nombre es obligatorio y debe tener al menos 2 caracteres"];
    }

    // Validación de apellido
    if (!surname || surname.trim().length < 2) {
      return ["El apellido es obligatorio y debe tener al menos 2 caracteres"];
    }

    // Validación de email
    if (!email) return ["El correo electrónico es obligatorio"];
    if (!regularExp.email.test(email))
      return ["El formato del correo electrónico no es válido"];

    // Validación de contraseña
    if (!password) return ["La contraseña es obligatoria"];
    if (!regularExp.password.test(password)) {
      return [
        "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo",
      ];
    }

    // Validación de WhatsApp
    if (!whatsapp) return ["El número de WhatsApp es obligatorio"];
    if (!regularExp.phone.test(whatsapp)) {
      return ["El número de WhatsApp debe tener exactamente 10 dígitos"];
    }
    if (!rol) return ["El rol es obligatorio"];
    return [
      undefined,
      new CreateUseradminDTO(
        username,
        name,
        surname,
        email,
        password,
        whatsapp,
        rol
      ),
    ];
  }
}
