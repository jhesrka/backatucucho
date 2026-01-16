export class SendNotificationDTO {
  constructor(
    public readonly id: string,
    public readonly subject: string,
    public readonly message: string,
    public readonly sendEmail: boolean = true // ✅ puedes dejarlo o eliminarlo si siempre será true
  ) {}

  static create(data: any): [string[]?, SendNotificationDTO?] {
    const errors: string[] = [];

    if (!data.id || typeof data.id !== "string" || data.id.trim().length === 0) {
      errors.push("El ID del usuario es obligatorio.");
    }

    if (!data.subject || typeof data.subject !== "string" || data.subject.trim().length < 3) {
      errors.push("El asunto es obligatorio y debe tener al menos 3 caracteres.");
    }

    if (!data.message || typeof data.message !== "string" || data.message.trim().length < 5) {
      errors.push("El mensaje es obligatorio y debe tener al menos 5 caracteres.");
    }

    const sendEmail = data.sendEmail === undefined ? true : Boolean(data.sendEmail);

    if (errors.length > 0) return [errors];

    return [
      undefined,
      new SendNotificationDTO(
        data.id.trim(),
        data.subject.trim(),
        data.message.trim(),
        sendEmail
      ),
    ];
  }
}
