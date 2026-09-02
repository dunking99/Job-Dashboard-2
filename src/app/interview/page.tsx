import { getInterviewQuestions, getSTARBank } from "@/app/actions/interview";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function InterviewPage() {
  const questions = await getInterviewQuestions();
  const stars = await getSTARBank();
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Interview Prep</h1>
      <div className="grid grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle>Predicted Questions</CardTitle></CardHeader><CardContent><ul className="list-disc pl-5 space-y-2">{questions.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul><Button className="mt-4">Generate More</Button></CardContent></Card>
        <Card><CardHeader><CardTitle>STAR Bank</CardTitle></CardHeader><CardContent>{stars.map((s: any, i: number) => <div key={i} className="border-b py-2 text-sm"><span className="font-medium">{s.competency}</span>: {s.story}</div>)}</CardContent></Card>
      </div>
    </div>
  );
}
