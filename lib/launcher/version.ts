import packageJson from "../../package.json"

/** Must stay equal to package.json — the Windows installer name and GitHub tag use it. */
export const LAUNCHER_VERSION: string = packageJson.version

/** Visual release label shown in settings. Not used by the updater. */
export const LAUNCHER_BUILD_LABEL = "2026.09.21"
