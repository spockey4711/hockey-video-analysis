"use client";

/**
 * "Als Video": the scene's whole animation as an MP4 or a GIF for a team chat
 * (M1). The button freezes the scene as it stands and opens a dialog to pick
 * the file and its shape and make it. Making it draws every frame, so it
 * takes a while: the dialog shows how far it is and can cancel it. Once made,
 * the video plays as a preview, says how big the file is, and goes to the
 * share sheet on a phone, a download elsewhere, from a press of its own, as
 * the share sheet requires. A browser without an H.264 encoder can still
 * make the GIF.
 *
 * The frames are the picture's own drawing (`BoardImage`), out of sight in
 * the dialog, put on each frame of the animation in turn. Until the video is
 * made, the preview shows its first frame, painted the same way.
 */
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { BoardImage } from "./BoardImage";
import { ExportDialog } from "./ExportDialog";
import { keyframe, type SceneFrame } from "./animation";
import {
  fileHandOff,
  handOffFile,
  IMAGE_PRESETS,
  isTouchScreen,
  renderBoardImage,
  type FileHandOff,
  type ImagePreset,
} from "./board-image";
import {
  boardVideoName,
  renderBoardVideo,
  VIDEO_FORMATS,
  videoFps,
  videoSize,
  videoEncoderConfig,
  videoTimes,
  VideoUnsupported,
  type VideoFormat,
} from "./board-video";
import { tacticsContent } from "./content";
import { playToolsIn, type PlayTool, type TacticsScene } from "./scene";

import { Button } from "@/components/forms/Button";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";

const copy = tacticsContent.video;

/** The scene the button froze, and what its video is called. */
interface Take {
  readonly scene: TacticsScene;
  /** The play tools the scene uses, for the legend. */
  readonly legend: readonly PlayTool[];
  /** The name the file is named after. */
  readonly name: string;
  /** The short names under the discs, when the board showed names. */
  readonly names: ReadonlyMap<string, string> | undefined;
}

export function BoardVideoExport({
  scene,
  name,
  names,
}: {
  scene: TacticsScene;
  /** The scene's name, which names the file; the board's name without one. */
  name?: string;
  /**
   * The short names the board shows under its discs, so the video shows
   * them too; left out, as while the board hides names, the video has none.
   */
  names?: ReadonlyMap<string, string>;
}) {
  const [take, setTake] = useState<Take | null>(null);
  // A scene without steps has nothing to animate; "Als Bild" covers it.
  if (scene.steps.length === 0 && take === null) return null;
  return (
    <>
      <Button
        variant="secondary"
        iconLeft="film"
        onClick={() =>
          setTake({
            scene,
            legend: playToolsIn(scene.lines),
            name: name?.trim() || copy.name,
            names,
          })
        }
      >
        {copy.open}
      </Button>
      <ExportDialog
        title={copy.title}
        closeLabel={copy.close}
        open={take !== null}
        onClose={() => setTake(null)}
      >
        {take ? <VideoPanel take={take} onDone={() => setTake(null)} /> : null}
      </ExportDialog>
    </>
  );
}

/** Where making the video stands. */
type Job =
  | { readonly status: "idle" }
  | { readonly status: "rendering"; readonly percent: number }
  | { readonly status: "failed" }
  | {
      readonly status: "ready";
      readonly file: File;
      /** An object URL of the file, for the preview. */
      readonly url: string;
      readonly how: FileHandOff;
    };

function VideoPanel({ take, onDone }: { take: Take; onDone: () => void }) {
  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [preset, setPreset] = useState<ImagePreset>("wide");
  const [job, setJob] = useState<Job>({ status: "idle" });
  // The shape the browser has no H.264 encoder for, if any.
  const [noMp4, setNoMp4] = useState<ImagePreset | null>(null);
  const [frame, setFrame] = useState<SceneFrame>(() => keyframe(take.scene, 0));
  const svgRef = useRef<SVGSVGElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fps = videoFps(format);
  const seconds = videoTimes(take.scene, fps).length / fps;
  const url = job.status === "ready" ? job.url : null;
  const [poster, setPoster] = useState<{
    readonly key: string;
    readonly url: string;
  } | null>(null);
  // A preview of another shape or file is still on its way.
  const shownPoster = poster?.key === `${format}-${preset}` ? poster.url : null;
  const unsupported = format === "mp4" && noMp4 === preset;

  // Say at once when the browser cannot make the MP4, before any press.
  useEffect(() => {
    let current = true;
    void videoEncoderConfig(videoSize(preset)).then((config) => {
      if (current && !config) setNoMp4(preset);
    });
    return () => {
      current = false;
    };
  }, [preset]);

  // The first frame as the preview, painted as every frame is.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let current = true;
    let url: string | null = null;
    const { width, height } = videoSize(preset, format);
    renderBoardImage(svg, width, height).then(
      (blob) => {
        if (!current) return;
        url = URL.createObjectURL(blob);
        setPoster({ key: `${format}-${preset}`, url });
      },
      () => {
        // No preview; the video can still be made.
      },
    );
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [preset, format]);

  // Closing the dialog cancels a video on its way.
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function make(): Promise<void> {
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ status: "rendering", percent: 0 });
    try {
      const bytes = await renderBoardVideo({
        scene: take.scene,
        preset,
        format,
        signal: controller.signal,
        draw: (next) => {
          flushSync(() => setFrame(next));
          const svg = svgRef.current;
          if (!svg) throw new Error("The video's drawing is gone");
          return svg;
        },
        onProgress: (share) => {
          const percent = Math.floor(share * 100);
          setJob((current) =>
            current.status === "rendering" && current.percent === percent
              ? current
              : { status: "rendering", percent },
          );
        },
      });
      const file = new File([bytes], boardVideoName(take.name, format), {
        type: format === "gif" ? "image/gif" : "video/mp4",
      });
      setJob({
        status: "ready",
        file,
        url: URL.createObjectURL(file),
        how: fileHandOff(file, navigator, isTouchScreen()),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setJob({ status: "idle" });
      } else if (error instanceof VideoUnsupported) {
        setNoMp4(preset);
        setJob({ status: "idle" });
      } else {
        setJob({ status: "failed" });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function handOff(file: File, how: FileHandOff): Promise<void> {
    const result = await handOffFile(file, how);
    if (result !== "cancelled") onDone();
  }

  const rendering = job.status === "rendering";
  const size = videoSize(preset, format);

  return (
    <div className="flex min-h-0 flex-col gap-[var(--space-3)] overflow-y-auto p-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <ChoiceGroup
          label={copy.format}
          options={VIDEO_FORMATS.map((value) => ({
            value,
            label: copy.formats[value],
          }))}
          value={format}
          onChange={(next) => {
            if (rendering) return;
            setFormat(next);
            setFrame(keyframe(take.scene, 0));
            setJob({ status: "idle" });
          }}
        />
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
          {copy.formatHints[format]}
        </p>
      </div>
      <ChoiceGroup
        label={copy.shape}
        options={IMAGE_PRESETS.map((value) => ({
          value,
          label: tacticsContent.image.presets[value],
        }))}
        value={preset}
        onChange={(next) => {
          if (rendering) return;
          setPreset(next);
          setFrame(keyframe(take.scene, 0));
          setJob({ status: "idle" });
        }}
      />
      {/* The drawing each frame is painted from, out of sight. */}
      <div aria-hidden className="sr-only">
        <BoardImage
          ref={svgRef}
          view={take.scene.view}
          frame={frame}
          preset={preset}
          legend={take.legend}
          title={copy.name}
          names={take.names}
        />
      </div>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-inset)]">
        {job.status === "ready" && format === "gif" ? (
          // A blob URL of a GIF made here; the image optimiser has nothing
          // to fetch.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.url}
            alt={copy.preview}
            width={size.width}
            height={size.height}
            className="h-full w-auto max-w-full object-contain"
          />
        ) : job.status === "ready" ? (
          <video
            src={job.url}
            aria-label={copy.preview}
            width={size.width}
            height={size.height}
            poster={shownPoster ?? undefined}
            controls
            muted
            playsInline
            className="h-full w-auto max-w-full object-contain"
          />
        ) : (
          shownPoster && (
            // A blob URL of a picture made here; the image optimiser has
            // nothing to fetch.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownPoster}
              alt={copy.preview}
              width={size.width}
              height={size.height}
              className="h-full w-auto max-w-full object-contain"
            />
          )
        )}
      </div>
      <div className="flex flex-col gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
        <p>{copy.shows(take.scene.steps.length, seconds)}</p>
        <p>
          {take.names && take.names.size > 0 ? copy.withNames : copy.privacy}
        </p>
        <p>{copy.notes}</p>
      </div>
      {rendering && (
        <div
          role="progressbar"
          aria-label={copy.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={job.percent}
          className="h-[var(--space-2)] w-full overflow-hidden rounded-full bg-[var(--surface-inset)]"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${job.percent}%` }}
          />
        </div>
      )}
      <p
        role="status"
        className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] empty:hidden"
      >
        {rendering
          ? copy.rendering(job.percent)
          : job.status === "failed"
            ? copy.failed
            : job.status === "ready"
              ? copy.size(job.file.size)
              : ""}
      </p>
      {unsupported && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {copy.unsupported}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-[var(--space-2)]">
        {rendering ? (
          <Button
            variant="secondary"
            iconLeft="x"
            onClick={() => abortRef.current?.abort()}
          >
            {copy.cancel}
          </Button>
        ) : job.status === "ready" ? (
          <>
            {job.how === "share" && (
              <Button
                variant="secondary"
                iconLeft="download"
                onClick={() => void handOff(job.file, "download")}
              >
                {copy.download}
              </Button>
            )}
            <Button
              iconLeft={job.how === "share" ? "share-2" : "download"}
              onClick={() => void handOff(job.file, job.how)}
            >
              {job.how === "share" ? copy.share : copy.download}
            </Button>
          </>
        ) : (
          <Button
            iconLeft="film"
            disabled={unsupported}
            onClick={() => void make()}
          >
            {copy.start[format]}
          </Button>
        )}
      </div>
    </div>
  );
}
