import { NextFunction, Request, Response } from "express";
import { JwtAdapter } from "../config";
import { Status, User, UserRole } from "../data";

export class AuthMiddleware {
  static async protect(req: Request, res: Response, next: NextFunction) {
    const authorization = req.header("Authorization");

    if (!authorization)
      return res
        .status(401)
        .json({ message: "Token no proporcionado o inválido" });

    if (!authorization.startsWith("Bearer "))
      return res
        .status(401)
        .json({ message: "Token no proporcionado o inválido" });

    const token = authorization.split(" ").at(1) || "";

    try {
      const payload = (await JwtAdapter.validateToken(token)) as { id: string };
      if (!payload) {
        return res.status(401).json({
          message: "Token expirado. Por favor inicia sesión nuevamente.",
        });
      }

      const user = await User.findOne({
        where: {
          id: payload.id,
          status: Status.ACTIVE,
        },
      });
      if (!user)
        return res
          .status(401)
          .json({ message: "Usuario no válido o inactivo" });

      // Validar sesión única (backend restriction)
      if (user.currentSessionId && user.currentSessionId !== token) {
        return res.status(401).json({
          message: "Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo",
        });
      }

      req.body.sessionUser = user;
      next();
    } catch (error) {
      // Si el token es inválido o expirado, esto lo atrapará
      return res
        .status(401)
        .json({
          message: "Token inválido o expirado. Inicia sesión nuevamente.",
        });
    }
  }
  static restrictTo = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!roles.includes(req.body.sessionUser.rol)) {
        return res
          .status(403)
          .json({ message: "No tienes permiso para acceder a esta ruta" });
      }
      next();
    };
  };
}
