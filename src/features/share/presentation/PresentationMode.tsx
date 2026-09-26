"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LaserPointer } from "./LaserPointer";
import { PresenterNotesPanel } from "./PresenterNotesPanel";
import { TitleCardView } from "./TitleCardView";
import { presentationContent } from "./content";
import {
  type ActiveTool,
  isBoardShortcut,
  isMarksShortcut,
  isNotesShortcut,
  isPointerShortcut,
  toggleTool,
} from "./presentation-tools";
import { type PresenterNotes, presenterNotesView } from "./presenter-notes";
import { titleCardsFor } from "./title-cards";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import {
  EditedClipStage,
  type StageControl,
} from "@/features/clip-edits/stage/EditedClipStage";
import {
  TelestrationLayer,
  TelestrationToolbar,
  telestrationContent,
  useTelestration,
} from "@/features/player/telestration";
import { ClipVideo } from "@/features/share/playlist/ClipVideo";
import { CoachComment } from "@/features/share/playlist/CoachComment";
import { playlistContent } from "@/features/share/playlist/content";
import {
  clampIndex,
  indexAfterEnd,
  isLast,
  nextIndex,
  type PlaybackMode,
  playsOnSelect,
  prevIndex,
} from "@/features/share/playlist/playlist-navigation";
import { clipOf, type PlaylistEntry } from "@/features/share/playlist/types";
import { type VideoEvent, viewTracking } from "@/features/share/views/client";
import {
  PresentationBoard,
  type SceneOption,
} from "@/features/tactics/PresentationBoard";
import { SceneStage, type SceneControl } from "@/features/tactics/SceneStage";
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
} from "@/lib/fullscreen";

export interface PresentationModeProps {
  /** The same ordered, display-ready clips the playlist plays, index `i` first. */
  readonly items: readonly PlaylistEntry[];
  /**
   * Whether clips start and advance on their own (`continuous`, the default) or
   * only on the viewer's action (`manual`), matching the playlist beside it.
   */
  readonly playback?: PlaybackMode;
  /**
   * Count anonymous views of the clips against this collection link, like the
   * playlist beside it (ADR 0009). Left out, nothing is reported.
   */
  readonly views?: { readonly shareToken: string };
  /**
   * The coach's private presenter notes. Only the collection link passes them,
   * and only for a signed-in coach session; left out, there is no notes panel
   * or switch at all.
   */
  readonly presenterNotes?: PresenterNotes;
  /**
   * The coach's intro for the team, public on the collection link: a title
   * card before the first clip. Left out, the first clip comes up as before.
   */
  readonly intro?: string;
  /**
   * The coach's saved tactics scenes the board can open, names only. Only the
   * collection link passes them, and only for a signed-in coach session; left
   * out, the board offers the lineup and an empty pitch.
   */
  readonly tacticsScenes?: readonly SceneOption[];
}

/** Past every title card of the current clip, whatever their number. */
const CARDS_DONE = Number.POSITIVE_INFINITY;

/**
 * Fullscreen, distraction-free playback for a team session (P1-8). It launches
 * from a button and, while open, gives almost the whole screen to one large clip:
 * a slim header with the clip's title and the way out, and a compact transport
 * row below. In `continuous` playback it auto-advances through the session and
 * stops on the last clip; in `manual` playback each clip waits for a play press
 * and stops at its end with a replay control beside next. It reuses the shared
 * {@link PlaylistEntry} contract and the pure playlist navigation, so - like the
 * {@link PlaylistPlayer} it sits beside - it stays dumb about where the clips
 * come from and never reaches past the resolved list on the login-free share
 * surface.
 */
export function PresentationMode({
  items,
  playback = "continuous",
  views,
  presenterNotes,
  intro,
  tacticsScenes,
}: PresentationModeProps) {
  const [active, setActive] = useState(false);
  const close = useCallback(() => {
    setActive(false);
    void exitFullscreen();
  }, []);

  if (items.length === 0) return null;

  if (!active) {
    return (
      <div className="flex justify-center">
        <Button
          variant="secondary"
          iconLeft="film"
          onClick={() => setActive(true)}
        >
          {presentationContent.launch}
        </Button>
      </div>
    );
  }

  return (
    <PresentationOverlay
      items={items}
      playback={playback}
      views={views}
      presenterNotes={presenterNotes}
      intro={intro}
      tacticsScenes={tacticsScenes}
      onClose={close}
    />
  );
}

interface PresentationOverlayProps extends PresentationModeProps {
  readonly playback: PlaybackMode;
  /** Close the overlay; stable across renders, as fullscreen is entered once. */
  readonly onClose: () => void;
}

/**
 * The open presentation, mounted fresh on every launch so it always starts on
 * the first clip with a clean drawing.
 *
 * The presenter can draw on a paused clip with the watch player's telestration
 * (P2-10): the same tools, pens and widths, the `d` key or the pen button. The
 * drawing lives only in this browser - never saved, exported or sent - and is
 * discarded once the clip plays on or another clip comes up. While it is up,
 * Escape belongs to the drawing, so the first press closes it rather than the
 * presentation.
 *
 * The laser pointer (`p` or its button) puts a glowing dot under the mouse or
 * finger over the video, playing or paused, and hides the cursor there. It
 * draws nothing, so it stays on across clips until switched off. Pointer and
 * drawing never run together: switching one on switches the other off.
 *
 * Clips the coach marked up in the editor show their markers (ADR 0011, D6);
 * `m` or the markers button hides them for the whole presentation, and shows
 * them again. The presenter's own drawing always lies on top of them.
 *
 * With presenter notes, `h` or the notes button shows the coach's notes beside
 * the video. The panel starts hidden, as the presentation usually runs on a
 * projector the team is watching, and it stays as switched across clips.
 *
 * The coach's notes for the team come up as title cards over the video: the
 * intro before the first clip, then a clip's own text before that clip, every
 * time the clip comes up. A card never advances on its own: "Weiter" (or Enter
 * or Space) steps to the next card or the clip, and play or the drawing skip
 * the rest and go straight to the clip. A clip without a text has no card.
 *
 * The tactics board (`t` or its button) comes up over the whole presentation
 * to sketch a move or play a prepared scene, with the clip paused under it.
 * `t`, `Escape` or "Zurück zur Präsentation" puts it away again and the
 * presentation carries on from the same clip, the same moment and the same
 * title card; the board keeps what was on it until the presentation closes.
 *
 * A clip with a playback plan (ADR 0011) plays on the {@link EditedClipStage}
 * from its in to its out point, its transport under the picture; like the
 * native controls before it, the transport steps aside for a drawing or a
 * title card.
 */
function PresentationOverlay({
  items,
  playback,
  views,
  presenterNotes,
  intro,
  tacticsScenes,
  onClose,
}: PresentationOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<StageControl>(null);
  const sceneRef = useRef<SceneControl>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Start playback whenever an index change was driven by a user action or an
  // auto-advance in continuous playback; consumed once the new source has loaded.
  const autoPlayRef = useRef(playsOnSelect(playback));
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // The current clip has played to its end and is waiting for the viewer.
  const [hasEnded, setHasEnded] = useState(false);

  const [isPointing, setIsPointing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showMarks, setShowMarks] = useState(true);
  // How many of the current clip's title cards the viewer has stepped past.
  const [cardStep, setCardStep] = useState(0);
  // The tactics board is mounted on its first opening and then only hidden,
  // so it keeps its scene between openings.
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardUsed, setBoardUsed] = useState(false);
  const boardOpenRef = useRef(boardOpen);
  useEffect(() => {
    boardOpenRef.current = boardOpen;
  });

  // Runs as the drawing layer goes up, by button or by `d`: hold the frame
  // still and take the pointer down, as only one tool is on at a time.
  const prepareDrawing = useCallback(() => {
    // The stage also stops a marker's hold, which would play on under the pen.
    if (stageRef.current) stageRef.current.pause();
    else videoRef.current?.pause();
    sceneRef.current?.pause();
    setIsPointing(false);
    setCardStep(CARDS_DONE);
  }, []);
  const telestration = useTelestration(prepareDrawing, videoRef);
  const isDrawing = telestration.state.active;
  const activeTool: ActiveTool = isDrawing
    ? "draw"
    : isPointing
      ? "pointer"
      : null;
  const closeDrawing = telestration.close;
  const closeBoard = useCallback(() => {
    setBoardOpen(false);
    // The board and its focus go away; keep the keys on the overlay.
    containerRef.current?.focus();
  }, []);
  const isDrawingRef = useRef(isDrawing);
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  });

  const { transport } = presentationContent;

  // Take native fullscreen as the overlay opens, move focus into it so the
  // arrow keys drive it straight away, and close if the viewer leaves
  // fullscreen with Escape or the browser chrome.
  useEffect(() => {
    const container = containerRef.current;
    container?.focus();
    void enterFullscreen(container);

    function handleFullscreenChange() {
      // Only treat leaving fullscreen as a close when we actually entered it;
      // browsers without the API never fire this and keep the overlay open.
      if (!isFullscreenSupported(container) || isFullscreenActive()) return;
      // The browser keeps Escape for leaving fullscreen and never passes it
      // on, so a press while the board or a drawing is up was meant for
      // that: close only it and stay open in the window.
      if (boardOpenRef.current) closeBoard();
      else if (isDrawingRef.current) closeDrawing();
      else onClose();
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onClose, closeDrawing, closeBoard]);

  const safeIndex = clampIndex(index, items.length);
  const current = items[safeIndex];
  const atFirst = safeIndex === 0;
  const atLast = isLast(safeIndex, items.length);
  const clip = clipOf(current);
  const plan = clip?.plan;
  const hasMarks = items.some(
    (item) => (clipOf(item)?.plan?.marks.length ?? 0) > 0,
  );
  const tracking = viewTracking(
    views && clip
      ? {
          shareToken: views.shareToken,
          clipId: clip.id,
          ...(plan && { window: { inS: plan.inS, outS: plan.outS } }),
        }
      : undefined,
  );
  const cards = titleCardsFor(safeIndex, clip ?? {}, intro);
  const card = cards[cardStep];

  // Navigate with functional updates so keyboard handlers never see a stale
  // index. A drawing belongs to the clip it was made on, so it goes too.
  function goNext() {
    telestration.close();
    autoPlayRef.current = playsOnSelect(playback);
    setHasEnded(false);
    // The clip going off screen stops without a `pause` the player hears.
    setIsPlaying(false);
    setCardStep(0);
    setIndex((i) => nextIndex(clampIndex(i, items.length), items.length));
  }

  function goPrev() {
    telestration.close();
    autoPlayRef.current = playsOnSelect(playback);
    setHasEnded(false);
    // The clip going off screen stops without a `pause` the player hears.
    setIsPlaying(false);
    setCardStep(0);
    setIndex((i) => prevIndex(clampIndex(i, items.length), items.length));
  }

  // The clip holds still under the board, and neither tool stays on.
  function openBoard() {
    telestration.close();
    setIsPointing(false);
    if (stageRef.current) stageRef.current.pause();
    else videoRef.current?.pause();
    sceneRef.current?.pause();
    setBoardUsed(true);
    setBoardOpen(true);
  }

  function togglePointer() {
    const next = toggleTool(activeTool, "pointer");
    if (isDrawing && next !== "draw") telestration.close();
    setIsPointing(next === "pointer");
  }

  // Start the entry on screen: the clip's video, or the scene's clock.
  function playCurrent() {
    if (clip) void videoRef.current?.play();
    else sceneRef.current?.play();
  }

  function replay() {
    if (!clip) {
      sceneRef.current?.replay();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = plan?.inS ?? 0;
    void video.play();
  }

  function togglePlay() {
    if (card) {
      // Play from a title card skips the rest of them and starts the clip.
      autoPlayRef.current = false;
      setCardStep(CARDS_DONE);
      playCurrent();
      return;
    }
    if (!clip) {
      sceneRef.current?.togglePlay();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    // The stage knows when a marker holds the picture of a clip still playing.
    if (plan && stageRef.current) stageRef.current.togglePlay();
    else if (video.paused) void video.play();
    else video.pause();
  }

  // Step past the current title card. Past the last one, a start that waited
  // behind the cards (continuous playback) goes ahead now.
  function continueFromCard() {
    const next = cardStep + 1;
    setCardStep(next);
    if (next < cards.length) return;
    // The card and its button go away; keep the keys on the overlay.
    containerRef.current?.focus();
    if (autoPlayRef.current) {
      autoPlayRef.current = false;
      playCurrent();
    }
  }

  function handleLoadedData() {
    // A title card is up: the start waits until the viewer is past it.
    if (!autoPlayRef.current || card) return;
    autoPlayRef.current = false;
    playCurrent();
  }

  function finish() {
    if (indexAfterEnd(playback, safeIndex, items.length) === null) {
      setHasEnded(true);
    } else {
      goNext();
    }
  }

  function handleEnded(event: VideoEvent) {
    tracking?.onEnded(event);
    finish();
  }

  // The same media events reach the view counting on either player.
  const media = {
    onPlay(event: VideoEvent) {
      tracking?.onPlay(event);
      setIsPlaying(true);
      setHasEnded(false);
    },
    onPause: () => setIsPlaying(false),
    onTimeUpdate: tracking?.onTimeUpdate,
    onSeeked: tracking?.onSeeked,
  };
  // The dot stands in for the cursor, and a finger drag points rather than
  // scrolls.
  const pointerClass =
    activeTool === "pointer" ? "cursor-none touch-none" : undefined;
  // Drawn over the picture: the drawing, a title card, the pointer's dot.
  const overlays = (
    <>
      {isDrawing ? (
        <>
          <TelestrationLayer
            state={telestration.state}
            dispatch={telestration.dispatch}
            videoRef={videoRef}
          />
          <TelestrationToolbar
            state={telestration.state}
            dispatch={telestration.dispatch}
            videoRef={videoRef}
            onClose={telestration.close}
          />
        </>
      ) : null}
      {card ? (
        <TitleCardView
          card={card}
          clipTitle={current.title}
          onContinue={continueFromCard}
        />
      ) : null}
      {activeTool === "pointer" ? (
        <LaserPointer surfaceRef={surfaceRef} />
      ) : null}
    </>
  );

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={presentationContent.regionLabel}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (isBoardShortcut(event)) {
          event.preventDefault();
          openBoard();
          return;
        }
        // A scene is no video to draw on; its board is one `t` away.
        if (!clip && event.key.toLowerCase() === "d") {
          event.preventDefault();
          return;
        }
        if (isPointerShortcut(event)) {
          event.preventDefault();
          togglePointer();
          return;
        }
        if (hasMarks && isMarksShortcut(event)) {
          event.preventDefault();
          setShowMarks((shown) => !shown);
          return;
        }
        if (presenterNotes && isNotesShortcut(event)) {
          event.preventDefault();
          setShowNotes((shown) => !shown);
          return;
        }
        // Enter or Space on the overlay itself steps past a title card; a
        // focused button keeps its own Enter and Space.
        if (
          card &&
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          continueFromCard();
          return;
        }
        switch (event.key) {
          case "ArrowRight":
            if (!atLast) {
              event.preventDefault();
              goNext();
            }
            break;
          case "ArrowLeft":
            if (!atFirst) {
              event.preventDefault();
              goPrev();
            }
            break;
          case "Escape":
            // The drawing's own Escape binding closes it first.
            if (isDrawing) break;
            // Native fullscreen also exits on Escape; closing here covers the
            // unsupported-fullscreen case where no fullscreenchange fires.
            onClose();
            break;
        }
      }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-app)] text-[color:var(--text-primary)] outline-none"
    >
      <div
        inert={boardOpen}
        className="flex items-start justify-between gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-2)]"
      >
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-[length:var(--fs-body)]">
            <span className="[font-weight:var(--fw-semibold)]">
              {current.title}
            </span>
            {current.subtitle && (
              <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {" - "}
                {current.subtitle}
              </span>
            )}
          </p>
          {clip?.coachComment && (
            <CoachComment
              text={clip.coachComment}
              className="max-w-[90ch] text-[length:var(--fs-body-sm)]"
            />
          )}
        </div>
        <IconButton name="x" label={transport.exit} onClick={onClose} />
      </div>

      <div
        inert={boardOpen}
        className="flex min-h-0 flex-1 gap-[var(--space-2)] px-[var(--space-2)]"
      >
        {current.kind === "scene" ? (
          <SceneStage
            key={current.id}
            scene={current.scene}
            holdS={current.holdS}
            title={current.title}
            controlRef={sceneRef}
            surfaceRef={surfaceRef}
            onReady={handleLoadedData}
            onPlay={() => {
              setIsPlaying(true);
              setHasEnded(false);
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              finish();
            }}
            className={cn(
              "min-w-0 flex-1 rounded-[var(--radius-md)]",
              pointerClass,
            )}
          >
            {overlays}
          </SceneStage>
        ) : plan ? (
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-[var(--radius-md)]">
            <EditedClipStage
              items={items}
              index={safeIndex}
              plan={plan}
              frameRate={current.frameRate}
              videoRef={videoRef}
              controlRef={stageRef}
              title={current.title}
              showMarks={showMarks}
              layout="fill"
              fullscreen={false}
              hideTransport={isDrawing || card !== undefined}
              pictureRef={surfaceRef}
              pictureClassName={cn(
                "bg-[image:var(--video-backdrop)]",
                pointerClass,
              )}
              onReady={handleLoadedData}
              {...media}
              onEnded={handleEnded}
            >
              {overlays}
            </EditedClipStage>
          </div>
        ) : (
          <div
            ref={surfaceRef}
            className={cn(
              "relative min-w-0 flex-1 overflow-hidden rounded-[var(--radius-md)] bg-[image:var(--video-backdrop)]",
              pointerClass,
            )}
          >
            <ClipVideo
              items={items}
              index={safeIndex}
              videoRef={videoRef}
              onReady={handleLoadedData}
              title={current.title}
              // The native bar would sit in the drawing and swallow its strokes.
              controls={!isDrawing}
              playsInline
              className="absolute inset-0 size-full object-contain"
              {...media}
              onEnded={handleEnded}
            >
              {playlistContent.unsupported}
            </ClipVideo>
            {overlays}
          </div>
        )}
        {presenterNotes && showNotes ? (
          <PresenterNotesPanel
            notes={presenterNotesView(presenterNotes, current.id, safeIndex)}
          />
        ) : null}
      </div>

      <div
        inert={boardOpen}
        className="flex flex-wrap items-center justify-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-2)]"
      >
        <IconButton
          name="chevron-left"
          label={transport.previous}
          disabled={atFirst}
          onClick={goPrev}
        />
        {hasEnded && playback === "manual" ? (
          <IconButton
            name="rotate-ccw"
            label={transport.replay}
            variant="solid"
            onClick={replay}
          />
        ) : (
          <IconButton
            name={isPlaying ? "pause" : "play"}
            label={isPlaying ? transport.pause : transport.play}
            variant="solid"
            onClick={togglePlay}
          />
        )}
        <Button iconRight="chevron-right" disabled={atLast} onClick={goNext}>
          {transport.next}
        </Button>
        <IconButton
          name="pen-tool"
          label={telestrationContent.toggle}
          active={isDrawing}
          disabled={!clip}
          onClick={telestration.toggle}
        />
        <IconButton
          name="mouse-pointer-2"
          label={presentationContent.pointer}
          active={activeTool === "pointer"}
          onClick={togglePointer}
        />
        <IconButton
          name="columns-2"
          label={presentationContent.board}
          active={boardOpen}
          onClick={openBoard}
        />
        {hasMarks ? (
          <IconButton
            name={showMarks ? "eye" : "eye-off"}
            label={presentationContent.marks}
            active={showMarks}
            onClick={() => setShowMarks((shown) => !shown)}
          />
        ) : null}
        {presenterNotes ? (
          <IconButton
            name="sticky-note"
            label={presentationContent.notes.toggle}
            active={showNotes}
            onClick={() => setShowNotes((shown) => !shown)}
          />
        ) : null}
        <span
          aria-live="polite"
          className="text-[length:var(--fs-body-sm)] whitespace-nowrap text-[color:var(--text-muted)] tabular-nums"
        >
          {presentationContent.counter(safeIndex + 1, items.length)}
        </span>
      </div>
      {boardUsed ? (
        <PresentationBoard
          scenes={tacticsScenes}
          open={boardOpen}
          onClose={closeBoard}
        />
      ) : null}
    </div>
  );
}
