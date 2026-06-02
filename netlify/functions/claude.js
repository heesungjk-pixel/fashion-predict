exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: ''
    };
  }

  try {
    const { apiKey, pubDate, daysUntil, channels, targetCtx, snsFormats } = JSON.parse(event.body);

    const chMap = { ig: '인스타그램 릴스', yt: '유튜브 숏츠', blog: '블로그' };
    const activeChLabels = channels.map(c => chMap[c]).join(', ');
    const today = new Date().toISOString().slice(0, 10);
    const month = parseInt(today.slice(5, 7));
    const season = month >= 3 && month <= 5 ? '봄' : month >= 6 && month <= 8 ? '여름' : month >= 9 && month <= 11 ? '가을' : '겨울';

    const igContent = channels.includes('ig') ? '지금 올려야 할 릴스 아이템 TOP5와 릴스 기획 TOP3, 피해야할것' : '';
    const ytContent = channels.includes('yt') ? '기획할 숏츠 주제 TOP5와 영상 기획 TOP3, 피해야할것' : '';
    const blogContent = channels.includes('blog') ? 'SEO 키워드 TOP5와 포스팅 기획 TOP3, 피해야할것' : '';

    const prompt = `한국 패션 SNS 전략가로서 분석해주세요.

오늘: ${today} (${season})
발행일: ${pubDate} (${daysUntil}일 후)
타겟: ${targetCtx || '20-30대 여성'}
채널: ${activeChLabels}
SNS 포맷: ${snsFormats || '없음'}

규칙:
- 구체적 아이템명으로 (예: "린넨 와이드 팬츠" O, "여름옷" X)
- 작년 대비 올해 트렌드 변화 포함
- 뻔한 계절 이야기 금지

JSON으로만 답하세요:
{"searchSummary":"트렌드 요약","topPicks":[{"type":"now","keyword":"아이템","reason":"근거","timing":"타이밍"},{"type":"predict","keyword":"아이템","reason":"근거","timing":"타이밍"},{"type":"newthis","keyword":"아이템","reason":"근거","timing":"타이밍"},{"type":"fading","keyword":"아이템","reason":"근거","timing":"타이밍"}],"trendKeywords":[{"keyword":"아이템","status":"rising","vsLastYear":"설명","bestTiming":"시기"},{"keyword":"아이템","status":"peak","vsLastYear":"설명","bestTiming":"시기"},{"keyword":"아이템","status":"rising","vsLastYear":"설명","bestTiming":"시기"},{"keyword":"아이템","status":"fading","vsLastYear":"설명","bestTiming":"시기"},{"keyword":"아이템","status":"rising","vsLastYear":"설명","bestTiming":"시기"}],"channels":{"ig":"${igContent}","yt":"${ytContent}","blog":"${blogContent}"}}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `Claude API ${res.status}: ${err.slice(0, 200)}` })
      };
    }

    const data = await res.json();
    const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    // raw 텍스트를 그대로 프론트에 전달 - 파싱은 프론트에서
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ raw })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
