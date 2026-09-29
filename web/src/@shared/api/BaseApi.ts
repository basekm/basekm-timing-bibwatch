export type ApiRequestOptions = {
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: any;
  options?: RequestInit;
};

export class BaseApi {
  protected static async get({
    url, headers, query, options
  }: ApiRequestOptions) {
    const fullUrl = this.buildUrlWithQuery(url, query);
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw await this.buildError(response);
    }

    return response;
  }

  protected static async post({
    url, headers, query, body, options
  }: ApiRequestOptions) {
    const fullUrl = this.buildUrlWithQuery(url, query);
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: isFormData
        ? {
          ...headers 
        }
        : {
          'Content-Type': 'application/json', ...headers 
        },
      body: isFormData ? body : (typeof body === 'string' ? body : JSON.stringify(body)),
      ...options,
    });

    if (!response.ok) {
      throw await this.buildError(response);
    }

    return response;
  }

  protected static async patch({
    url, headers, query, body, options
  }: ApiRequestOptions) {
    const fullUrl = this.buildUrlWithQuery(url, query);
    const response = await fetch(fullUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    });

    if (!response.ok) {
      throw await this.buildError(response);
    }

    return response;
  }

  protected static async delete({
    url, headers, query, options
  }: ApiRequestOptions) {
    const fullUrl = this.buildUrlWithQuery(url, query);
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw await this.buildError(response);
    }

    return response;
  }

  private static async buildError(response: Response): Promise<Error> {
    try {
      const body = await response.clone().json();
      if (body?.error) {
        return new Error(String(body.error));
      }
      if (body?.message) {
        return new Error(Array.isArray(body.message) ? body.message.join(', ') : String(body.message));
      }
    } catch {
      return new Error(`HTTP error! status: ${response.status}`);
    }

    return new Error(`HTTP error! status: ${response.status}`);
  }

  protected static buildUrlWithQuery(
    url: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    if (!query || Object.keys(query).length === 0) {
      return url;
    }

    const searchParameters = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        searchParameters.append(key, String(value));
      }
    }

    const queryString = searchParameters.toString();
    if (!queryString) {
      return url;
    }

    return url.includes('?') ? `${url}&${queryString}` : `${url}?${queryString}`;
  }
}
