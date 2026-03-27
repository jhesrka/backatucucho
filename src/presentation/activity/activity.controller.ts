import { Request, Response } from "express";
import { ActivityService } from "../services/activity.service";
import { CustomError } from "../../domain";

export class ActivityController {
    constructor(private readonly activityService: ActivityService) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Activity Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    };

    ping = (req: Request, res: Response) => {
        const user = req.body.sessionUser;
        if (!user) return res.status(401).json({ message: "No session user" });

        this.activityService
            .ping(user.id)
            .then((result) => res.json(result))
            .catch((error) => this.handleError(error, res));
    };
}
