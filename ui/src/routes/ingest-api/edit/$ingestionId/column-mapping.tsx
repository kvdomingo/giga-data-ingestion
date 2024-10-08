import { createFileRoute, redirect } from "@tanstack/react-router";

import { qosGeolocationSchemaQueryOptions } from "@/api/queryOptions.ts";
import ColumnMapping from "@/components/ingest-api/ColumnMapping";
import { useStore } from "@/context/store";

export const Route = createFileRoute(
  "/ingest-api/edit/$ingestionId/column-mapping",
)({
  component: ColumnMapping,
  loaderDeps: () => {
    const {
      apiIngestionSlice: { detectedColumns },
      apiIngestionSliceActions: { setStepIndex },
    } = useStore.getState();
    return { detectedColumns, setStepIndex };
  },
  loader: ({
    context: { queryClient },
    deps: { detectedColumns, setStepIndex },
  }) => {
    if (detectedColumns.length === 0) {
      setStepIndex(0);
      throw redirect({ to: ".." });
    }

    setStepIndex(1);

    return queryClient.ensureQueryData(qosGeolocationSchemaQueryOptions);
  },
});
