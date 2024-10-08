export interface GraphGroup {
  id: string;
  description: string;
  display_name: string;
  mail: string | null;
}

export const SentinelGroup: GraphGroup = {
  id: "",
  description: "",
  display_name: "",
  mail: null,
};

export interface Dataset {
  name: string;
  id: string;
}

export interface DatabaseRole {
  id: string;
  name: string;
}
