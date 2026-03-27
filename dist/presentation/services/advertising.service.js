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
exports.AdvertisingService = void 0;
const data_1 = require("../../data");
const typeorm_1 = require("typeorm");
// Mock WhatsApp Provider (Replace with real logic or library)
class WhatsAppProvider {
    static sendMessage(phone, text) {
        return __awaiter(this, void 0, void 0, function* () {
            // Simulate network delay
            yield new Promise(r => setTimeout(r, 1000));
            // Simulate success
            console.log(`[WA MOCK] Sending to ${phone}: ${text.substring(0, 20)}...`);
            return true;
        });
    }
}
class AdvertisingService {
    constructor(emailService) {
        this.emailService = emailService;
    }
    // 1. FILTER RECIPIENTS (Advanced Marketing System)
    getRecipients(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // IF MANUAL SELECTION BY ID (User requested this feature)
            if (((_a = filters.advanced) === null || _a === void 0 ? void 0 : _a.includes('manual_selection')) && ((_b = filters.userIds) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                return yield data_1.User.createQueryBuilder("user")
                    .where("user.id IN (:...ids)", { ids: filters.userIds })
                    .getMany();
            }
            const query = data_1.User.createQueryBuilder("user");
            const advanced = filters.advanced || [];
            const params = filters.params || {};
            // 0. CHANNEL VALIDATION (CRITICAL)
            if (filters.channel === 'WHATSAPP') {
                query.andWhere("user.whatsapp IS NOT NULL AND user.whatsapp != ''");
            }
            else if (filters.channel === 'EMAIL') {
                query.andWhere("user.email IS NOT NULL AND user.email LIKE '%@%'");
            }
            // 1. BASE ROLE FILTER
            if (filters.role === 'CLIENT') {
                query.andWhere("user.rol = :rol", { rol: data_1.UserRole.USER });
            }
            else if (filters.role === 'ADMIN') {
                query.andWhere("user.rol = :rol", { rol: data_1.UserRole.ADMIN });
            }
            else if (filters.role === 'BUSINESS') {
                // "Negocios = Usuario con negocio registrado. Sin importar estado."
                query.innerJoin("user.negocios", "negocio");
            }
            else if (filters.role === 'MOTORIZED') {
                query.innerJoin("UserMotorizado", "motorizado", "motorizado.userId = user.id");
            }
            // 2. STATUS FILTER (Ignored for Business if not specified)
            if (filters.status && filters.role !== 'BUSINESS') {
                query.andWhere("user.status = :status", { status: filters.status });
            }
            // 3. DATE FILTER
            if (filters.startDate && filters.endDate) {
                query.andWhere("user.createdAt BETWEEN :start AND :end", {
                    start: new Date(filters.startDate),
                    end: new Date(filters.endDate)
                });
            }
            // 4. ADVANCED SMART TAGS (COMBINABLE)
            advanced.forEach((tagId) => {
                const tagVal = params[tagId];
                switch (tagId) {
                    case 'new_users':
                        const dateLimit = new Date();
                        dateLimit.setDate(dateLimit.getDate() - (Number(tagVal) || 7));
                        query.andWhere("user.createdAt >= :dateLimit", { dateLimit });
                        break;
                    case 'incomplete_profile':
                        query.andWhere("(user.name IS NULL OR user.surname IS NULL OR user.name = '')");
                        break;
                    case 'no_login':
                        query.andWhere("user.lastLoginDate IS NULL");
                        break;
                    case 'wallet_zero':
                        query.innerJoin("user.wallet", "wallet_z")
                            .andWhere("wallet_z.balance = 0");
                        break;
                    case 'never_bought':
                        query.leftJoin("user.pedidos", "pedido_n")
                            .andWhere("pedido_n.id IS NULL");
                        break;
                    case 'bought_once':
                        query.innerJoin("user.pedidos", "pedido_o")
                            .groupBy("user.id")
                            .having("COUNT(pedido_o.id) = 1");
                        break;
                    case 'top_buyers':
                        query.innerJoin("user.pedidos", "pedido_t")
                            .groupBy("user.id")
                            .having("COUNT(pedido_t.id) > 10");
                        break;
                    case 'unused_balance':
                        const uDate = new Date();
                        uDate.setDate(uDate.getDate() - (Number(tagVal) || 30));
                        query.innerJoin("user.wallet", "wallet_u")
                            .andWhere("wallet_u.balance > 0")
                            .andWhere("wallet_u.updated_at < :uDate", { uDate });
                        break;
                    case 'no_posts':
                        query.leftJoin("user.posts", "post_n")
                            .andWhere("post_n.id IS NULL");
                        break;
                    case 'inactive_user':
                        const iDate = new Date();
                        iDate.setDate(iDate.getDate() - (Number(tagVal) || 30));
                        query.andWhere("user.lastLoginDate < :iDate", { iDate });
                        break;
                    case 'new_business':
                        query.innerJoin("user.negocios", "nb_new")
                            .andWhere("nb_new.createdAt >= :nbDate", {
                            nbDate: new Date(Date.now() - (Number(tagVal) || 7) * 24 * 60 * 60 * 1000)
                        });
                        break;
                    case 'no_products':
                        query.innerJoin("user.negocios", "nb_nop")
                            .leftJoin("nb_nop.productos", "prod_n")
                            .andWhere("prod_n.id IS NULL");
                        break;
                    case 'no_sales':
                        query.innerJoin("user.negocios", "nb_nos")
                            .leftJoin("nb_nos.pedidos", "ped_nos")
                            .andWhere("ped_nos.id IS NULL");
                        break;
                    case 'high_sales':
                        query.innerJoin("user.negocios", "nb_hs")
                            .innerJoin("nb_hs.pedidos", "ped_hs")
                            .groupBy("user.id")
                            .having("COUNT(ped_hs.id) > 50");
                        break;
                    case 'no_stock':
                        query.innerJoin("user.negocios", "nb_stk")
                            .innerJoin("nb_stk.productos", "prod_stk")
                            .andWhere("prod_stk.stock = 0");
                        break;
                    case 'inactive_biz':
                        query.innerJoin("user.negocios", "nb_in")
                            .andWhere("nb_in.updated_at < :nbInDate", {
                            nbInDate: new Date(Date.now() - (Number(tagVal) || 30) * 24 * 60 * 60 * 1000)
                        });
                        break;
                    case 'negocio_by_status':
                        query.innerJoin("user.negocios", "nb_status")
                            .andWhere("nb_status.status = :nbStat", { nbStat: tagVal || 'ACTIVE' });
                        break;
                    case 'cancelled_orders':
                        query.innerJoin("user.negocios", "nb_can")
                            .innerJoin("nb_can.pedidos", "ped_can")
                            .andWhere("ped_can.status = 'CANCELADO'")
                            .groupBy("user.id")
                            .having("COUNT(ped_can.id) > 5");
                        break;
                }
            });
            const users = yield query
                .select(['user.id', 'user.email', 'user.name', 'user.surname', 'user.whatsapp', 'user.rol', 'user.status', 'user.createdAt'])
                .getMany();
            return users;
        });
    }
    // 2. CREATE TEMPLATE CAMPAIGN
    createCampaign(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Save Campaign Template
            const campaign = new data_1.Campaign();
            campaign.type = data.type;
            campaign.name = data.name;
            campaign.content = data.content;
            campaign.subject = data.subject || "";
            campaign.mediaUrl = data.mediaUrl || null;
            campaign.mediaType = data.mediaType || null;
            campaign.filters = data.filters;
            campaign.status = data_1.CampaignStatus.DRAFT; // Initial state
            // 2. Generate Static List (Logs as Targets)
            const recipients = yield this.getRecipients(data.filters);
            campaign.totalTargets = recipients.length;
            yield campaign.save();
            const CHUNK_SIZE = 50;
            for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
                const chunkUserIds = recipients.slice(i, i + CHUNK_SIZE).map(u => u.id);
                if (chunkUserIds.length === 0)
                    continue;
                // Using In(ids) with relations is much more reliable in TypeORM 
                // than complex QueryBuilder joins for deeply nested marketing data
                const fullUsers = yield data_1.User.find({
                    where: { id: (0, typeorm_1.In)(chunkUserIds) },
                    relations: [
                        'wallet',
                        'pedidos',
                        'negocios',
                        'negocios.productos',
                        'negocios.pedidos'
                    ]
                });
                const logsToInsert = fullUsers.map(user => {
                    const attr = this.resolveUserAttributes(user);
                    const log = new data_1.CampaignLog();
                    log.campaign = campaign;
                    log.user = user;
                    // Important: for email we use email, for whatsapp we use phone
                    log.targetContact = data.type === data_1.CampaignType.EMAIL ? user.email : user.whatsapp;
                    log.status = data_1.LogStatus.PENDING;
                    log.dynamicAttributes = attr;
                    return log;
                });
                yield data_1.CampaignLog.save(logsToInsert);
            }
            // 3. AUTO-START BACKGROUND PROCESSOR (ONLY FOR EMAIL)
            if (data.type === data_1.CampaignType.EMAIL) {
                this.processCampaign(campaign.id).catch(console.error);
            }
            return campaign;
        });
    }
    // MANUAL SEND (One by One)
    sendOneMessage(logId) {
        return __awaiter(this, void 0, void 0, function* () {
            const log = yield data_1.CampaignLog.findOne({
                where: { id: logId },
                relations: ['campaign', 'user']
            });
            if (!log)
                throw new Error("Target not found");
            if (log.status === data_1.LogStatus.SENT)
                return { success: true, message: "Already sent" };
            const campaign = log.campaign;
            const user = log.user;
            let success = false;
            let errorMsg = null;
            try {
                const attr = log.dynamicAttributes || {};
                const subject = this.replaceTags(campaign.subject || "No Subject", attr);
                const content = this.replaceTags(campaign.content, attr);
                if (campaign.type === data_1.CampaignType.EMAIL) {
                    if (!user.email || !user.email.includes('@'))
                        throw new Error("Invalid Email");
                    yield this.emailService.sendEmail({
                        to: user.email,
                        subject,
                        htmlBody: content
                    });
                    success = true;
                }
                else if (campaign.type === data_1.CampaignType.WHATSAPP) {
                    if (!user.whatsapp)
                        throw new Error("No WhatsApp Number");
                    // For WhatsApp, we assume the replacement is done here for the admin to use
                    // or we are logging the successful generation of the personalized message.
                    success = true;
                }
            }
            catch (e) {
                success = false;
                errorMsg = e.response ? `SMTP ${e.response}` : (e.message || JSON.stringify(e));
            }
            // Update Log
            log.status = success ? data_1.LogStatus.SENT : data_1.LogStatus.FAILED;
            log.errorMessage = errorMsg || "";
            log.attemptedAt = new Date();
            yield log.save();
            // Update Campaign Counters (Atomic increment ideally, but fine here)
            // We re-fetch campaign to ensure we don't overwrite concurrent updates if we were doing parallel, 
            // but this is one-by-one by admin.
            if (success) {
                yield data_1.Campaign.getRepository().increment({ id: campaign.id }, 'sentCount', 1);
            }
            else {
                yield data_1.Campaign.getRepository().increment({ id: campaign.id }, 'failedCount', 1);
            }
            return { success, error: errorMsg };
        });
    }
    getCampaignTargets(campaignId_1) {
        return __awaiter(this, arguments, void 0, function* (campaignId, page = 1, status) {
            const take = 20;
            const skip = (page - 1) * take;
            const where = { campaign: { id: campaignId } };
            if (status)
                where.status = status;
            const [targets, total] = yield data_1.CampaignLog.findAndCount({
                where,
                relations: ['user'],
                skip,
                take,
                order: {
                    status: 'ASC', // Pending first (alphabetically PENDING < SENT? No. FAILED < PENDING < SENT)
                    // We want Pending first. 
                    // Custom sort is hard in basic TypeORM without query builder. 
                    // Let's just sort by user name or ID for stability.
                    // Or user can filter by status.
                }
            });
            return {
                targets: targets.map(t => {
                    var _a, _b, _c, _d;
                    return ({
                        id: t.id,
                        name: t.user ? `${t.user.name} ${t.user.surname}` : 'Desconocido',
                        firstname: ((_a = t.user) === null || _a === void 0 ? void 0 : _a.name) || '',
                        lastname: ((_b = t.user) === null || _b === void 0 ? void 0 : _b.surname) || '',
                        email: ((_c = t.user) === null || _c === void 0 ? void 0 : _c.email) || '',
                        phone: t.targetContact,
                        status: t.status,
                        role: (_d = t.user) === null || _d === void 0 ? void 0 : _d.rol,
                        error: t.errorMessage,
                        sentAt: t.attemptedAt,
                        dynamicAttributes: t.dynamicAttributes // EXTREMELY CRITICAL for personalization!
                    });
                }),
                total,
                totalPages: Math.ceil(total / take)
            };
        });
    }
    // Centralized function to resolve ALL dynamic attributes
    resolveUserAttributes(user) {
        // DEFAULT BASE SNAPSHOT
        const attr = {
            id: user.id,
            nombre: user.name || "Usuario",
            name: user.name || "Usuario",
            apellido: user.surname || "",
            surname: user.surname || "",
            email: user.email || "N/A",
            telefono: user.whatsapp || "N/A",
            phone: user.whatsapp || "N/A",
            saldo_billetera: "$0.00",
            saldo: "$0.00",
            total_compras: 0,
            monto_total_compras: "$0.00",
            negocio_principal: "N/A",
            nombre_negocio: "N/A",
            total_productos: 0,
            total_ventas: 0,
            monto_total_ventas: "$0.00",
        };
        // 1. RESOLVE USER/CLIENT DATA (WALLETS AND PEDIDOS)
        if (user.wallet) {
            attr.saldo_billetera = `$${Number(user.wallet.balance || 0).toFixed(2)}`;
            attr.saldo = attr.saldo_billetera;
        }
        const userPedidos = user.pedidos || [];
        if (userPedidos.length > 0) {
            attr.total_compras = userPedidos.length;
            const totalSpent = userPedidos.reduce((sum, p) => sum + Number(p.total || 0), 0);
            attr.monto_total_compras = `$${totalSpent.toFixed(2)}`;
        }
        // 2. RESOLVE BUSINESS DATA (AGGREGATED FROM ALL BUSINESSES)
        const userBusinesses = user.negocios || [];
        if (userBusinesses.length > 0) {
            // Business Logic: Principal is the first one or latest
            attr.negocio_principal = userBusinesses[0].nombre;
            attr.nombre_negocio = userBusinesses.map(n => n.nombre).join(', ');
            // Sales Aggregation
            let productsCount = 0;
            let salesCount = 0;
            let revenue = 0;
            userBusinesses.forEach(biz => {
                const bizProducts = biz.productos || [];
                const bizPedidos = biz.pedidos || [];
                productsCount += bizProducts.length;
                salesCount += bizPedidos.length;
                revenue += bizPedidos.reduce((sum, p) => sum + Number(p.total || 0), 0) || 0;
            });
            attr.total_productos = productsCount;
            attr.total_ventas = salesCount;
            attr.monto_total_ventas = `$${revenue.toFixed(2)}`;
        }
        return attr;
    }
    // 4. STATS & LOGS
    getCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield data_1.Campaign.find({ order: { createdAt: 'DESC' } });
        });
    }
    searchUsers(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query || query.length < 2)
                return [];
            return yield data_1.User.createQueryBuilder("user")
                .where("user.name ILIKE :q", { q: `%${query}%` })
                .orWhere("user.email ILIKE :q", { q: `%${query}%` })
                .orWhere("user.whatsapp ILIKE :q", { q: `%${query}%` })
                .orWhere("user.surname ILIKE :q", { q: `%${query}%` })
                .limit(20)
                .getMany();
        });
    }
    deleteCampaign(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // Cleanup logs first? TypeORM cascade might handle it if configured, 
            // else manual delete.
            yield data_1.CampaignLog.delete({ campaign: { id } });
            yield data_1.Campaign.delete({ id });
            return true;
        });
    }
    // Kept generic processCampaign for background compatibility if needed, but not used by new features.
    // Helper for personalization
    replaceTags(content, attributes) {
        try {
            let text = content;
            if (!attributes)
                return text;
            // Robust parsing in case it's a string
            const attr = typeof attributes === 'string' ? JSON.parse(attributes) : attributes;
            // Loop over attributes and use Regex to handle spaces inside tags {{ tag }}
            Object.keys(attr).forEach(key => {
                const val = (attr[key] !== null && attr[key] !== undefined) ? String(attr[key]) : "";
                // This regex matches {{key}} with any internal spacing: {{ key }}, {{   key}}, etc.
                // It also Ignores case for common placeholders
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'gi');
                text = text.replace(regex, val);
            });
            // Fallback for some common English names if user used them
            const fallbacks = {
                'name': attr.nombre,
                'surname': attr.apellido,
                'phone': attr.telefono,
                'balance': attr.saldo_billetera,
                'wallet_balance': attr.saldo_billetera,
                'wallet': attr.saldo_billetera,
                'business_name': attr.negocio_principal
            };
            Object.keys(fallbacks).forEach(key => {
                if (fallbacks[key] !== undefined) {
                    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
                    text = text.replace(regex, String(fallbacks[key]));
                }
            });
            return text;
        }
        catch (e) {
            return content;
        }
    }
    processCampaign(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log(`[ENGINE] 🚀 Iniciando procesamiento automático para campaña: ${id}`);
            const campaign = yield data_1.Campaign.findOne({ where: { id } });
            if (!campaign) {
                console.error(`[ENGINE] ❌ Error: Campaña ${id} no encontrada`);
                return;
            }
            // Auto-processing ONLY for EMAIL
            if (campaign.type !== data_1.CampaignType.EMAIL) {
                console.log(`[ENGINE] ⚠️ Campaña ${id} no es de tipo EMAIL. Abortando auto-procesamiento.`);
                return;
            }
            campaign.status = data_1.CampaignStatus.PROCESSING;
            yield campaign.save();
            const logs = yield data_1.CampaignLog.find({
                where: { campaign: { id }, status: data_1.LogStatus.PENDING },
                relations: ['user']
            });
            console.log(`[ENGINE] 📬 Encontrados ${logs.length} destinatarios pendientes para campaña: ${campaign.name}`);
            if (logs.length === 0) {
                console.warn(`[ENGINE] ⚠️ No hay logs pendientes para procesar.`);
                campaign.status = data_1.CampaignStatus.COMPLETED;
                yield campaign.save();
                return;
            }
            for (const log of logs) {
                try {
                    const attr = log.dynamicAttributes || {};
                    const subject = this.replaceTags(campaign.subject || "No Subject", attr);
                    const content = this.replaceTags(campaign.content, attr);
                    if (((_a = log.user) === null || _a === void 0 ? void 0 : _a.email) && log.user.email.includes('@')) {
                        console.log(`[ENGINE] 📧 Enviando a: ${log.user.email}...`);
                        const result = yield this.emailService.sendEmail({
                            to: log.user.email,
                            subject,
                            htmlBody: content
                        });
                        if (result) {
                            log.status = data_1.LogStatus.SENT;
                            yield data_1.Campaign.getRepository().increment({ id: campaign.id }, 'sentCount', 1);
                            console.log(`[ENGINE] ✅ Éxito: ${log.user.email}`);
                        }
                        else {
                            throw new Error("SMTP Refused / Internal Error");
                        }
                    }
                    else {
                        throw new Error("Invalid Email Address");
                    }
                }
                catch (e) {
                    console.error(`[ENGINE] ❌ Fallo en ${log.targetContact}: ${e.message}`);
                    log.status = data_1.LogStatus.FAILED;
                    log.errorMessage = e.message || "Email error";
                    yield data_1.Campaign.getRepository().increment({ id: campaign.id }, 'failedCount', 1);
                }
                log.attemptedAt = new Date();
                yield log.save();
            }
            campaign.status = data_1.CampaignStatus.COMPLETED;
            yield campaign.save();
            console.log(`[ENGINE] 🏁 Campaña ${id} terminada.`);
        });
    }
}
exports.AdvertisingService = AdvertisingService;
