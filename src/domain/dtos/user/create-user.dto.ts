import { regularExp } from "../../../config";

// src/domain/dtos/user/create-user.dto.ts
export class CreateUserDTO {
  constructor(
    public readonly name: string,
    public readonly surname: string,
    public readonly email: string,
    public readonly password: string,
    public readonly birthday: string, // Fecha como string
    public readonly whatsapp: string,
    public readonly acceptedTerms: boolean,
    public readonly acceptedPrivacy: boolean,
    public photoperfil?: string | null // Eliminar 'readonly' para poder modificarlo
  ) { }

  static create(object: { [key: string]: any }): [string?, CreateUserDTO?] {
    const { name, surname, email, password, birthday, whatsapp, photoperfil, acceptedTerms, acceptedPrivacy } = object;

    if (acceptedTerms !== true && acceptedTerms !== 'true') return ["Debes aceptar los Términos y Condiciones"];
    if (acceptedPrivacy !== true && acceptedPrivacy !== 'true') return ["Debes aceptar las Políticas de Privacidad"];

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
    if (!regularExp.email.test(email)) return ["El formato del correo electrónico no es válido"];

    // Validación de contraseña
    if (!password) return ["La contraseña es obligatoria"];
    if (!regularExp.password.test(password)) {
      return [
        "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo"
      ];
    }

    // Validación de fecha
    if (!birthday) return ["La fecha de nacimiento es obligatoria"];
    if (!regularExp.date.test(birthday)) return ["El formato de la fecha debe ser YYYY-MM-DD"];

    // Validación de WhatsApp
    if (!whatsapp) return ["El número de WhatsApp es obligatorio"];
    if (!regularExp.phone.test(whatsapp)) {
      return ["El número de WhatsApp debe tener exactamente 10 dígitos"];
    }
    return [undefined, new CreateUserDTO(name, surname, email, password, birthday, whatsapp, acceptedTerms, acceptedPrivacy, photoperfil)];
  }
}
