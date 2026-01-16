// src/domain/dtos/storie/CreateStorie.dto.ts
import { regularExp } from "../../../config";

export class CreateStorieDTO {
  constructor(
    public readonly description: string,
    public readonly imgstorie: string,
    public readonly userId: string,
    public readonly dias: number
  ) {}

  static create(object: { [key: string]: any }): [string?, CreateStorieDTO?] {
    const { description, userId, dias } = object;

    if (
      !userId ||
      typeof userId !== "string" ||
      !regularExp.uuid.test(userId)
    ) {
      return ["Formato inválido de UUID"];
    }

    if (!description || typeof description !== "string") {
      return ["La descripción es necesaria"];
    }

    const diasNumber = Number(dias);
    if (isNaN(diasNumber) || diasNumber < 1) {
      return ["Debes ingresar al menos 1 día"];
    }
    return [
      undefined,
      new CreateStorieDTO(description, "", userId, diasNumber),
    ];
  }
}
