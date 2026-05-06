import { Extension } from '../types';

class ExtensionService {
  private mockMarketplace: Extension[] = [
    {
      id: 'ext.plsql-runner',
      name: 'plsql-runner',
      publisher: 'Nexus',
      displayName: 'Oracle PL/SQL Runner',
      description: 'Run and debug Oracle PL/SQL blocks directly from the editor.',
      version: '1.2.0',
      installed: false,
      enabled: false,
      category: 'Language',
      downloads: 4500,
      rating: 4.8
    },
    {
      id: 'ext.schema-visualizer',
      name: 'schema-visualizer',
      publisher: 'Nexus',
      displayName: 'DB Schema Visualizer',
      description: 'Generate ER diagrams and browse database schemas visually.',
      version: '0.9.5',
      installed: false,
      enabled: false,
      category: 'Other',
      downloads: 1200,
      rating: 4.5
    },
    {
      id: 'ext.github-copilot-nexus',
      name: 'github-copilot-nexus',
      publisher: 'GitHub',
      displayName: 'GitHub Copilot for Nexus',
      description: 'AI-powered code suggestions and chat integrations.',
      version: '2.0.1',
      installed: false,
      enabled: false,
      category: 'Other',
      downloads: 89000,
      rating: 4.9
    },
    {
      id: 'ext.dracula-nexus',
      name: 'dracula-nexus',
      publisher: 'Dracula',
      displayName: 'Dracula Theme',
      description: 'The famous dark theme for developers.',
      version: '1.0.0',
      installed: false,
      enabled: false,
      category: 'Theme',
      downloads: 15000,
      rating: 5.0
    }
  ];

  async getMarketplaceExtensions(query?: string): Promise<Extension[]> {
    const installed = await this.getInstalledExtensions();
    const marketplace = this.mockMarketplace.map(ext => ({
      ...ext,
      installed: installed.some(i => i.id === ext.id)
    }));

    if (!query) return marketplace;
    return marketplace.filter(e => 
      e.displayName.toLowerCase().includes(query.toLowerCase()) || 
      e.description.toLowerCase().includes(query.toLowerCase())
    );
  }

  async getInstalledExtensions(): Promise<Extension[]> {
    try {
      const response = await fetch('/api/extensions');
      if (!response.ok) return [];
      return await response.json();
    } catch (e) {
      return [];
    }
  }

  async installExtension(extension: Extension): Promise<void> {
    const response = await fetch('/api/extensions/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extension)
    });
    if (!response.ok) throw new Error('Failed to install extension');
  }

  async uninstallExtension(id: string): Promise<void> {
    const response = await fetch('/api/extensions/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Failed to uninstall extension');
  }

  async toggleExtension(id: string, enabled: boolean): Promise<void> {
    const response = await fetch('/api/extensions/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled })
    });
    if (!response.ok) throw new Error('Failed to toggle extension');
  }
}

export const extensionService = new ExtensionService();
