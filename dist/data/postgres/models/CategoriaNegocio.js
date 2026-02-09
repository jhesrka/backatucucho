"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriaNegocio = exports.RestriccionModeloMonetizacion = exports.StatusCategoria = void 0;
const typeorm_1 = require("typeorm");
const Negocio_1 = require("./Negocio");
var StatusCategoria;
(function (StatusCategoria) {
    StatusCategoria["ACTIVO"] = "ACTIVO";
    StatusCategoria["SUSPENDIDO"] = "SUSPENDIDO";
})(StatusCategoria || (exports.StatusCategoria = StatusCategoria = {}));
var RestriccionModeloMonetizacion;
(function (RestriccionModeloMonetizacion) {
    RestriccionModeloMonetizacion["COMISION_SUSCRIPCION"] = "COMISION_SUSCRIPCION";
    RestriccionModeloMonetizacion["SUSCRIPCION"] = "SUSCRIPCION";
})(RestriccionModeloMonetizacion || (exports.RestriccionModeloMonetizacion = RestriccionModeloMonetizacion = {}));
let CategoriaNegocio = class CategoriaNegocio extends typeorm_1.BaseEntity {
};
exports.CategoriaNegocio = CategoriaNegocio;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], CategoriaNegocio.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: false, length: 100, unique: true }),
    __metadata("design:type", String)
], CategoriaNegocio.prototype, "nombre", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: false }),
    __metadata("design:type", String)
], CategoriaNegocio.prototype, "icono", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: StatusCategoria,
        default: StatusCategoria.ACTIVO,
    }),
    __metadata("design:type", String)
], CategoriaNegocio.prototype, "statusCategoria", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: RestriccionModeloMonetizacion,
        nullable: true,
        default: null,
    }),
    __metadata("design:type", Object)
], CategoriaNegocio.prototype, "restriccionModeloMonetizacion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], CategoriaNegocio.prototype, "soloComision", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CategoriaNegocio.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CategoriaNegocio.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Negocio_1.Negocio, (negocio) => negocio.categoria),
    __metadata("design:type", Array)
], CategoriaNegocio.prototype, "negocios", void 0);
exports.CategoriaNegocio = CategoriaNegocio = __decorate([
    (0, typeorm_1.Entity)()
], CategoriaNegocio);
