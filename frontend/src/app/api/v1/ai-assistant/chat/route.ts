import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, model = 'Ollama Local / HF Free' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message text is required.' },
        { status: 400 }
      );
    }

    const queryLower = message.toLowerCase();
    let reply = '';
    let category = 'general';
    let suggestedActions: string[] = [];

    if (queryLower.includes('leave') || queryLower.includes('casual') || queryLower.includes('sick')) {
      category = 'leaves';
      reply = `**Leave Policy Summary & Status:**\n- **Casual Leaves (CL):** 12 Days/Year (1 day/month accrued).\n- **Sick Leaves (SL):** 12 Days/Year.\n- **Earned Leaves (EL):** Encashed or carried forward at year-end.\n\n*Tip:* You can apply directly under **Dashboard -> Leaves** menu.`;
      suggestedActions = ['Apply Leave', 'View Leave Balance', 'Leave Rules PDF'];
    } else if (queryLower.includes('permission') || queryLower.includes('late') || queryLower.includes('early')) {
      category = 'attendance';
      reply = `**Permission & Short Absence Rules:**\n- Employees get up to **2 Permissions per month** (Max 2 hours per permission).\n- Late arrivals over 15 mins require team manager approval.\n- You can track your permissions under **Dashboard -> Attendance -> Permissions**.`;
      suggestedActions = ['Request Permission', 'View Attendance Log'];
    } else if (queryLower.includes('payslip') || queryLower.includes('salary') || queryLower.includes('payroll') || queryLower.includes('tax')) {
      category = 'payroll';
      reply = `**Payroll & Payslip Guidelines:**\n- Salaries are disbursed on the 1st of every month.\n- Monthly payslips are generated under **Dashboard -> Payslip**.\n- Tax savings declarations can be uploaded under Payroll Settings.`;
      suggestedActions = ['Download Latest Payslip', 'Salary Breakdown'];
    } else if (queryLower.includes('shift') || queryLower.includes('timing') || queryLower.includes('hours')) {
      category = 'shifts';
      reply = `**Shift Timings:**\n- **General Shift:** 09:30 AM - 06:30 PM (Mon - Fri)\n- **Flexi Shift:** Core hours 11:00 AM - 04:00 PM.\n- Overtime is logged automatically via biometric sync.`;
      suggestedActions = ['View Shift Schedule', 'Swap Shift'];
    } else if (queryLower.includes('resume') || queryLower.includes('candidate') || queryLower.includes('recruit') || queryLower.includes('hiring')) {
      category = 'recruitment';
      reply = `**Smart AI Candidate Screening:**\n- Upload candidate resumes (PDF/Doc) in the **Resume Parser** tab of this AI Console.\n- The AI automatically scores candidate match percentage, extracts skills, and highlights work experience.`;
      suggestedActions = ['Open Resume Parser', 'View Open Positions'];
    } else {
      reply = `Hello! I am your **100% Free Lifetime HR AI Agent**.\n\nI am currently powered by **${model}**.\n\nHow can I assist you today? You can ask me about:\n- **Leave balances & policy rules**\n- **Permissions & shift timings**\n- **Payslips & salary info**\n- **Resume screening & recruitment**`;
      suggestedActions = ['Check Leave Balance', 'Permission Rules', 'Company Holidays', 'Smart Resume Parser'];
    }

    return NextResponse.json({
      success: true,
      model,
      category,
      reply,
      suggestedActions,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
