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

    async create(data: Partial<BankAccount>) {
        if (data.qrImageUrl) {
            data.qrImageUrl = this.extractKey(data.qrImageUrl);
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

        // Sign QR URLs
        return await Promise.all(accounts.map(async (account) => {
            if (account.qrImageUrl) {
                // Always try to get a fresh signed URL from the key
                const key = this.extractKey(account.qrImageUrl);
                account.qrImageUrl = await UploadFilesCloud.getFile({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: key
                });
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
        return account;
    }

    async update(id: string, data: Partial<BankAccount>) {
        const bankAccount = await BankAccount.findOneBy({ id });
        if (!bankAccount) throw new Error('Bank account not found');

        if (data.qrImageUrl) {
            data.qrImageUrl = this.extractKey(data.qrImageUrl);
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
        return saved;
    }

    async delete(id: string) {
        const bankAccount = await this.findOne(id);
        if (!bankAccount) throw new Error('Bank account not found');

        return await bankAccount.remove();
    }
}
