import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './solicitacoes/route';

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: vi.fn().mockReturnValue(true),
  createServiceSupabase: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-solicitacao-id' },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('API /api/solicitacoes', () => {
  it('detecta bot via honeypot e simula sucesso sem persistir', async () => {
    const req = new NextRequest('http://localhost:3000/api/solicitacoes', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Bot Spammer',
        whatsapp: '11999999999',
        modalidade: 'presencial',
        inicio: '2026-10-15T14:00:00.000Z',
        fim: '2026-10-15T15:00:00.000Z',
        website_hp: 'https://spam-link.com', // Honeypot preenchido!
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // Não deve conter solicitacao_id gerado
    expect(data.solicitacao_id).toBeUndefined();
  });

  it('rejeita solicitação sem nome válido', async () => {
    const req = new NextRequest('http://localhost:3000/api/solicitacoes', {
      method: 'POST',
      body: JSON.stringify({
        nome: ' ',
        whatsapp: '11999999999',
        modalidade: 'presencial',
        inicio: '2026-10-15T14:00:00.000Z',
        fim: '2026-10-15T15:00:00.000Z',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('nome');
  });

  it('rejeita solicitação com whatsapp inválido', async () => {
    const req = new NextRequest('http://localhost:3000/api/solicitacoes', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Consulente Teste',
        whatsapp: '123', // Muito curto
        modalidade: 'presencial',
        inicio: '2026-10-15T14:00:00.000Z',
        fim: '2026-10-15T15:00:00.000Z',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('WhatsApp');
  });

  it('rejeita modalidade desconhecida', async () => {
    const req = new NextRequest('http://localhost:3000/api/solicitacoes', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Consulente Teste',
        whatsapp: '11988887777',
        modalidade: 'astral', // Inválida
        inicio: '2026-10-15T14:00:00.000Z',
        fim: '2026-10-15T15:00:00.000Z',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Modalidade');
  });

  it('rejeita data de início no passado', async () => {
    const req = new NextRequest('http://localhost:3000/api/solicitacoes', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Consulente Teste',
        whatsapp: '11988887777',
        modalidade: 'presencial',
        inicio: '2020-01-01T14:00:00.000Z', // Passado
        fim: '2020-01-01T15:00:00.000Z',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('passou');
  });

  it('aceita solicitação válida e retorna sucesso com id', async () => {
    const futuro = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const fimFuturo = new Date(futuro.getTime() + 60 * 60 * 1000);

    const req = new NextRequest('http://localhost:3000/api/solicitacoes', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '10.0.0.6',
      },
      body: JSON.stringify({
        nome: 'Maria da Silva',
        whatsapp: '(11) 98765-4321',
        modalidade: 'presencial',
        inicio: futuro.toISOString(),
        fim: fimFuturo.toISOString(),
        motivo: 'Orientação espiritual',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.solicitacao_id).toBe('test-solicitacao-id');
  });

  it('bloqueia excesso de requisições por IP com status 429', async () => {
    const ip = '10.99.99.99';
    // Envia 5 requisições para estourar o limite
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/solicitacoes', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
        body: JSON.stringify({ nome: 'x' }),
      });
      await POST(req);
    }

    // A 6ª requisição deve ser bloqueada
    const reqBlocked = new NextRequest('http://localhost:3000/api/solicitacoes', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: JSON.stringify({ nome: 'x' }),
    });
    const res = await POST(reqBlocked);
    expect(res.status).toBe(429);
  });
});
