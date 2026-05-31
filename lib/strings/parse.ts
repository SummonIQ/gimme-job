export function parseQueryString(search: string) {
  return (search || '')
    .replace(/^\?/g, '')
    .split('&')
    .reduce((acc: { [key: string]: string }, query) => {
      const [key, value] = query.split('=');

      if (key) {
        acc[key] = decodeURIComponent(value);
      }

      return acc;
    }, {});
}
