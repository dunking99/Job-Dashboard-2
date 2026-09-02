import { getPipeline } from "@/app/actions/jobs";
import Link from "next/link";

const columns = ["saved", "tailoring", "applied", "screening", "interview", "offer", "rejected"];

export default async function PipelinePage() {
  const items = await getPipeline();
  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Pipeline</h1>
      <div className="grid grid-cols-7 gap-3">
        {columns.map((col) => (
          <div key={col} className="border rounded-lg p-3 min-h-[400px] bg-gray-50 dark:bg-gray-900/30">
            <h3 className="font-semibold capitalize text-sm mb-3">{col}</h3>
            <div className="space-y-2">
              {items.filter((i: any) => i.status === col).map((i: any) => (
                <Link key={i.id} href={`/jobs/${i.id}`} className="block bg-white dark:bg-gray-950 p-3 rounded border shadow-sm text-sm hover:shadow transition">
                  <div className="font-medium">{i.title}</div>
                  <div className="text-xs text-gray-500">{i.company}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
