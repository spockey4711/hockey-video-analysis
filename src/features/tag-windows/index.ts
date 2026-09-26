/**
 * Public surface of the team's tag windows (Einstellungen > Tag-Fenster): the
 * lead-in and follow-through each tag type's new captures get. Pages compose
 * the form; server code reads the stored windows through `./queries`, and the
 * clip worker through `./read`.
 */
export { tagWindowsContent } from "./content";
export { TagWindowsForm } from "./TagWindowsForm";
