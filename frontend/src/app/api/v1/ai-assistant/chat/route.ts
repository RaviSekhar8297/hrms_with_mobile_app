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
    const suggestedActions: string[] = ['Policy', 'Attendance', 'Leaves', 'Shift Timings'];

    if (queryLower.includes('policy') || queryLower.includes('rule') || queryLower.includes('lunch') || queryLower.includes('start') || queryLower.includes('exit')) {
      category = 'policy';
      reply = `🏢 **Company Attendance Policy:**\n• **Starting Time:** 09:30 AM\n• **Exit Time:** 06:30 PM (18:30)\n• **Lunch Timings:** 01:15 PM to 02:00 PM (13:15 to 14:00)\n• **Grace Period:** 15 mins (up to 09:45 AM)\n• **Half-Day:** Minimum 4.5 working hours required.`;
    } else if (queryLower.includes('attendance') || queryLower.includes('present') || queryLower.includes('working') || queryLower.includes('month') || queryLower.includes('holiday') || queryLower.includes('weekoff')) {
      category = 'attendance';
      reply = `📅 **This Month's Attendance Summary:**\n• **Total Working Days:** 26 Days\n• **Present Days:** 22 Days\n• **Leaves Taken:** 1 Day\n• **Company Holidays:** 1 Day\n• **Weekoffs:** 4 Days`;
    } else if (queryLower.includes('leave') || queryLower.includes('sick') || queryLower.includes('casual') || queryLower.includes('balance')) {
      category = 'leaves';
      reply = `🌴 **Available Leave Balances:**\n• **Casual Leaves (CL):** 3 Available\n• **Sick Leaves (SL):** 3 Available\n• **Earned Leaves (EL):** 3 Available\n• **Total Available Leaves:** 9 Days`;
    } else if (queryLower.includes('shift') || queryLower.includes('timing') || queryLower.includes('hour') || queryLower.includes('general')) {
      category = 'shifts';
      reply = `⏰ **Current Shift Details:**\n• **Assigned Shift:** General Shift\n• **Shift Timings:** 09:30 AM to 06:30 PM (18:30)\n• **Working Days:** Monday to Saturday (Alternate Weekoffs)`;
    } else {
      reply = `Namaste! 👋 I am your **HR AI Assistant**.\n\nPlease select any of the topics below for instant information:`;
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
