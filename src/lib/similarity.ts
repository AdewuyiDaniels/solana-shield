export interface AddressDiff {
  candidate: string;
  reference: string;
  prefix: number;
  suffix: number;
  sameLength: boolean;
  differingMiddle: number;
  candidateMask: boolean[];
  referenceMask: boolean[];
}

export function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

export function commonSuffixLength(a: string, b: string, limit = Number.POSITIVE_INFINITY): number {
  const max = Math.min(Math.min(a.length, b.length), limit);
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}

export function diffAgainst(candidate: string, reference: string): AddressDiff {
  const prefix = commonPrefixLength(candidate, reference);
  const available = Math.min(candidate.length, reference.length) - prefix;
  const suffix = commonSuffixLength(candidate, reference, Math.max(0, available));

  const candidateMask = new Array<boolean>(candidate.length).fill(false);
  const referenceMask = new Array<boolean>(reference.length).fill(false);

  for (let i = 0; i < prefix; i += 1) {
    candidateMask[i] = true;
    referenceMask[i] = true;
  }
  for (let i = 0; i < suffix; i += 1) {
    candidateMask[candidate.length - 1 - i] = true;
    referenceMask[reference.length - 1 - i] = true;
  }

  const middleLength = Math.max(0, Math.min(candidate.length, reference.length) - prefix - suffix);
  let differingMiddle = 0;
  for (let i = 0; i < middleLength; i += 1) {
    if (candidate[prefix + i] !== reference[prefix + i]) differingMiddle += 1;
  }
  differingMiddle += Math.abs(candidate.length - reference.length);

  return {
    candidate,
    reference,
    prefix,
    suffix,
    sameLength: candidate.length === reference.length,
    differingMiddle,
    candidateMask,
    referenceMask,
  };
}
