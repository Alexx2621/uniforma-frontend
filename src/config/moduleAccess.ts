export const isModuleAccessible = (path: string, disabledPaths: string[]) => {
  return !disabledPaths.some((disabledPath) => {
    if (!disabledPath) return false;
    if (disabledPath === "/") {
      return path === "/";
    }
    return path === disabledPath || path.startsWith(`${disabledPath}/`);
  });
};
