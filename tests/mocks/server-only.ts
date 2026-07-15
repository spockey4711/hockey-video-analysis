// No-op stand-in for the `server-only` package under Vitest. The real module
// throws on import outside a React Server Component (it has no `react-server`
// build for the test runner to resolve), so we alias it here to let unit tests
// import server-only modules (e.g. auth session/invite helpers) directly.
export {};
