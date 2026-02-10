/**
 * Hardcoded B2C / Commerce IDs for this app.
 * Use these when calling APIs that require WebStoreId or Pricebook2Id.
 */
export const B2C_CONSTANTS = {
  /** Salesforce B2C Commerce Web Store ID. */
  WebStoreId: '0ZEDX000000008M4AQ',
  /** Salesforce Price Book (Pricebook2) ID. */
  Pricebook2Id: '01sDX0000000ehaYAA',
} as const;

export type B2CConstants = typeof B2C_CONSTANTS;
