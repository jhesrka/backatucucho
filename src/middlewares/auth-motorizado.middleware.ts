import { NextFunction, Request, Response } from "express";
import { UserMotorizado, EstadoCuentaMotorizado } from "../data";
import { JwtAdapterMotorizado } from "../config";

export class AuthMotorizadoMiddleware {
  static async protect(req: Request, res: Response, next: NextFunction) {
    const authorization = req.header("Authorization");

    if (!authorization) {
      return res.status(401).json({ message: "No token provided" });
    }

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    const token = authorization.split(" ")[1];

    try {
      // 🔐 Validar JWT
      const payload = (await JwtAdapterMotorizado.validateTokenMotorizado(
        token
      )) as { id: string; tokenVersion?: number };

      if (!payload?.id) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // 🔎 Buscar motorizado activo
      const motorizado = await UserMotorizado.findOne({
        where: {
          id: payload.id,
          estadoCuenta: EstadoCuentaMotorizado.ACTIVO,
        },
      });

      if (!motorizado) {
        return res.status(401).json({ message: "Motorizado no autorizado" });
      }

      // 🔒 VALIDACIÓN CLAVE: tokenVersion (logout real)
      if (
        payload.tokenVersion !== undefined &&
        payload.tokenVersion !== motorizado.tokenVersion
      ) {
        return res.status(401).json({ message: "Sesión inválida" });
      }

      // ✅ Mantener compatibilidad con tu sistema actual
      req.body.sessionMotorizado = motorizado;

      next();
    } catch (error) {
      return res.status(401).json({ message: "Token inválido o expirado" });
    }
  }
}
