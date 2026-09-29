import {
  SightingSearchQueryDto,
  TemplateFinderQueryDto
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

class ApiQueryKeysMedia {
  static getOverview() {
    return ['media', 'overview'];
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
    return ['sightings', 'search', data.bib ?? '', data.tag ?? ''];
  }
}

class ApiQueryKeysTemplates {
  static getAll() {
    return ['templates'];
  }

  static find(data: PayloadOnly<TemplateFinderQueryDto>) {
    return ['templates', 'finder', data.video, data.t, data.templates.join(',')];
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

  static get Sightings() {
    return ApiQueryKeysSightings;
  }

  static get Templates() {
    return ApiQueryKeysTemplates;
  }
}
