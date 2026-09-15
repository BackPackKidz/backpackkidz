import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
const fail = (message) => { throw new Error(message); };

const stableValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }

  return value;
};

export const canonicalJson = (value) => JSON.stringify(stableValue(value));

const isPathInside = (rootPath, candidatePath) => {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === "" || (!isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
};

export const resolveSafeRepositoryPath = (
  root,
  repositoryRelativePath,
  { allowMissing = false, requireDirectory = false, requireFile = false } = {}
) => {
  const rootPath = resolve(root);
  const candidatePath = resolve(rootPath, repositoryRelativePath);

  if (!isPathInside(rootPath, candidatePath)) {
    fail("Resolved publication path escaped the repository root.");
  }

  const relativePath = relative(rootPath, candidatePath);
  let currentPath = rootPath;

  for (const segment of relativePath.split(sep).filter(Boolean)) {
    currentPath = resolve(currentPath, segment);

    if (!existsSync(currentPath)) {
      if (allowMissing) {
        continue;
      }

      fail(`Required publication path does not exist: ${repositoryRelativePath}.`);
    }

    if (lstatSync(currentPath).isSymbolicLink()) {
      fail(`Publication paths must not contain symbolic links or reparse points: ${repositoryRelativePath}.`);
    }
  }

  if (existsSync(candidatePath)) {
    const realRoot = realpathSync(rootPath);
    const realCandidate = realpathSync(candidatePath);
    const candidateStats = lstatSync(candidatePath);

    if (!isPathInside(realRoot, realCandidate)) {
      fail("Canonical publication path escaped the repository root.");
    }

    if (requireFile && (!candidateStats.isFile() || candidateStats.nlink !== 1)) {
      fail(`Governed publication target must be a single-link regular file: ${repositoryRelativePath}.`);
    }

    if (requireDirectory && !candidateStats.isDirectory()) {
      fail(`Governed publication directory is not a directory: ${repositoryRelativePath}.`);
    }
  } else if (!allowMissing) {
    fail(`Required publication path does not exist: ${repositoryRelativePath}.`);
  }

  return candidatePath;
};
