exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  try {
    const { clientId, clientSecret, startDate, endDate, timeUnit, category } = JSON.parse(event.body);

    // 네이버 쇼핑인사이트 - 카테고리별 인기 검색어
    // 올바른 엔드포인트: /v1/datalab/shopping/category/keywords
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

    const data = await response.json();

    if (data.errorCode) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.message, errorCode: data.errorCode }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ keywords: data.results || [] }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
