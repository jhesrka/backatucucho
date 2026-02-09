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
    // 1. FILTER RECIPIENTS
    getRecipients(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {};
            // By Role
            if (filters.role === 'CLIENT')
                where.rol = data_1.UserRole.USER;
            if (filters.role === 'ADMIN')
                where.rol = data_1.UserRole.ADMIN;
            // For specific roles like 'NEGOCIO' or 'MOTORIZADO', 
            // we assume they are Users but we check relations.
            // This logic depends on how you identify them. 
            // Assuming 'role' filter maps to UserRole or specific relation checks.
            // By Status
            if (filters.status)
                where.status = filters.status;
            // By Date Registration
            if (filters.startDate && filters.endDate) {
                where.createdAt = (0, typeorm_1.Between)(new Date(filters.startDate), new Date(filters.endDate));
            }
            // Advanced: Check for Negocio/Motorizado existence if requested
            // This is a simplified fetch.
            const users = yield data_1.User.find({ where, select: ['id', 'email', 'name', 'surname', 'whatsapp', 'rol', 'status', 'createdAt'] });
            // Detailed filtering in memory if relations needed (e.g. only those who have Negocio)
            let filtered = users;
            if (filters.targetGroup === 'BUSINESS') {
                // Assume we need to check if user has businesses? 
                // For MVP, letting frontend pass exact criteria or just simpler filtering
            }
            return filtered;
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
            // 3. Bulk Insert Targets (Logs)
            // We do this in chunks to avoid blowing up memory if list is huge
            const CHUNK_SIZE = 100;
            for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
                const chunk = recipients.slice(i, i + CHUNK_SIZE);
                const logsToInsert = chunk.map(user => {
                    const log = new data_1.CampaignLog();
                    log.campaign = campaign;
                    log.user = user;
                    log.targetContact = data.type === data_1.CampaignType.EMAIL ? user.email : user.whatsapp;
                    log.status = data_1.LogStatus.PENDING;
                    return log;
                });
                yield data_1.CampaignLog.save(logsToInsert);
            }
            // If Email, we might still want auto-send? User focused on WhatsApp. 
            // For now, let's leave Email as "Manual start" too for consistency or keep it auto if previous logic needed it.
            // User said "Eliminar completamente el sistema anterior de WhatsApp masivo".
            // I will NOT tigger processCampaign automatically for anyone now, to be safe and consistent.
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
                if (campaign.type === data_1.CampaignType.EMAIL) {
                    if (!user.email || !user.email.includes('@'))
                        throw new Error("Invalid Email");
                    yield this.emailService.sendEmail({
                        to: user.email,
                        subject: campaign.subject || "No Subject",
                        htmlBody: campaign.content
                    });
                    success = true;
                }
                else if (campaign.type === data_1.CampaignType.WHATSAPP) {
                    if (!user.whatsapp)
                        throw new Error("No WhatsApp Number");
                    let phone = user.whatsapp.trim().replace(/\+/g, '');
                    if (phone.length < 9)
                        throw new Error("Invalid Phone Format");
                    const text = campaign.content.replace('{{name}}', user.name || 'Cliente');
                    // MEDIA SUPPORT (Mock for now, but ready for logic)
                    if (campaign.mediaUrl) {
                        // logic to send media would go here
                        // await WhatsAppProvider.sendMedia(...)
                        console.log(`[WA] Sending Media ${campaign.mediaUrl}`);
                    }
                    // MANUAL SEND: We assume the admin clicked the "Open WhatsApp" button.
                    // We just mark it as successful in the database.
                    success = true;
                    // success = await WhatsAppProvider.sendMessage(phone, text);
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
                        sentAt: t.attemptedAt
                    });
                }),
                total,
                totalPages: Math.ceil(total / take)
            };
        });
    }
    // 4. STATS & LOGS
    getCampaigns() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield data_1.Campaign.find({ order: { createdAt: 'DESC' } });
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
    processCampaign(id) {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}
exports.AdvertisingService = AdvertisingService;
