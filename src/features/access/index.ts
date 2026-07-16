/**
 * Public surface of the access feature. Sibling feature lanes import the guard
 * and current-coach helper from here to protect their pages and stamp `author`.
 */
export { requireCoach } from "./guard";
export { getCurrentCoach } from "@/lib/auth";
export { isSignupEnabled } from "./invite";
export { LoginForm } from "./LoginForm";
export { SignupForm } from "./SignupForm";
export { SignOutForm } from "./SignOutForm";
export { logoutAction } from "./actions";
export { accessContent } from "./content";
