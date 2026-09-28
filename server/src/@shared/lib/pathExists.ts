import * as fs from 'fs/promises';

export const pathExists = async (file: string) => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};

export const isFile = async (file: string) => {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
};

export const isDirectory = async (file: string) => {
  try {
    return (await fs.stat(file)).isDirectory();
  } catch {
    return false;
  }
};
