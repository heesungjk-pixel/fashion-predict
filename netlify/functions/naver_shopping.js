exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  try {
    const { clientId, clientSecret, startDate, endDate, timeUnit, category } = JSON.parse(event.body);

    // 네이버 쇼핑인사이트 - 분야별 트렌드 (키워드 미리 안 정해도 됨)
    // category: 패션의류(50000000), 패션잡화(50000001)
    const categories = [
      { id: '50000000', name: '패션의류' },
      { id: '50000001', name: '패션잡화' },
    ];

    const results = [];

    for (const cat of categories) {
      // 쇼핑인사이트 키워드 트렌드 API
      const reqBody = JSON.stringify({
        startDate,
        endDate,
        timeUnit: timeUnit || 'week',
        category: cat.id,
        keyword: [{ name: '전체', param: [''] }],
        device: '',
        gender: '',
        ages: []
      });

      const response = await fetch('https://openapi.naver.com/v1/datalab/shopping/categories', {
        method: 'POST',
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
          'Content-Type': 'application/json',
        },
        body: reqBody,
      });

      const data = await response.json();
      if (!data.errorCode) {
        results.push({ category: cat.name, data: data.results || [] });
      }
    }

    // 쇼핑인사이트 인기 검색어 TOP 20 (카테고리별)
    const keywordResults = [];
    for (const cat of categories) {
      const reqBody = JSON.stringify({
        startDate,
        endDate,
        timeUnit: timeUnit || 'week',
        category: cat.id,
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

      const data = await response.json();
      if (!data.errorCode && data.results) {
        keywordResults.push({
          category: cat.name,
          keywords: data.results.map(r => ({ keyword: r.keyword, ratio: r.ratio }))
        });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ trends: results, keywords: keywordResults }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
