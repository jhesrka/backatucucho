// src/domain/dtos/user/update-user.dto.ts

export class UpdateUserDTO {
  constructor(
    public readonly name?: string,
    public readonly surname?: string,
    public readonly birthday?: string, // Fecha como string
    public readonly photoperfil?: string // Es opcional
  ) {}

  static create(object: { [key: string]: any }): [string?, UpdateUserDTO?] {
    const { name, surname, birthday, photoperfil } = object;

    if (
      name === undefined &&
      surname === undefined &&
      birthday === undefined &&
      photoperfil === undefined
    ) {
      return ["No se proporcionaron datos válidos para actualizar"];
    }

    return [undefined, new UpdateUserDTO(name, surname, birthday, photoperfil)];
  }
}
