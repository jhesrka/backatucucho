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
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class EmailService {
    constructor(mailerService, mailerEmail, senderEmailPassword, postToProvider) {
        this.postToProvider = postToProvider;
        this.transporter = nodemailer_1.default.createTransport({
            service: mailerService,
            pool: true, // Use pooled connections
            maxConnections: 1, // Limit concurrent connections to avoid blocking
            rateLimit: 3, // Rate limit messages per second
            auth: {
                user: mailerEmail,
                pass: senderEmailPassword,
            },
        });
    }
    sendEmail(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { to, subject, htmlBody, attachments = [] } = options;
            if (!this.postToProvider) {
                console.warn("⚠️ Email sending is disabled in .env (SEND_EMAIL=false). returning 'true' to simulate success.");
                return true;
            }
            try {
                const sentInformation = yield this.transporter.sendMail({
                    to: to,
                    subject: subject,
                    html: htmlBody,
                    attachments: attachments,
                });
                console.log(`✅ Email sent to ${to} | ID: ${sentInformation.messageId}`);
                return true;
            }
            catch (error) {
                console.error("Email Service Error:", error);
                if ((error === null || error === void 0 ? void 0 : error.responseCode) === 535) {
                    console.error("⚠️ SMTP 535 Error: Authentication failed. If using Gmail, make sure to use an 'App Password', not your main password.");
                }
                return false;
            }
        });
    }
}
exports.EmailService = EmailService;
