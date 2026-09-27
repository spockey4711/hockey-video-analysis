/**
 * Result shape of the Geräte actions, kept out of the `"use server"` module
 * (which may only export async functions) so the forms can import the initial
 * state.
 */
export type DeviceActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; error: string };

export const deviceActionInitialState: DeviceActionState = { status: "idle" };
