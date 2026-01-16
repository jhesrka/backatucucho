"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectAccountOwner = void 0;
const protectAccountOwner = (ownerUserId, sessionUserId) => {
    if (ownerUserId !== sessionUserId) {
        return false;
    }
    return true;
};
exports.protectAccountOwner = protectAccountOwner;
