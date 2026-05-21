import { Request, Response } from 'express';
import { TrainingVideo } from '../../data/postgres/models/TrainingVideo';
import { TrainingCategory } from '../../data/postgres/models/TrainingCategory';
import { JwtAdapterAdmin } from '../../config/jwt.adapteradmin';
import { User, Useradmin, UserMotorizado } from '../../data';
import { In } from 'typeorm';

export class TrainingController {
  
  static getPublicVideos = async (req: Request, res: Response) => {
    try {
      const activeRoles = new Set<string>();

      // Read tokens from query parameters
      const tokenAdmin = req.query.ta as string;
      const tokenMotorizado = req.query.tm as string;
      const tokenClient = req.query.tc as string;

      const processToken = async (token: string, expectedRole: string, entityClass: any) => {
        try {
          const payload = await JwtAdapterAdmin.validateTokenAdmin(token) as { id?: string };
          if (payload?.id) {
            const user = await entityClass.findOneBy({ id: payload.id });
            if (user) activeRoles.add(expectedRole);
          }
        } catch (e) {
          // invalid token, ignore
        }
      };

      if (tokenAdmin) await processToken(tokenAdmin, 'ADMIN', Useradmin);
      if (tokenMotorizado) await processToken(tokenMotorizado, 'MOTORIZADO', UserMotorizado);
      if (tokenClient) await processToken(tokenClient, 'CLIENT', User);

      // Si no hay roles activos, es GUEST
      if (activeRoles.size === 0) {
        activeRoles.add('GUEST');
      }

      const activeRolesArray = Array.from(activeRoles);

      const allCategories = await TrainingCategory.find();

      const allowedCategories = allCategories.filter(cat => {
        // Normalizar: TypeORM simple-array con DEFAULT '' devuelve [''] no []
        const rawRoles = Array.isArray(cat.allowedRoles) ? cat.allowedRoles : [];
        const validRoles = rawRoles.filter(r => r && r.trim() !== '');
        
        // Si no hay roles válidos definidos → sin restricción → todos pueden ver
        if (validRoles.length === 0) return true;
        
        // Intersección: ¿Hay algún rol requerido que el usuario tenga?
        return validRoles.some(role => activeRoles.has(role));
      });

      const allowedCategoryNames = allowedCategories.map(c => c.name.trim());

      if (allowedCategoryNames.length === 0) {
        return res.json([]);
      }

      const allVideos = await TrainingVideo.find({ where: { isActive: true } });

      const videos = await TrainingVideo.find({
        where: { isActive: true, category: In(allowedCategoryNames) },
        order: { priority: 'DESC', createdAt: 'DESC' }
      });

      return res.json(videos);
    } catch (error) {
      console.error('Error in getPublicVideos:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static getAllVideos = async (req: Request, res: Response) => {
    try {
      const videos = await TrainingVideo.find({
        order: { priority: 'DESC', createdAt: 'DESC' }
      });
      return res.json(videos);
    } catch (error) {
      console.error('Error in getAllVideos:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static createVideo = async (req: Request, res: Response) => {
    try {
      const { title, category, youtubeUrl, description, priority, isActive } = req.body;
      
      const newVideo = TrainingVideo.create({
        title,
        category,
        youtubeUrl,
        description,
        priority: priority || 0,
        isActive: isActive !== undefined ? isActive : true
      });

      await newVideo.save();
      return res.status(201).json(newVideo);
    } catch (error) {
      console.error('Error in createVideo:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static updateVideo = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, category, youtubeUrl, description, priority, isActive } = req.body;

      const video = await TrainingVideo.findOneBy({ id });
      if (!video) {
        return res.status(404).json({ error: 'Video no encontrado' });
      }

      if (title !== undefined) video.title = title;
      if (category !== undefined) video.category = category;
      if (youtubeUrl !== undefined) video.youtubeUrl = youtubeUrl;
      if (description !== undefined) video.description = description;
      if (priority !== undefined) video.priority = priority;
      if (isActive !== undefined) video.isActive = isActive;

      await video.save();

      return res.json(video);
    } catch (error) {
      console.error('Error in updateVideo:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static toggleVideoStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const video = await TrainingVideo.findOneBy({ id });
      if (!video) {
        return res.status(404).json({ error: 'Video no encontrado' });
      }

      video.isActive = !video.isActive;
      await video.save();
      
      return res.json(video);
    } catch (error) {
      console.error('Error in toggleVideoStatus:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static deleteVideo = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const video = await TrainingVideo.findOneBy({ id });
      if (!video) {
        return res.status(404).json({ error: 'Video no encontrado' });
      }

      await video.remove();
      return res.json({ message: 'Video eliminado correctamente' });
    } catch (error) {
      console.error('Error in deleteVideo:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  // ================= CATEGORÍAS =================

  static getCategories = async (req: Request, res: Response) => {
    try {
      const categories = await TrainingCategory.find({
        order: { name: 'ASC' }
      });
      return res.json(categories);
    } catch (error) {
      console.error('Error in getCategories:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static createCategory = async (req: Request, res: Response) => {
    try {
      const { name, allowedRoles } = req.body;
      if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

      // Verificar si ya existe
      const exists = await TrainingCategory.findOneBy({ name });
      if (exists) return res.status(400).json({ error: 'La categoría ya existe' });

      const newCategory = TrainingCategory.create({ 
        name,
        allowedRoles: allowedRoles || ['GUEST', 'CLIENT', 'MOTORIZADO', 'ADMIN']
      });
      await newCategory.save();
      return res.status(201).json(newCategory);
    } catch (error) {
      console.error('Error in createCategory:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static updateCategory = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, allowedRoles } = req.body;

      const category = await TrainingCategory.findOneBy({ id });
      if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });

      if (name) category.name = name;
      if (allowedRoles) category.allowedRoles = allowedRoles;

      await category.save();
      return res.json(category);
    } catch (error) {
      console.error('Error in updateCategory:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  static deleteCategory = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const category = await TrainingCategory.findOneBy({ id });
      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      await category.remove();
      return res.json({ message: 'Categoría eliminada' });
    } catch (error) {
      console.error('Error in deleteCategory:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
