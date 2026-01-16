import { Like, Post, User } from "../../../data";
import { CreateLikeDTO, CustomError } from "../../../domain";
import { getIO } from "../../../config/socket";

export class LikeService {
  /**
   * Agrega un like a un post.
   * Maneja concurrencia y evita duplicados con la restricción de base de datos.
   */
  async addLike(createLikeDto: CreateLikeDTO) {
    const { userId, postId } = createLikeDto;

    // 1. Validaciones previas
    const post = await Post.findOneBy({ id: postId });
    if (!post) throw CustomError.notFound("Post no encontrado");

    const user = await User.findOneBy({ id: userId });
    if (!user) throw CustomError.notFound("Usuario no encontrado");

    try {
      // 2. Intentar crear el like
      // Si ya existe, fallará por la restricción UNIQUE (user_id, post_id)
      const newLike = Like.create({ user, post });
      await newLike.save();

      // 3. Incrementar contador atómicamente
      await Post.getRepository().increment({ id: postId }, "likesCount", 1);

      // 4. Obtener el nuevo contador para actualizar al cliente
      // Podemos confiar en que incrementó, pero para estar 100% seguros leemos o calculamos
      // Por performance, podemos devolver el valor anterior + 1, pero si queremos consistencia eventual:
      const updatedPost = await Post.findOne({ where: { id: postId }, select: ['likesCount'] });

      const realLikes = updatedPost?.likesCount || 0;

      // 5. Emitir evento Websocket
      getIO().emit("post_like_updated", {
        postId: postId,
        totalLikes: realLikes,
      });

      return {
        liked: true,
        message: "Like agregado",
        likesCount: realLikes,
      };

    } catch (error: any) {
      // Manejo de error de duplicado (Postgres error code 23505)
      if (error.code === '23505') {
        throw CustomError.badRequest("Ya has dado like a este post");
      }
      throw CustomError.internalServer("Error al dar like");
    }
  }

  /**
   * Elimina un like de un post.
   */
  async removeLike(postId: string, userId: string) {
    const like = await Like.findOne({
      where: {
        post: { id: postId },
        user: { id: userId },
      },
    });

    if (!like) {
      throw CustomError.badRequest("No has dado like a este post");
    }

    try {
      // 1. Eliminar el like
      await like.remove();

      // 2. Decrementar contador atómicamente
      await Post.getRepository().decrement({ id: postId }, "likesCount", 1);

      // 3. Obtener contador actualizado
      const updatedPost = await Post.findOne({ where: { id: postId }, select: ['likesCount'] });
      const realLikes = updatedPost?.likesCount || 0;

      // 4. Emitir evento Websocket
      getIO().emit("post_like_updated", {
        postId: postId,
        totalLikes: realLikes,
      });

      return {
        liked: false,
        message: "Like eliminado",
        likesCount: realLikes,
      };

    } catch (error) {
      throw CustomError.internalServer("Error al quitar like");
    }
  }

  /**
   * Devuelve el número total de likes que tiene un post.
   */
  async countLikesByPost(postId: string): Promise<number> {
    const post = await Post.findOne({ where: { id: postId }, select: ['likesCount'] });
    return post?.likesCount || 0;
  }

  /**
   * Verifica si un usuario ya dio like a un post (para frontend).
   */
  async hasUserLikedPost(userId: string, postId: string): Promise<boolean> {
    const like = await Like.findOne({
      where: {
        user: { id: userId },
        post: { id: postId },
      },
      select: ['id'] // Optimización: solo traer ID
    });
    return !!like;
  }
}
