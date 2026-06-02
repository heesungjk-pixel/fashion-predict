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
    const nextMonth = month >= 12 ? 1 : month + 1;
    const nextSeason = nextMonth >= 3 && nextMonth <= 5 ? '봄' : nextMonth >= 6 && nextMonth <= 8 ? '여름' : nextMonth >= 9 && nextMonth <= 11 ? '가을' : '겨울';

    const prompt = `당신은 한국 패션 SNS 콘텐츠 전략가입니다.

## 상황
오늘: ${today} (${season} 시즌)
발행 예정일: ${pubDate} (${daysUntil}일 후, ${nextSeason} 시즌 진입)
타겟: ${targetCtx || '한국 패션 SNS, 20-30대 여성'}
채널: ${activeChLabels}
팀 발견 SNS 포맷: ${snsFormats || '없음'}

## 요청
지금 한국 패션 시장에서 실제로 일어나는 트렌드를 분석해주세요:
1. 지금 무신사/29CM/인스타에서 뜨고 있는 구체적 키워드 (카테고리 말고 아이템명으로)
2. 작년 같은 시기 대비 올해 새로 뜬 것 vs 식어가는 것
3. ${pubDate} 발행 기준으로 피크칠 아이템
4. SNS 포맷이 있으면 패션 아이템과 연결한 기획안

중요: "겨울 옷 피해라" 같은 뻔한 말 금지. 구체적 아이템명과 트렌드 근거 제시.

JSON만 반환 (마크다운 없이):
{
  "searchSummary": "지금 한국 패션 트렌드 핵심 요약 2-3줄",
  "topPicks": [
    {"type": "now", "keyword": "지금 당장 기획할 구체적 아이템", "reason": "트렌드 근거", "timing": "발행 타이밍"},
    {"type": "predict", "keyword": "발행일 피크 예측 아이템", "reason": "시즌+트렌드 근거", "timing": "피크 예상"},
    {"type": "newthis", "keyword": "올해 새로 뜬 아이템", "reason": "작년엔 없었던 이유", "timing": "지금이 적기"},
    {"type": "fading", "keyword": "검색량 하락 중인 구체적 아이템", "reason": "하락 근거 (시즌 말고)", "timing": "피크 지남"}
  ],
  "trendKeywords": [
    {"keyword": "구체적 아이템명", "status": "rising", "vsLastYear": "작년 대비 설명", "bestTiming": "최적 발행 시기"},
    {"keyword": "구체적 아이템명", "status": "peak", "vsLastYear": "작년 대비 설명", "bestTiming": "최적 발행 시기"},
    {"keyword": "구체적 아이템명", "status": "rising", "vsLastYear": "작년 대비 설명", "bestTiming": "최적 발행 시기"},
    {"keyword": "구체적 아이템명", "status": "fading", "vsLastYear": "작년 대비 설명", "bestTiming": "이미 지남"},
    {"keyword": "구체적 아이템명", "status": "rising", "vsLastYear": "작년 대비 설명", "bestTiming": "최적 발행 시기"}
  ],
  "channels": {
    "ig": "${channels.includes('ig') ? '### 🔥 지금 올려야 할 TOP 5\\n- 아이템: 근거\\n\\n### 릴스 기획 TOP 3\\n- 제목: 포맷/타이밍\\n\\n### ⚠️ 지금 피해야 할 것\\n- 아이템: 구체적 근거' : ''}",
    "yt": "${channels.includes('yt') ? '### 🔥 기획할 주제 TOP 5\\n- 주제: 근거\\n\\n### 영상 기획 TOP 3\\n- 제목(SEO키워드): 타이밍\\n\\n### ⚠️ 피해야 할 것\\n- 아이템: 근거' : ''}",
    "blog": "${channels.includes('blog') ? '### 🔥 SEO 키워드 TOP 5\\n- 키워드: 검색 근거\\n\\n### 포스팅 기획 TOP 3\\n- 제목: 구조/타이밍\\n\\n### ⚠️ 피해야 할 것\\n- 키워드: 근거' : ''}"
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

    try {
      const parsed = JSON.parse(candidate);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(parsed)
      };
    } catch (e) {
      const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
      const parsed = JSON.parse(fixed);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(parsed)
      };
    }

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
