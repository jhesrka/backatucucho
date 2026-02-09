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
exports.AdvertisingController = void 0;
const domain_1 = require("../../domain");
class AdvertisingController {
    constructor(advertisingService) {
        this.advertisingService = advertisingService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Advertising Controller Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        };
        this.createCampaign = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const data = req.body;
                const campaign = yield this.advertisingService.createCampaign(data);
                return res.status(201).json(campaign);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.getCampaigns = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const campaigns = yield this.advertisingService.getCampaigns();
                return res.json(campaigns);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // Unified endpoint for Targets/Logs with pagination
        this.getCampaignTargets = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { page = 1, status } = req.query;
                const result = yield this.advertisingService.getCampaignTargets(id, Number(page), status);
                return res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.sendOneMessage = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { logId } = req.params;
                const result = yield this.advertisingService.sendOneMessage(logId);
                return res.json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.deleteCampaign = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                yield this.advertisingService.deleteCampaign(id);
                return res.json({ message: "Campaign deleted" });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.estimateRecipients = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const filters = req.body;
                const recipients = yield this.advertisingService.getRecipients(filters);
                return res.json({ count: recipients.length });
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
    }
}
exports.AdvertisingController = AdvertisingController;
