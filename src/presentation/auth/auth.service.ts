import { JwtAdapter, encriptAdapter, envs } from "../../config";
import {
    User,
    Useradmin,
    UserMotorizado,
    Status,
    Statusadmin,
    EstadoCuentaMotorizado
} from "../../data";
import { CustomError } from "../../domain";

export class AuthService {
    constructor() { }

    async refreshToken(refreshToken: string) {
        if (!refreshToken) throw CustomError.badRequest("Refresh token is required");

        // 1. Validar el token usando el adaptador genérico (misma SEED para todos)
        const payload: any = await JwtAdapter.validateToken(refreshToken);
        if (!payload || !payload.id || !payload.role) {
            throw CustomError.unAuthorized("Invalid or expired refresh token");
        }

        const { id, role } = payload;
        let user: any = null;
        let isActive = false;

        // 2. Verificar usuario según el rol
        switch (role) {
            case "USER":
                user = await User.findOne({ where: { id } });
                isActive = user && user.status === Status.ACTIVE;
                break;
            case "ADMIN":
                user = await Useradmin.findOne({ where: { id } });
                isActive = user && user.status === Statusadmin.ACTIVE;
                break;
            case "MOTORIZADO":
                user = await UserMotorizado.findOne({ where: { id } });
                isActive = user && user.estadoCuenta === EstadoCuentaMotorizado.ACTIVO;
                break;
            default:
                throw CustomError.unAuthorized("Invalid role in token");
        }

        if (!user) throw CustomError.notFound("User not found");
        if (!isActive) throw CustomError.unAuthorized("User is inactive or blocked");

        // Validar tokenVersion para asegurar que el refresh token pertenece a la sesión actual
        if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
            throw CustomError.unAuthorized("Invalid session. Please login again.");
        }

        user.tokenVersion += 1;
        await user.save();

        // 3. Generar nuevos tokens (Rotación de Refresh Token)
        const newAccessToken = await JwtAdapter.generateToken(
            { id: user.id, role, tokenVersion: user.tokenVersion },
            envs.JWT_EXPIRE_IN
        );

        const newRefreshToken = await JwtAdapter.generateToken(
            { id: user.id, role, tokenVersion: user.tokenVersion },
            envs.JWT_REFRESH_EXPIRE_IN
        );

        if (!newAccessToken || !newRefreshToken) throw CustomError.internalServer("Error allocating tokens");

        // Sesión gestionada a través de tokenVersion (ya incrementado y guardado arriba)

        // 4. Retornar
        return {
            token: newAccessToken,
            refreshToken: newRefreshToken,
            role
        };
    }
}
