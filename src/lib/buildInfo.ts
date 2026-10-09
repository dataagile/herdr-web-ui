/**
 * What this client was built from, for the sidebar footer's line ("DevDA · v0.3.52 ·
 * fc94649"): the version is package.json's, the commit and the build time are written into the
 * bundle by vite.config.ts. A build that has none of them (a script that bundles the app without
 * vite, a checkout without Git) says "dev" for the commit and shows no date.
 */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string | undefined;
declare const __APP_BUILT__: string | undefined;

/** The fork's name: a brand, written the same in every language. */
export const BRAND_NAME = "DevDA";

export interface BuildInfo {
  version: string;
  commit: string;
  /** an ISO time, or null */
  built: string | null;
}

/** The constants vite defines, each guarded: a bundle that lacks one still renders. */
export function currentBuild(): BuildInfo {
  return {
    version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev",
    commit: typeof __APP_COMMIT__ === "string" && __APP_COMMIT__ !== "" ? __APP_COMMIT__ : "dev",
    built: typeof __APP_BUILT__ === "string" && __APP_BUILT__ !== "" ? __APP_BUILT__ : null,
  };
}

/** "DevDA · v0.3.52 · fc94649": the three parts the footer shows. */
export function versionLine(build: BuildInfo): string {
  return [BRAND_NAME, `v${build.version}`, build.commit].join(" · ");
}

/** The build time in the reader's own format, or null when there is none to show. */
export function builtLabel(built: string | null, locale?: string): string | null {
  if (built === null) return null;
  const time = new Date(built);
  return Number.isNaN(time.getTime()) ? null : time.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}
