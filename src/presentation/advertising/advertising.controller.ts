import { Request, Response } from "express";
import { AdvertisingService } from "../services/advertising.service";
import { CustomError } from "../../domain";

export class AdvertisingController {
    constructor(private readonly advertisingService: AdvertisingService) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Advertising Controller Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    };

    createCampaign = async (req: Request, res: Response) => {
        try {
            const data = req.body;
            const campaign = await this.advertisingService.createCampaign(data);
            return res.status(201).json(campaign);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    getCampaigns = async (req: Request, res: Response) => {
        try {
            const campaigns = await this.advertisingService.getCampaigns();
            return res.json(campaigns);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    // Unified endpoint for Targets/Logs with pagination
    getCampaignTargets = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { page = 1, status } = req.query;
            const result = await this.advertisingService.getCampaignTargets(id, Number(page), status as string);
            return res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    sendOneMessage = async (req: Request, res: Response) => {
        try {
            const { logId } = req.params;
            const result = await this.advertisingService.sendOneMessage(logId);
            return res.json(result);
        } catch (error) {
            this.handleError(error, res);
        }
    };

    deleteCampaign = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await this.advertisingService.deleteCampaign(id);
            return res.json({ message: "Campaign deleted" });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    estimateRecipients = async (req: Request, res: Response) => {
        try {
            const filters = req.body;
            const recipients = await this.advertisingService.getRecipients(filters);
            return res.json({ count: recipients.length });
        } catch (error) {
            this.handleError(error, res);
        }
    };
}
