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
require("reflect-metadata"); // esto si bien instalamos depues siempre debe ir primero
const config_1 = require("./config");
const data_1 = require("./data");
const routes_1 = require("./presentation/routes");
const server_1 = require("./presentation/server");
require("dotenv/config");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const postgres = new data_1.PostgresDatabase({
            username: config_1.envs.DB_USERNAME,
            password: config_1.envs.DB_PASSWORD,
            host: config_1.envs.DB_HOST,
            database: config_1.envs.DB_DATABASE,
            port: config_1.envs.DB_PORT
        });
        yield postgres.connect();
        const server = new server_1.Server({
            port: config_1.envs.PORT,
            routes: routes_1.AppRoutes.routes //este viene de un metodo estatico por es no ponemos new
        });
        yield server.start();
    });
}
main();
