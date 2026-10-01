import {
  SightingSearchQueryDto
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

class ApiQueryKeysMedia {
  static getOverview() {
    return ['media', 'overview'];
  }

  static getDetections(data: PayloadOnly<{ url: string }>) {
    return ['media', 'detections', data.url];
  }

  static getSegments(data: PayloadOnly<{ url: string }>) {
    return ['media', 'segments', data.url];
  }
}

class ApiQueryKeysTags {
  static getByUrl(data: PayloadOnly<{ url: string }>) {
    return ['tags', data.url];
  }
}

class ApiQueryKeysScans {
  static getStatus() {
    return ['scans', 'status'];
  }
}

class ApiQueryKeysEvent {
  static getSettings() {
    return ['event', 'settings'];
  }
}

class ApiQueryKeysSightings {
  static search(data: PayloadOnly<SightingSearchQueryDto>) {
    return ['sightings', 'search', data.bib ?? '', data.tag ?? '', data.video ?? ''];
  }
}

export class ApiQueryKeys {
  static get Media() {
    return ApiQueryKeysMedia;
  }

  static get Scans() {
    return ApiQueryKeysScans;
  }

  static get Event() {
    return ApiQueryKeysEvent;
  }

  static get Tags() {
    return ApiQueryKeysTags;
  }

  static get Sightings() {
    return ApiQueryKeysSightings;
  }
}
