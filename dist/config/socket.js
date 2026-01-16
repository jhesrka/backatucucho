"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.setIO = void 0;
let io;
const setIO = (ioInstance) => {
    io = ioInstance;
};
exports.setIO = setIO;
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io no ha sido inicializado");
    }
    return io;
};
exports.getIO = getIO;
