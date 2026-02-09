"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envs = void 0;
require("dotenv/config");
const env_var_1 = require("env-var");
exports.envs = {
    PORT: (0, env_var_1.get)("PORT").required().asPortNumber(),
    DB_HOST: (0, env_var_1.get)("HOST_DATABASE").required().asString(),
    DB_USERNAME: (0, env_var_1.get)("USERNAME_DATABASE").required().asString(),
    DB_PASSWORD: (0, env_var_1.get)("PASSWORD_DATABASE").required().asString(),
    DB_DATABASE: (0, env_var_1.get)("DATABASE").required().asString(),
    DB_PORT: (0, env_var_1.get)("PORT_DATABASE").required().asPortNumber(),
    JWT_SEED: (0, env_var_1.get)("JWT_SEED").required().asString(),
    JWT_EXPIRE_IN: (0, env_var_1.get)("JWT_EXPIRE_IN").required().asString(),
    JWT_REFRESH_EXPIRE_IN: (0, env_var_1.get)("JWT_REFRESH_EXPIRE_IN").default("5d").asString(),
    AWS_ACCESS_KEY_ID: (0, env_var_1.get)("AWS_ACCESS_KEY_ID").required().asString(),
    AWS_SECRET_ACCESS_KEY: (0, env_var_1.get)("AWS_SECRET_ACCESS_KEY").required().asString(),
    AWS_REGION: (0, env_var_1.get)("AWS_REGION").required().asString(),
    AWS_BUCKET_NAME: (0, env_var_1.get)("AWS_BUCKET_NAME").required().asString(),
    SEND_EMAIL: (0, env_var_1.get)("SEND_EMAIL").required().asBool(),
    MAILER_SERVICE: (0, env_var_1.get)("MAILER_SERVICE").required().asString(),
    MAILER_EMAIL: (0, env_var_1.get)("MAILER_EMAIL").required().asString(),
    MAILER_SECRET_KEY: (0, env_var_1.get)("MAILER_SECRET_KEY").required().asString(),
    WEBSERVICE_URL: (0, env_var_1.get)("WEBSERVICE_URL").required().asString(),
    WEBSERVICE_URL_FRONT: (0, env_var_1.get)("WEBSERVICE_URL_FRONT").required().asString(),
    GOOGLE_CLIENT_ID: (0, env_var_1.get)("GOOGLE_CLIENT_ID").required().asString(),
};
