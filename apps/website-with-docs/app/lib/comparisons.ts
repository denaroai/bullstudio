import { comparisons } from "collections/server";
import { loader } from "fumadocs-core/source";

export const comparisonsRoute = "/comparisons";

// Fumadocs source over the comparisons collection. Powers both the
// /comparisons index (getPages) and the individual article routes (getPage).
export const comparisonsSource = loader({
  source: comparisons.toFumadocsSource(),
  baseUrl: comparisonsRoute,
});

export type ComparisonPage = (typeof comparisonsSource)["$inferPage"];
