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

    const prompt = `당신은 한국 패션 SNS 콘텐츠 전략가입니다. 웹서치를 활용해 실시간 트렌드를 조사하고 분석해주세요.

## 미션
오늘(${today})부터 ${daysUntil}일 후인 ${pubDate}에 발행할 패션 콘텐츠를 지금 기획해야 합니다.

## 조사 요청
다음을 웹서치로 직접 조사하세요:
1. 지금 한국에서 뜨고 있는 패션 키워드 TOP 10 (네이버, 무신사, 29CM 트렌드)
2. 작년 같은 시기(${today.slice(0,4)-1}년 ${today.slice(5,10)})에 뭐가 핫했는지
3. 올해 새로 뜬 것 vs 작년에도 뜬 것 vs 올해 식은 것
4. ${pubDate} 기준으로 뭐가 피크칠지 예측

## 컨텍스트
- 타겟: ${targetCtx || '한국 패션 SNS, 20-30대 여성'}
- 채널: ${activeChLabels}
- 팀 발견 SNS 포맷: ${snsFormats || '없음'}

## 출력 형식 (JSON만, 마크다운 없이)
{
  "searchSummary": "웹서치로 찾은 핵심 트렌드 요약 2-3줄",
  "topPicks": [
    {"type": "now", "keyword": "지금 당장 기획할 아이템", "reason": "검색 데이터/트렌드 근거", "timing": "발행 타이밍"},
    {"type": "predict", "keyword": "발행일 피크 예측 아이템", "reason": "작년 패턴+현재 상승세 근거", "timing": "피크 예상 시점"},
    {"type": "newthis", "keyword": "올해 새로 뜬 아이템", "reason": "작년엔 없었고 올해 급상승", "timing": "지금이 적기"},
    {"type": "fading", "keyword": "지금 식어가는 아이템", "reason": "검색량 하락 근거 (계절 말고 구체적으로)", "timing": "이미 피크 지남"}
  ],
  "trendKeywords": [
    {"keyword": "키워드", "status": "rising|peak|fading", "vsLastYear": "작년 대비 설명", "bestTiming": "최적 발행 시기"}
  ],
  "channels": {
    "ig": "${channels.includes('ig') ? '### 🔥 지금 올려야 할 TOP 5\\n- 아이템: 근거\\n\\n### 릴스 기획 TOP 3\\n- 제목: 타이밍/포맷\\n\\n### ⚠️ 지금 피해야 할 것\\n- 아이템: 구체적 근거 (계절 말고)' : ''}",
    "yt": "${channels.includes('yt') ? '### 🔥 기획할 주제 TOP 5\\n- 주제: 근거\\n\\n### 영상 기획 TOP 3\\n- 제목(SEO키워드): 타이밍\\n\\n### ⚠️ 피해야 할 것\\n- 아이템: 근거' : ''}",
    "blog": "${channels.includes('blog') ? '### 🔥 SEO 키워드 TOP 5\\n- 키워드: 검색량 근거\\n\\n### 포스팅 기획 TOP 3\\n- 제목: 구조/타이밍\\n\\n### ⚠️ 피해야 할 것\\n- 키워드: 근거' : ''}"
  }
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
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

    // 텍스트 블록만 추출
    const raw = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // JSON 파싱
    const jsonBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const braceBlock = raw.match(/\{[\s\S]*\}/);
    const candidate = jsonBlock ? jsonBlock[1].trim() : braceBlock ? braceBlock[0] : null;

    if (!candidate) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'JSON 파싱 실패', raw: raw.slice(0, 300) })
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch (e) {
      const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
      parsed = JSON.parse(fixed);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(parsed)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
