import { Request, Response } from "express";
import { LikeService } from "../services/postService/like.service";
import { CustomError } from "../../domain";
import { CreateLikeDTO } from "../../domain/dtos/likes/like.dto";

export class LikeController {
  constructor(private readonly likeService: LikeService) { }

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Error inesperado" });
  };

  /**
   * Agrega un like a un post.
   */
  addLike = async (req: Request, res: Response) => {
    // Si el body no trae userId pero tenemos sessionUser (AuthMiddleware), lo inyectamos
    if (!req.body.userId && req.body.sessionUser?.id) {
      req.body.userId = req.body.sessionUser.id;
    }

    const [error, createLikeDto] = CreateLikeDTO.create(req.body);
    if (error) return res.status(400).json({ message: error });

    this.likeService
      .addLike(createLikeDto!)
      .then((result) => res.status(200).json(result))
      .catch((err) => this.handleError(err, res));
  };

  /**
   * Elimina un like de un post.
   */
  removeLike = async (req: Request, res: Response) => {
    const { postId } = req.params;
    const userId = req.body.sessionUser?.id; // Autenticación middleware debe proveer esto

    if (!userId) return res.status(401).json({ message: "Usuario no autenticado" });

    this.likeService
      .removeLike(postId, userId)
      .then((result) => res.status(200).json(result))
      .catch((err) => this.handleError(err, res));
  }

  /**
   * Cuenta la cantidad total de likes de un post.
   */
  countLikesByPost = async (req: Request, res: Response) => {
    const { postId } = req.params;
    this.likeService
      .countLikesByPost(postId)
      .then((count) => res.status(200).json({ count }))
      .catch((err) => this.handleError(err, res));
  };

  /**
   * Verifica si un usuario ya dio like a un post.
   */
  hasUserLikedPost = async (req: Request, res: Response) => {
    const { postId, userId } = req.params;
    this.likeService
      .hasUserLikedPost(userId, postId)
      .then((liked) => res.status(200).json({ liked }))
      .catch((err) => this.handleError(err, res));
  };
}
