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
    // category 파라미터: { name, param: [catId] } 배열 형식으로 넘겨야 함
    const catName = category === '50000167' ? '패션의류' : '패션잡화';

    const reqBody = JSON.stringify({
      startDate,
      endDate,
      timeUnit: timeUnit || 'week',
      category: [
        {
          name: catName,
          param: [String(category)]
        }
      ],
      device: '',
      gender: '',
      ages: []
    });

    console.log('Request:', reqBody);

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
    console.log('Status:', response.status, 'Body:', text.slice(0, 500));

    let data;
    try { data = JSON.parse(text); }
    catch (e) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '파싱 실패', raw: text.slice(0, 300) })
      };
    }

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

    // 응답: { results: [{ title, keywords: [{ keyword, period, ratio }] }] }
    // 또는: { results: [{ keyword, period, ratio }] }
    // 두 형식 모두 처리
    let allKeywords = [];

    if (data.results && data.results[0]) {
      const first = data.results[0];
      if (first.keywords) {
        // 배열 형식
        allKeywords = first.keywords;
      } else if (first.keyword) {
        // 평탄화 형식
        allKeywords = data.results;
      }
    }

    // 키워드별 평균 관심도 계산
    const keywordMap = {};
    for (const item of allKeywords) {
      if (!keywordMap[item.keyword]) keywordMap[item.keyword] = { sum: 0, count: 0 };
      keywordMap[item.keyword].sum += (item.ratio || 0);
      keywordMap[item.keyword].count += 1;
    }

    const keywords = Object.entries(keywordMap)
      .map(([keyword, { sum, count }]) => ({
        keyword,
        ratio: (sum / count).toFixed(1)
      }))
      .sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))
      .slice(0, 20);

    console.log('Keywords found:', keywords.length, keywords.slice(0,3));

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
