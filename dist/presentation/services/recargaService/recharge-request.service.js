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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RechargeRequestService = void 0;
const data_1 = require("../../../data");
const global_settings_model_1 = require("../../../data/postgres/models/global-settings.model");
const FinancialClosing_1 = require("../../../data/postgres/models/financial/FinancialClosing"); // Check path correctness
const upload_files_cloud_adapter_1 = require("../../../config/upload-files-cloud-adapter");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../../../config");
const domain_1 = require("../../../domain");
const ocr_service_1 = require("../ocr/ocr.service"); // Added
const json2csv_1 = require("json2csv");
const typeorm_1 = require("typeorm");
const socket_1 = require("../../../config/socket");
class RechargeRequestService {
    constructor(userService) {
        this.userService = userService;
        this.ocrService = new ocr_service_1.OcrService();
    }
    //USUARIO
    // ANALISIS OCR
    analyzeReceipt(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw domain_1.CustomError.badRequest("Imagen requerida");
            return this.ocrService.processImage(file.buffer);
        });
    }
    //CREAR UNA RECARGA
    createRecharge(rechargeData, file) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // 1. DUPLICATE CHECK (LOGICAL)
            const { bank_name, receipt_number, transaction_date, force, requiresManualReview } = rechargeData;
            let existingPending = null;
            // Only check duplicates if we have complete data
            if (bank_name && receipt_number && transaction_date) {
                // A. Check Strictly Approved (BLOCKING)
                const existingApproved = yield data_1.RechargeRequest.findOne({
                    where: {
                        bank_name,
                        receipt_number,
                        transaction_date,
                        status: data_1.StatusRecarga.APROBADO
                    }
                });
                if (existingApproved) {
                    if (!force && !requiresManualReview) {
                        throw domain_1.CustomError.conflict("DUPLICATE_APPROVED");
                    }
                }
                existingPending = yield data_1.RechargeRequest.findOne({
                    where: {
                        bank_name,
                        receipt_number,
                        transaction_date,
                        status: data_1.StatusRecarga.PENDIENTE
                    }
                });
            }
            // B. Check Pending/Duplicate (WARNING)
            if (existingPending) {
                // If force is false AND manual review is false, we block.
                // If manual review is true, we assume user overrides everything (including potential duplicates) or duplicate check is partial.
                if (!force && !requiresManualReview) {
                    throw domain_1.CustomError.conflict("POSSIBLE_DUPLICATE");
                }
            }
            if (!file) {
                throw domain_1.CustomError.badRequest("El comprobante de banco es obligatorio");
            }
            const recharge = new data_1.RechargeRequest();
            let key;
            let url;
            const user = yield this.userService.findOneUser(rechargeData.userId);
            try {
                key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `recharge/${Date.now()}-${file.originalname}`,
                    body: file.buffer,
                    contentType: file.mimetype,
                    isReceipt: true,
                });
                recharge.receipt_image = key;
                url = (yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key,
                }));
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error subiendo la imagen del comprobante de banco");
            }
            recharge.amount = (_a = rechargeData.amount) !== null && _a !== void 0 ? _a : null;
            recharge.bank_name = (_b = rechargeData.bank_name) !== null && _b !== void 0 ? _b : null;
            recharge.transaction_date = (_c = rechargeData.transaction_date) !== null && _c !== void 0 ? _c : null;
            recharge.receipt_number = (_d = rechargeData.receipt_number) !== null && _d !== void 0 ? _d : null;
            recharge.user = user;
            recharge.requiresManualReview = !!requiresManualReview;
            recharge.isDuplicateWarning = (!!existingPending && !!force);
            try {
                const savedRecharge = yield recharge.save();
                savedRecharge.receipt_image = url;
                // ✅ NUEVO: Crear Transacción PENDIENTE para que aparezca en el historial unificado (Movimientos)
                // Solo si es una recarga válida (tiene monto > 0 visualmente), aunque sea pendiente
                // El saldo NO cambia (previous = resulting)
                if (recharge.amount && recharge.amount > 0) {
                    const wallet = yield data_1.Wallet.findOne({ where: { user: { id: user.id } } });
                    if (wallet) {
                        const transaction = new data_1.Transaction();
                        transaction.wallet = wallet;
                        transaction.amount = recharge.amount;
                        transaction.type = 'credit'; // Recarga es un ingreso
                        transaction.reason = data_1.TransactionReason.RECHARGE;
                        transaction.origin = data_1.TransactionOrigin.USER;
                        transaction.status = 'PENDING';
                        transaction.observation = `Solicitud de Recarga - Banco: ${recharge.bank_name}`;
                        transaction.reference = savedRecharge.id; // Vinculamos con la solicitud
                        transaction.receipt_image = savedRecharge.receipt_image; // Guardamos el key de la imagen
                        transaction.previousBalance = Number(wallet.balance);
                        transaction.resultingBalance = Number(wallet.balance); // Sin cambios aún
                        yield transaction.save();
                    }
                }
                // Emitir evento socket en tiempo real
                try {
                    const io = (0, socket_1.getIO)();
                    // Estructuramos el objeto tal cual lo espera el frontend
                    const socketPayload = Object.assign(Object.assign({}, savedRecharge), { isDuplicateWarning: savedRecharge.isDuplicateWarning, user: {
                            id: user.id,
                            name: user.name,
                            surname: user.surname,
                            email: user.email,
                            whatsapp: user.whatsapp,
                            photoperfil: user.photoperfil,
                            status: user.status
                        }, receiptImage: url.original });
                    io.emit("new-recharge-request", socketPayload);
                }
                catch (error) {
                    console.error("Error emitiendo socket recarga", error);
                }
                return savedRecharge;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error creando la solicitud de recarga");
            }
        });
    }
    //OBTENER RECARGAS POR USUARIO ID CON PAGINACION 3
    getByUser(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1) {
            const take = 3;
            const skip = (page - 1) * take;
            const [requests, total] = yield data_1.RechargeRequest.findAndCount({
                where: { user: { id: userId } },
                relations: ["user"],
                order: { created_at: "DESC" },
                take,
                skip,
            });
            const data = yield Promise.all(requests.map((req) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: req.receipt_image,
                });
                return {
                    id: req.id,
                    amount: req.amount,
                    bank_name: req.bank_name,
                    transaction_date: req.transaction_date,
                    receipt_number: req.receipt_number,
                    status: req.status,
                    requiresManualReview: req.requiresManualReview,
                    admin_comment: req.admin_comment,
                    created_at: req.created_at,
                    resolved_at: req.resolved_at,
                    receiptImage: imageUrl,
                };
            })));
            return {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / take),
                data,
            };
        });
    }
    //Filtrar por estado
    filterByStatus(status_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (status, userId, // Hacer el userId opcional para mantener compatibilidad
        page = 1, itemsPerPage = 3) {
            const skip = (page - 1) * itemsPerPage;
            // Crear objeto where dinámico
            const where = { status };
            // Si se proporciona userId, filtrar también por usuario
            if (userId) {
                where.user = { id: userId };
            }
            const [requests, total] = yield data_1.RechargeRequest.findAndCount({
                where,
                relations: ["user"],
                order: { created_at: "DESC" },
                skip,
                take: itemsPerPage,
            });
            // Optimización: Obtener todas las imágenes en paralelo
            const data = yield Promise.all(requests.map((r) => __awaiter(this, void 0, void 0, function* () {
                const [imageUrl, photoUrl] = yield Promise.all([
                    upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: r.receipt_image,
                    }),
                    r.user.photoperfil
                        ? upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: r.user.photoperfil,
                        })
                        : Promise.resolve(null),
                ]);
                return {
                    id: r.id,
                    amount: Number(r.amount),
                    bank_name: r.bank_name,
                    transaction_date: r.transaction_date,
                    receipt_number: r.receipt_number,
                    status: r.status,
                    requiresManualReview: r.requiresManualReview,
                    admin_comment: r.admin_comment,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                    receiptImage: imageUrl,
                    user: {
                        id: r.user.id,
                        name: r.user.name,
                        surname: r.user.surname,
                        email: r.user.email,
                        photoperfil: photoUrl,
                        whatsapp: r.user.whatsapp,
                        status: r.user.status,
                    },
                };
            })));
            return {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / itemsPerPage),
                data,
            };
        });
    }
    //Filtrar por rango de fechas
    filterByDateRangeForUser(userId_1, startDate_1, endDate_1) {
        return __awaiter(this, arguments, void 0, function* (userId, startDate, endDate, page = 1, itemsPerPage = 9) {
            // Ajustar las fechas para reflejar correctamente el rango en UTC-5 (Ecuador)
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0); // 00:00 en Ecuador es 05:00 UTC
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999); // 23:59 en Ecuador es 04:59 UTC del día siguiente
            const [userRequests, total] = yield data_1.RechargeRequest.findAndCount({
                where: {
                    user: { id: userId }, // Filtro por usuario
                    created_at: (0, typeorm_1.Between)(start, end), // Filtro por rango de fechas
                },
                relations: ["user"],
                order: { created_at: "DESC" },
                skip: (page - 1) * itemsPerPage,
                take: itemsPerPage,
            });
            const data = yield Promise.all(userRequests.map((r) => __awaiter(this, void 0, void 0, function* () {
                const [imageUrl, photoUrl] = yield Promise.all([
                    upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: r.receipt_image,
                    }),
                    upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: r.user.photoperfil,
                    }),
                ]);
                return {
                    id: r.id,
                    amount: Number(r.amount),
                    bank_name: r.bank_name,
                    transaction_date: r.transaction_date,
                    receipt_number: r.receipt_number,
                    status: r.status,
                    requiresManualReview: r.requiresManualReview,
                    admin_comment: r.admin_comment,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                    receiptImage: imageUrl,
                    user: {
                        id: r.user.id,
                        name: r.user.name,
                        surname: r.user.surname,
                        email: r.user.email,
                        photoperfil: photoUrl,
                        whatsapp: r.user.whatsapp,
                        status: r.user.status,
                    },
                };
            })));
            return {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / itemsPerPage),
                data,
            };
        });
    }
    //ADMINISTRADOR
    //1 Obtener todas las recargas con paginación (para admins)
    getAllRequestsPaginated() {
        return __awaiter(this, arguments, void 0, function* (page = 1) {
            const take = 10;
            const skip = (page - 1) * take;
            const [requests, total] = yield data_1.RechargeRequest.findAndCount({
                relations: ["user"],
                order: { created_at: "DESC" },
                skip,
                take,
            });
            const data = yield Promise.all(requests.map((r) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.receipt_image,
                });
                const photoUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.user.photoperfil,
                });
                return {
                    id: r.id,
                    amount: Number(r.amount),
                    bank_name: r.bank_name,
                    transaction_date: r.transaction_date,
                    receipt_number: r.receipt_number,
                    status: r.status,
                    requiresManualReview: r.requiresManualReview,
                    admin_comment: r.admin_comment,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                    receiptImage: imageUrl,
                    user: {
                        id: r.user.id,
                        name: r.user.name,
                        surname: r.user.surname,
                        email: r.user.email,
                        photoperfil: photoUrl,
                        whatsapp: r.user.whatsapp,
                        status: r.user.status,
                    },
                };
            })));
            return {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / take),
                data,
            };
        });
    }
    //2 Buscar por nombre de banco, ID, monto o comprobante
    searchRechargeRequests(term) {
        return __awaiter(this, void 0, void 0, function* () {
            const allRequests = yield data_1.RechargeRequest.find({
                relations: ["user"],
                order: { created_at: "DESC" },
            });
            const termLower = term.toLowerCase();
            const filtered = allRequests.filter((r) => {
                var _a, _b;
                const bank = ((_a = r.bank_name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "";
                const receipt = r.receipt_number || "";
                const amountStr = ((_b = r.amount) === null || _b === void 0 ? void 0 : _b.toString()) || "";
                return (bank.includes(termLower) ||
                    r.id === term ||
                    receipt === term ||
                    amountStr.includes(term));
            });
            return yield Promise.all(filtered.map((r) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.receipt_image,
                });
                const photoUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.user.photoperfil,
                });
                return {
                    id: r.id,
                    amount: Number(r.amount),
                    bank_name: r.bank_name,
                    transaction_date: r.transaction_date,
                    receipt_number: r.receipt_number,
                    status: r.status,
                    requiresManualReview: r.requiresManualReview,
                    admin_comment: r.admin_comment,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                    receiptImage: imageUrl,
                    user: {
                        id: r.user.id,
                        name: r.user.name,
                        surname: r.user.surname,
                        email: r.user.email,
                        photoperfil: photoUrl,
                        whatsapp: r.user.whatsapp,
                        status: r.user.status,
                    },
                };
            })));
        });
    }
    //3 OBTENER TODAS LAS RECARGAS SOLO EN ESTADO PEDIENTE
    getAllRechargeRequests() {
        return __awaiter(this, void 0, void 0, function* () {
            const requests = yield data_1.RechargeRequest.find({
                relations: ["user"],
                order: { created_at: "DESC" },
                where: { status: data_1.StatusRecarga.PENDIENTE }, // solo solicitudes pendientes
            });
            return yield Promise.all(requests.map((req) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: req.receipt_image,
                });
                const photoUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: req.user.photoperfil,
                });
                return {
                    id: req.id,
                    amount: Number(req.amount),
                    bank_name: req.bank_name,
                    transaction_date: req.transaction_date,
                    receipt_number: req.receipt_number,
                    status: req.status,
                    requiresManualReview: req.requiresManualReview,
                    admin_comment: req.admin_comment,
                    created_at: req.created_at,
                    resolved_at: req.resolved_at,
                    receiptImage: imageUrl,
                    user: {
                        id: req.user.id,
                        name: req.user.name,
                        surname: req.user.surname,
                        email: req.user.email,
                        photoperfil: photoUrl,
                        whatsapp: req.user.whatsapp,
                        status: req.user.status,
                    },
                };
            })));
        });
    }
    //4  Filtrar por rango de fechas con paginación y opción de exportar
    filterByDateRangePaginated(startDate_1, endDate_1) {
        return __awaiter(this, arguments, void 0, function* (startDate, endDate, page = 1, limit = 9) {
            const take = limit;
            const skip = (page - 1) * take;
            // Ajustar las fechas para reflejar correctamente el rango en UTC-5 (Ecuador)
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0); // 00:00 en Ecuador es 05:00 UTC
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999); // 23:59 en Ecuador es 04:59 UTC del día siguiente
            const [allRequests, total] = yield data_1.RechargeRequest.findAndCount({
                relations: ["user"],
                order: { created_at: "DESC" },
                where: {
                    created_at: (0, typeorm_1.Between)(start, end),
                },
                skip,
                take,
            });
            const data = yield Promise.all(allRequests.map((r) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.receipt_image,
                });
                const photoUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.user.photoperfil,
                });
                return {
                    id: r.id,
                    amount: Number(r.amount),
                    bank_name: r.bank_name,
                    transaction_date: r.transaction_date,
                    receipt_number: r.receipt_number,
                    status: r.status,
                    requiresManualReview: r.requiresManualReview,
                    admin_comment: r.admin_comment,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                    receiptImage: imageUrl,
                    user: {
                        id: r.user.id,
                        name: r.user.name,
                        surname: r.user.surname,
                        email: r.user.email,
                        photoperfil: photoUrl,
                        whatsapp: r.user.whatsapp,
                        status: r.user.status,
                    },
                };
            })));
            return {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / take),
                data,
            };
        });
    }
    // 5 ACTUALIZA SOLO EL ESTADO PEDIENTE DE UN USUARIO
    updateStatus(id, status, adminComment, bank_name, amount, transaction_date, receipt_number) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = yield data_1.RechargeRequest.findOne({
                where: { id },
                relations: ["user"],
            });
            if (!request)
                throw domain_1.CustomError.notFound("Solicitud de recarga no encontrada");
            // 🔒 VALIDADOR DE CIERRE DIARIO
            yield this.validateDayNotClosed(request.created_at);
            if (request.status !== data_1.StatusRecarga.PENDIENTE)
                throw domain_1.CustomError.badRequest("La solicitud ya fue procesada");
            // Validar que el nuevo estado sea APROBADO o RECHAZADO
            if (![data_1.StatusRecarga.APROBADO, data_1.StatusRecarga.RECHAZADO].includes(status)) {
                throw domain_1.CustomError.badRequest("Estado inválido. Debe ser 'APROBADO' o 'RECHAZADO'");
            }
            // Actualizar campos opcionales
            if (bank_name)
                request.bank_name = bank_name;
            if (amount !== undefined)
                request.amount = Number(amount);
            if (transaction_date)
                request.transaction_date = new Date(transaction_date);
            if (receipt_number)
                request.receipt_number = receipt_number;
            // VALIDACION DUPLICADO AL APROBAR (CRÍTICO)
            if (status === data_1.StatusRecarga.APROBADO) {
                if (request.bank_name && request.receipt_number && request.transaction_date) {
                    const duplicate = yield data_1.RechargeRequest.findOne({
                        where: {
                            bank_name: request.bank_name,
                            receipt_number: request.receipt_number,
                            transaction_date: request.transaction_date,
                            status: data_1.StatusRecarga.APROBADO,
                        }
                    });
                    if (duplicate) {
                        throw domain_1.CustomError.badRequest("Este comprobante ya fue aprobado anteriormente y no puede volver a acreditarse.");
                    }
                }
            }
            request.status = status;
            request.admin_comment = adminComment !== null && adminComment !== void 0 ? adminComment : "";
            request.resolved_at = new Date();
            yield request.save();
            // ✅ ACTUALIZAR TRANSACCIÓN VINCULADA (Si existe)
            const linkedTx = yield data_1.Transaction.findOne({ where: { reference: request.id } });
            // Si fue aprobado, actualizar la wallet del usuario Y la transacción
            if (status === data_1.StatusRecarga.APROBADO) {
                const wallet = yield data_1.Wallet.findOne({
                    where: { user: { id: request.user.id } },
                });
                if (!wallet)
                    throw domain_1.CustomError.notFound("Wallet del usuario no encontrada");
                const previous = Number(wallet.balance);
                wallet.balance = Number(wallet.balance) + Number(request.amount);
                yield wallet.save();
                if (linkedTx) {
                    linkedTx.status = 'APPROVED';
                    linkedTx.previousBalance = previous; // Ahora sí tiene sentido actualizar esto para registro histórico real
                    linkedTx.resultingBalance = Number(wallet.balance);
                    linkedTx.admin = null; // Podríamos guardar el admin si lo tuviéramos
                    linkedTx.created_at = new Date(); // Opcional: ¿Actualizamos la fecha a la de aprobación o dejamos la de solicitud? Dejemos la original o actualicémosla para que salga arriba. Mejor dejar original.
                    yield linkedTx.save();
                }
                else {
                    // Fallback por si la transacción no se creó (legacy data): Crear la transacción ahora APROBADA
                    const transaction = new data_1.Transaction();
                    transaction.wallet = wallet;
                    transaction.amount = Number(request.amount);
                    transaction.type = 'credit';
                    transaction.reason = data_1.TransactionReason.RECHARGE;
                    transaction.origin = data_1.TransactionOrigin.ADMIN; // Fue aprobado por admin
                    transaction.status = 'APPROVED';
                    transaction.reference = request.id;
                    transaction.receipt_image = request.receipt_image;
                    transaction.observation = `Recarga Aprobada - Banco: ${request.bank_name}`;
                    transaction.previousBalance = previous;
                    transaction.resultingBalance = Number(wallet.balance);
                    yield transaction.save();
                }
            }
            else if (status === data_1.StatusRecarga.RECHAZADO) {
                if (linkedTx) {
                    linkedTx.status = 'REJECTED';
                    linkedTx.observation = linkedTx.observation + ` (Rechazado: ${adminComment || 'Sin motivo'})`;
                    yield linkedTx.save();
                }
            }
            return {
                id: request.id,
                amount: Number(request.amount),
                bank_name: request.bank_name,
                transaction_date: request.transaction_date,
                receipt_number: request.receipt_number,
                receipt_image: request.receipt_image,
                status: request.status,
                admin_comment: request.admin_comment,
                created_at: request.created_at,
                resolved_at: request.resolved_at,
            };
        });
    }
    //6
    exportToCSVByDate(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = new Date(startDate);
            start.setUTCHours(5, 0, 0, 0); // 00:00 hora Ecuador (UTC-5)
            const end = new Date(endDate);
            end.setUTCHours(28, 59, 59, 999); // 23:59 hora Ecuador (UTC-5) => 04:59 UTC del día siguiente
            const allRequests = yield data_1.RechargeRequest.find({
                relations: ["user"],
                where: {
                    created_at: (0, typeorm_1.Between)(start, end), // 🔥 corregido aquí también
                },
                order: {
                    created_at: "DESC",
                },
            });
            const data = yield Promise.all(allRequests.map((r) => __awaiter(this, void 0, void 0, function* () {
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.receipt_image,
                });
                const photoUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: r.user.photoperfil,
                });
                return {
                    id: r.id,
                    amount: Number(r.amount),
                    bank_name: r.bank_name,
                    transaction_date: r.transaction_date,
                    receipt_number: r.receipt_number,
                    status: r.status,
                    requiresManualReview: r.requiresManualReview,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                    "user.name": r.user.name,
                    "user.email": r.user.email,
                    "user.whatsapp": r.user.whatsapp,
                };
            })));
            const csvFields = [
                "id",
                "amount",
                "bank_name",
                "transaction_date",
                "receipt_number",
                "status",
                "created_at",
                "resolved_at",
                "user.name",
                "user.email",
                "user.whatsapp",
            ];
            const parser = new json2csv_1.Parser({ fields: csvFields });
            const csv = parser.parse(data);
            return csv;
        });
    }
    //7 FILTRAR POR ESTADO
    filterByStatusAdmin(status_1) {
        return __awaiter(this, arguments, void 0, function* (status, page = 1, itemsPerPage = 3) {
            const skip = (page - 1) * itemsPerPage;
            // Objeto where simplificado - solo filtra por estado
            const where = { status }; // ← Eliminamos el filtro por usuario
            const [requests, total] = yield data_1.RechargeRequest.findAndCount({
                where, // Solo aplica { status }
                relations: ["user"], // Mantenemos la relación para traer datos del usuario
                order: { created_at: "DESC" },
                skip,
                take: itemsPerPage,
            });
            // Optimización: Obtener imágenes en paralelo (igual que antes)
            const data = yield Promise.all(requests.map((r) => __awaiter(this, void 0, void 0, function* () {
                const [imageUrl, photoUrl] = yield Promise.all([
                    upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: r.receipt_image,
                    }),
                    r.user.photoperfil
                        ? upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: r.user.photoperfil,
                        })
                        : Promise.resolve(null),
                ]);
                return {
                    id: r.id,
                    amount: Number(r.amount),
                    bank_name: r.bank_name,
                    transaction_date: r.transaction_date,
                    receipt_number: r.receipt_number,
                    status: r.status,
                    requiresManualReview: r.requiresManualReview,
                    admin_comment: r.admin_comment,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                    receiptImage: imageUrl,
                    user: {
                        id: r.user.id,
                        name: r.user.name,
                        surname: r.user.surname,
                        email: r.user.email,
                        photoperfil: photoUrl,
                        whatsapp: r.user.whatsapp,
                        status: r.user.status,
                    },
                };
            })));
            return {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / itemsPerPage),
                data,
            };
        });
    }
    // 8. Eliminar solicitudes de recarga antiguas (PURGA)
    deleteOldRechargeRequests() {
        return __awaiter(this, void 0, void 0, function* () {
            // Obtener configuración
            const settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            const days = (settings === null || settings === void 0 ? void 0 : settings.rechargeRetentionDays) || 60; // Default
            const today = new Date();
            const cutoffDate = new Date(today);
            cutoffDate.setDate(today.getDate() - days);
            // Encontramos solicitudes anteriores a esa fecha
            const oldRequests = yield data_1.RechargeRequest.find({
                where: {
                    created_at: (0, typeorm_1.LessThan)(cutoffDate),
                },
                select: ["id", "receipt_image"] // Optimización: solo traer lo necesario
            });
            if (!oldRequests.length) {
                return {
                    deleted: 0,
                    message: "No hay solicitudes antiguas para eliminar.",
                };
            }
            // TODO: Eliminar imágenes de S3 si es requerido (requiere iterar y llamar a deleteFile)
            // Por rendimiento, en purgas masivas, a veces se hace en background job.
            // Eliminamos registros de BD
            const result = yield data_1.RechargeRequest.remove(oldRequests);
            return {
                deleted: result.length,
                message: `Se han purgado ${result.length} registros anteriores a ${days} días.`,
            };
        });
    }
    // 8.1 Configurar Purga
    configurePurge(pin, days) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pin)
                throw domain_1.CustomError.badRequest("PIN es requerido");
            if (days < 1)
                throw domain_1.CustomError.badRequest("Días debe ser mayor a 0");
            const settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            if (!settings || !settings.masterPin) {
                throw domain_1.CustomError.badRequest("Error de sistema: PIN Maestro no configurado.");
            }
            const isValid = yield bcryptjs_1.default.compare(pin, settings.masterPin);
            if (!isValid) {
                throw domain_1.CustomError.unAuthorized("PIN Maestro incorrecto.");
            }
            settings.rechargeRetentionDays = days;
            yield settings.save();
            return {
                success: true,
                message: `Configuración actualizada. Retención: ${days} días.`
            };
        });
    }
    // Helper: Validar día cerrado
    validateDayNotClosed(date) {
        return __awaiter(this, void 0, void 0, function* () {
            const dateStr = new Date(date).toISOString().split('T')[0];
            const closed = yield FinancialClosing_1.FinancialClosing.findOne({ where: { closingDate: dateStr } });
            if (closed) {
                throw domain_1.CustomError.badRequest(`El día ${dateStr} está CERRADO contablemente. No se permiten modificaciones.`);
            }
        });
    }
    // Helper para obtener saldo rápido
    getWalletBalance(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: userId } } });
            return wallet ? Number(wallet.balance) : 0;
        });
    }
    // 9. Reversar recarga aprobada (ADMIN)
    reverseRecharge(rechargeId, adminUser) {
        return __awaiter(this, void 0, void 0, function* () {
            const recharge = yield data_1.RechargeRequest.findOne({
                where: { id: rechargeId },
                relations: ["user"]
            });
            if (!recharge)
                throw domain_1.CustomError.notFound("Recarga no encontrada");
            // 🔒 VALIDADOR DE CIERRE DIARIO
            yield this.validateDayNotClosed(recharge.created_at);
            // Validaciones
            if (recharge.status !== data_1.StatusRecarga.APROBADO) {
                throw domain_1.CustomError.badRequest("Solo se pueden reversar recargas APROBADAS.");
            }
            const today = new Date().toISOString().split('T')[0];
            const createdDate = new Date(recharge.created_at).toISOString().split('T')[0];
            if (createdDate !== today) {
                throw domain_1.CustomError.badRequest("Solo se pueden reversar recargas del día actual (HOY).");
            }
            const wallet = yield data_1.Wallet.findOne({ where: { user: { id: recharge.user.id } } });
            if (!wallet)
                throw domain_1.CustomError.notFound("Wallet del usuario no encontrada");
            const amount = Number(recharge.amount);
            if (wallet.balance < amount) {
                throw domain_1.CustomError.badRequest("El usuario no tiene saldo suficiente para reversar esta recarga.");
            }
            // Ejecutar Reverso
            try {
                // 1. Descontar saldo
                wallet.balance = Number(wallet.balance) - amount;
                yield wallet.save();
                // 2. Registrar Transacción de Egreso (Reverso)
                const transaction = new data_1.Transaction();
                transaction.wallet = wallet;
                transaction.amount = amount;
                transaction.type = 'debit';
                transaction.reason = data_1.TransactionReason.REVERSAL;
                transaction.origin = data_1.TransactionOrigin.ADMIN;
                transaction.reference = `Reverso Recarga #${recharge.receipt_number || recharge.id}`;
                transaction.observation = `Reverso ejecutado por admin: ${adminUser.email}`;
                transaction.admin = adminUser;
                transaction.previousBalance = Number(wallet.balance) + amount; // Lo que tenía antes
                transaction.resultingBalance = Number(wallet.balance);
                yield transaction.save();
                // 3. Actualizar estado de la recarga a PENDIENTE
                recharge.status = data_1.StatusRecarga.PENDIENTE;
                recharge.admin_comment = `Reversado por admin el ${new Date().toLocaleString()}`;
                recharge.resolved_at = null; // Reset resolved date
                yield recharge.save();
                return {
                    success: true,
                    message: "Recarga reversada correctamente. El saldo ha sido descontado y la solicitud está pendiente nuevamente.",
                    newBalance: wallet.balance,
                    rechargeStatus: recharge.status
                };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error al procesar el reverso: " + error.message);
            }
        });
    }
}
exports.RechargeRequestService = RechargeRequestService;
