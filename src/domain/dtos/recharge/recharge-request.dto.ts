import { regularExp } from "../../../config";

export class CreateRechargeRequestDTO {
  private constructor(
    public readonly amount: number,
    public readonly bank_name: string,
    public readonly transaction_date: Date,
    public readonly receipt_number: string,
    public readonly receipt_image: string,
    public readonly userId: string
  ) {}

  static create(object: {
    [key: string]: any;
  }): [string?, CreateRechargeRequestDTO?] {
    const { userId, amount, bank_name, transaction_date, receipt_number } =
      object;

    if (
      !userId ||
      typeof userId !== "string" ||
      !regularExp.uuid.test(userId)
    ) {
      return ["El ID de usuario no es válido"];
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return ["El monto debe ser un número positivo"];
    }

    if (
      !bank_name ||
      typeof bank_name !== "string" ||
      bank_name.trim().length < 2
    ) {
      return ["El nombre del banco debe tener al menos 2 caracteres"];
    }

    if (
      isNaN(new Date(transaction_date).getTime()) ||
      new Date(transaction_date) > new Date()
    ) {
      return ["La fecha de transacción no es válida o es futura"];
    }

    if (!receipt_number || typeof receipt_number !== 'string' || receipt_number.trim().length < 3) {
      return ["El número de comprobante debe tener al menos 3 caracteres"];
    }

    return [
      undefined,
      new CreateRechargeRequestDTO(
        Number(amount),
        bank_name.trim(),
        new Date(transaction_date),
        receipt_number.trim(),
        "",
        userId
      ),
    ];
  }
}
