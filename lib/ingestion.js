export function summarizeIngestionRuns(runs) {
  const totals = runs.reduce(
    (accumulator, run) => {
      accumulator.itemsSeen += run.itemsSeen;
      accumulator.itemsCreated += run.itemsCreated;
      accumulator.duplicatesCount += run.duplicatesCount;
      accumulator.filteredCount += run.filteredCount || 0;
      if (run.status === "error") accumulator.errors += 1;
      return accumulator;
    },
    { itemsSeen: 0, itemsCreated: 0, duplicatesCount: 0, filteredCount: 0, errors: 0 }
  );

  return [
    { label: "Runs", value: runs.length },
    { label: "Candidates created", value: totals.itemsCreated },
    { label: "Duplicates skipped", value: totals.duplicatesCount },
    { label: "Filtered noise", value: totals.filteredCount },
    { label: "Run errors", value: totals.errors },
  ];
}
