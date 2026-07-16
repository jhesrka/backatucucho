import { Request, Response } from "express";
import { FormularioCreditoService } from "../services/formularioCredito.service";

export class FormularioCreditoController {
  constructor(
    private readonly formularioCreditoService: FormularioCreditoService
  ) {}

  obtenerPreguntasPorNegocio = async (req: Request, res: Response) => {
    try {
      const { negocioId } = req.params;
      const preguntas = await this.formularioCreditoService.obtenerPreguntas(negocioId);
      return res.status(200).json(preguntas);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  };

  guardarPreguntas = async (req: Request, res: Response) => {
    try {
      const { negocioId } = req.params;
      const { preguntas } = req.body;
      const result = await this.formularioCreditoService.guardarPreguntas(negocioId, preguntas);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  };

  pagarLeadCredito = async (req: Request, res: Response) => {
    try {
      const { negocioId } = req.body; // El negocio dueño del lead
      // const userId = req.body.sessionUser.id; // Podría usarse para saber quién lo llenó, o nada si solo es cobrar al dueño
      const result = await this.formularioCreditoService.cobrarLeadAlDueño(negocioId);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  };
}
