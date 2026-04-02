/**
 * Explicit state machine for the restaurant recommendations scrape pipeline.
 * Enforces valid transitions as defined in manifest.json's stateMachine section.
 */

export type ScrapeState =
  | 'PENDING'
  | 'PARSING'
  | 'FETCHING'
  | 'FALLBACK'
  | 'EXTRACTING'
  | 'VALIDATING'
  | 'ENRICHING'
  | 'COMPLETE'
  | 'FAILED';

const VALID_TRANSITIONS: Record<ScrapeState, ScrapeState[]> = {
  PENDING: ['PARSING'],
  PARSING: ['FETCHING'],
  FETCHING: ['EXTRACTING', 'FALLBACK'],
  FALLBACK: ['EXTRACTING', 'FAILED'],
  EXTRACTING: ['VALIDATING', 'FAILED'],
  VALIDATING: ['ENRICHING', 'FAILED'],
  ENRICHING: ['COMPLETE', 'FAILED'],
  COMPLETE: [],
  FAILED: ['PENDING'],
};

export class InvalidTransitionError extends Error {
  constructor(from: ScrapeState, to: ScrapeState) {
    super(`Transition from ${from} to ${to} is not permitted.`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Assert that a state transition is valid. Throws if not.
 */
export function assertValidTransition(from: ScrapeState, to: ScrapeState): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

