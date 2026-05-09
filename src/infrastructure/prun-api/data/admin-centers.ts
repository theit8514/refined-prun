import { castArray } from '@src/utils/cast-array';
import { createEntityStore } from '@src/infrastructure/prun-api/data/create-entity-store';
import { onApiMessage } from '@src/infrastructure/prun-api/data/api-messages';

/** Latest `ADMIN_CENTER_CLIENT_VOTING_DATA` snapshot (after user opens gov/admin buffers). */
const clientVotes = shallowRef<PrunApi.AdminCenterClientVoteRecord[] | undefined>(undefined);

const terms = createEntityStore<PrunApi.AdminCenterTerm>({
  selectId: t => `${t.adminCenterId}:${t.id}`,
});
const termsState = terms.state;

/** From `DATA_DATA` planet documents — present even when there are no admin-center alerts yet. */
const planetNaturalIdToAdminCenterId = reactive<Record<string, string>>({});

function clearPlanetAdminCenterLinks() {
  for (const k in planetNaturalIdToAdminCenterId) {
    delete planetNaturalIdToAdminCenterId[k];
  }
}

onApiMessage({
  CLIENT_CONNECTION_OPENED() {
    clientVotes.value = undefined;
    clearPlanetAdminCenterLinks();
  },
  ADMIN_CENTER_CLIENT_VOTING_DATA(data: { votes: PrunApi.AdminCenterClientVoteRecord[] }) {
    clientVotes.value = data.votes;
  },
});

onApiMessage({
  DATA_DATA(data: { body: unknown; path: string[] }) {
    if (data.path[0] === 'planets' && data.path[1] !== undefined) {
      const body = data.body as Partial<PrunApi.PlanetAdminCenterLinkPayload>;
      if (
        typeof body.naturalId === 'string' &&
        typeof body.adminCenterId === 'string' &&
        body.adminCenterId.length > 0
      ) {
        planetNaturalIdToAdminCenterId[body.naturalId.toUpperCase()] = body.adminCenterId;
      }
      return;
    }
    if (data.path[0] !== 'admincenters' || data.path[2] !== 'terms') {
      return;
    }
    for (const body of castArray(data.body as Arrayable<PrunApi.AdminCenterTerm>)) {
      terms.setOne(body);
    }
    terms.setFetched();
  },
});

function getVotesByAdminCenterId(adminCenterId: string | undefined | null) {
  const list = clientVotes.value;
  if (!adminCenterId || !list) {
    return undefined;
  }
  const id = adminCenterId.toLowerCase();
  return list.filter(x => x.adminCenterId.toLowerCase() === id);
}

function getTermsByAdminCenterId(adminCenterId: string | undefined | null) {
  const allTerms = termsState.all.value;
  if (!adminCenterId || !allTerms) {
    return undefined;
  }
  const id = adminCenterId.toLowerCase();
  return allTerms.filter(x => x.adminCenterId.toLowerCase() === id);
}

/** `undefined` until voting snapshot loads; otherwise whether this account has any ballot recorded for this term. */
export function hasUserRecordedVoteForTerm(
  adminCenterId: string | undefined | null,
  termId: string | undefined | null,
): boolean | undefined {
  if (!adminCenterId || !termId) {
    return undefined;
  }
  const list = clientVotes.value;
  if (list === undefined) {
    return undefined;
  }
  const ac = adminCenterId.toLowerCase();
  const tid = termId.toLowerCase();
  return list.some(v => v.adminCenterId.toLowerCase() === ac && v.termId.toLowerCase() === tid);
}

export const adminCentersVotesStore = {
  all: computed(() => clientVotes.value),
  getVotesByAdminCenterId,
};

export const adminCentersTermsStore = {
  ...termsState,
  getTermsByAdminCenterId,
};

export function getAdminCenterIdFromPlanetNaturalId(
  naturalId: string | null | undefined,
): string | undefined {
  if (!naturalId) {
    return undefined;
  }
  return planetNaturalIdToAdminCenterId[naturalId.toUpperCase()];
}
