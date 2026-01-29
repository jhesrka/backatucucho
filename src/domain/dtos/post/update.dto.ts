export class UpdateDTO {
  constructor(
    public readonly title?: string,
    public readonly subtitle?: string,
    public readonly content?: string,
    public readonly imgpost?: string[],
    public readonly showWhatsApp?: boolean,
    public readonly showLikes?: boolean
  ) { }

  static create(object: { [key: string]: any }): [string?, UpdateDTO?] {
    return [undefined, new UpdateDTO(
      object.title,
      object.subtitle,
      object.content,
      object.imgpost,
      object.showWhatsApp,
      object.showLikes
    )];
  }
}
