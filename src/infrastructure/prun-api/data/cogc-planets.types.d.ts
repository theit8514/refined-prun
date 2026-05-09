declare namespace PrunApi {
  /** Company ref on a COGC `votes[]` row (game proxy). */
  interface CogcPlanetVoteVoter {
    id: string;
    name: string;
    code: string;
    _type: string;
    _proxy_key: string;
  }

  /** One company vote cast in the planetary COGC process. */
  interface CogcPlanetVoteRecord {
    voter: CogcPlanetVoteVoter;
    influence: number;
    type: string;
    time: DateTime;
  }

  /** Planet stub on COGC `DATA_DATA` payloads. */
  interface CogcPlanetWirePlanet {
    id: string;
    naturalId: string;
    name: string;
    _type: string;
    _proxy_key: string;
  }

  /** `DATA_DATA` body for path `planets/:planetId/cogc/:cogcId`. */
  interface CogcPlanetWireBody {
    planet: CogcPlanetWirePlanet;
    votes: CogcPlanetVoteRecord[];
    programs: unknown[];
    programTypes: string[];
    status: unknown;
    upkeep: unknown;
    id: string;
    completionDate?: unknown;
    address: unknown;
  }

  /** Cached COGC snapshot keyed by planet `naturalId` (loaded when client opens COGC for that planet). */
  interface CogcPlanetClientSnapshot {
    cogcFragmentId: string;
    votes: CogcPlanetVoteRecord[];
  }
}
