import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase, isSupabaseConfigured } from '@/lib/supabase/server';

// Rate limit simples por IP em memória (máximo 5 pedidos por hora por IP)
const ipRequests = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora
const MAX_REQUESTS_PER_IP = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);

  if (!entry) {
    ipRequests.set(ip, { count: 1, timestamp: now });
    return true;
  }

  if (now - entry.timestamp > RATE_LIMIT_WINDOW) {
    ipRequests.set(ip, { count: 1, timestamp: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_IP) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Obter IP para Rate Limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Muitas solicitações a partir desta rede. Por favor, aguarde uma hora antes de tentar novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { nome, whatsapp, modalidade, inicio, fim, motivo, tipo_atendimento, website_hp } = body;

    // 2. Honeypot check contra bots de spam
    if (website_hp && website_hp.trim() !== '') {
      // Simula sucesso sem salvar para enganar bot
      return NextResponse.json({ success: true, message: 'Solicitação registrada com sucesso!' });
    }

    // 3. Validações de entrada
    if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
      return NextResponse.json({ error: 'Por favor, informe seu nome completo.' }, { status: 400 });
    }

    const cleanPhone = (whatsapp || '').replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return NextResponse.json(
        { error: 'Por favor, informe um número de WhatsApp válido com DDD (ex: 11 98765-4321).' },
        { status: 400 }
      );
    }

    if (!['presencial', 'online'].includes(modalidade)) {
      return NextResponse.json({ error: 'Modalidade de atendimento inválida.' }, { status: 400 });
    }

    if (!inicio || !fim) {
      return NextResponse.json({ error: 'Horário de atendimento não especificado.' }, { status: 400 });
    }

    const dataInicio = new Date(inicio);
    const dataFim = new Date(fim);

    if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime()) || dataInicio >= dataFim) {
      return NextResponse.json({ error: 'Horário selecionado é inválido.' }, { status: 400 });
    }

    if (dataInicio.getTime() < Date.now()) {
      return NextResponse.json({ error: 'O horário selecionado já passou.' }, { status: 400 });
    }

    // 4. Inserir solicitação no Supabase ou gerar ID local
    let solicitacaoId = 'mock-' + Date.now();

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServiceSupabase();
        const { data, error } = await supabase
          .from('solicitacoes')
          .insert({
            nome: nome.trim(),
            whatsapp: cleanPhone,
            modalidade,
            inicio,
            fim,
            observacao: (() => {
              let obs = motivo && typeof motivo === 'string' ? motivo.trim().slice(0, 300) : '';
              if (tipo_atendimento) {
                return obs ? `[${tipo_atendimento}] ${obs}` : `[${tipo_atendimento}]`;
              }
              return obs || null;
            })(),
            status: 'pendente',
          })
          .select('id')
          .single();

        if (error) {
          console.error('Erro ao inserir solicitação:', error);
          if (error.message?.includes('limite') || error.message?.includes('pendente')) {
            return NextResponse.json(
              { error: 'Você já possui solicitações em análise no momento. Aguarde a confirmação pelo WhatsApp.' },
              { status: 400 }
            );
          }
          return NextResponse.json({ error: 'Não foi possível enviar a solicitação. Tente novamente mais tarde.' }, { status: 500 });
        }
        if (data?.id) solicitacaoId = data.id;
      } catch (err) {
        console.error('Erro de conexão Supabase:', err);
      }
    }

    return NextResponse.json({
      success: true,
      solicitacao_id: solicitacaoId,
      message: 'Solicitação recebida com sucesso! Em breve o pai de santo entrará em contato via WhatsApp.',
    });
  } catch (error) {
    console.error('Erro no processamento da solicitação:', error);
    return NextResponse.json({ error: 'Falha interna ao processar o pedido.' }, { status: 500 });
  }
}

