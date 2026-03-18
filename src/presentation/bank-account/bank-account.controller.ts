import { Request, Response } from "express";
import { BankAccountService } from "../services/bank-account.service";

export class BankAccountController {
    constructor(private readonly bankAccountService: BankAccountService) { }

    create = (req: Request, res: Response) => {
        this.bankAccountService.create(req.body)
            .then(account => res.json(account))
            .catch(error => res.status(500).json({ error: error.message }));
    }

    findAll = (req: Request, res: Response) => {
        const onlyActive = req.query.all !== 'true';
        this.bankAccountService.findAll(onlyActive)
            .then(accounts => res.json(accounts))
            .catch(error => res.status(500).json({ error: error.message }));
    }

    update = (req: Request, res: Response) => {
        const { id } = req.params;
        this.bankAccountService.update(id, req.body)
            .then(account => res.json(account))
            .catch(error => res.status(500).json({ error: error.message }));
    }

    delete = (req: Request, res: Response) => {
        const { id } = req.params;
        this.bankAccountService.delete(id)
            .then(() => res.json({ message: 'Account deleted' }))
            .catch(error => res.status(500).json({ error: error.message }));
    }
}
