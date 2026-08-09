/**
 * Price anchors are not a structured field on the research artifacts — they
 * only exist inside natural-language claims such as
 *   "Ionix lists Sculpt 3D leggings at $49.90 sale versus $69.90 regular."
 *
 * This parser is deliberately conservative: anything it cannot read with
 * confidence is dropped rather than guessed, so a missing anchor shows up as
 * "未结构化" instead of an invented number. Every anchor it does produce stays
 * traceable to the claim and source it came from.
 */

export type PriceAnchor = {
  label: string;
  /** Current / promotional price. */
  current: number;
  /** List price when the claim states one. */
  original: number | null;
  currencySymbol: string;
  claimId: string;
  sourceId: string;
  url: string | null;
};

export type PriceRange = { low: number; high: number; currencySymbol: string };

const PRICE = /([$£€])\s?(\d+(?:\.\d{1,2})?)/g;

const readPrices = (text: string): Array<{ symbol: string; value: number }> => {
  const out: Array<{ symbol: string; value: number }> = [];
  for (const match of text.matchAll(PRICE)) {
    const value = Number(match[2]);
    if (Number.isFinite(value) && value > 0) out.push({ symbol: match[1], value });
  }
  return out;
};

/**
 * Reads one competitor price anchor from a claim.
 *
 * Requires the claim to name a promotional price; a claim that merely mentions
 * a number (a shipping threshold, a guarantee window) yields nothing.
 */
export const parsePriceAnchor = (
  claim: { id: string; sourceId: string; statement: string; targetScope?: string },
  label: string,
  url: string | null,
): PriceAnchor | null => {
  if (claim.targetScope !== "competitor") return null;

  const text = claim.statement;
  // Only claims that actually frame a price point qualify. "free-shipping
  // threshold" and similar mentions carry a number but not a product price.
  if (!/\b(sale|regular|price|priced|lists|anchor)\b/i.test(text)) return null;
  if (/free[- ]shipping|threshold|guarantee/i.test(text)) return null;

  const prices = readPrices(text);
  if (prices.length === 0) return null;

  const symbol = prices[0].symbol;
  // Mixed currencies in one sentence are ambiguous — refuse rather than guess.
  if (prices.some((price) => price.symbol !== symbol)) return null;

  const mentionsOriginal = /\b(regular|versus|vs\.?|was|list)\b/i.test(text);
  const current = prices[0].value;
  const original = mentionsOriginal && prices.length > 1 ? prices[1].value : null;

  // A "list price" below the current price would misrepresent the discount.
  if (original !== null && original <= current) {
    return { label, current, original: null, currencySymbol: symbol, claimId: claim.id, sourceId: claim.sourceId, url };
  }

  return { label, current, original, currencySymbol: symbol, claimId: claim.id, sourceId: claim.sourceId, url };
};

/** Reads our own recommended band, e.g. "USD $39-$49 after ... are verified". */
export const parsePriceRange = (text: string): PriceRange | null => {
  const prices = readPrices(text);
  if (prices.length < 2) return null;
  if (prices[0].symbol !== prices[1].symbol) return null;
  const [low, high] = [prices[0].value, prices[1].value].sort((a, b) => a - b);
  if (low === high) return null;
  return { low, high, currencySymbol: prices[0].symbol };
};
