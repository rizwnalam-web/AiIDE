
export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'gitea' | 'codecommit';

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  private: boolean;
  owner: {
    login: string;
    avatarUrl: string;
  };
  provider: GitProvider;
  isFork?: boolean;
  hasIssues?: boolean;
  hasCi?: boolean;
}

export interface GitAuth {
  provider: GitProvider;
  token: string;
  username?: string;
}

class GitIntegrationService {
  async listRepositories(auth: GitAuth): Promise<Repository[]> {
    switch (auth.provider) {
      case 'github':
        return this.fetchGitHubRepos(auth.token);
      case 'gitlab':
        return this.fetchGitLabRepos(auth.token);
      case 'bitbucket':
        return this.fetchBitbucketRepos(auth.token, auth.username || '');
      default:
        throw new Error(`Provider ${auth.provider} not yet fully implemented for listing.`);
    }
  }

  private async fetchGitHubRepos(token: string): Promise<Repository[]> {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch GitHub repositories');
    const data = await response.json();

    return data.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.clone_url,
      private: repo.private,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url
      },
      provider: 'github',
      isFork: repo.fork,
      hasIssues: repo.has_issues
    }));
  }

  private async fetchGitLabRepos(token: string): Promise<Repository[]> {
    const response = await fetch('https://gitlab.com/api/v4/projects?membership=true&order_by=updated_at&per_page=100', {
      headers: {
        'PRIVATE-TOKEN': token
      }
    });

    if (!response.ok) throw new Error('Failed to fetch GitLab repositories');
    const data = await response.json();

    return data.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.path_with_namespace,
      description: repo.description,
      url: repo.http_url_to_repo,
      private: repo.visibility === 'private',
      owner: {
        login: repo.namespace.path,
        avatarUrl: repo.avatar_url || ''
      },
      provider: 'gitlab',
      hasCi: repo.jobs_enabled
    }));
  }

  private async fetchBitbucketRepos(token: string, username: string): Promise<Repository[]> {
    // Bitbucket uses different auth for app passwords vs OAuth, simplify to Bearer for now
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${username || 'me'}?role=member`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch Bitbucket repositories');
    const data = await response.json();

    return data.values.map((repo: any) => ({
      id: repo.uuid,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.links.clone.find((c: any) => c.name === 'https')?.href || '',
      private: repo.is_private,
      owner: {
        login: repo.owner.username || repo.owner.nickname,
        avatarUrl: repo.owner.links.avatar.href
      },
      provider: 'bitbucket'
    }));
  }

  async cloneRepository(url: string, targetPath: string, token?: string, provider?: GitProvider): Promise<{ success: boolean; message: string }> {
    // Transform URL to include token if provided for private repos
    let cloneUrl = url;
    if (token) {
      if (provider === 'github') {
        cloneUrl = url.replace('https://', `https://${token}@`);
      } else if (provider === 'gitlab') {
        cloneUrl = url.replace('https://', `https://oauth2:${token}@`);
      }
      // Add other provider logic as needed
    }

    const response = await fetch('/api/git/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloneUrl, targetPath })
    });

    return await response.json();
  }

  async saveCredentials(auth: GitAuth): Promise<void> {
    const response = await fetch('/api/git/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auth)
    });
    if (!response.ok) throw new Error('Failed to save credentials');
  }

  async getSavedCredentials(): Promise<Record<GitProvider, Partial<GitAuth>>> {
    const response = await fetch('/api/git/credentials');
    if (!response.ok) throw new Error('Failed to fetch credentials');
    return await response.json();
  }
}

export const gitService = new GitIntegrationService();
