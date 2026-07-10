declare namespace PrunApi {
  /** Planet `DATA_DATA` payload fields used to link a planet natural id to its administration. */
  interface PlanetAdminCenterLinkPayload {
    naturalId: string;
    adminCenterId: string;
  }

  /** WebSocket user reference shape (game proxy). */
  interface AdminCenterUserProxy {
    id: string;
    username: string;
    _type: string;
    _proxy_key: string;
  }

  /** WebSocket corporation reference shape (game proxy). */
  interface AdminCenterCorporationProxy {
    id: string;
    name: string;
    code: string;
    _type: string;
    _proxy_key: string;
  }

  /** WebSocket country reference shape (game proxy). */
  interface AdminCenterCountryProxy {
    id: string;
    code: string;
    name: string;
    _type: string;
    _proxy_key: string;
  }

  interface AdminCenterElectionCandidate {
    startOfRun: DateTime | null;
    user: AdminCenterUserProxy;
    corporation: AdminCenterCorporationProxy;
    country: AdminCenterCountryProxy;
    votes: number;
    votesPercentage: number;
  }

  interface AdminCenterTerm {
    naturalId: number;
    electionStart: DateTime | null;
    electionEnd: DateTime | null;
    start: unknown;
    end: unknown;
    candidates: AdminCenterElectionCandidate[];
    adminCenterId: string;
    winners: AdminCenterUserProxy[];
    motions: unknown[];
    parliamentSize: number;
    electionOngoing: boolean;
    id: string;
  }

  /**
   * One row in `ADMIN_CENTER_CLIENT_VOTING_DATA` — ballot the **current signed-in player** cast,
   * keyed by `adminCenterId` + `termId`.
   */
  interface AdminCenterClientVoteRecord {
    time: DateTime;
    adminCenterId: string;
    termId: string;
    candidate: AdminCenterUserProxy;
  }
}
