import type {CloudState} from './cloudState';
/** Merge disjoint key edits only. Same-field conflicts are surfaced, never guessed. */
export function mergeCloudVersions(base:CloudState,local:CloudState,remote:CloudState):CloudState {
 const next:CloudState={};
 for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
  const l=local[key],r=remote[key],b=base[key];
  if(l!==b&&r!==b&&l!==r)throw Error('Deze gegevens zijn ook op een ander apparaat gewijzigd. Je lokale wijzigingen zijn behouden. Kies bij Instellingen welke versie je wilt laden.');
  const chosen=l!==b?l:r;
  if(chosen!==undefined)next[key]=chosen;
 }
 return next;
}
