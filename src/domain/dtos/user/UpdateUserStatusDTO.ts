import { Status } from "../../../data";


export class UpdateUserStatusDTO {
  constructor(public readonly id: string, public readonly status: Status) {}

  static create(data: any): [string[]?, UpdateUserStatusDTO?] {
    const errors: string[] = [];

    if (!data.id || typeof data.id !== "string") {
      errors.push("El ID es requerido y debe ser un string.");
    }

    if (!Object.values(Status).includes(data.status)) {
      errors.push("El estado no es válido.");
    }

    return errors.length > 0 ? [errors] : [undefined, new UpdateUserStatusDTO(data.id, data.status)];
  }
}
