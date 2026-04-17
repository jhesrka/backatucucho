import axios from "axios";
import { CustomError } from "../../domain";
import { envs } from "../../config/env";

export class PayphoneService {
    private static API_URL = "https://pay.payphonetodoesposible.com/api";

    static async createCheckout({
        amount,
        tax = 0,
        amountWithTax = 0,
        clientTransactionId,
        reference,
        storeId,
        token,
        responseUrl,
        cancellationUrl,
    }: {
        amount: number;
        tax?: number;
        amountWithTax?: number;
        clientTransactionId: string;
        reference: string;
        storeId: string;
        token: string;
        responseUrl?: string;
        cancellationUrl?: string;
    }) {
        try {
            // Convert to cents (integer)
            const amountCents = Math.round(amount * 100);
            const taxCents = Math.round(tax * 100);
            const amountWithTaxCents = Math.round(amountWithTax * 100);
            const amountWithoutTaxCents = amountCents - amountWithTaxCents;

            const cleanToken = token.trim();
            const cleanStoreId = storeId.trim();

            const payload = {
                amount: amountCents,
                tax: taxCents,
                amountWithTax: amountWithTaxCents,
                amountWithoutTax: amountWithoutTaxCents,
                clientTransactionId,
                reference,
                storeId: cleanStoreId,
                currency: "USD",
                expireIn: 15,
                responseUrl: responseUrl || `${envs.WEBSERVICE_URL_FRONT}/mis-pedidos?payment=success&orderId=${clientTransactionId}`,
                cancellationUrl: cancellationUrl || `${envs.WEBSERVICE_URL_FRONT}/mis-pedidos?payment=cancelled&orderId=${clientTransactionId}`,
            };

            console.log("🚀 [Payphone] PAYLOAD:", JSON.stringify(payload, null, 2));
            console.log("🔐 [Payphone] TOKEN (CLEAN):", cleanToken);

            const { data } = await axios.post(`${this.API_URL}/button/Prepare`, payload, {
                headers: {
                    Authorization: `Bearer ${cleanToken}`,
                    "Content-Type": "application/json",
                },
            });

            console.log("✅ [Payphone] SUCCESS:", data);
            return data;
        } catch (error: any) {
            const errorDetail = error?.response?.data || error.message;
            console.error("❌ [Payphone] ERROR:", errorDetail);

            // Log to file for deep debugging
            try {
                const fs = require('fs');
                const path = require('path');
                const logDir = path.join(__dirname, '..', '..', '..', '..', 'tmp');
                if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                const logPath = path.join(logDir, 'order_debug.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] PAYPHONE PREPARE ERROR: ${JSON.stringify(errorDetail)}\n`);
            } catch (e) {}

            throw error; // Rethrow to let the controller handle it with 400
        }
    }

    static async confirmPayment(id: number | string, clientTransactionId: string, token: string) {
        try {
            const payload = { 
                id: Number(id), 
                clientTransactionId 
            };
            console.log("🚀 [Payphone] CONFIRMING:", JSON.stringify(payload, null, 2));

            const { data } = await axios.post(`${this.API_URL}/button/V2/Confirm`, payload, {
                headers: {
                    Authorization: `Bearer ${token.trim()}`,
                    "Content-Type": "application/json",
                },
            });

            console.log("✅ [Payphone] CONFIRMATION SUCCESS:", data);
            return data; // Approved, Denied, etc.
        } catch (error: any) {
            const errorDetail = error?.response?.data || error.message;
            console.error("❌ [Payphone] CONFIRMATION ERROR:", errorDetail);
            throw error;
        }
    }

    static async getTransactionByClientTxId(clientTxId: string, token: string) {
        try {
            console.log(`🚀 [Payphone] GET TRANSACTION BY CLIENT TX ID: ${clientTxId}`);
            // Note: Token should be cleaned
            const { data } = await axios.get(`https://pay.payphonetodoesposible.com/api/button/V2/Get?clientTransactionId=${clientTxId}`, {
                headers: {
                    Authorization: `Bearer ${token.trim()}`,
                    "Content-Type": "application/json",
                },
            });
            console.log("✅ [Payphone] TRANSACTION FOUND:", data);
            return data;
        } catch (error: any) {
            console.error("❌ [Payphone] GET TRANSACTION ERROR:", error?.response?.data || error.message);
            return null;
        }
    }
}
