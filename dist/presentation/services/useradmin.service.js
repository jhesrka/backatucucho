"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseradminService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
class UseradminService {
    createUseradmin(useradminData) {
        return __awaiter(this, void 0, void 0, function* () {
            const useradmin = new data_1.Useradmin();
            useradmin.username = useradminData.username.toLocaleLowerCase().trim();
            useradmin.name = useradminData.name.toLocaleLowerCase().trim();
            useradmin.surname = useradminData.surname.toLocaleLowerCase().trim();
            useradmin.email = useradminData.email.toLocaleLowerCase().trim();
            useradmin.password = useradminData.password;
            useradmin.whatsapp = useradminData.whatsapp.trim();
            try {
                const newUseradmin = yield useradmin.save();
                return {
                    id: newUseradmin.id,
                    username: newUseradmin.username,
                    name: newUseradmin.name,
                    surname: newUseradmin.surname,
                    email: newUseradmin.email,
                    whatsapp: newUseradmin.whatsapp,
                    create_at: newUseradmin.created_at,
                    update_at: newUseradmin.updated_at,
                    rol: newUseradmin.rol,
                    status: newUseradmin.status,
                };
            }
            catch (error) {
                if (error.code === "23505") {
                    throw domain_1.CustomError.badRequest(`Correo:${useradminData.email} o Whatsapp:${useradminData.whatsapp} ya existen`);
                }
                throw domain_1.CustomError.internalServer("Error creando el Usuario");
            }
        });
    }
    findAllUsersadmin() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const usersadmin = yield data_1.Useradmin.find();
                return usersadmin.map((useradmin) => ({
                    id: useradmin.id,
                    username: useradmin.username,
                    name: useradmin.name,
                    surname: useradmin.surname,
                    email: useradmin.email,
                    whatsapp: useradmin.whatsapp,
                    created_at: useradmin.created_at,
                    update_at: useradmin.updated_at,
                    rol: useradmin.rol,
                    status: useradmin.status,
                }));
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error obteniendo usuarios administradores");
            }
        });
    }
}
exports.UseradminService = UseradminService;
