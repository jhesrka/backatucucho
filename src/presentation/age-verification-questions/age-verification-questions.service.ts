import { CustomError } from "../../domain";
import { AgeVerificationQuestion } from "../../data/postgres/models/AgeVerificationQuestion";

export class AgeVerificationQuestionService {
  async getAllQuestions(onlyActive: boolean = false) {
    try {
      const whereClause = onlyActive ? { activa: true } : {};
      const questions = await AgeVerificationQuestion.find({
        where: whereClause,
        order: { orden: "ASC" },
      });
      return questions;
    } catch (error) {
      throw CustomError.internalServer("Error al obtener preguntas de verificación");
    }
  }

  async createQuestion(data: { pregunta: string; activa?: boolean; orden?: number }) {
    try {
      const question = new AgeVerificationQuestion();
      question.pregunta = data.pregunta;
      if (data.activa !== undefined) question.activa = data.activa;
      if (data.orden !== undefined) question.orden = data.orden;
      return await question.save();
    } catch (error) {
      throw CustomError.internalServer("Error al crear pregunta de verificación");
    }
  }

  async updateQuestion(id: string, data: { pregunta?: string; activa?: boolean; orden?: number }) {
    try {
      const question = await AgeVerificationQuestion.findOne({ where: { id } });
      if (!question) throw CustomError.notFound("Pregunta no encontrada");

      if (data.pregunta !== undefined) question.pregunta = data.pregunta;
      if (data.activa !== undefined) question.activa = data.activa;
      if (data.orden !== undefined) question.orden = data.orden;

      return await question.save();
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al actualizar pregunta de verificación");
    }
  }

  async deleteQuestion(id: string) {
    try {
      const question = await AgeVerificationQuestion.findOne({ where: { id } });
      if (!question) throw CustomError.notFound("Pregunta no encontrada");

      await question.remove();
      return { message: "Pregunta eliminada" };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw CustomError.internalServer("Error al eliminar pregunta de verificación");
    }
  }
}
