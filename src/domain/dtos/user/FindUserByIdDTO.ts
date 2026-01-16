import { Status } from "../../../data";


export class FilterUsersByStatusDTO {
  constructor(public readonly status: Status) {}

  static create(data: any): [string[]?, FilterUsersByStatusDTO?] {
    const errors: string[] = [];

    if (!data.status || typeof data.status !== "string") {
      errors.push("El estado es requerido y debe ser un string.");
    } else if (!Object.values(Status).includes(data.status as Status)) {
      errors.push("El estado proporcionado no es válido.");
    }

    return errors.length > 0
      ? [errors]
      : [undefined, new FilterUsersByStatusDTO(data.status as Status)];
  }
}
