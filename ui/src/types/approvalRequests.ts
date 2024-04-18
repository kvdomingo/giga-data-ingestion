export interface ApprovalRequestListing {
  id: string;
  country: string;
  country_iso3: string;
  dataset: string;
  subpath: string;
  last_modified: string;
  rows_count: number;
  rows_added: number;
  rows_updated: number;
  rows_deleted: number;
}

export interface ApprovalRequestInfo {
  country: string;
  dataset: string;
}

export type ApprovalRequestData = Record<string, null> & {
  _change_type: "insert" | "remove" | "update_preimage";
};

export type ApprovalRequest = {
  info: ApprovalRequestInfo;
  total_count: number;
  data: ApprovalRequestData[];
};

export const SENTINEL_APPROVAL_REQUEST: ApprovalRequest = {
  info: {
    country: "",
    dataset: "",
  },
  data: [],
  total_count: 0,
};
