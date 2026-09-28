import * as fs from 'fs/promises';
import * as path from 'path';

/** Write to a temp file, then rename over the target: readers never see a half-written file. */
export const writeJsonAtomic = async (file: string, data: unknown) => {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(data, null, 1));
  await fs.rename(tmp, file);
};
