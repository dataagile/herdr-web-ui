import { ChevronDown, ChevronRight } from "lucide-react";

/** The fold chevron of a section heading: right when folded, down when open. */
export function FoldChevron({ folded }: { folded: boolean }) {
  return folded ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />;
}
