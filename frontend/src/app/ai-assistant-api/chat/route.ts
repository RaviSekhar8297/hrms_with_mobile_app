import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, model = 'Ollama Local' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message text is required.' },
        { status: 400 }
      );
    }

    let aiReply = '';
    let category = 'dynamic-ai';
    let suggestedActions: string[] = [];

    // 1. TRY LOCAL OLLAMA AI ENGINE (DeepSeek / LLaMA 3)
    if (model.toLowerCase().includes('ollama')) {
      try {
        const ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3', // or deepseek-r1
            messages: [
              {
                role: 'system',
                content: 'You are an intelligent Enterprise HR AI Agent. Provide helpful, accurate HR & workforce management answers.'
              },
              { role: 'user', content: message }
            ],
            stream: false
          })
        });

        if (ollamaRes.ok) {
          const ollamaData = await ollamaRes.json();
          aiReply = ollamaData.message?.content || '';
        }
      } catch (ollamaErr) {
        // Ollama not active
      }
    }

    // 2. TRY GOOGLE GEMINI FREE API (If GEMINI_API_KEY is available)
    if (!aiReply && process.env.GEMINI_API_KEY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are an HR AI Agent. User asked: ${message}` }] }]
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          aiReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (geminiErr) {
        // Gemini error fallback
      }
    }

    // 3. TRY HUGGING FACE FREE INFERENCE API
    if (!aiReply && process.env.HUGGINGFACE_API_KEY) {
      try {
        const hfRes = await fetch(
          'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: message })
          }
        );

        if (hfRes.ok) {
          const hfData = await hfRes.json();
          if (Array.isArray(hfData) && hfData[0]?.generated_text) {
            aiReply = hfData[0].generated_text;
          }
        }
      } catch (hfErr) {
        // HuggingFace error
      }
    }

    // 4. REAL-TIME AI ENGINE CONNECTION PROMPT (If no external service is live)
    if (!aiReply) {
      aiReply = `🤖 **Real AI Engine Status**:
No static responses are configured. 

To enable **100% Live Dynamic AI Generation**:
1. **Ollama (Free Local AI)**: Run \`ollama run llama3\` or \`ollama run deepseek-r1\` on server port 11434.
2. **Gemini Free API**: Add \`GEMINI_API_KEY=your_key\` to \`.env.local\`.

Query received: "${message}"`;
      suggestedActions = ['Configure Ollama Local', 'Add Free Gemini API Key', 'System Diagnostics'];
    } else {
      suggestedActions = ['Check Leave Balance', 'Permission Rules', 'Shift Timings'];
    }

    return NextResponse.json({
      success: true,
      model,
      category,
      reply: aiReply,
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
