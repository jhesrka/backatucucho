"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateWalletDTO = void 0;
const config_1 = require("../../../config");
class CreateWalletDTO {
    constructor(balance, userId) {
        this.balance = balance;
        this.userId = userId;
    }
    static create(object) {
        const { balance, userId } = object;
        if (typeof balance !== "number" || balance < 0) {
            return ["El saldo debe ser un número positivo o cero"];
        }
        if (!userId || typeof userId !== "string" || !config_1.regularExp.uuid.test(userId)) {
            return ["Formato inválido de UUID para el usuario"];
        }
        return [undefined, new CreateWalletDTO(balance, userId)];
    }
}
exports.CreateWalletDTO = CreateWalletDTO;
