"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserMotorizadoRoutes = exports.UseradminRoutes = exports.UserRoutes = void 0;
//USUARIO
var user_routes_1 = require("./usuarioController/user.routes");
Object.defineProperty(exports, "UserRoutes", { enumerable: true, get: function () { return user_routes_1.UserRoutes; } });
//ADMINISTRADOR
var useradmin_routes_1 = require("./administradorController/useradmin/useradmin.routes");
Object.defineProperty(exports, "UseradminRoutes", { enumerable: true, get: function () { return useradmin_routes_1.UseradminRoutes; } });
//MOTORIZADO
var usermotorizado_routes_1 = require("./motorizadoController/usermotorizado.routes");
Object.defineProperty(exports, "UserMotorizadoRoutes", { enumerable: true, get: function () { return usermotorizado_routes_1.UserMotorizadoRoutes; } });
