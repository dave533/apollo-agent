import fetch from 'node-fetch';

export class GitHubAPI {
  constructor(token = null) {
    this.token = token || process.env.GITHUB_TOKEN;
    this.baseUrl = 'https://api.github.com';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Apollo-Serena-Agent',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async searchRepositories(query, options = {}) {
    const params = new URLSearchParams({
      q: query,
      sort: options.sort || 'stars',
      order: options.order || 'desc',
      per_page: options.perPage || 10
    });

    return await this.request(`/search/repositories?${params}`);
  }

  async getRepository(owner, repo) {
    return await this.request(`/repos/${owner}/${repo}`);
  }

  async getRepositoryContents(owner, repo, path = '') {
    return await this.request(`/repos/${owner}/${repo}/contents/${path}`);
  }

  async searchCode(query, options = {}) {
    const params = new URLSearchParams({
      q: query,
      per_page: options.perPage || 10
    });

    return await this.request(`/search/code?${params}`);
  }
}

export class NPMRegistry {
  constructor() {
    this.baseUrl = 'https://registry.npmjs.org';
  }

  async searchPackages(query) {
    const response = await fetch(`${this.baseUrl}/-/v1/search?text=${encodeURIComponent(query)}&size=10`);
    if (!response.ok) {
      throw new Error(`NPM Registry error: ${response.status}`);
    }
    return await response.json();
  }

  async getPackage(packageName) {
    const response = await fetch(`${this.baseUrl}/${packageName}`);
    if (!response.ok) {
      throw new Error(`NPM Registry error: ${response.status}`);
    }
    return await response.json();
  }
}

export class PyPIAPI {
  constructor() {
    this.baseUrl = 'https://pypi.org/pypi';
  }

  async searchPackages(query) {
    const response = await fetch(`https://pypi.org/search/?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`PyPI error: ${response.status}`);
    }
    return await response.text();
  }

  async getPackage(packageName) {
    const response = await fetch(`${this.baseUrl}/${packageName}/json`);
    if (!response.ok) {
      throw new Error(`PyPI error: ${response.status}`);
    }
    return await response.json();
  }
}

export class WikipediaAPI {
  constructor() {
    this.baseUrl = 'https://en.wikipedia.org/w/api.php';
  }

  async search(query, limit = 5) {
    const params = new URLSearchParams({
      action: 'opensearch',
      search: query,
      limit: limit.toString(),
      format: 'json'
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }
    return await response.json();
  }

  async getSummary(title) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      titles: title,
      format: 'json'
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId];
  }

  async getContent(title) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      titles: title,
      format: 'json',
      rvslots: 'main'
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }
    return await response.json();
  }
}

export class ToolRegistry {
  constructor() {
    this.github = new GitHubAPI();
    this.npm = new NPMRegistry();
    this.pypi = new PyPIAPI();
    this.wikipedia = new WikipediaAPI();
  }

  getGitHub() { return this.github; }
  getNPM() { return this.npm; }
  getPyPI() { return this.pypi; }
  getWikipedia() { return this.wikipedia; }
}

