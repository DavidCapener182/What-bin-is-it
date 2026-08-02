import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const requestedSize = Number((await context.params).size);
  const size = requestedSize === 192 || requestedSize === 512 ? requestedSize : undefined;
  if (!size) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#FEFDFB",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <svg
          aria-hidden="true"
          height="70%"
          viewBox="0 0 320 320"
          width="70%"
        >
          <rect fill="#00A79D" height="30" rx="13" width="168" x="76" y="71" />
          <path d="M121 71c4-22 15-31 39-31s35 9 39 31" fill="none" stroke="#00A79D" strokeWidth="18" />
          <path d="M91 96h138l-15 148c-2 17-12 26-29 26h-50c-17 0-27-9-29-26L91 96Z" fill="#17324D" />
          <path d="M95 108h130" fill="none" stroke="#0F2A3A" strokeLinecap="round" strokeWidth="15" />
          <circle cx="112" cy="254" fill="#17324D" r="31" />
          <circle cx="112" cy="254" fill="#FEFDFB" r="13" />
          <circle cx="219" cy="219" fill="#00A79D" r="54" stroke="#FEFDFB" strokeWidth="12" />
          <path d="m191 218 19 19 37-42" fill="none" stroke="#FEFDFB" strokeLinecap="round" strokeLinejoin="round" strokeWidth="14" />
        </svg>
        <div
          style={{
            alignItems: "center",
            background: "#E5F1FF",
            borderRadius: 999,
            bottom: "10%",
            display: "flex",
            height: "18%",
            justifyContent: "center",
            position: "absolute",
            right: "10%",
            width: "18%",
          }}
        >
          <svg aria-hidden="true" height="64%" viewBox="0 0 100 100" width="64%">
            <circle cx="50" cy="50" fill="#007AFF" r="9" />
            <path d="M31 31a27 27 0 0 0 0 38M69 31a27 27 0 0 1 0 38" fill="none" stroke="#007AFF" strokeLinecap="round" strokeWidth="9" />
            <path d="M17 17a47 47 0 0 0 0 66M83 17a47 47 0 0 1 0 66" fill="none" stroke="#007AFF" strokeLinecap="round" strokeWidth="8" />
          </svg>
        </div>
      </div>
    ),
    {
      height: size,
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
      width: size,
    },
  );
}
