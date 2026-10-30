/**
 * GitHub Repository URL Validator & Normalizer.
 *
 * Implements strict client-side validation rules for CodeSentinel AI:
 * - Must use HTTPS protocol
 * - Must belong strictly to github.com
 * - Must reject inline credentials (user:password@)
 * - Must contain valid owner and repository path segments
 * - Normalizes trailing slashes and optional .git suffix
 */

export function validateGitHubUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      isValid: false,
      error: 'Repository URL is required. Please enter a valid GitHub URL.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  const trimmed = rawUrl.trim();

  // 1. Check for unexpected inline credentials
  if (trimmed.includes('@') && !trimmed.startsWith('git@')) {
    return {
      isValid: false,
      error: 'Security Warning: URLs containing embedded user credentials (user:pass@) are disallowed.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // 2. Protocol validation
  if (!trimmed.startsWith('https://')) {
    if (trimmed.startsWith('http://')) {
      return {
        isValid: false,
        error: 'Insecure Protocol: URL must use secure HTTPS (https://), not unencrypted HTTP.',
        normalizedUrl: null,
        owner: null,
        repo: null,
      };
    }
    return {
      isValid: false,
      error: 'Invalid Format: URL must start with https://github.com/owner/repository.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return {
      isValid: false,
      error: 'Malformed URL: Unable to parse the provided web address.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // 3. Domain validation
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    return {
      isValid: false,
      error: `Unsupported Domain: CodeSentinel AI only accepts github.com repositories (received: ${hostname}).`,
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // 4. Path validation & normalization
  // Clean pathname: remove leading/trailing slashes and split
  const cleanPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length < 2) {
    return {
      isValid: false,
      error: 'Incomplete Path: URL must specify both an owner/organization and a repository name (e.g., https://github.com/owner/repository).',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  const owner = segments[0];
  let repo = segments[1];

  // Strip optional .git suffix
  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  // Plausibility regex check for GitHub usernames and repo names
  const validSegmentPattern = /^[a-zA-Z0-9_.-]+$/;
  if (!validSegmentPattern.test(owner) || !validSegmentPattern.test(repo)) {
    return {
      isValid: false,
      error: 'Invalid Identifier: Owner or repository name contains unsupported characters.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Construct canonical normalized URL
  const normalizedUrl = `https://github.com/${owner}/${repo}`;

  return {
    isValid: true,
    error: null,
    normalizedUrl,
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

export default validateGitHubUrl;
