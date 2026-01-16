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
        return (0, bcryptjs_1.compareSync)(unHashedPassword, hashedPassword);
    },
};
