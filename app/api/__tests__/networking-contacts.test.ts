import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth
vi.mock('@/lib/user', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock networking contacts functions
vi.mock('@/lib/networking/contacts', () => ({
  getNetworkContacts: vi.fn(),
  getNetworkContact: vi.fn(),
  createNetworkContact: vi.fn(),
  updateNetworkContact: vi.fn(),
  deleteNetworkContact: vi.fn(),
  importContacts: vi.fn(),
}));

import {
  createNetworkContact,
  getNetworkContacts,
} from '@/lib/networking/contacts';
import { getCurrentUser } from '@/lib/user';
import { DELETE, GET, POST } from '../networking/contacts/route';

describe('Networking Contacts API', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/networking/contacts', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/networking/contacts',
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return contacts when authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
      vi.mocked(getNetworkContacts).mockResolvedValue([
        {
          id: 'contact-1',
          userId: mockUser.id,
          name: 'John Doe',
          email: 'john@example.com',
          company: 'Acme Inc',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const request = new NextRequest(
        'http://localhost:3000/api/networking/contacts',
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe('John Doe');
    });
  });

  describe('POST /api/networking/contacts', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/networking/contacts',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Jane Doe' }),
        },
      );
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should create contact when authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
      vi.mocked(createNetworkContact).mockResolvedValue({
        id: 'contact-new',
        userId: mockUser.id,
        name: 'Jane Doe',
        email: 'jane@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const request = new NextRequest(
        'http://localhost:3000/api/networking/contacts',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }),
        },
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.name).toBe('Jane Doe');
    });
  });

  describe('DELETE /api/networking/contacts', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/networking/contacts?id=contact-1',
        {
          method: 'DELETE',
        },
      );
      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });
  });
});
