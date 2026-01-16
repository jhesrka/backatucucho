import jwt from "jsonwebtoken";
import { envs } from "./env";

const JWT_SEED = envs.JWT_SEED;
export class JwtAdapterMotorizado {
  static async generateTokenMotorizado(payload: any, duration: string = envs.JWT_EXPIRE_IN) {
    return new Promise((resolve) => {
      jwt.sign(
        payload,
        JWT_SEED,
        { expiresIn: duration },
        (err, tokenmotorizado) => {
          if (err) return resolve(null);
          resolve(tokenmotorizado);
        }
      );
    });
  }
  static async validateTokenMotorizado(tokenmotorizado: string) {
    return new Promise((resolve) => {
      jwt.verify(tokenmotorizado, JWT_SEED, (err: any, decoded: any) => {
        if (err) return resolve(null);
        resolve(decoded);
      });
    });
  }
}
