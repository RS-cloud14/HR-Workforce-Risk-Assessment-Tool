export async function handler(event) {
  // ============================================
  // CORS HEADERS
  // ============================================
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const { message, context } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "API key missing." }),
      };
    }

    let systemContext;

    if (context && context.inputs && context.results) {
        // MODIFIED: This entire prompt is more direct and action-oriented.
        systemContext = `Your role is to act as a direct, expert AI assistant for a business user. 
The user has just received the following risk assessment report. 
Directly answer their questions based on this data. 
**DO NOT** introduce yourself or explain the platform's purpose. Get straight to the answer.
Provide actionable advice and explain what the metrics mean in a practical business context.

CURRENT BUSINESS ASSESSMENT:
----------------------------
- Industry: ${context.inputs.industry}
- Average Workforce Age: ${context.inputs.averageAge} years
- Total Employees: ${context.inputs.totalEmployees}
- Overall Risk Level: ${context.results.riskLevel}
- Employees Retiring Soon: ${context.results.retiringEmployees}
- Estimated Replacement Cost: ${context.results.replacementCost}
- Return on Investment (ROI) for retention: ${context.results.roi}

IMPORTANT: Your answers must be concise. Keep your response to a maximum of 8 sentences.`;
    } else {
        // MODIFIED: This prompt is also more direct for the initial state.
        systemContext = `Your role is to act as a direct, expert AI assistant.
The user has not run a business risk analysis yet.
Directly answer their general questions about workforce risks.
**DO NOT** introduce yourself or the platform. 
If they ask what to do, your main goal is to guide them to use the assessment tool on the left to get started. Be direct.

IMPORTANT: Your answers must be concise. Keep your response to a maximum of 8 sentences.`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemContext}\n\nUser Question: ${message}` }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512
          }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Gemini API Error:", data.error);
      return { 
        statusCode: response.status || 400, 
        headers: corsHeaders,
        body: JSON.stringify({ error: data.error ? data.error.message : "AI service error." }) 
      };
    }

    let reply = "I'm sorry, I couldn't generate a response. Please try again.";
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      reply = data.candidates[0].content.parts[0].text.trim();
    } else if (data.candidates?.[0]?.finishReason) {
      reply = `I am unable to respond due to: ${data.candidates[0].finishReason}. Please rephrase your question.`;
    }

    return { 
      statusCode: 200, 
      headers: corsHeaders,
      body: JSON.stringify({ response: reply })
    };

  } catch (error) {
    console.error("Function Error:", error);
    return { 
      statusCode: 500, 
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error: " + error.message }) 
    };
  }
}