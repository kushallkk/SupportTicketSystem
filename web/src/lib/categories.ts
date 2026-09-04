export const CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing",
  technical: "Technical",
  account: "Account",
  feature_request: "Feature Request",
  other: "General",
};

export function categoryDisplayName(slug: string) {
  return CATEGORY_LABELS[slug] ?? slug;
}
