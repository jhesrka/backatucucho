export class DeleteUserDTO {
  constructor(public readonly id: string) {}

  static create(data: any): [string[]?, DeleteUserDTO?] {
    const errors: string[] = [];

    if (!data.id || typeof data.id !== "string") {
      errors.push("El ID es requerido y debe ser un string.");
    }

    return errors.length > 0 ? [errors] : [undefined, new DeleteUserDTO(data.id)];
  }
}
