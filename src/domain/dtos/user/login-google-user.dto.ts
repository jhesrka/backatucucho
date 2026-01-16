
export class LoginGoogleUserDTO {
    private constructor(public readonly token: string) { }

    static create(object: { [key: string]: any }): [string?, LoginGoogleUserDTO?] {
        const { token } = object;

        if (!token) return ["El token de Google es obligatorio"];

        return [undefined, new LoginGoogleUserDTO(token)];
    }
}
