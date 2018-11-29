import * as Utils from "../utils";
import skins from "../skins.json";

export function getSelectedSkinHash(state) {
  return state.selectedSkinHash;
}

export function getSelectedSkinPosition(state) {
  return state.selectedSkinPosition;
}

export function getSelectedSkinUrl(state) {
  const hash = getSelectedSkinHash(state);
  return hash == null ? null : Utils.screenshotUrlFromHash(hash);
}

export function getSearchQuery(state) {
  return state.searchQuery;
}

// TODO: Memoize this very expensive function
export function getMatchingSkinHashes(state) {
  const hashes = Object.keys(skins);
  const searchQuery = getSearchQuery(state);
  if (searchQuery == null || state.matchingHashes == null) {
    return hashes;
  }
  return hashes.filter(hash => state.matchingHashes.has(hash));
}

export function getUrl(state) {
  const hash = getSelectedSkinHash(state);
  const query = getSearchQuery(state);
  if (hash) {
    // TODO: Add a human readable version
    return `/skin/${hash}/${Utils.filenameFromHash(hash)}`;
  } else if (query) {
    return `/?query=${encodeURIComponent(query)}`;
  }
  return "/";
}

export function getPageTitle(state) {
  return "Winamp Skins";
}
