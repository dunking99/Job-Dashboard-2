import { getJob } from "@/app/actions/jobs";
import { generateCV, generateCoverLetter } from "@/app/actions/documents";
import { Button } from "@/components/ui";
import BulletEditor from "@/components/BulletEditor";

export default async function TailorPage({ params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  const cv = await generateCV(params.id); // Calls your complex 451-line documents.ts
  const cover = await generateCoverLetter(params.id);
  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-4">Tailoring Studio</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Job Description</h2>
          <pre className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded max-h-96 overflow-auto">{job.description}</pre>
        </div>
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Generated CV</h2>
          <BulletEditor bullets={cv.bullets} onSave={() => {}} />
          <div className="mt-2 flex gap-2"><Button variant="outline">Export DOCX</Button><Button>AI Refine</Button></div>
        </div>
        <div className="col-span-2 border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Cover Letter</h2>
          <pre className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded">{cover.text}</pre>
        </div>
      </div>
    </div>
  );
}
