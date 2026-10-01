class ApiMutationKeysMedia {
  static saveClock() {
    return ['media', 'clock', 'save'];
  }
}

class ApiMutationKeysScans {
  static start() {
    return ['scans', 'start'];
  }

  static enqueue() {
    return ['scans', 'enqueue'];
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

class ApiMutationKeysFolders {
  static open() {
    return ['folders', 'open'];
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

  static get Folders() {
    return ApiMutationKeysFolders;
  }

  static get Sightings() {
    return ApiMutationKeysSightings;
  }

  static get Tags() {
    return ApiMutationKeysTags;
  }
}
