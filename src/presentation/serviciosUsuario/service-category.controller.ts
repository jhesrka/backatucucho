import { Request, Response } from "express";
import { ServiceCategoryService } from "../services/serviciosUsuario/service-category.service";

export class ServiceCategoryController {
  constructor(private readonly serviceCategoryService: ServiceCategoryService) {}

  getPublicCategories = (req: Request, res: Response) => {
    this.serviceCategoryService.getPublicCategories()
      .then((categories) => res.json(categories))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  getPublicSubcategoriesByCategory = (req: Request, res: Response) => {
    const { categoriaId } = req.params;
    this.serviceCategoryService.getPublicSubcategoriesByCategory(categoriaId)
      .then((subcategories) => res.json(subcategories))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  getActiveCategoriesForCreation = (req: Request, res: Response) => {
    this.serviceCategoryService.getActiveCategoriesForCreation()
      .then((categories) => res.json(categories))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  getAllCategoriesAdmin = (req: Request, res: Response) => {
    this.serviceCategoryService.getAllCategoriesAdmin()
      .then((categories) => res.json(categories))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  createCategory = (req: Request, res: Response) => {
    const { nombre } = req.body;
    this.serviceCategoryService.createCategory(nombre)
      .then((category) => res.json(category))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  updateCategory = (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    this.serviceCategoryService.updateCategory(id, nombre, estado)
      .then((category) => res.json(category))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  createSubcategory = (req: Request, res: Response) => {
    const { categoriaId } = req.params;
    const { nombre, icono } = req.body;
    this.serviceCategoryService.createSubcategory(categoriaId, nombre, icono)
      .then((subcategory) => res.json(subcategory))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  updateSubcategory = (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre, estado, icono } = req.body;
    this.serviceCategoryService.updateSubcategory(id, nombre, estado, icono)
      .then((subcategory) => res.json(subcategory))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  deleteCategory = (req: Request, res: Response) => {
    const { id } = req.params;
    this.serviceCategoryService.deleteCategory(id)
      .then((result) => res.json(result))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  deleteSubcategory = (req: Request, res: Response) => {
    const { id } = req.params;
    this.serviceCategoryService.deleteSubcategory(id)
      .then((result) => res.json(result))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };

  seedCategories = (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: "Este endpoint solo está disponible en entorno de desarrollo." });
    }
    this.serviceCategoryService.seedCategories()
      .then((result) => res.json(result))
      .catch((error) => res.status(error.statusCode || 500).json({ error: error.message }));
  };
}
