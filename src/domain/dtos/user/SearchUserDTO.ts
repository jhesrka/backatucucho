export class SearchUserDTO {
  constructor(public readonly query: string) {}

  static create(data: any): [string[]?, SearchUserDTO?] {
    const query = data.query?.trim() || "";

    if (query.length === 0) {
      return [undefined, new SearchUserDTO("")];
    }

    return [undefined, new SearchUserDTO(query)];
  }
}
