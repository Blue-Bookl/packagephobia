import 'isomorphic-unfetch';

/**
 * Make an API call to npm to get package manifest details
 * @param name The npm package name
 */
export async function fetchManifest(name: string) {
    const encodedPackage = escapePackageName(name);
    const response = await fetch(`https://registry.npmjs.com/${encodedPackage}`);
    const manifest: NpmManifest = await response.json();
    if (response.status === 404 || !manifest || Object.keys(manifest).length === 0) {
        throw new Error('Package not found');
    }
    if (manifest.time.unpublished) {
        throw new Error('Package was unpublished');
    }
    return manifest;
}

/**
 * Get the latest/newest version of the npm package
 */
export function getLatestVersion(manifest: NpmManifest) {
    return manifest['dist-tags'].latest;
}

/**
 * Get all versions of the npm package
 */
export function getAllVersions(manifest: NpmManifest) {
    return Object.keys(manifest.versions);
}

/**
 * Get the most recent versions of the npm package
 */
export function getVersionsForChart(allVersions: string[], version: string, count: number) {
    const index = allVersions.indexOf(version);
    const last = allVersions.length - 1;
    let start = index - count;
    if (start < 0) {
        start = 0;
    }
    let end = index + count + 1;
    if (end > last) {
        end = last;
    }
    return allVersions.slice(start, end);
}

/**
 * Escape an npm package name.
 * The registry expects the slashes in the (scoped) package names
 * to be sent escaped.
 */
function escapePackageName(name: string) {
    return name.replace('/', '%2f');
}
