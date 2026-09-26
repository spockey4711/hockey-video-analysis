"use client";

/**
 * "Als Bild": the board's moment on show as a picture for a team chat (S7).
 * The button freezes that moment - the step the board rests on, or where a
 * playing animation stands - and opens a dialog to pick the picture's shape.
 * The picture is drawn as soon as the shape is picked, so the share sheet
 * opens straight from the button press, as a phone requires. On a phone the
 * picture goes to the share sheet, elsewhere it downloads.
 *
 * The dialog stops every key press it gets, so none reaches the board's keys
 * or the presentation the board may be open over.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { BoardImage } from "./BoardImage";
import { frameAt, keyframe, type SceneFrame } from "./animation";
import {
  boardImageName,
  handOffImage,
  IMAGE_PRESETS,
  IMAGE_SIZE,
  imageHandOff,
  isTouchScreen,
  renderBoardImage,
  type ImageHandOff,
  type ImagePreset,
} from "./board-image";
import type { BoardState } from "./board-state";
import { tacticsContent } from "./content";
import type { PitchView } from "./pitch";
import { playToolsIn, type PlayTool } from "./scene";

import { Heading } from "@/components/core/Heading";
import { Button } from "@/components/forms/Button";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
import { IconButton } from "@/components/forms/IconButton";

const copy = tacticsContent.image;

/** The moment the button froze: what the picture shows and what it is called. */
interface Moment {
  readonly view: PitchView;
  readonly frame: SceneFrame;
  /** The play tools the scene uses, for the legend. */
  readonly legend: readonly PlayTool[];
  readonly note: string;
  readonly fileName: string;
  /** The short names under the discs, when the board showed names. */
  readonly names: ReadonlyMap<string, string> | undefined;
}

function freeze(
  { scene, step, playback }: Pick<BoardState, "scene" | "step" | "playback">,
  name: string,
  names: ReadonlyMap<string, string> | undefined,
): Moment {
  const frame = playback
    ? frameAt(scene, playback.time)
    : keyframe(scene, step);
  return {
    view: scene.view,
    frame,
    legend: playToolsIn(scene.lines),
    note: playback
      ? copy.shows.moment
      : step === 0
        ? copy.shows.start
        : copy.shows.step(step),
    fileName: boardImageName(name, playback ? frame.step : step),
    names,
  };
}

export function BoardImageExport({
  state,
  name,
  names,
}: {
  state: Pick<BoardState, "scene" | "step" | "playback">;
  /** The scene's name, which names the file; the board's name without one. */
  name?: string;
  /**
   * The short names the board shows under its discs, so the picture shows
   * them too; left out, as while the board hides names, the picture has none.
   */
  names?: ReadonlyMap<string, string>;
}) {
  const [moment, setMoment] = useState<Moment | null>(null);
  return (
    <>
      <Button
        variant="secondary"
        iconLeft="image"
        onClick={() =>
          setMoment(freeze(state, name?.trim() || copy.name, names))
        }
      >
        {copy.open}
      </Button>
      <ImageDialog moment={moment} onClose={() => setMoment(null)} />
    </>
  );
}

/** The picture drawn for a shape, ready to preview and hand off. */
type Drawn =
  | { readonly preset: ImagePreset; readonly status: "failed" }
  | {
      readonly preset: ImagePreset;
      readonly status: "ready";
      readonly file: File;
      /** An object URL of the file, for the preview. */
      readonly url: string;
      readonly how: ImageHandOff;
    };

function ImageDialog({
  moment,
  onClose,
}: {
  moment: Moment | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = moment !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    // The board and the presentation listen further up; Escape is the
    // dialog's own, handled by the browser.
    event.stopPropagation();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={onKeyDown}
      // The panel fills the dialog, so a click on the dialog itself is one on
      // the backdrop beside it.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[min(90dvh,48rem)] w-[min(100%-2*var(--space-4),40rem)] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[var(--surface-raised)] text-[color:var(--text-primary)] shadow-[var(--shadow-lg)] backdrop:bg-[var(--scrim)]"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-center gap-[var(--space-3)] border-b border-[color:var(--border)] px-[var(--space-4)] py-[var(--space-3)]">
          <Heading level={2} size="sub" id={titleId}>
            {copy.title}
          </Heading>
          <IconButton
            name="x"
            label={copy.close}
            onClick={onClose}
            className="ms-auto"
          />
        </header>
        {moment ? <ImagePanel moment={moment} onDone={onClose} /> : null}
      </div>
    </dialog>
  );
}

function ImagePanel({
  moment,
  onDone,
}: {
  moment: Moment;
  onDone: () => void;
}) {
  const [preset, setPreset] = useState<ImagePreset>("wide");
  const [result, setResult] = useState<Drawn | null>(null);
  // A picture of another shape is still on its way.
  const drawn = result?.preset === preset ? result : null;
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let current = true;
    let url: string | null = null;
    const { width, height } = IMAGE_SIZE[preset];
    renderBoardImage(svg, width, height).then(
      (blob) => {
        if (!current) return;
        const file = new File([blob], moment.fileName, { type: "image/png" });
        url = URL.createObjectURL(file);
        setResult({
          preset,
          status: "ready",
          file,
          url,
          how: imageHandOff(file, navigator, isTouchScreen()),
        });
      },
      () => {
        if (current) setResult({ preset, status: "failed" });
      },
    );
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [preset, moment]);

  async function handOff(file: File, how: ImageHandOff): Promise<void> {
    const result = await handOffImage(file, how);
    if (result !== "cancelled") onDone();
  }

  return (
    <div className="flex min-h-0 flex-col gap-[var(--space-3)] overflow-y-auto p-[var(--space-4)]">
      <ChoiceGroup
        label={copy.shape}
        options={IMAGE_PRESETS.map((value) => ({
          value,
          label: copy.presets[value],
        }))}
        value={preset}
        onChange={setPreset}
      />
      {/* The drawing the picture is painted from, out of sight. */}
      <div aria-hidden className="sr-only">
        <BoardImage
          ref={svgRef}
          view={moment.view}
          frame={moment.frame}
          preset={preset}
          legend={moment.legend}
          title={copy.name}
          names={moment.names}
        />
      </div>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-inset)]">
        {drawn?.status === "ready" && (
          // A blob URL of a picture made here; the image optimiser has
          // nothing to fetch.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drawn.url}
            alt={copy.preview}
            width={IMAGE_SIZE[preset].width}
            height={IMAGE_SIZE[preset].height}
            className="h-full w-auto max-w-full object-contain"
          />
        )}
      </div>
      <div className="flex flex-col gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
        <p>{moment.note}</p>
        <p>{copy.privacy}</p>
      </div>
      <p
        role="status"
        className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] empty:hidden"
      >
        {drawn === null
          ? copy.rendering
          : drawn.status === "failed"
            ? copy.failed
            : ""}
      </p>
      <div className="flex flex-wrap justify-end gap-[var(--space-2)]">
        {drawn?.status === "ready" && drawn.how === "share" && (
          <Button
            variant="secondary"
            iconLeft="download"
            onClick={() => void handOff(drawn.file, "download")}
          >
            {copy.download}
          </Button>
        )}
        <Button
          iconLeft={
            drawn?.status === "ready" && drawn.how === "share"
              ? "share-2"
              : "download"
          }
          disabled={drawn?.status !== "ready"}
          onClick={() => {
            if (drawn?.status === "ready") void handOff(drawn.file, drawn.how);
          }}
        >
          {drawn?.status === "ready" && drawn.how === "share"
            ? copy.share
            : copy.download}
        </Button>
      </div>
    </div>
  );
}
