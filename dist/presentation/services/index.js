"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = exports.GlobalSettingsService = exports.EmailService = exports.PriceService = exports.SubscriptionService = exports.FreePostTrackerService = exports.LikeService = exports.RechargeRequestService = exports.UserMotorizadoService = exports.UseradminService = exports.UserService = void 0;
//USUARIO
var user_service_1 = require("./usuario/user.service");
Object.defineProperty(exports, "UserService", { enumerable: true, get: function () { return user_service_1.UserService; } });
//ADMINISTRADOR
var useradmin_service_1 = require("./administradorService/useradmin.service");
Object.defineProperty(exports, "UseradminService", { enumerable: true, get: function () { return useradmin_service_1.UseradminService; } });
//MOTORIZADO
var usermotorizado_service_1 = require("./motorizadoService/usermotorizado.service");
Object.defineProperty(exports, "UserMotorizadoService", { enumerable: true, get: function () { return usermotorizado_service_1.UserMotorizadoService; } });
//RECARGA
var recharge_request_service_1 = require("./recargaService/recharge-request.service");
Object.defineProperty(exports, "RechargeRequestService", { enumerable: true, get: function () { return recharge_request_service_1.RechargeRequestService; } });
//POSTUSUARIO
var like_service_1 = require("./postService/like.service");
Object.defineProperty(exports, "LikeService", { enumerable: true, get: function () { return like_service_1.LikeService; } });
var free_post_tracker_service_1 = require("./postService/free-post-tracker.service");
Object.defineProperty(exports, "FreePostTrackerService", { enumerable: true, get: function () { return free_post_tracker_service_1.FreePostTrackerService; } });
var subscription_service_1 = require("./postService/subscription.service");
Object.defineProperty(exports, "SubscriptionService", { enumerable: true, get: function () { return subscription_service_1.SubscriptionService; } });
//PRECIOS DE LAS APP
var price_service_service_1 = require("./priceService/price-service.service");
Object.defineProperty(exports, "PriceService", { enumerable: true, get: function () { return price_service_service_1.PriceService; } });
//GENERAL
var email_service_1 = require("./email.service");
Object.defineProperty(exports, "EmailService", { enumerable: true, get: function () { return email_service_1.EmailService; } });
var global_settings_service_1 = require("./globalSettings/global-settings.service");
Object.defineProperty(exports, "GlobalSettingsService", { enumerable: true, get: function () { return global_settings_service_1.GlobalSettingsService; } });
var ocr_service_1 = require("./ocr/ocr.service");
Object.defineProperty(exports, "OcrService", { enumerable: true, get: function () { return ocr_service_1.OcrService; } });
