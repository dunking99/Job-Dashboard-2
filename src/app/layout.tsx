import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { aiMode } from "@/lib/ai/client";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Job Engine",
  description: "Integrated job search, tailoring and interview preparation.",
};

// Everything reads live from the local database, so nothing here should be
// statically cached between requests.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = aiMode();
  const pendingBridge =
    mode === "BRIDGE"
      ? await prisma.aiCall.count({ where: { status: "PENDING", mode: "BRIDGE" } })
      : 0;

  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Applied before paint so a stored theme choice does not flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="flex h-dvh overflow-hidden">
          <Nav aiMode={mode} pendingBridge={pendingBridge} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
