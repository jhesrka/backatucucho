"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchUserDTO = void 0;
class SearchUserDTO {
    constructor(query, status, date) {
        this.query = query;
        this.status = status;
        this.date = date;
    }
    static create(data) {
        var _a;
        const query = ((_a = data.query) === null || _a === void 0 ? void 0 : _a.trim()) || "";
        const status = data.status && data.status !== 'ALL' ? data.status : undefined;
        const date = data.date && data.date !== '' ? data.date : undefined;
        if (query.length === 0 && !date && !status) {
            return [undefined, new SearchUserDTO("", status, date)];
        }
        return [undefined, new SearchUserDTO(query, status, date)];
    }
}
exports.SearchUserDTO = SearchUserDTO;
