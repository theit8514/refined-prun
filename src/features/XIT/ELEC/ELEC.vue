<script setup lang="ts">
import ActionBar from '@src/components/ActionBar.vue';
import PrunButton from '@src/components/PrunButton.vue';
import PrunLink from '@src/components/PrunLink.vue';
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import {
  adminCentersTermsStore,
  getAdminCenterIdFromPlanetNaturalId,
  hasUserRecordedVoteForTerm,
} from '@src/infrastructure/prun-api/data/admin-centers';
import { cogcPlanetsStore } from '@src/infrastructure/prun-api/data/cogc-planets';
import { companyStore } from '@src/infrastructure/prun-api/data/company';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { userDataStore } from '@src/infrastructure/prun-api/data/user-data';
import { getCoGCProgramDisplayName } from '@src/infrastructure/prun-ui/i18n';
import ElecRefresh from '@src/features/XIT/ELEC/ElecRefresh.vue';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { timestampEachSecond } from '@src/utils/dayjs';
import dayjs from 'dayjs';

const parameters = useXitParameters();
const isRefreshMode = computed(() => parameters[0]?.toUpperCase() === 'REFRESH');

interface ElectionRow {
  planet: string;
  planetNaturalId: string;
  type: 'GOV' | 'COGC';
  electionStart?: number;
  electionEnd?: number;
  /** Present for `GOV` rows only: live term data from GOV/ADM buffers vs alert-derived schedule. */
  govDateSource?: 'server' | 'estimate';
  /**
   * `GOV` only, server term: before election opens — candidacy vs `term.candidates`;
   * once voting has started — ballot from `ADMIN_CENTER_CLIENT_VOTING_DATA`.
   */
  govYourVote?: 'unknown' | 'upcoming-running' | 'upcoming-not-running' | 'voted' | 'not-voted';
  /** `COGC` only: whether `votes` from planet COGC `DATA_DATA` includes this company (after loading COGC). */
  cogcCompanyVote?: 'unknown' | 'voted' | 'not-voted';
  /** `COGC` only: wire `votes[].type` for this company’s latest ballot (when `cogcCompanyVote === 'voted'`). */
  cogcVotedProgramType?: string;
}

const dayMs = 24 * 60 * 60 * 1000;

const rows = computed<ElectionRow[] | undefined>(() => {
  const now = timestampEachSecond.value;
  const sites = sitesStore.all.value;
  if (!sites) {
    return undefined;
  }

  const govElectionTimestampByPlanet = getLatestAlertTimestampByPlanet(
    'ADMIN_CENTER_GOVERNOR_ELECTED',
  );
  const cogcElectionTimestampByPlanet = getLatestAlertTimestampByPlanet('COGC_PROGRAM_CHANGED');
  const planetKeyToAdminCenterId = getPlanetKeyToAdminCenterIdMap();

  const map = new Map<string, { planet: string; planetNaturalId: string }>();
  for (const site of sites) {
    const planetNaturalId = getEntityNaturalIdFromAddress(site.address);
    const planetName = getEntityNameFromAddress(site.address);
    if (!planetNaturalId || !planetName) {
      continue;
    }

    const key = planetNaturalId.toUpperCase();
    if (map.has(key)) {
      continue;
    }

    map.set(key, { planet: `${planetName} (${planetNaturalId})`, planetNaturalId });
  }

  const merged: ElectionRow[] = [];
  for (const planet of map.values()) {
    const planetKey = planet.planetNaturalId.toUpperCase();
    const govElectionTimestamp = govElectionTimestampByPlanet.get(planetKey);
    const cogcElectionTimestamp = cogcElectionTimestampByPlanet.get(planetKey);

    const adminCenterId =
      planetKeyToAdminCenterId.get(planetKey) ??
      getAdminCenterIdFromPlanetNaturalId(planet.planetNaturalId);
    let govStart: number | undefined;
    let govEnd: number | undefined;
    let govDateSource: 'server' | 'estimate' | undefined;

    let govYourVote: ElectionRow['govYourVote'];
    if (adminCenterId) {
      const terms = adminCentersTermsStore.getTermsByAdminCenterId(adminCenterId) ?? [];
      const term = pickGovTermForElectionRow(terms, now);
      if (term !== undefined && term.electionStart !== null && term.electionEnd !== null) {
        govStart = term.electionStart.timestamp;
        govEnd = term.electionEnd.timestamp;
        govDateSource = 'server';
        govYourVote = govParticipationForTerm(term, now, adminCenterId);
      }
    }

    if (govDateSource !== 'server') {
      govStart = govElectionTimestamp === undefined ? undefined : govElectionTimestamp + dayMs * 20;
      govEnd = govElectionTimestamp === undefined ? undefined : govElectionTimestamp + dayMs * 28;
      govDateSource = 'estimate';
    }

    merged.push({
      ...planet,
      type: 'GOV',
      electionStart: govStart,
      electionEnd: govEnd,
      govDateSource,
      govYourVote,
    });

    const cogcPart = cogcCompanyParticipationDetails(planet.planetNaturalId);
    merged.push({
      ...planet,
      type: 'COGC',
      electionStart: cogcElectionTimestamp,
      electionEnd:
        cogcElectionTimestamp === undefined ? undefined : cogcElectionTimestamp + dayMs * 7,
      cogcCompanyVote: cogcPart.status,
      cogcVotedProgramType: cogcPart.programType,
    });
  }

  return merged.sort(compareRows);
});

const showStaleElectionDataNotice = computed(() => {
  const list = rows.value;
  if (!list) {
    return false;
  }
  return list.some(rowNeedsStaleDataNotice);
});

function compareRows(a: ElectionRow, b: ElectionRow) {
  const groupA = getSortGroup(a);
  const groupB = getSortGroup(b);
  if (groupA !== groupB) {
    return groupA - groupB;
  }

  if (
    a.electionStart !== undefined &&
    b.electionStart !== undefined &&
    a.electionStart !== b.electionStart
  ) {
    return a.electionStart - b.electionStart;
  }

  const planetDiff = a.planetNaturalId.localeCompare(b.planetNaturalId);
  if (planetDiff !== 0) {
    return planetDiff;
  }
  return a.type.localeCompare(b.type);
}

function getSortGroup(row: ElectionRow) {
  if (isElectionOpen(row)) {
    return 0;
  }
  if (row.electionStart !== undefined) {
    return 1;
  }
  return 2;
}

function isElectionOpen(row: ElectionRow) {
  const now = timestampEachSecond.value;
  return (
    row.electionStart !== undefined &&
    row.electionEnd !== undefined &&
    now >= row.electionStart &&
    now < row.electionEnd
  );
}

function rowNeedsStaleDataNotice(row: ElectionRow): boolean {
  if (row.type === 'GOV') {
    if (row.govDateSource === 'estimate') {
      return true;
    }
    if (row.govDateSource === 'server' && row.govYourVote === 'unknown' && isElectionOpen(row)) {
      return true;
    }
  }
  if (row.type === 'COGC' && row.cogcCompanyVote === 'unknown') {
    return true;
  }
  return false;
}

function isPastOrNow(timestamp?: number) {
  return timestamp !== undefined && timestamp <= timestampEachSecond.value;
}

function formatFutureDuration(timestamp: number) {
  const now = timestampEachSecond.value;
  if (timestamp <= now) {
    return '0s';
  }

  let duration = dayjs.duration({ milliseconds: timestamp - now });
  const days = Math.floor(duration.asDays());
  duration = duration.subtract(days, 'days');
  const hours = Math.floor(duration.asHours());
  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  duration = duration.subtract(hours, 'hours');
  const minutes = Math.floor(duration.asMinutes());
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  duration = duration.subtract(minutes, 'minutes');
  const seconds = Math.floor(duration.asSeconds());
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function openBuffer(command: string) {
  void showBuffer(command, { force: true });
}

function openElectionRefreshBuffer() {
  void showBuffer('XIT ELEC REFRESH', { force: true });
}

function govParticipationForTerm(
  term: PrunApi.AdminCenterTerm,
  atTime: number,
  adminCenterId: string,
): ElectionRow['govYourVote'] {
  if (term.electionStart === null || term.electionEnd === null) {
    return undefined;
  }
  const start = term.electionStart.timestamp;
  if (atTime < start) {
    const uid = userDataStore.id;
    if (!uid) {
      return 'unknown';
    }
    const id = uid.toLowerCase();
    const running = term.candidates.some(c => c.user.id.toLowerCase() === id);
    return running ? 'upcoming-running' : 'upcoming-not-running';
  }
  const recorded = hasUserRecordedVoteForTerm(adminCenterId, term.id);
  return recorded === undefined ? 'unknown' : recorded ? 'voted' : 'not-voted';
}

function cogcCompanyParticipationDetails(planetNaturalId: string): {
  status: ElectionRow['cogcCompanyVote'];
  programType?: string;
} {
  const snap = cogcPlanetsStore.getSnapshot(planetNaturalId);
  if (snap === undefined) {
    return { status: undefined };
  }
  const companyId = companyStore.value?.id ?? userDataStore.companyId;
  if (!companyId) {
    return { status: 'unknown' };
  }
  const id = companyId.toLowerCase();
  const mine = snap.votes.filter(v => v.voter.id.toLowerCase() === id);
  if (mine.length === 0) {
    return { status: 'not-voted' };
  }
  mine.sort((a, b) => b.time.timestamp - a.time.timestamp);
  return { status: 'voted', programType: mine[0].type };
}

function electionYouColumnCell(row: ElectionRow) {
  if (row.type === 'COGC') {
    switch (row.cogcCompanyVote) {
      case 'voted': {
        const name = getCoGCProgramDisplayName(row.cogcVotedProgramType);
        return name !== undefined ? `Voted (${name})` : 'Voted';
      }
      case 'not-voted':
        return 'Not voted';
      default:
        return '—';
    }
  }
  switch (row.govYourVote) {
    case 'upcoming-running':
      return 'Running';
    case 'upcoming-not-running':
      return 'Not running';
    case 'voted':
      return 'Voted';
    case 'not-voted':
      return 'Not voted';
    default:
      return '—';
  }
}

function typeColumnLabel(row: ElectionRow) {
  return row.type === 'GOV' ? 'ADM' : row.type;
}

function getTypeCommand(row: ElectionRow) {
  return row.type === 'GOV' ? `ADM ${row.planetNaturalId}` : `COGC ${row.planetNaturalId}`;
}

function getVoteCommand(row: ElectionRow) {
  return row.type === 'GOV' ? `ADM ${row.planetNaturalId}` : `COGCPEX ${row.planetNaturalId}`;
}

function getLatestAlertTimestampByPlanet(type: PrunApi.AlertType) {
  const timestamps = new Map<string, number>();
  for (const alert of alertsStore.all.value ?? []) {
    if (alert.type !== type) {
      continue;
    }
    const naturalId = getPlanetNaturalIdFromAlert(alert)?.toUpperCase();
    if (!naturalId) {
      continue;
    }
    const timestamp = alert.time.timestamp;
    const existing = timestamps.get(naturalId);
    if (existing === undefined || timestamp > existing) {
      timestamps.set(naturalId, timestamp);
    }
  }
  return timestamps;
}

function getPlanetNaturalIdFromAlert(alert: PrunApi.Alert) {
  for (const item of alert.data) {
    if (item.key === 'planet' || item.key === 'address') {
      const address = (item.value as { address?: PrunApi.Address } | undefined)?.address;
      const naturalId = getEntityNaturalIdFromAddress(address);
      if (naturalId) {
        return naturalId;
      }
    }
  }
  return alert.naturalId;
}

/** Prefer admin center id from the newest alert that carries both planet info and `adminCenterId`. */
function getPlanetKeyToAdminCenterIdMap(): Map<string, string> {
  const best = new Map<string, { adminCenterId: string; time: number }>();
  for (const alert of alertsStore.all.value ?? []) {
    const adminItem = alert.data.find(
      (x): x is { key: 'adminCenterId'; value: string } => x.key === 'adminCenterId',
    );
    if (!adminItem) {
      continue;
    }
    const planetId = getPlanetNaturalIdFromAlert(alert)?.toUpperCase();
    if (!planetId) {
      continue;
    }
    const ts = alert.time.timestamp;
    const prev = best.get(planetId);
    if (prev === undefined || ts > prev.time) {
      best.set(planetId, { adminCenterId: adminItem.value, time: ts });
    }
  }
  return new Map([...best].map(([k, v]) => [k, v.adminCenterId]));
}

function termGovernorBoundsUnset(t: PrunApi.AdminCenterTerm) {
  return t.start == null && t.end == null;
}

/**
 * Match GOV/ADM “Upcoming term”: active vote window, then placeholder term (no governor run yet),
 * then ongoing flag, else earliest future election.
 */
function pickGovTermForElectionRow(planetTerms: PrunApi.AdminCenterTerm[], atTime: number) {
  const withBoth = planetTerms.filter(t => t.electionStart !== null && t.electionEnd !== null);
  if (withBoth.length === 0) {
    return undefined;
  }
  const activeVote = withBoth.find(t => {
    const s = t.electionStart!.timestamp;
    const e = t.electionEnd!.timestamp;
    return atTime >= s && atTime < e;
  });
  if (activeVote !== undefined) {
    return activeVote;
  }
  const upcomingPlaceholder = withBoth.filter(
    t => termGovernorBoundsUnset(t) && t.electionStart!.timestamp > atTime,
  );
  if (upcomingPlaceholder.length > 0) {
    upcomingPlaceholder.sort((a, b) => {
      const byPlanet = b.naturalId - a.naturalId;
      return byPlanet !== 0 ? byPlanet : a.electionStart!.timestamp - b.electionStart!.timestamp;
    });
    return upcomingPlaceholder[0];
  }
  const ongoing = withBoth.find(t => t.electionOngoing);
  if (ongoing !== undefined) {
    return ongoing;
  }
  const future = withBoth
    .filter(t => t.electionStart!.timestamp > atTime)
    .sort((a, b) => {
      const d = a.electionStart!.timestamp - b.electionStart!.timestamp;
      if (d !== 0) {
        return d;
      }
      return b.naturalId - a.naturalId;
    });
  return future[0];
}
</script>

<template>
  <ElecRefresh v-if="isRefreshMode" />
  <div v-else>
    <ActionBar :class="$style.topActionBar">
      <div />
      <PrunButton primary @click="openElectionRefreshBuffer">REFRESH</PrunButton>
    </ActionBar>
    <LoadingSpinner v-if="rows === undefined" />
    <template v-else>
      <p v-if="showStaleElectionDataNotice" :class="$style.notice">
        Data loads from notifications first and may stay <strong>stale</strong> until buffers load:
        governor rows may use estimates or show <strong>Unknown</strong> during an open vote until
        <strong>ADM</strong> has been opened; COGC participation may be
        <strong>Unknown</strong> until <strong>COGC</strong> has been opened. Use
        <strong>REFRESH</strong> above to load fresh data, or open <strong>ADM</strong> /
        <strong>COGC</strong> per planet — rows update automatically.
      </p>
      <table>
        <thead>
          <tr>
            <th>Planet</th>
            <th>Type</th>
            <th>Voting</th>
            <th>Ends</th>
            <th>You</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="`${row.planetNaturalId}:${row.type}`">
            <td>
              <PrunLink inline :command="`PLI ${row.planetNaturalId}`">{{ row.planet }}</PrunLink>
            </td>
            <td>
              <PrunButton dark @click="openBuffer(getTypeCommand(row))">
                {{ typeColumnLabel(row) }}
              </PrunButton>
            </td>
            <td>
              <template v-if="row.electionStart === undefined">—</template>
              <PrunButton
                v-else-if="isPastOrNow(row.electionStart)"
                primary
                @click="openBuffer(getVoteCommand(row))">
                VOTE
              </PrunButton>
              <template v-else>{{ formatFutureDuration(row.electionStart) }}</template>
            </td>
            <td>
              <template v-if="row.electionEnd === undefined">—</template>
              <template v-else-if="isPastOrNow(row.electionEnd)">Now</template>
              <template v-else>{{ formatFutureDuration(row.electionEnd) }}</template>
            </td>
            <td>{{ electionYouColumnCell(row) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style module>
.topActionBar {
  width: 100%;
  margin-bottom: 0.5rem;
  user-select: none;
}

.topActionBar > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.notice {
  margin: 0 0 0.75rem;
  line-height: 1.45;
}
</style>
