"use client";

/**
 * "Als Video": the scene's whole animation as an MP4 for a team chat (M1).
 * The button freezes the scene as it stands and opens a dialog to pick the
 * video's shape and make it. Making it draws every frame, so it takes a
 * while: the dialog shows how far it is and can cancel it. Once made, the
 * video plays as a preview and goes to the share sheet on a phone, a
 * download elsewhere, from a press of its own, as the share sheet requires.
 *
 * The frames are the picture's own drawing (`BoardImage`), out of sight in
 * the dialog, put on each frame of the animation in turn.
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
  type FileHandOff,
  type ImagePreset,
} from "./board-image";
import {
  boardVideoName,
  renderBoardVideo,
  VIDEO_FPS,
  videoSize,
  videoEncoderConfig,
  videoTimes,
  VideoUnsupported,
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
  readonly fileName: string;
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
            fileName: boardVideoName(name?.trim() || copy.name),
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
  | { readonly status: "unsupported" }
  | {
      readonly status: "ready";
      readonly file: File;
      /** An object URL of the file, for the preview. */
      readonly url: string;
      readonly how: FileHandOff;
    };

function VideoPanel({ take, onDone }: { take: Take; onDone: () => void }) {
  const [preset, setPreset] = useState<ImagePreset>("wide");
  const [job, setJob] = useState<Job>({ status: "idle" });
  const [frame, setFrame] = useState<SceneFrame>(() => keyframe(take.scene, 0));
  const svgRef = useRef<SVGSVGElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seconds = videoTimes(take.scene).length / VIDEO_FPS;
  const url = job.status === "ready" ? job.url : null;

  // Say at once when the browser cannot make the video, before any press.
  useEffect(() => {
    let current = true;
    void videoEncoderConfig(videoSize(preset)).then((config) => {
      if (current && !config) setJob({ status: "unsupported" });
    });
    return () => {
      current = false;
    };
  }, [preset]);

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
      const file = new File([bytes], take.fileName, { type: "video/mp4" });
      setJob({
        status: "ready",
        file,
        url: URL.createObjectURL(file),
        how: fileHandOff(file, navigator, isTouchScreen()),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setJob({ status: "idle" });
      } else {
        setJob({
          status: error instanceof VideoUnsupported ? "unsupported" : "failed",
        });
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
  const size = videoSize(preset);

  return (
    <div className="flex min-h-0 flex-col gap-[var(--space-3)] overflow-y-auto p-[var(--space-4)]">
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
        {job.status === "ready" && (
          <video
            src={job.url}
            aria-label={copy.preview}
            width={size.width}
            height={size.height}
            controls
            muted
            playsInline
            className="h-full w-auto max-w-full object-contain"
          />
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
            : ""}
      </p>
      {job.status === "unsupported" && (
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
            disabled={job.status === "unsupported"}
            onClick={() => void make()}
          >
            {copy.start}
          </Button>
        )}
      </div>
    </div>
  );
}
