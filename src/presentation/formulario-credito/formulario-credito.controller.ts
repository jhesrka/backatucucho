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
      const { negocioId, respuestas, preguntas, idempotencyKey } = req.body; 
      // Obtenemos el userId desde el sessionUser que inyecta el middleware AuthMiddleware
      const userId = req.body.sessionUser?.id; 

      if (!userId) {
        return res.status(401).json({ error: "No autorizado" });
      }

      if (!idempotencyKey) {
        return res.status(400).json({ error: "idempotencyKey es requerido" });
      }

      const result = await this.formularioCreditoService.procesarLeadCredito(
        negocioId, 
        userId, 
        respuestas, 
        preguntas, 
        idempotencyKey
      );
      
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  };

  obtenerLeadsPorNegocio = async (req: Request, res: Response) => {
    try {
      const { negocioId } = req.params;
      const leads = await this.formularioCreditoService.obtenerLeads(negocioId);
      return res.status(200).json(leads);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  };

  obtenerLeadPorCodigoAuditoria = async (req: Request, res: Response) => {
    try {
      const { codigo } = req.params;
      const lead = await this.formularioCreditoService.obtenerLeadPorCodigoAuditoria(codigo);
      if (!lead) {
        return res.status(404).json({ error: "No se encontró ningún registro para este código" });
      }
      return res.status(200).json(lead);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  };
  obtenerTodosLosLeadsAuditoria = async (req: Request, res: Response) => {
    try {
      const fecha = req.query.fecha as string || new Date().toISOString().split('T')[0];
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const result = await this.formularioCreditoService.obtenerTodosLosLeadsAuditoria(fecha, page, limit);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  };
}
