exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const apiKey = body.apiKey;
    const payload = body.payload;

    if (!apiKey || !payload) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing apiKey or payload' }),
      };
    }

    // 웹서치 포함 다중 턴 처리 (tool_use → tool_result 자동 처리)
    let messages = payload.messages || [];
    const tools = payload.tools || [];
    let finalContent = [];
    let iterations = 0;
    const MAX_ITER = 5;

    while (iterations < MAX_ITER) {
      iterations++;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ ...payload, messages, tools }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(data),
        };
      }

      finalContent = data.content || [];

      // stop_reason이 tool_use면 → tool_result 없이 종료 (서버에서 웹서치 실행 불가)
      // 대신 Claude가 웹서치 결과 없이도 최선을 다하도록 assistant 메시지 추가 후 재요청
      if (data.stop_reason === 'tool_use') {
        const toolUseBlocks = finalContent.filter(b => b.type === 'tool_use');
        messages = [
          ...messages,
          { role: 'assistant', content: finalContent },
          {
            role: 'user',
            content: toolUseBlocks.map(tb => ({
              type: 'tool_result',
              tool_use_id: tb.id,
              content: `웹서치 결과를 직접 가져올 수 없습니다. 대신 ${tb.input?.query || '해당 주제'}에 대해 AI가 보유한 최신 지식을 활용해 분석해주세요.`,
            })),
          },
        ];
        continue;
      }

      // end_turn이면 완료
      break;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ content: finalContent }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
