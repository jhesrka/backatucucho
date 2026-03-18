import { In, LessThan } from "typeorm";
import { Post, Storie, Subscription, SubscriptionStatus, User, GlobalSettings } from "../../data";
import { UploadFilesCloud, envs } from "../../config";

export class CleanupService {
  constructor() {}

  /**
   * Identifica y elimina completamente el contenido y registros de usuarios
   * cuya suscripción expiró hace más de 60 días y no ha sido renovada.
   */
  async cleanupInactiveSubscriptions(): Promise<{
    usersProcessed: number;
    postsDeleted: number;
    storiesDeleted: number;
    filesDeleted: number;
  }> {
    const results = {
      usersProcessed: 0,
      postsDeleted: 0,
      storiesDeleted: 0,
      filesDeleted: 0,
    };

    try {
      // 0. Obtener configuración dinámica
      const settings = await GlobalSettings.findOne({ where: {} });
      const daysToPurge = settings?.cleanupSubscriptionContentDays || 60;

      const exclusionPeriod = new Date();
      exclusionPeriod.setDate(exclusionPeriod.getDate() - daysToPurge);

      console.log(`[Cleanup] Iniciando limpieza estricta: suscripciones vencidas hace > ${daysToPurge} días (${exclusionPeriod.toISOString()})`);
      // Y que no tengan ninguna suscripción activa o que expire recientemente.
      
      // Usamos QueryBuilder para mayor precisión
      const inactiveUsers = await User.createQueryBuilder("user")
        .innerJoin("user.subscriptions", "sub")
        // Usuarios que tienen AL MENOS una suscripción expirada hace > 60 días
        .where("sub.endDate < :exclusionPeriod", { exclusionPeriod })
        // PERO que NO tienen ninguna suscripción activa O que haya vencido hace MENOS de 60 días
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select("s.userId")
            .from(Subscription, "s")
            .where("s.status = :activeStatus")
            .orWhere("s.endDate >= :exclusionPeriod")
            .getQuery();
          return "user.id NOT IN " + subQuery;
        })
        .setParameters({
          exclusionPeriod,
          activeStatus: SubscriptionStatus.ACTIVA
        })
        .getMany();


      if (!inactiveUsers.length) return results;

      for (const user of inactiveUsers) {
        console.log(`[Cleanup] Purgeando contenido del usuario inactivo: ${user.name} (${user.id})`);
        
        // 2. Obtener Posts para borrar archivos S3
        const posts = await Post.find({ where: { user: { id: user.id } } });
        for (const post of posts) {
          if (post.imgpost && post.imgpost.length > 0) {
            for (const key of post.imgpost) {
              await this.deleteS3File(key);
              results.filesDeleted++;
            }
          }
          // El borrado del post disparará el CASCADE para likes, reports asociados al post, etc.
          await post.remove();
          results.postsDeleted++;
        }

        // 3. Obtener Stories para borrar archivos S3
        const stories = await Storie.find({ where: { user: { id: user.id } } });
        for (const storie of stories) {
          if (storie.imgstorie) {
            await this.deleteS3File(storie.imgstorie);
            results.filesDeleted++;
          }
          await storie.remove();
          results.storiesDeleted++;
        }

        // 4. Borrar foto de perfil si no es la default
        if (user.photoperfil && user.photoperfil !== "ImgStore/user.png") {
          await this.deleteS3File(user.photoperfil);
          user.photoperfil = "ImgStore/user.png";
          await user.save();
          results.filesDeleted++;
        }

        results.usersProcessed++;
        console.log(`[Cleanup] Limpieza completada para usuario ${user.id}. Posts: ${posts.length}, Stories: ${stories.length}`);
      }


      return results;
    } catch (error) {
      console.error("[Cleanup] Error durante el proceso de limpieza:", error);
      throw error;
    }
  }

  /**
   * Helper para eliminar archivos de S3 de forma segura.
   */
  async deleteS3File(key: string): Promise<void> {
    if (!key || key.startsWith("http")) return; // Ignorar URLs externas o vacías

    try {
      await UploadFilesCloud.deleteFile({
        bucketName: envs.AWS_BUCKET_NAME,
        key: key
      });
      console.log(`[Cleanup] Eliminada imagen S3: ${key}`);
    } catch (error) {
      console.error(`[Cleanup] Error eliminando archivo S3 (${key}):`, error);
    }
  }
}
