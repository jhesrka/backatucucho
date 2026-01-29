export class CustomError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "CustomError";
    Object.setPrototypeOf(this, CustomError.prototype); // Necesario para instanceof
  }

  static badRequest(message: string) {
    return new CustomError(400, message);
  }

  static unAuthorized(message: string) {
    return new CustomError(401, message);
  }

  static forbiden(message: string) {
    return new CustomError(403, message);
  }

  static notFound(message: string) {
    return new CustomError(404, message);
  }
  static conflict(message: string) {
    // ⚠️ NUEVO MÉTODO PARA CONFLICTOS DE DUPLICADO
    return new CustomError(409, message);
  }

  static internalServer(message: string) {
    return new CustomError(500, message);
  }

  static serviceUnavailable(message: string) {
    return new CustomError(503, message);
  }
}
