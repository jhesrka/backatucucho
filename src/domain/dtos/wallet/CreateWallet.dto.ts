import { regularExp } from "../../../config";

export class CreateWalletDTO {
  constructor(
    public readonly balance: number,
    public readonly userId: string
  ) {}

  static create(object: { [key: string]: any }): [string?, CreateWalletDTO?] {
    const { balance, userId } = object;

    if (typeof balance !== "number" || balance < 0) {
      return ["El saldo debe ser un número positivo o cero"];
    }

    if (!userId || typeof userId !== "string" || !regularExp.uuid.test(userId)) {
      return ["Formato inválido de UUID para el usuario"];
    }

    return [undefined, new CreateWalletDTO(balance, userId)];
  }
}
