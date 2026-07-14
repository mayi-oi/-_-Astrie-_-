exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const fetchHeaders = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AstrieOS-Netlify-Proxy'
    };

    if (token) {
      fetchHeaders['Authorization'] = `token ${token}`;
    }

    const response = await fetch('https://api.github.com/repos/mayi-oi/-_-Astrie-_-/commits?per_page=1', {
      headers: fetchHeaders
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'GitHub API Fehler', status: response.status })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};