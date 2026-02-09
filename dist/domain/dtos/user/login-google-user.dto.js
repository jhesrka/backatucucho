"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginGoogleUserDTO = void 0;
class LoginGoogleUserDTO {
    constructor(token) {
        this.token = token;
    }
    static create(object) {
        const { token } = object;
        if (!token)
            return ["El token de Google es obligatorio"];
        return [undefined, new LoginGoogleUserDTO(token)];
    }
}
exports.LoginGoogleUserDTO = LoginGoogleUserDTO;
