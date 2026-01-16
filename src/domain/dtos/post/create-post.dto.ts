// src/domain/dtos/create-post.dto.ts
export class CreatePostDTO {
  readonly userId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly content: string;
  readonly isPaid?: boolean; // Opcional (default: false)
}