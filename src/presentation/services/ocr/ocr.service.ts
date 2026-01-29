import Tesseract from 'tesseract.js';
import { CustomError } from '../../../domain';

interface ExtractedData {
    text: string;
    suggestedBank?: string;
    suggestedAmount?: number;
    suggestedDate?: Date;
    suggestedCode?: string;
}

export class OcrService {

    async processImage(imageBuffer: Buffer): Promise<ExtractedData> {
        try {
            const { data: { text } } = await Tesseract.recognize(
                imageBuffer,
                'spa',
                {
                    // logger: m => console.log(m) 
                }
            );

            return this.parseText(text);
        } catch (error) {
            console.error('OCR Error:', error);
            throw CustomError.internalServer('Error procesando imagen del comprobante');
        }
    }

    private parseText(text: string): ExtractedData {
        const cleanText = text.toUpperCase();

        // 1. Detect Bank
        let bank = "";
        if (cleanText.includes("PICHINCHA")) bank = "PICHINCHA";
        else if (cleanText.includes("GUAYAQUIL")) bank = "GUAYAQUIL";
        else if (cleanText.includes("PRODUBANCO")) bank = "PRODUBANCO";
        else if (cleanText.includes("AUSTRIA")) bank = "AUSTRO";
        else if (cleanText.includes("PACIFICO")) bank = "PACIFICO";

        // 2. Detect Amount (Heuristic: look for numbers with $ or nearby "monto" keywords)
        // Regex for currency: $ 12.34 or 12.34
        // Simple verification: find largest number? Or look for context.
        // Simplifying: Look for lines with "$"
        const amountRegex = /\$\s?(\d{1,5}[.,]\d{2})/g;
        let amountMatch = amountRegex.exec(cleanText);
        let amount: number | undefined;
        if (amountMatch) {
            amount = parseFloat(amountMatch[1].replace(',', '.'));
        }

        // 3. Detect Date
        // DD/MM/YYYY or DD-MM-YYYY
        const dateRegex = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/;
        let dateMatch = dateRegex.exec(cleanText);
        let date: Date | undefined;
        if (dateMatch) {
            // Assuming DD/MM/YYYY
            try {
                date = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
            } catch (e) { }
        }

        // 4. Detect Receipt Number / Documento
        // Look for "DOCUMENTO", "COMPROBANTE", "NUMERO" followed by digits
        const codeRegex = /(?:DOCUMENTO|COMPROBANTE|NUMERO|NO\.)\D*(\d{4,})/i;
        let codeMatch = codeRegex.exec(cleanText);
        let code: string | undefined;
        if (codeMatch) {
            code = codeMatch[1];
        } else {
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
