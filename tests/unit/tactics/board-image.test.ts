import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BoardImageFailure,
  boardImageName,
  fontFamilies,
  handOffImage,
  IMAGE_PRESETS,
  IMAGE_SIZE,
  imageFrame,
  imageHandOff,
  inlineFontFace,
  renderBoardImage,
  standaloneSvg,
} from "@/features/tactics/board-image";
import { boardLayout, viewSize } from "@/features/tactics/geometry";

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

const FULL = viewSize(boardLayout("full", "landscape"));
const CORNER = viewSize(boardLayout("corner", "landscape"));

describe("imageFrame", () => {
  it("makes every shape full-HD wide at its aspect ratio", () => {
    expect(IMAGE_SIZE.wide).toEqual({ width: 1920, height: 1080 });
    expect(IMAGE_SIZE.standard).toEqual({ width: 1920, height: 1440 });
    expect(IMAGE_SIZE.square).toEqual({ width: 1920, height: 1920 });
  });

  it.each(IMAGE_PRESETS)(
    "fits the whole board into the %s shape, centred",
    (preset) => {
      for (const view of [FULL, CORNER]) {
        const frame = imageFrame(view, preset);
        const { viewBox } = frame;
        expect(frame.width).toBe(IMAGE_SIZE[preset].width);
        expect(frame.height).toBe(IMAGE_SIZE[preset].height);
        // The view box keeps the picture's shape, so nothing is stretched.
        expect(viewBox.width / viewBox.height).toBeCloseTo(
          frame.width / frame.height,
        );
        expect(viewBox.width * frame.pxPerMetre).toBeCloseTo(frame.width);
        // The board lies inside, with the same room on either side.
        expect(viewBox.x).toBeLessThanOrEqual(0);
        expect(viewBox.y).toBeLessThanOrEqual(0);
        expect(viewBox.x + viewBox.width).toBeCloseTo(view.width - viewBox.x);
        expect(viewBox.y + viewBox.height).toBeCloseTo(view.height - viewBox.y);
        // As large as it goes: it touches two opposite edges.
        const touches =
          Math.abs(viewBox.x) < 1e-9 || Math.abs(viewBox.y) < 1e-9;
        expect(touches).toBe(true);
      }
    },
  );

  it("draws a wide board wall to wall in a square", () => {
    const frame = imageFrame({ width: 100, height: 50 }, "square");
    expect(frame.pxPerMetre).toBe(19.2);
    expect(frame.viewBox).toEqual({ x: 0, y: -25, width: 100, height: 100 });
  });
});

describe("boardImageName", () => {
  it("names the picture after the scene and the step", () => {
    expect(boardImageName("Ecke kurz Variante 2", 3)).toBe(
      "ecke-kurz-variante-2-schritt-3.png",
    );
  });

  it("names the start arrangement", () => {
    expect(boardImageName("Pressing", 0)).toBe("pressing-start.png");
  });

  it("spells out umlauts and drops accents and punctuation", () => {
    expect(boardImageName("Gegenstoß über Außen: Café!", 1)).toBe(
      "gegenstoss-ueber-aussen-cafe-schritt-1.png",
    );
  });

  it("falls back to the board's name when nothing is left", () => {
    expect(boardImageName("  ?!  ", 0)).toBe("taktiktafel-start.png");
  });

  it("keeps a long name short", () => {
    const name = boardImageName("a ".repeat(100), 0);
    expect(name.length).toBeLessThanOrEqual(60 + "-start.png".length);
    expect(name).not.toMatch(/--|-\./);
  });
});

describe("fontFamilies", () => {
  it("unquotes a CSS font-family list", () => {
    expect(fontFamilies(`"Hanken Grotesk", 'Fallback', system-ui`)).toEqual([
      "Hanken Grotesk",
      "Fallback",
      "system-ui",
    ]);
  });
});

function png(): File {
  return new File(["png"], "pressing-start.png", { type: "image/png" });
}

describe("imageHandOff", () => {
  const sharing = { canShare: () => true };

  it("shares on a phone that can share files", () => {
    expect(imageHandOff(png(), sharing, true)).toBe("share");
  });

  it("downloads on a laptop even where it could share", () => {
    expect(imageHandOff(png(), sharing, false)).toBe("download");
  });

  it("downloads on a phone that cannot share files", () => {
    expect(imageHandOff(png(), { canShare: () => false }, true)).toBe(
      "download",
    );
    expect(imageHandOff(png(), {} as Navigator, true)).toBe("download");
    expect(
      imageHandOff(
        png(),
        {
          canShare: () => {
            throw new TypeError("no files");
          },
        },
        true,
      ),
    ).toBe("download");
  });
});

describe("handOffImage", () => {
  function spyDownloads(): string[] {
    const names: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:picture");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    return names;
  }

  it("hands the file alone to the share sheet", async () => {
    const downloads = spyDownloads();
    const share = vi.fn(async () => {});
    const file = png();
    await expect(handOffImage(file, "share", { share })).resolves.toBe(
      "shared",
    );
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(downloads).toEqual([]);
  });

  it("stops when the coach cancels the share sheet", async () => {
    const downloads = spyDownloads();
    const share = vi.fn(async () => {
      throw new DOMException("cancelled", "AbortError");
    });
    await expect(handOffImage(png(), "share", { share })).resolves.toBe(
      "cancelled",
    );
    expect(downloads).toEqual([]);
  });

  it("downloads when the browser refuses to share", async () => {
    const downloads = spyDownloads();
    const share = vi.fn(async () => {
      throw new DOMException("no gesture", "NotAllowedError");
    });
    await expect(handOffImage(png(), "share", { share })).resolves.toBe(
      "downloaded",
    );
    expect(downloads).toEqual(["pressing-start.png"]);
  });

  it("downloads without asking the share sheet", async () => {
    const downloads = spyDownloads();
    const share = vi.fn(async () => {});
    await expect(handOffImage(png(), "download", { share })).resolves.toBe(
      "downloaded",
    );
    expect(share).not.toHaveBeenCalled();
    expect(downloads).toEqual(["pressing-start.png"]);
  });
});

const SVG_NS = "http://www.w3.org/2000/svg";

function pictureSvg(): SVGSVGElement {
  document.head.innerHTML =
    "<style>.turf { fill: rgb(1, 2, 3); } .ink { font-weight: 700; }</style>";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "1920");
  svg.setAttribute("height", "1080");
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("class", "turf");
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("class", "ink");
  text.textContent = "9";
  svg.append(rect, text);
  document.body.append(svg);
  return svg;
}

describe("standaloneSvg", () => {
  it("writes the page's paint onto each element and drops the classes", async () => {
    const markup = await standaloneSvg(pictureSvg());
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup).not.toContain("class=");
    expect(markup).toMatch(/<rect style="[^"]*fill: rgb\(1, 2, 3\)/);
    expect(markup).toMatch(/<text style="[^"]*font-weight: 700/);
  });

  it("carries the font the labels use and only that one", async () => {
    const svg = pictureSvg();
    document.head.innerHTML += `<style>
      @font-face { font-family: "Board Sans"; font-weight: 100 900; }
      @font-face { font-family: "Other"; }
      .ink { font-family: "Board Sans", sans-serif; }
    </style>`;

    const markup = await standaloneSvg(svg);

    expect(markup).toMatch(/<style>@font-face[^<]*Board Sans/);
    expect(markup).not.toContain("Other");
  });

  it("leaves the page's own drawing as it was", async () => {
    const svg = pictureSvg();
    await standaloneSvg(svg);
    expect(svg.querySelector("rect")).toHaveAttribute("class", "turf");
    expect(svg.querySelector("rect")?.getAttribute("style")).toBeNull();
  });
});

/** jsdom decodes no images; let a test say how the picture decodes. */
function stubDecode() {
  const decode = vi.fn<() => Promise<void>>();
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: decode,
  });
  return decode;
}

describe("inlineFontFace", () => {
  const face = `@font-face { font-family: "Board Sans"; src: url("/media/board.woff2") format("woff2"); }`;

  it("inlines the font file as a data URL", async () => {
    const fetchMock = vi.fn<(url: URL) => Promise<Response>>(
      async () =>
        ({
          ok: true,
          blob: async () => new Blob(["font"], { type: "font/woff2" }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    const css = await inlineFontFace(face, "http://localhost/styles/app.css");
    vi.unstubAllGlobals();

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://localhost/media/board.woff2",
    );
    expect(css).toMatch(/src: url\("data:font\/woff2;base64,Zm9udA=="\)/);
    expect(css).toContain('format("woff2")');
  });

  it("drops a face whose file cannot be had", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    await expect(inlineFontFace(face, "http://localhost/")).resolves.toBe("");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    await expect(inlineFontFace(face, "http://localhost/")).resolves.toBe("");
    vi.unstubAllGlobals();
  });
});

describe("renderBoardImage", () => {
  function stubCanvas(blob: Blob | null): { size: [number, number] } {
    const drawn = { size: [0, 0] as [number, number] };
    const ctx = new Proxy({}, { get: () => vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (this: HTMLCanvasElement, done: BlobCallback) {
        drawn.size = [this.width, this.height];
        done(blob);
      },
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:svg");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    return drawn;
  }

  it("paints the picture at the shape's full size", async () => {
    const png = new Blob(["png"], { type: "image/png" });
    const drawn = stubCanvas(png);
    stubDecode().mockResolvedValue();

    await expect(renderBoardImage(pictureSvg(), 1920, 1440)).resolves.toBe(png);
    expect(drawn.size).toEqual([1920, 1440]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:svg");
  });

  it("fails when the browser cannot draw the picture", async () => {
    stubCanvas(null);
    stubDecode().mockRejectedValue(
      new DOMException("bad svg", "EncodingError"),
    );
    await expect(
      renderBoardImage(pictureSvg(), 1920, 1080),
    ).rejects.toBeInstanceOf(BoardImageFailure);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:svg");
  });

  it("fails when the browser cannot encode the PNG", async () => {
    stubCanvas(null);
    stubDecode().mockResolvedValue();
    await expect(
      renderBoardImage(pictureSvg(), 1920, 1080),
    ).rejects.toBeInstanceOf(BoardImageFailure);
  });
});
