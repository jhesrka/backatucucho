import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { CustomError } from "../../domain";

export class AuthController {
    constructor(private readonly authService: AuthService) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Auth Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    };

    refreshToken = (req: Request, res: Response) => {
        const { refreshToken } = req.body;

        this.authService
            .refreshToken(refreshToken)
            .then((data) => res.status(200).json(data))
            .catch((error) => this.handleError(error, res));
    };
}
