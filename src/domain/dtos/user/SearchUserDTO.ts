export class SearchUserDTO {
  constructor(public readonly query: string, public readonly status?: string, public readonly date?: string) {}

  static create(data: any): [string[]?, SearchUserDTO?] {
    const query = data.query?.trim() || "";
    const status = data.status && data.status !== 'ALL' ? data.status : undefined;
    const date = data.date && data.date !== '' ? data.date : undefined;

    if (query.length === 0 && !date && !status) {
      return [undefined, new SearchUserDTO("", status, date)];
    }

    return [undefined, new SearchUserDTO(query, status, date)];
  }
}
