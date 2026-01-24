import { regularExp } from "../../../../config";

export class CreateMotorizadoDTO {
  constructor(
    public readonly name: string,
    public readonly surname: string,
    public readonly whatsapp: string,
    public readonly cedula: number,
    public readonly password?: string,
  ) { }

  static create(object: {
    [key: string]: any;
  }): [string?, CreateMotorizadoDTO?] {
    const { name, surname, password, whatsapp, cedula } = object;

    // Validación de nombre
    if (!name || name.trim().length < 2) {
      return ["El nombre es obligatorio y debe tener al menos 2 caracteres"];
    }

    // Validación de apellido
    if (!surname || surname.trim().length < 2) {
      return ["El apellido es obligatorio y debe tener al menos 2 caracteres"];
    }

    // Validación de contraseña (Opcional)
    if (password) {
      if (!regularExp.password.test(password)) {
        return [
          "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo",
        ];
      }
    }

    // Validación de WhatsApp
    if (!whatsapp) return ["El número de WhatsApp es obligatorio"];
    if (!regularExp.phone.test(whatsapp)) {
      return ["El número de WhatsApp debe tener exactamente 10 dígitos"];
    }

    // Validación de cédula
    if (!cedula && cedula !== 0) return ["La cédula es obligatoria"];
    if (!regularExp.cedula.test(cedula.toString())) {
      return ["La cédula debe tener exactamente 10 dígitos"];
    }

    return [undefined, new CreateMotorizadoDTO(name, surname, whatsapp, cedula, password)];
  }
}
