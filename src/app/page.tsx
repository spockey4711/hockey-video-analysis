export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <span className="text-accent text-sm font-medium tracking-widest uppercase">
          Field hockey
        </span>
        <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
          Tag the game. Share the clips.
        </h1>
        <p className="text-muted max-w-2xl text-lg">
          Mark moments in a multi-chapter game recording, link them to players,
          and share cut clips through login-free secret links.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-3">
        {features.map((feature) => (
          <li
            key={feature.title}
            className="border-border bg-surface rounded-lg border p-4"
          >
            <h2 className="font-medium">{feature.title}</h2>
            <p className="text-muted mt-1 text-sm">{feature.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

const features = [
  {
    title: "Tag",
    description:
      "Capture goals, corners and actions on a single game timeline.",
  },
  {
    title: "Cut",
    description: "Turn confirmed tags into clips cut by the pipeline worker.",
  },
  {
    title: "Share",
    description: "Send team and per-player clips via unguessable secret links.",
  },
] as const;
