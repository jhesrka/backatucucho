import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs } from "../../config";
import { BankAccount } from "../../data/postgres/models/BankAccount";

export class BankAccountService {
    private extractKey(urlOrKey: string): string {
        if (!urlOrKey) return urlOrKey;
        if (!urlOrKey.startsWith('http')) return urlOrKey;

        try {
            // Try to extract key from a standard S3 URL or signed URL
            const url = new URL(urlOrKey);
            // The path usually starts with /bucket/key or is just /key if it's virtual-hosted
            let key = url.pathname.substring(1);

            // If it's a signed URL, it might have query params, but pathname is just the key
            // (unless it's path-style, then it's bucket/key)
            if (key.startsWith(`${envs.AWS_BUCKET_NAME}/`)) {
                key = key.replace(`${envs.AWS_BUCKET_NAME}/`, '');
            }

            return key;
        } catch (error) {
            return urlOrKey;
        }
    }

    async create(data: Partial<BankAccount>, file?: Express.Multer.File) {
        if (data.qrImageUrl) {
            data.qrImageUrl = this.extractKey(data.qrImageUrl);
        }

        if (file) {
            const key = await UploadFilesCloud.uploadSingleFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: `BankLogos/${Date.now()}_${file.originalname.replace(/\s/g, "")}`,
                body: file.buffer,
                contentType: file.mimetype
            });
            data.logoUrl = key;
        }

        const bankAccount = BankAccount.create(data as any);
        return await bankAccount.save();
    }

    async findAll(onlyActive: boolean = true) {
        const where = onlyActive ? { isActive: true } : {};
        const accounts = await BankAccount.find({
            where,
            order: { order: 'ASC', createdAt: 'DESC' }
        });

        // Sign URLs
        return await Promise.all(accounts.map(async (account) => {
            if (account.qrImageUrl) {
                const key = this.extractKey(account.qrImageUrl);
                account.qrImageUrl = await UploadFilesCloud.getFile({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: key
                });
            }
            if (account.logoUrl) {
                const logoUrls = await UploadFilesCloud.getOptimizedUrls({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: account.logoUrl
                });
                account.logoUrl = logoUrls.original || account.logoUrl;
            }
            return account;
        }));
    }

    async findOne(id: string) {
        const account = await BankAccount.findOneBy({ id });
        if (account && account.qrImageUrl) {
            const key = this.extractKey(account.qrImageUrl);
            account.qrImageUrl = await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: key
            });
        }
        if (account && account.logoUrl) {
            const logoUrls = await UploadFilesCloud.getOptimizedUrls({
                bucketName: envs.AWS_BUCKET_NAME,
                key: account.logoUrl
            });
            account.logoUrl = logoUrls.original || account.logoUrl;
        }
        return account;
    }

    async update(id: string, data: Partial<BankAccount>, file?: Express.Multer.File) {
        const bankAccount = await BankAccount.findOneBy({ id });
        if (!bankAccount) throw new Error('Bank account not found');

        if (data.qrImageUrl) {
            data.qrImageUrl = this.extractKey(data.qrImageUrl);
        }

        if (file) {
            const key = await UploadFilesCloud.uploadSingleFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: `BankLogos/${Date.now()}_${file.originalname.replace(/\s/g, "")}`,
                body: file.buffer,
                contentType: file.mimetype
            });
            data.logoUrl = key;
        }

        Object.assign(bankAccount, data);
        const saved = await bankAccount.save();

        // Return with signed URL
        if (saved.qrImageUrl) {
            saved.qrImageUrl = await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: saved.qrImageUrl
            });
        }
        if (saved.logoUrl) {
            const logoUrls = await UploadFilesCloud.getOptimizedUrls({
                bucketName: envs.AWS_BUCKET_NAME,
                key: saved.logoUrl
            });
            saved.logoUrl = logoUrls.original || saved.logoUrl;
        }
        return saved;
    }

    async delete(id: string) {
        const bankAccount = await this.findOne(id);
        if (!bankAccount) throw new Error('Bank account not found');

        return await bankAccount.remove();
    }
}
