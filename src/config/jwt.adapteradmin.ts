import jwt from "jsonwebtoken";
import { envs } from "./env";


const JWT_SEED = envs.JWT_SEED;
export class JwtAdapterAdmin {
  static async generateTokenAdmin(payload: any, duration: string = envs.JWT_EXPIRE_IN) {
    return new Promise((resolve) => {
      jwt.sign(payload, JWT_SEED, { expiresIn: duration }, (err, tokenadmin) => {
        if (err) return resolve(null);
        resolve(tokenadmin);
      });
    });
  }
  static async validateTokenAdmin(tokenadmin: string) {
    return new Promise((resolve) => {
      jwt.verify(tokenadmin, JWT_SEED, (err: any, decoded: any) => {
        if (err) return resolve(null);
        resolve(decoded);
      });
    });
  }
}
