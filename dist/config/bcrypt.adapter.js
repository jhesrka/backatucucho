"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encriptAdapter = void 0;
const bcryptjs_1 = require("bcryptjs");
exports.encriptAdapter = {
    hash: (password) => {
        const salt = (0, bcryptjs_1.genSaltSync)(12);
        return (0, bcryptjs_1.hashSync)(password, salt);
    },
    compare: (unHashedPassword, hashedPassword) => {
        try {
            if (typeof unHashedPassword !== 'string' || typeof hashedPassword !== 'string') {
                console.error('Bcrypt Error: Invalid arguments. Both must be strings.');
                return false;
            }
            return (0, bcryptjs_1.compareSync)(unHashedPassword, hashedPassword);
        }
        catch (error) {
            console.error('Bcrypt Error:', error);
            return false;
        }
    },
};
