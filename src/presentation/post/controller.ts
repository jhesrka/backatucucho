import { Request, Response } from "express";
import { PostService } from "../services/post.service";
import { CreateDTO, CreatePostDTO, CustomError, UpdateDTO } from "../../domain";

export class PostController {
  constructor(private readonly postService: PostService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Something went very wrong" });
  };

  //revisado y aprobado

  createPostPlan = (req: Request, res: Response) => {
    const { title, subtitle, content, isPaid, showWhatsApp, showLikes } = req.body;
    const userId = req.body.sessionUser?.id || req.body.userId;

    if (!userId || !this.isValidUUID(userId)) {
      return res.status(400).json({ message: "ID de usuario inválido o no proporcionado" });
    }

    // Convertir isPaid a booleano correctamente
    const isPaidBool = isPaid === "true" || isPaid === true;
    const showWhatsAppBool = showWhatsApp === "true" || showWhatsApp === true || showWhatsApp === undefined;
    const showLikesBool = showLikes === "true" || showLikes === true || showLikes === undefined;

    this.postService
      .createPostPlan(
        {
          userId,
          title,
          subtitle,
          content,
          isPaid: isPaidBool,
          showWhatsApp: showWhatsAppBool,
          showLikes: showLikesBool,
        },
        req.files as Express.Multer.File[]
      )
      .then((data) => res.status(201).json(data))
      .catch((error) => this.handleError(error, res));
  };

  findAllPostPaginated = (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.body.sessionUser?.id;

    if (page <= 0 || limit <= 0) {
      return res.status(400).json({
        message: "Los parámetros 'page' y 'limit' deben ser números positivos.",
      });
    }

    this.postService
      .findAllPostPaginated(page, limit, userId)
      .then((data) => res.status(200).json(data))
      .catch((error) => this.handleError(error, res));
  };


  findOnePost = (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.body.sessionUser?.id;

    this.postService
      .findOnePost(id, userId)
      .then((data) => {
        res.status(201).json(data);
      })
      .catch((error: unknown) => this.handleError(error, res));
  };

  getPostsByUser = async (req: Request, res: Response) => {
    try {
      // Verificación más estricta del usuario de sesión
      const sessionUser = req.body.sessionUser;

      if (!sessionUser?.id) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado o sesión inválida",
        });
      }

      // Validación de UUID
      if (!this.isValidUUID(sessionUser.id)) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario no válido",
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const data = await this.postService.getPostsByUser(sessionUser.id, page);

      res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  updatePostDate = async (req: Request, res: Response) => {
    const { id: postId } = req.params;
    const userId = req.body.sessionUser?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!this.isValidUUID(userId)) {
      return res.status(400).json({ message: "ID de usuario no válido" });
    }

    try {
      const result = await this.postService.updatePostDate(postId, userId);
      return res.status(200).json(result);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  deletePost = (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.body.sessionUser?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    this.postService
      .deletePost(id, userId)
      .then((result) => res.status(200).json(result))
      .catch((error) => this.handleError(error, res));
  };

  updatePost = async (req: Request, res: Response) => {
    const { id } = req.params;

    // Creamos el DTO con los datos enviados (todos opcionales)
    const [, updatePostDto] = UpdateDTO.create(req.body);

    try {
      const postActualizado = await this.postService.updatePost(
        id,
        updatePostDto!
      );
      res.status(200).json(postActualizado);
    } catch (error: unknown) {
      this.handleError(error, res);
    }
  };

  searchPost = (req: Request, res: Response) => {
    const { searchTerm } = req.query;
    const userId = req.body.sessionUser?.id;
    if (!searchTerm || typeof searchTerm !== "string") {
      return res
        .status(400)
        .json({ message: "Debe proporcionar un término de búsqueda" });
    }
    this.postService
      .searchPost(searchTerm, userId)
      .then((data) => {
        res.status(200).json(data);
      })
      .catch((error: unknown) => this.handleError(error, res));
  };

  //ADMINISTRADOR

  // Total de posts pagados activos (estatus PUBLICADO + autor con suscripción activa)
  countActivePaidPosts = (_req: Request, res: Response) => {
    this.postService
      .countActivePaidPosts()
      .then((total) =>
        res.status(200).json({
          success: true,
          total,
        })
      )
      .catch((error) => this.handleError(error, res));
  };
  // Total de posts pagados activos en las últimas 24h
  countActivePaidPostsLast24h = (_req: Request, res: Response) => {
    this.postService
      .countActivePaidPostsLast24h()
      .then((total) =>
        res.status(200).json({
          success: true,
          total,
        })
      )
      .catch((error) => this.handleError(error, res));
  };
  // Cantidad de posts gratuitos publicados (vigentes)
  countFreePublishedPosts = (_req: Request, res: Response) => {
    this.postService
      .countFreePublishedPosts()
      .then((total) =>
        res.status(200).json({
          success: true,
          total,
        })
      )
      .catch((error) => this.handleError(error, res));
  };
  // Dentro de la clase PostController
  // GET /api/admin/posts/search-by-id/:id   (también soporta ?id=...)
  getPostByIdAdmin = async (req: Request, res: Response) => {
    try {
      const id = (req.params.id as string) || (req.query.id as string) || "";

      if (!id) {
        return res
          .status(400)
          .json({ message: "Debe proporcionar el ID del post" });
      }

      // Validación temprana (el service también valida, pero así respondemos más claro al admin)
      if (!this.isValidUUID(id)) {
        return res.status(400).json({ message: "ID de post inválido" });
      }

      const post = await this.postService.findPostByIdAdmin(id);

      return res.status(200).json({
        success: true,
        post,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  // ADMIN: Get all posts for a specific user
  getPostsByUserAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params; // userId
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!id) return res.status(400).json({ message: "User ID is required" });

      const data = await this.postService.getPostsByUserAdmin(id, page, limit);

      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  }
  // ADMINISTRADOR - Bloquear post
  // POST /api/post/admin/:id/block
  // ADMINISTRADOR - Bloquear/Desbloquear post (toggle)
  // POST /api/post/admin/:id/block
  blockPostAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res
          .status(400)
          .json({ message: "Debe proporcionar el ID del post" });
      }

      if (!this.isValidUUID(id)) {
        return res.status(400).json({ message: "ID de post inválido" });
      }

      const { message, status } = await this.postService.blockPostAdmin(id);
      const action = status === "BLOQUEADO" ? "block" : "unblock";

      return res.status(200).json({
        success: true,
        action, // "block" | "unblock"
        status, // nuevo estado del post
        message, // "Post bloqueado correctamente" | "Post desbloqueado correctamente"
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };
  // ADMINISTRADOR - Purgar posts ELIMINADO (>3 días) y sus imágenes
  // DELETE /api/post/admin/purge-deleted


  // ADMIN: Change status explicitly
  changeStatusPostAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ message: "Status is required" });

    this.postService.changeStatusPostAdmin(id, status)
      .then(data => res.status(200).json(data))
      .catch(err => this.handleError(err, res));
  }

  // ADMIN: Purge definitive
  purgePostAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    this.postService.purgePostAdmin(id)
      .then(data => res.status(200).json(data))
      .catch(err => this.handleError(err, res));
  }

  // ADMINISTRADOR - Purgar posts ELIMINADO (>3 días) y sus imágenes
  // DELETE /api/post/admin/purge-deleted
  purgeDeletedPostsOlderThan3Days = async (_req: Request, res: Response) => {
    try {
      const { deletedCount } =
        await this.postService.purgeDeletedPostsOlderThan3Days();

      return res.status(200).json({
        success: true,
        deletedCount,
      });
    } catch (error) {
      console.error(
        "💥 Error en controlador purgeDeletedPostsOlderThan3Days:",
        error
      );
      return this.handleError(error, res);
    }
  };
  // ==========================================
  // 🛡️ ADMIN DASHBOARD METHODS
  // ==========================================

  getAdminStats = (_req: Request, res: Response) => {
    this.postService.getAdminStats()
      .then(data => res.status(200).json(data))
      .catch(error => this.handleError(error, res));
  }

  getAdminPosts = (req: Request, res: Response) => {
    const filters = {
      id: req.query.id,
      status: req.query.status,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    this.postService.getAdminPosts(filters, page, limit)
      .then(data => res.status(200).json(data))
      .catch(error => this.handleError(error, res));
  }

  purgeOldDeletedPosts = (_req: Request, res: Response) => {
    this.postService.purgeOldDeletedPosts()
      .then(data => res.status(200).json(data))
      .catch(error => this.handleError(error, res));
  }
}
