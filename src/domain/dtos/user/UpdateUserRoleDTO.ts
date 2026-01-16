import { UserRole } from "../../../data";

export class UpdateUserRoleDTO {
  constructor(public readonly id: string, public readonly rol: UserRole) {}

  static create(data: any): [string[]?, UpdateUserRoleDTO?] {
    const errors: string[] = [];

    if (!data.id || typeof data.id !== "string") {
      errors.push("El ID es requerido y debe ser un string.");
    }

    if (!Object.values(UserRole).includes(data.rol)) {
      errors.push("El rol no es válido.");
    }

    return errors.length > 0 ? [errors] : [undefined, new UpdateUserRoleDTO(data.id, data.rol)];
  }
}
