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
exports.OcrService = void 0;
const tesseract_js_1 = __importDefault(require("tesseract.js"));
const domain_1 = require("../../../domain");
class OcrService {
    processImage(imageBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data: { text } } = yield tesseract_js_1.default.recognize(imageBuffer, 'spa', {
                // logger: m => console.log(m) 
                });
                return this.parseText(text);
            }
            catch (error) {
                console.error('OCR Error:', error);
                throw domain_1.CustomError.internalServer('Error procesando imagen del comprobante');
            }
        });
    }
    parseText(text) {
        const cleanText = text.toUpperCase();
        // 1. Detect Bank
        let bank = "";
        if (cleanText.includes("PICHINCHA"))
            bank = "PICHINCHA";
        else if (cleanText.includes("GUAYAQUIL"))
            bank = "GUAYAQUIL";
        else if (cleanText.includes("PRODUBANCO"))
            bank = "PRODUBANCO";
        else if (cleanText.includes("AUSTRIA"))
            bank = "AUSTRO";
        else if (cleanText.includes("PACIFICO"))
            bank = "PACIFICO";
        // 2. Detect Amount (Heuristic: look for numbers with $ or nearby "monto" keywords)
        // Regex for currency: $ 12.34 or 12.34
        // Simple verification: find largest number? Or look for context.
        // Simplifying: Look for lines with "$"
        const amountRegex = /\$\s?(\d{1,5}[.,]\d{2})/g;
        let amountMatch = amountRegex.exec(cleanText);
        let amount;
        if (amountMatch) {
            amount = parseFloat(amountMatch[1].replace(',', '.'));
        }
        // 3. Detect Date
        // DD/MM/YYYY or DD-MM-YYYY
        const dateRegex = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/;
        let dateMatch = dateRegex.exec(cleanText);
        let date;
        if (dateMatch) {
            // Assuming DD/MM/YYYY
            try {
                date = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
            }
            catch (e) { }
        }
        // 4. Detect Receipt Number / Documento
        // Look for "DOCUMENTO", "COMPROBANTE", "NUMERO" followed by digits
        const codeRegex = /(?:DOCUMENTO|COMPROBANTE|NUMERO|NO\.)\D*(\d{4,})/i;
        let codeMatch = codeRegex.exec(cleanText);
        let code;
        if (codeMatch) {
            code = codeMatch[1];
        }
        else {
            // Fallback: look for long number > 6 digits standalone?
            // Risky.
        }
        return {
            text: text,
            suggestedBank: bank,
            suggestedAmount: amount,
            suggestedDate: date,
            suggestedCode: code
        };
    }
}
exports.OcrService = OcrService;
