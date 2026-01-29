import { regularExp } from "../../../config";

export class ChangePasswordUserDTO {
    constructor(
        public readonly currentPassword: string,
        public readonly newPassword: string,
    ) { }

    static create(object: { [key: string]: any }): [string?, ChangePasswordUserDTO?] {
        const { currentPassword, newPassword, confirmNewPassword } = object;

        if (!currentPassword) return ['La contraseña actual es requerida'];
        if (!newPassword) return ['La nueva contraseña es requerida'];
        if (newPassword !== confirmNewPassword) return ['Las contraseñas no coinciden'];
        if (!regularExp.password.test(newPassword)) {
            return [
                "La nueva contraseña no cumple los requisitos (8 caracteres, mayuscula, minuscula, numero, simbolo)"
            ];
        }

        if (currentPassword === newPassword) return ['La nueva contraseña no puede ser igual a la anterior'];

        return [undefined, new ChangePasswordUserDTO(currentPassword, newPassword)];
    }
}
