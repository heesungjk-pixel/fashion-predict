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

    // 네이버 쇼핑인사이트 카테고리별 트렌드 API
    // https://developers.naver.com/docs/serviceapi/datalab/shopping/guide.md
    const reqBody = JSON.stringify({
      startDate,
      endDate,
      timeUnit: timeUnit || 'week',
      category: [{ name: 'fashion', param: [category] }],
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

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '응답 파싱 실패: ' + text.slice(0, 200) })
      };
    }

    if (data.errorCode || data.errorMessage) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.message || data.errorMessage, errorCode: data.errorCode })
      };
    }

    // results[0].data = [{period, ratio}, ...] — 기간별 관심도 시계열
    // 관심도 합산해서 키워드 대신 카테고리 트렌드로 반환
    const periods = (data.results && data.results[0] && data.results[0].data) || [];

    // 최근 4주 평균 관심도
    const recent = periods.slice(-4);
    const avgRatio = recent.length
      ? (recent.reduce((s, d) => s + d.ratio, 0) / recent.length).toFixed(1)
      : null;

    // 키워드 형태로 맞춰서 반환 (카테고리 트렌드이므로 keyword = 카테고리명)
    const catName = data.results && data.results[0] ? data.results[0].title : category;
    const keywords = avgRatio ? [{ keyword: catName, ratio: avgRatio, periods }] : [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ keywords, raw: data })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
