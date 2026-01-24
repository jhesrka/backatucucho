import { NextFunction, Request, Response } from "express";
import { Useradmin, Statusadmin, UserRoleAdmin } from "../data";
import { JwtAdapterAdmin } from "../config/jwt.adapteradmin";

export class AuthAdminMiddleware {
  static async protect(req: Request, res: Response, next: NextFunction) {
    const authorization = req.header("Authorization");
    if (!authorization)
      return res.status(401).json({ message: "No Token provided" });
    if (!authorization.startsWith("Bearer "))
      return res.status(401).json({ message: "Invalid token format" });

    const tokenadmin = authorization.split(" ").at(1) || "";

    try {
      const payload = (await JwtAdapterAdmin.validateTokenAdmin(
        tokenadmin
      )) as { id: string };
      if (!payload) return res.status(401).json({ message: "Invalid Token" });

      const useradmin = await Useradmin.findOne({
        where: { id: payload.id, status: Statusadmin.ACTIVE },
      });

      if (!useradmin)
        return res.status(401).json({ message: "Admin no autorizado" });

      (req as any).sessionAdmin = useradmin;
      (req as any).admin = useradmin;
      (req as any).user = useradmin;

      req.body.sessionAdmin = useradmin;
      req.body.admin = useradmin;
      req.body.user = useradmin;
      next();
    } catch (error) {
      // Captura cualquier error de validación JWT
      return res.status(401).json({
        message: "Token inválido o expirado. Inicia sesión nuevamente.",
      });
    }
  }

  static restrictTo = (...roles: UserRoleAdmin[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const useradmin = (req as any).sessionAdmin || req.body.sessionAdmin;
      if (!useradmin || !roles.includes(useradmin.rol)) {
        return res
          .status(403)
          .json({ message: "No tienes permisos como administrador" });
      }
      next();
    };
  };
}
