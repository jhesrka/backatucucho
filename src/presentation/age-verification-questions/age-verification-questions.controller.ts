import { Request, Response } from "express";
import { CustomError } from "../../domain";
import { AgeVerificationQuestionService } from "./age-verification-questions.service";

export class AgeVerificationQuestionController {
  constructor(private readonly ageVerificationQuestionService: AgeVerificationQuestionService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  getAllQuestions = (req: Request, res: Response) => {
    const onlyActive = req.query.activas === "true";
    this.ageVerificationQuestionService
      .getAllQuestions(onlyActive)
      .then((questions) => res.status(200).json(questions))
      .catch((error) => this.handleError(error, res));
  };

  createQuestion = (req: Request, res: Response) => {
    const { pregunta, activa, orden } = req.body;
    if (!pregunta) {
      return res.status(400).json({ message: "La pregunta es obligatoria" });
    }

    this.ageVerificationQuestionService
      .createQuestion({ pregunta, activa, orden })
      .then((question) => res.status(201).json(question))
      .catch((error) => this.handleError(error, res));
  };

  updateQuestion = (req: Request, res: Response) => {
    const id = req.params.id;
    const { pregunta, activa, orden } = req.body;

    this.ageVerificationQuestionService
      .updateQuestion(id, { pregunta, activa, orden })
      .then((question) => res.status(200).json(question))
      .catch((error) => this.handleError(error, res));
  };

  deleteQuestion = (req: Request, res: Response) => {
    const id = req.params.id;

    this.ageVerificationQuestionService
      .deleteQuestion(id)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };
}
