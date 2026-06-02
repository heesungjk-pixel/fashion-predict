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

    // 네이버 쇼핑인사이트 카테고리별 인기 키워드
    // 공식 문서: https://developers.naver.com/docs/serviceapi/datalab/shopping/guide.md
    // category 파라미터: 숫자 코드 (50000167=패션의류, 50000172=패션잡화)
    const reqBody = JSON.stringify({
      startDate,       // "2026-05-01"
      endDate,         // "2026-06-01"
      timeUnit: timeUnit || 'week',
      category: String(category),  // 문자열로 변환
      device: '',
      gender: '',
      ages: []
    });

    console.log('Request body:', reqBody);

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
    console.log('Response status:', response.status);
    console.log('Response body:', text.slice(0, 500));

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '파싱 실패', raw: text.slice(0, 300) })
      };
    }

    // 에러 응답 처리
    if (!response.ok || data.errorCode || data.errorMessage) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: data.message || data.errorMessage || `HTTP ${response.status}`,
          errorCode: data.errorCode,
          raw: data
        })
      };
    }

    // 응답 구조: { results: [{ keyword, period, ratio }] }
    // 같은 keyword가 여러 period로 반복됨 → 평균 ratio로 집계
    const results = data.results || [];
    const keywordMap = {};

    for (const item of results) {
      if (!keywordMap[item.keyword]) {
        keywordMap[item.keyword] = { sum: 0, count: 0 };
      }
      keywordMap[item.keyword].sum += item.ratio;
      keywordMap[item.keyword].count += 1;
    }

    const keywords = Object.entries(keywordMap)
      .map(([keyword, { sum, count }]) => ({
        keyword,
        ratio: (sum / count).toFixed(1)
      }))
      .sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))
      .slice(0, 20);

    console.log('Keywords found:', keywords.length);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ keywords })
    };

  } catch (err) {
    console.error('Handler error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
