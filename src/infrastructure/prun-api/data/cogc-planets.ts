import { onApiMessage } from '@src/infrastructure/prun-api/data/api-messages';

const cogcByPlanetNaturalId = reactive<Record<string, PrunApi.CogcPlanetClientSnapshot>>({});

function clearCogcPlanetSnapshots() {
  for (const k in cogcByPlanetNaturalId) {
    delete cogcByPlanetNaturalId[k];
  }
}

onApiMessage({
  CLIENT_CONNECTION_OPENED() {
    clearCogcPlanetSnapshots();
  },
  DATA_DATA(data: { body: unknown; path: string[] }) {
    if (data.path.length < 4 || data.path[0] !== 'planets' || data.path[2] !== 'cogc') {
      return;
    }
    const body = data.body as Partial<PrunApi.CogcPlanetWireBody>;
    const naturalId = body.planet?.naturalId;
    if (typeof naturalId !== 'string') {
      return;
    }
    const votes = Array.isArray(body.votes) ? body.votes : [];
    const fragmentId = typeof data.path[3] === 'string' ? data.path[3] : (body.id ?? '');
    cogcByPlanetNaturalId[naturalId.toUpperCase()] = {
      cogcFragmentId: fragmentId,
      votes,
    };
  },
});

export const cogcPlanetsStore = {
  /**
   * Latest COGC snapshot for this planet after the client has loaded COGC (`COGC planet`)
   * and PrUn emitted `DATA_DATA` for `planets/.../cogc/...`.
   */
  getSnapshot(
    planetNaturalId: string | null | undefined,
  ): PrunApi.CogcPlanetClientSnapshot | undefined {
    if (!planetNaturalId) {
      return undefined;
    }
    return cogcByPlanetNaturalId[planetNaturalId.toUpperCase()];
  },
};
