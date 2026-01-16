export class CreateLikeDTO {
  constructor(
    public readonly postId: string,
    public readonly userId: string
  ) {}

  static create(object: { [key: string]: any }): [string?, CreateLikeDTO?] {
    const { postId, userId } = object;

    if (!postId || typeof postId !== "string") {
      return ["El postId es requerido y debe ser un string"];
    }

    if (!userId || typeof userId !== "string") {
      return ["El userId es requerido y debe ser un string"];
    }

    return [undefined, new CreateLikeDTO(postId, userId)];
  }
}
