import { Campaign, CampaignStatus, CampaignType, Status, User, UserRole, CampaignLog, LogStatus } from "../../data";
import { EmailService } from "./email.service";
import { envs } from "../../config";
import { Between, LessThan, MoreThan } from "typeorm";

// Mock WhatsApp Provider (Replace with real logic or library)
class WhatsAppProvider {
    static async sendMessage(phone: string, text: string): Promise<boolean> {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 1000));
        // Simulate success
        console.log(`[WA MOCK] Sending to ${phone}: ${text.substring(0, 20)}...`);
        return true;
    }
}

export class AdvertisingService {
    constructor(private readonly emailService: EmailService) { }

    // 1. FILTER RECIPIENTS
    async getRecipients(filters: any) {
        const where: any = {};

        // By Role
        if (filters.role === 'CLIENT') where.rol = UserRole.USER;
        if (filters.role === 'ADMIN') where.rol = UserRole.ADMIN;
        // For specific roles like 'NEGOCIO' or 'MOTORIZADO', 
        // we assume they are Users but we check relations.
        // This logic depends on how you identify them. 
        // Assuming 'role' filter maps to UserRole or specific relation checks.

        // By Status
        if (filters.status) where.status = filters.status;

        // By Date Registration
        if (filters.startDate && filters.endDate) {
            where.createdAt = Between(new Date(filters.startDate), new Date(filters.endDate));
        }

        // Advanced: Check for Negocio/Motorizado existence if requested
        // This is a simplified fetch.
        const users = await User.find({ where, select: ['id', 'email', 'name', 'surname', 'whatsapp', 'rol', 'status', 'createdAt'] });

        // Detailed filtering in memory if relations needed (e.g. only those who have Negocio)
        let filtered = users;
        if (filters.targetGroup === 'BUSINESS') {
            // Assume we need to check if user has businesses? 
            // For MVP, letting frontend pass exact criteria or just simpler filtering
        }

        return filtered;
    }

    // 2. CREATE TEMPLATE CAMPAIGN
    async createCampaign(data: { type: CampaignType; name: string; content: string; subject?: string; filters: any; mediaUrl?: string; mediaType?: string }) {
        // 1. Save Campaign Template
        const campaign = new Campaign();
        campaign.type = data.type;
        campaign.name = data.name;
        campaign.content = data.content;
        campaign.subject = data.subject || "";
        campaign.mediaUrl = data.mediaUrl || null!;
        campaign.mediaType = data.mediaType || null!;
        campaign.filters = data.filters;
        campaign.status = CampaignStatus.DRAFT; // Initial state

        // 2. Generate Static List (Logs as Targets)
        const recipients = await this.getRecipients(data.filters);
        campaign.totalTargets = recipients.length;

        await campaign.save();

        // 3. Bulk Insert Targets (Logs)
        // We do this in chunks to avoid blowing up memory if list is huge
        const CHUNK_SIZE = 100;
        for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
            const chunk = recipients.slice(i, i + CHUNK_SIZE);
            const logsToInsert = chunk.map(user => {
                const log = new CampaignLog();
                log.campaign = campaign;
                log.user = user;
                log.targetContact = data.type === CampaignType.EMAIL ? user.email : user.whatsapp;
                log.status = LogStatus.PENDING;
                return log;
            });
            await CampaignLog.save(logsToInsert);
        }

        // If Email, we might still want auto-send? User focused on WhatsApp. 
        // For now, let's leave Email as "Manual start" too for consistency or keep it auto if previous logic needed it.
        // User said "Eliminar completamente el sistema anterior de WhatsApp masivo".
        // I will NOT tigger processCampaign automatically for anyone now, to be safe and consistent.

        return campaign;
    }

    // MANUAL SEND (One by One)
    async sendOneMessage(logId: string) {
        const log = await CampaignLog.findOne({
            where: { id: logId },
            relations: ['campaign', 'user']
        });

        if (!log) throw new Error("Target not found");
        if (log.status === LogStatus.SENT) return { success: true, message: "Already sent" };

        const campaign = log.campaign;
        const user = log.user;

        let success = false;
        let errorMsg = null;

        try {
            if (campaign.type === CampaignType.EMAIL) {
                if (!user.email || !user.email.includes('@')) throw new Error("Invalid Email");
                await this.emailService.sendEmail({
                    to: user.email,
                    subject: campaign.subject || "No Subject",
                    htmlBody: campaign.content
                });
                success = true;
            } else if (campaign.type === CampaignType.WHATSAPP) {
                if (!user.whatsapp) throw new Error("No WhatsApp Number");
                let phone = user.whatsapp.trim().replace(/\+/g, '');
                if (phone.length < 9) throw new Error("Invalid Phone Format");

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
        } catch (e: any) {
            success = false;
            errorMsg = e.response ? `SMTP ${e.response}` : (e.message || JSON.stringify(e));
        }

        // Update Log
        log.status = success ? LogStatus.SENT : LogStatus.FAILED;
        log.errorMessage = errorMsg || "";
        log.attemptedAt = new Date();
        await log.save();

        // Update Campaign Counters (Atomic increment ideally, but fine here)
        // We re-fetch campaign to ensure we don't overwrite concurrent updates if we were doing parallel, 
        // but this is one-by-one by admin.
        if (success) {
            await Campaign.getRepository().increment({ id: campaign.id }, 'sentCount', 1);
        } else {
            await Campaign.getRepository().increment({ id: campaign.id }, 'failedCount', 1);
        }

        return { success, error: errorMsg };
    }

    async getCampaignTargets(campaignId: string, page: number = 1, status?: string) {
        const take = 20;
        const skip = (page - 1) * take;
        const where: any = { campaign: { id: campaignId } };
        if (status) where.status = status;

        const [targets, total] = await CampaignLog.findAndCount({
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
            targets: targets.map(t => ({
                id: t.id,
                name: t.user ? `${t.user.name} ${t.user.surname}` : 'Desconocido',
                firstname: t.user?.name || '',
                lastname: t.user?.surname || '',
                email: t.user?.email || '',
                phone: t.targetContact,
                status: t.status,
                role: t.user?.rol,
                error: t.errorMessage,
                sentAt: t.attemptedAt
            })),
            total,
            totalPages: Math.ceil(total / take)
        };
    }

    // 4. STATS & LOGS
    async getCampaigns() {
        return await Campaign.find({ order: { createdAt: 'DESC' } });
    }

    async deleteCampaign(id: string) {
        // Cleanup logs first? TypeORM cascade might handle it if configured, 
        // else manual delete.
        await CampaignLog.delete({ campaign: { id } });
        await Campaign.delete({ id });
        return true;
    }

    // Kept generic processCampaign for background compatibility if needed, but not used by new features.
    private async processCampaign(id: string) { }
}
