"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchUserDTO = void 0;
class SearchUserDTO {
    constructor(query) {
        this.query = query;
    }
    static create(data) {
        var _a;
        const query = ((_a = data.query) === null || _a === void 0 ? void 0 : _a.trim()) || "";
        if (query.length === 0) {
            return [undefined, new SearchUserDTO("")];
        }
        return [undefined, new SearchUserDTO(query)];
    }
}
exports.SearchUserDTO = SearchUserDTO;
