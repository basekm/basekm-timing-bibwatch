export class Environment {
  static get ApiBaseUrl() {
    return process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
  }
}
