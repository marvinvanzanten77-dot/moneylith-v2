export {};

/**
 * @typedef {Object} Institution
 * @property {string} id
 * @property {string} name
 * @property {string[]} countries
 */

/**
 * @typedef {Object} Agreement
 * @property {string} id
 * @property {string} institution_id
 * @property {string} created
 * @property {string} access_valid_for
 * @property {number} max_historical_days
 */

/**
 * @typedef {Object} Requisition
 * @property {string} id
 * @property {string} status
 * @property {string} institution_id
 * @property {string[]} accounts
 * @property {string} agreement
 * @property {string} link
 * @property {string} reference
 */

/**
 * @typedef {Object} BankTransaction
 * @property {string} transactionId
 * @property {string} bookingDate
 * @property {string} valueDate
 * @property {string} remittanceInformationUnstructured
 * @property {string} creditorName
 * @property {string} creditorAccount
 * @property {string} debtorName
 * @property {string} debtorAccount
 * @property {Object} transactionAmount
 * @property {string} transactionAmount.amount
 * @property {string} transactionAmount.currency
 */
