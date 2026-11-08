// Roteamento por hash (#/desafios/slug): funciona com o servidor estático
// atual sem precisar de fallback de rotas no Express.
export function parseLocation() {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const [path, queryString = ""] = hash.split("?");
  return { path: path || "/", query: new URLSearchParams(queryString) };
}

export function matchRoute(routes, path) {
  for (const route of routes) {
    const names = [];
    const pattern = new RegExp(
      `^${route.path.replace(/:[a-zA-Z]+/g, (segment) => {
        names.push(segment.slice(1));
        return "([^/]+)";
      })}/?$`
    );
    const match = path.match(pattern);
    if (match) {
      const params = Object.fromEntries(
        names.map((name, index) => [name, decodeURIComponent(match[index + 1])])
      );
      return { route, params };
    }
  }
  return null;
}

export function navigate(path) {
  if (window.location.hash === `#${path}`) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = path;
  }
}
