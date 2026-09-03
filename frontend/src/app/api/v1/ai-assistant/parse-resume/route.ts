import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;
    const targetRole = (formData.get('targetRole') as string) || 'Senior Fullstack Engineer';

    let fileName = file ? file.name : 'Sample_Candidate_Resume.pdf';

    // Mock parsed candidate data (can be replaced by local HuggingFace / Donut / LayoutLM parser)
    const mockSkills = [
      'React.js', 'Next.js', 'Node.js', 'TypeScript',
      'PostgreSQL', 'Tailwind CSS', 'REST APIs', 'Docker'
    ];

    const matchScore = Math.floor(Math.random() * 20) + 80; // 80% to 99%

    return NextResponse.json({
      success: true,
      data: {
        fileName,
        candidateName: fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        email: 'candidate.ai@example.com',
        phone: '+91 98765 43210',
        targetRole,
        matchScore: `${matchScore}%`,
        experienceYears: '4.5 Years',
        education: 'B.Tech in Computer Science & Engineering',
        summary: 'Experienced Fullstack Developer specializing in modern web applications, scalable backends, and responsive UI design.',
        extractedSkills: mockSkills,
        recommendedVerdict: matchScore > 85 ? 'Strongly Recommended' : 'Suitable for Interview',
        extractedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to parse resume.' },
      { status: 500 }
    );
  }
}
