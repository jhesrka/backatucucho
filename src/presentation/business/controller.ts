import { Request, Response } from "express";
import { BusinessService } from "../services/business.service"; // Ajustar import según estructura final
import { CustomError, LoginUserDTO } from "../../domain";

export class BusinessController {
    constructor(private readonly businessService: BusinessService) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Unhandled error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    };

    login = (req: Request, res: Response) => {
        const [error, loginUserDto] = LoginUserDTO.create(req.body);
        if (error) return res.status(422).json({ message: error });

        this.businessService
            .loginBusiness(loginUserDto!)
            .then((data) => res.status(200).json(data))
            .catch((error) => this.handleError(error, res));
    };

    getMyBusinesses = (req: Request, res: Response) => {
        // sessionUser viene del middleware AuthMiddleware
        const { id } = req.body.sessionUser;

        this.businessService
            .getMyBusinesses(id)
            .then((data) => res.status(200).json(data))
            .catch((error) => this.handleError(error, res));
    };

    getOrders = (req: Request, res: Response) => {
        const { businessId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        this.businessService
            .getOrdersByBusiness(businessId, status as string, +page, +limit)
            .then((data) => res.status(200).json(data))
            .catch((error) => this.handleError(error, res));
    };

    updateOrderStatus = (req: Request, res: Response) => {
        const { businessId, orderId } = req.params;
        const { status, motivoCancelacion } = req.body;

        this.businessService
            .updateOrderStatus(businessId, orderId, status, motivoCancelacion)
            .then((data: any) => res.status(200).json(data))
            .catch((error: any) => this.handleError(error, res));
    };

    getFinance = (req: Request, res: Response) => {
        const { businessId } = req.params;
        const { date } = req.query;

        this.businessService
            .getFinanceSummary(businessId, date as string)
            .then((data: any) => res.status(200).json(data))
            .catch((error: any) => this.handleError(error, res));
    };

    registerPayment = (req: Request, res: Response) => {
        const { businessId } = req.params;
        const { date } = req.body;
        const file = (req as any).files?.file;

        this.businessService.registerPayment(businessId, date, file)
            .then(data => res.json(data))
            .catch(error => this.handleError(error, res));
    };
}
