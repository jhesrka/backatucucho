import { regularExp } from "../../../config";

export class CreateDTO {
  constructor(
    public readonly title: string,
    public readonly subtitle: string,
    public readonly content: string,
    public readonly imgpost: string[],
    public readonly userId: string
  ) {}

  static create(object: { [key: string]: any }): [string?, CreateDTO?] {
    const { title, subtitle, content, imgpost, userId } = object;
    if (!title) {
      return ["El titulo es necesario"];
    }
    if (!subtitle) {
      return ["El subtítulo es necesario"];
    }
    if (!content) {
      return ["El contenido es necesario"];
    }
    if (!userId||typeof userId!=="string"||!regularExp.uuid.test(userId)) {
        return ["Formato invalido de uuid"]
    }
    return [
      undefined,
      new CreateDTO(title, subtitle, content, imgpost, userId),
    ];
  }
}
