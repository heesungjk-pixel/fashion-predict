exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: ''
    };
  }

  try {
    const { clientId, clientSecret, startDate, endDate, timeUnit, category } = JSON.parse(event.body);

    // 네이버 쇼핑인사이트 카테고리별 인기 키워드 API
    // category: 카테고리 코드 (패션의류=50000167, 패션잡화=50000172)
    const reqBody = JSON.stringify({
      startDate,
      endDate,
      timeUnit: timeUnit || 'week',
      category,
      device: '',
      gender: '',
      ages: []
    });

    const response = await fetch('https://openapi.naver.com/v1/datalab/shopping/category/keywords', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        'Content-Type': 'application/json',
      },
      body: reqBody,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '응답 파싱 실패: ' + text.slice(0, 300) })
      };
    }

    if (data.errorCode || data.errorMessage || !response.ok) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.message || data.errorMessage || 'API 오류', errorCode: data.errorCode, raw: data })
      };
    }

    // /category/keywords 응답 구조:
    // { results: [{ keyword, period, ratio }] }
    // keyword별 최근 관심도 합산해서 TOP 순으로 정렬
    const results = data.results || [];

    // 키워드별 최근 평균 관심도 계산
    const keywordMap = {};
    for (const item of results) {
      if (!keywordMap[item.keyword]) keywordMap[item.keyword] = [];
      keywordMap[item.keyword].push(item.ratio);
    }

    const keywords = Object.entries(keywordMap)
      .map(([keyword, ratios]) => ({
        keyword,
        ratio: (ratios.reduce((s, r) => s + r, 0) / ratios.length).toFixed(1)
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 20);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ keywords })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
