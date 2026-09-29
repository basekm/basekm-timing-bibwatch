class ApiMutationKeysMedia {
  static saveClock() {
    return ['media', 'clock', 'save'];
  }
}

class ApiMutationKeysScans {
  static start() {
    return ['scans', 'start'];
  }

  static cancel() {
    return ['scans', 'cancel'];
  }

  static clear() {
    return ['scans', 'clear'];
  }

  static saveSegments() {
    return ['scans', 'segments', 'save'];
  }
}

class ApiMutationKeysEvent {
  static saveSettings() {
    return ['event', 'settings', 'save'];
  }
}

class ApiMutationKeysSightings {
  static save() {
    return ['sightings', 'save'];
  }
}

class ApiMutationKeysTags {
  static save() {
    return ['tags', 'save'];
  }
}

class ApiMutationKeysTemplates {
  static create() {
    return ['templates', 'create'];
  }

  static calibrate() {
    return ['templates', 'calibrate'];
  }

  static remove() {
    return ['templates', 'remove'];
  }
}

export class ApiMutationKeys {
  static get Media() {
    return ApiMutationKeysMedia;
  }

  static get Scans() {
    return ApiMutationKeysScans;
  }

  static get Event() {
    return ApiMutationKeysEvent;
  }

  static get Sightings() {
    return ApiMutationKeysSightings;
  }

  static get Tags() {
    return ApiMutationKeysTags;
  }

  static get Templates() {
    return ApiMutationKeysTemplates;
  }
}
