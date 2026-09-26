"use client";

import {
  type CSSProperties,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { AudienceBoard } from "./AudienceBoard";
import { LaserSpot } from "./LaserPointer";
import { TitleCardView } from "./TitleCardView";
import { mediaCorrection } from "./audience-media";
import {
  audienceChannelName,
  byeMessage,
  commandMessage,
  helloMessage,
  parsePresenterMessage,
  sessionIdFromHash,
  type AudienceCommand,
  type AudienceEntry,
  type AudienceState,
} from "./audience-protocol";
import {
  audienceSessionReducer,
  waitingSession,
  type AudienceSession,
} from "./audience-session";
import { presentationContent } from "./content";
import { presentationScaleFactor } from "./presentation-scale";
import { usePresentationScale } from "./use-presentation-scale";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import type { StageControl } from "@/features/clip-edits/stage/EditedClipStage";
import { EditedClipStage } from "@/features/clip-edits/stage/EditedClipStage";
import { TelestrationView } from "@/features/player/telestration";
import type { PicturePoint } from "@/features/player/telestration/geometry";
import { ClipVideo } from "@/features/share/playlist/ClipVideo";
import { playlistContent } from "@/features/share/playlist/content";
import { SceneStage, type SceneControl } from "@/features/tactics/SceneStage";
import { boardLayout, viewSize } from "@/features/tactics/geometry";
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreenActive,
} from "@/lib/fullscreen";

const copy = presentationContent.audience;

/** How long the mouse rests before the cursor and the fullscreen button go. */
const IDLE_MS = 2500;

/** The picture's width over its height until the video says otherwise. */
const DEFAULT_ASPECT = 16 / 9;

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * The audience window of a presentation on a second screen (ADR 0015): the
 * projector's picture and nothing else. It loads no data of its own; it
 * joins the presenter's channel named in its address, says hello, and shows
 * what the presenter sends - the clip or scene, the title cards, the drawing,
 * the pointer, the markers and the board - with no notes, no list and no
 * controls but fullscreen. Its keys (a presenter remote's, once a click here
 * put this window in front) go to the presenter. When the presenter closes
 * the presentation or its window, it falls back to a neutral end.
 */
export function AudienceView() {
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => null,
  );
  // Rendered on the server, the address is not known yet: wait neutrally.
  if (hash === null) return <AudienceMessage title={copy.waiting} />;
  const sessionId = sessionIdFromHash(hash);
  if (!sessionId) return <AudienceMessage title={copy.unavailable} />;
  // A new session id (the presenter reloaded) starts over.
  return <AudienceSessionView key={sessionId} sessionId={sessionId} />;
}

/** The pointer's spot, set many times a second without re-rendering the stage. */
interface PointerStore {
  get(): PicturePoint | null;
  set(at: PicturePoint | null): void;
  subscribe(onChange: () => void): () => void;
}

function createPointerStore(): PointerStore {
  let at: PicturePoint | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => at,
    set(next) {
      at = next;
      for (const listener of listeners) listener();
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}

function AudienceSessionView({ sessionId }: { sessionId: string }) {
  const [session, dispatch] = useReducer(
    audienceSessionReducer,
    waitingSession,
  );
  const [pointer] = useState(createPointerStore);
  const sendRef = useRef<(command: AudienceCommand) => void>(() => {});
  const [onCommand] = useState(
    () => (command: AudienceCommand) => sendRef.current(command),
  );

  useEffect(() => {
    // This window only ever listens; it needs no way back into the other.
    window.opener = null;
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(audienceChannelName(sessionId));
    channel.onmessage = (event: MessageEvent) => {
      const parsed = parsePresenterMessage(event.data);
      if (!parsed.ok) {
        if (parsed.reason === "version") dispatch("other-version");
        return;
      }
      const { message } = parsed;
      if (message.type === "pointer") pointer.set(message.at);
      else dispatch(message);
    };
    sendRef.current = (command) => channel.postMessage(commandMessage(command));
    channel.postMessage(helloMessage);
    const leave = () => channel.postMessage(byeMessage);
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
      channel.close();
      sendRef.current = () => {};
    };
  }, [sessionId, pointer]);

  return (
    <AudienceScreen session={session} pointer={pointer} onCommand={onCommand} />
  );
}

interface AudienceScreenProps {
  readonly session: AudienceSession;
  readonly pointer: PointerStore;
  readonly onCommand: (command: AudienceCommand) => void;
}

function AudienceScreen({ session, pointer, onCommand }: AudienceScreenProps) {
  const scale = usePresentationScale();
  const idle = useIdle(IDLE_MS);
  const fullscreen = useFullscreen();
  const toggleFullscreen = fullscreen.toggle;
  const live = session.kind === "live";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const command = commandFor(event.key);
      if (command) {
        event.preventDefault();
        onCommand(command);
      } else if (event.key.toLowerCase() === "f" && !event.repeat) {
        event.preventDefault();
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCommand, toggleFullscreen]);

  return (
    <main
      aria-label={copy.title}
      onDoubleClick={fullscreen.toggle}
      style={
        {
          "--presentation-scale": presentationScaleFactor(scale),
        } as CSSProperties
      }
      className={cn(
        "fixed inset-0 flex bg-[var(--bg-app)] text-[color:var(--text-primary)]",
        live && idle && "cursor-none",
      )}
    >
      {session.kind === "live" ? (
        <LiveStage
          entries={session.entries}
          state={session.state}
          pointer={pointer}
        />
      ) : session.kind === "ended" ? (
        <AudienceMessage title={copy.ended} />
      ) : session.kind === "other-version" ? (
        <AudienceMessage title={copy.otherVersion} />
      ) : (
        <AudienceMessage title={copy.waiting} hint={copy.waitingHint} />
      )}
      {fullscreen.isActive && (idle || live) ? null : (
        <div
          className={cn(
            "absolute inset-x-0 bottom-[var(--space-6)] z-30 flex justify-center transition-opacity duration-[var(--dur-fast)]",
            live && idle && "pointer-events-none opacity-0",
          )}
        >
          <Button
            variant="secondary"
            iconLeft={fullscreen.isActive ? "minimize" : "maximize"}
            onClick={fullscreen.toggle}
          >
            {fullscreen.isActive ? copy.exitFullscreen : copy.fullscreen}
          </Button>
        </div>
      )}
    </main>
  );
}

/** The presenter's step a key in this window stands for, if any. */
function commandFor(key: string): AudienceCommand | null {
  switch (key) {
    case "ArrowRight":
    case "PageDown":
      return "next";
    case "ArrowLeft":
    case "PageUp":
      return "previous";
    case " ":
      return "toggle-play";
    default:
      return null;
  }
}

interface LiveStageProps {
  readonly entries: readonly AudienceEntry[];
  readonly state: AudienceState;
  readonly pointer: PointerStore;
}

/**
 * The entry the presenter shows, full screen, playing along with the
 * presenter's: it plays and pauses when the presenter does and seeks only
 * when it drifts off (see `mediaCorrection`). It plays without sound; the
 * sound comes from the presenter's window.
 */
function LiveStage({ entries, state, pointer }: LiveStageProps) {
  const entry = entries[state.index];
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<StageControl>(null);
  const sceneRef = useRef<SceneControl>(null);
  // Whether the entry on screen plays, as its transport would show it.
  const playingRef = useRef({ id: "", playing: false });
  const [videoAspect, setVideoAspect] = useState(DEFAULT_ASPECT);

  function setPlaying(playing: boolean) {
    playingRef.current = { id: entry.id, playing };
  }

  function isPlaying(): boolean {
    const current = playingRef.current;
    return current.id === entry.id && current.playing;
  }

  // Bring the entry to where the presenter's is, after each message and as
  // a clip's picture comes in.
  function follow() {
    const target = state.media;
    if (entry.kind === "scene") {
      const scene = sceneRef.current;
      if (target.playing && !isPlaying()) scene?.play();
      else if (!target.playing && isPlaying()) scene?.pause();
      return;
    }
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    const staged = entry.plan !== undefined;
    const playing = staged ? isPlaying() : !video.paused;
    const fix = mediaCorrection(target, Date.now(), {
      playing,
      held: staged && playing && video.paused,
      time: video.currentTime,
    });
    if (fix.seekTo !== null) video.currentTime = fix.seekTo;
    if (fix.pause) {
      if (staged) stageRef.current?.pause();
      else video.pause();
    }
    if (fix.play) void video.play().catch(() => {});
  }

  useEffect(follow);

  function onReady() {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setVideoAspect(video.videoWidth / video.videoHeight);
    }
    follow();
  }

  const aspect =
    entry.kind === "scene" ? sceneAspect(entry.scene.view) : videoAspect;
  const overlays = (
    <>
      {state.drawing && entry.kind === "clip" ? (
        <TelestrationView strokes={state.drawing} videoRef={videoRef} />
      ) : null}
      {state.card ? (
        <TitleCardView card={state.card} clipTitle={entry.title} />
      ) : null}
      {state.pointer ? (
        <AudiencePointer pointer={pointer} aspect={aspect} />
      ) : null}
    </>
  );
  const media = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
  };

  return (
    <div className="type-presentation relative min-w-0 flex-1">
      {entry.kind === "scene" ? (
        <SceneStage
          key={entry.id}
          scene={entry.scene}
          holdS={entry.holdS}
          title={entry.title}
          controlRef={sceneRef}
          onReady={follow}
          {...media}
          className="absolute inset-0"
        >
          {overlays}
        </SceneStage>
      ) : entry.plan ? (
        <div className="absolute inset-0 overflow-hidden">
          <EditedClipStage
            items={entries}
            index={state.index}
            plan={entry.plan}
            frameRate={entry.frameRate}
            videoRef={videoRef}
            controlRef={stageRef}
            title={entry.title}
            showMarks={state.showMarks}
            layout="fill"
            fullscreen={false}
            hideTransport
            silent
            pictureClassName="bg-[image:var(--video-backdrop)]"
            onReady={onReady}
            {...media}
          >
            {overlays}
          </EditedClipStage>
        </div>
      ) : (
        <div className="absolute inset-0 overflow-hidden bg-[image:var(--video-backdrop)]">
          <ClipVideo
            items={entries}
            index={state.index}
            videoRef={videoRef}
            onReady={onReady}
            title={entry.title}
            muted
            playsInline
            className="absolute inset-0 size-full object-contain"
            {...media}
          >
            {playlistContent.unsupported}
          </ClipVideo>
          {overlays}
        </div>
      )}
      {state.board ? <AudienceBoard board={state.board} /> : null}
    </div>
  );
}

/** The width over the height of a scene's pitch, drawn as on the stage. */
function sceneAspect(view: Parameters<typeof boardLayout>[0]): number {
  const { width, height } = viewSize(boardLayout(view, "landscape"));
  return width / height;
}

interface AudiencePointerProps {
  readonly pointer: PointerStore;
  /** The picture's width over its height, to find it in the box. */
  readonly aspect: number;
}

/** The presenter's laser dot, on the same spot of the picture. */
function AudiencePointer({ pointer, aspect }: AudiencePointerProps) {
  const at = useSyncExternalStore(pointer.subscribe, pointer.get, () => null);
  return (
    <div
      aria-hidden="true"
      data-testid="audience-pointer"
      className="[container-type:size] pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute inset-0 m-auto h-[min(100cqh,calc(100cqw/var(--picture-aspect)))] w-[min(100cqw,calc(100cqh*var(--picture-aspect)))]"
        style={{ "--picture-aspect": aspect } as CSSProperties}
      >
        {at ? (
          <div
            className="absolute"
            style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
          >
            <LaserSpot />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A neutral screen: nothing of the presentation, just where things stand. */
function AudienceMessage({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="type-presentation m-auto flex max-w-[40ch] flex-col items-center gap-[var(--space-2)] p-[var(--space-6)] text-center">
      <p
        role="status"
        className="text-[length:var(--fs-title)] text-[color:var(--text-secondary)]"
      >
        {title}
      </p>
      {hint ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Whether the mouse has rested for `ms`; any move wakes it. */
function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), ms);
    function wake() {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    }
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [ms]);
  return idle;
}

function subscribeToFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Whether this window fills the screen, and the switch. */
function useFullscreen(): { isActive: boolean; toggle: () => void } {
  const isActive = useSyncExternalStore(
    subscribeToFullscreen,
    isFullscreenActive,
    () => false,
  );
  const [control] = useState(() => ({
    toggle() {
      if (isFullscreenActive()) void exitFullscreen();
      else void enterFullscreen(document.documentElement);
    },
  }));
  return { isActive, toggle: control.toggle };
}
