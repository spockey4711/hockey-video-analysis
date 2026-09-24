/**
 * Public surface of the legal feature: the Impressum and Datenschutzerklärung
 * pages render from here, and every shell (site footer, share shell) links them
 * through {@link LegalLinks}. Operator details come from the environment via
 * `getLegalOperator`, which is server-only and so imported from `./operator`
 * directly (the site footer is a client component that imports this barrel);
 * nothing personal is hard-coded.
 */
export { legalContent, type LegalSection } from "./content";
export { Impressum } from "./Impressum";
export { LegalLinks } from "./LegalLinks";
export { PrivacyPolicy } from "./PrivacyPolicy";
export { IMPRESSUM_PATH, PRIVACY_PATH } from "./routes";
