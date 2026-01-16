export class RechargeResponseDTO {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly bank_name: string,
    public readonly transaction_date: Date,
    public readonly receipt_number: string,
    public readonly receipt_image: string,
    public readonly status: string,
    public readonly created_at: Date,
    public readonly admin_comment: string | null,
    public readonly resolved_at: Date | null,
    public readonly user: {
      id: string;
      name: string;
      surname: string;
      email: string;
      whatsapp: string;
    }
  ) {}

  static fromEntity(entity: any): RechargeResponseDTO {
    const {
      id,
      amount,
      bank_name,
      transaction_date,
      receipt_number,
      receipt_image,
      status,
      created_at,
      admin_comment,
      resolved_at,
      user,
    } = entity;

    return new RechargeResponseDTO(
      id,
      amount,
      bank_name,
      new Date(transaction_date),
      receipt_number,
      receipt_image,
      status,
      new Date(created_at),
      admin_comment,
      resolved_at ? new Date(resolved_at) : null,
      {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        whatsapp: user.whatsapp,
      }
    );
  }
}
