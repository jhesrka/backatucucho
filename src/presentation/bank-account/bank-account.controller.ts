import { Request, Response } from "express";
import { BankAccountService } from "../services/bank-account.service";
import { UseradminService } from "../services/administradorService/useradmin.service";

export class BankAccountController {
    constructor(
        private readonly bankAccountService: BankAccountService,
        private readonly userAdminService: UseradminService
    ) { }

    create = async (req: Request, res: Response) => {
        const { masterPin, ...data } = req.body;

        try {
            if (!masterPin) return res.status(400).json({ error: "PIN Maestro es requerido" });
            
            // Validar PIN contra GlobalSettings
            await this.userAdminService.validateMasterPin(masterPin);

            const account = await this.bankAccountService.create(data);
            res.json(account);
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }

    findAll = (req: Request, res: Response) => {
        const onlyActive = req.query.all !== 'true';
        this.bankAccountService.findAll(onlyActive)
            .then(accounts => res.json(accounts))
            .catch(error => res.status(500).json({ error: error.message }));
    }

    update = async (req: Request, res: Response) => {
        const { id } = req.params;
        const { masterPin, ...data } = req.body;

        try {
            if (!masterPin) return res.status(400).json({ error: "PIN Maestro es requerido para actualizar" });
            
            // Validar PIN contra GlobalSettings
            await this.userAdminService.validateMasterPin(masterPin);

            const account = await this.bankAccountService.update(id, data);
            res.json(account);
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }

    delete = async (req: Request, res: Response) => {
        const { id } = req.params;
        // Para DELETE, el PIN podría venir en el body (si se usa POST/PATCH para delete) 
        // o como un query param. Dado que frontend enviará JSON en body (si es una petición con body), 
        // pero DELETE estándar a veces no tiene body. 
        // Siguiendo el requerimiento de "editar o crear", nos enfocamos en esos.
        // Pero añadiremos soporte para masterPin en body por si acaso.
        const { masterPin } = req.body;

        try {
            // Intentar obtener del body o query
            const pin = masterPin || req.query.masterPin;
            if (!pin) return res.status(400).json({ error: "PIN Maestro es requerido para eliminar" });

            await this.userAdminService.validateMasterPin(pin as string);

            await this.bankAccountService.delete(id);
            res.json({ message: 'Account deleted' });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }
}
