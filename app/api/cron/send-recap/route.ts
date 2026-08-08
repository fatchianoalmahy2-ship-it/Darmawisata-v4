import { NextRequest, NextResponse } from 'next/server';
import {
  getInitialSettings,
  getInitialClasses,
  getInitialStudents,
  saveSettings,
} from '@/services/supabaseService';
import { RecapGeneratorService } from '@/services/recapGenerator';
import { WhatsAppService } from '@/services/whatsappService';

async function executeRecapDispatch(simulate: boolean = false) {
  const settings = await getInitialSettings();
  const classes = await getInitialClasses();
  const students = await getInitialStudents();

  // Generate the 1-page Rombongan Belajar (Rombel) summary message
  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const summaryText = RecapGeneratorService.generateWhatsAppAllUnregisteredSummary(
    classes,
    students,
    settings,
    dateStr
  );

  const targetGroup = settings.autoRecapTargetGroup || 'Grup Panitia Darmawisata';
  const targetPhone = settings.autoRecapTargetPhone || '';
  const finalTarget = targetPhone.trim() || targetGroup;

  const nowStr = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  try {
    const ws = WhatsAppService.getInstance();
    
    // Override mode to simulation if requested
    const updatedSettings = {
      ...settings,
      whatsappMode: simulate ? 'SIMULATION' : settings.whatsappMode || 'SIMULATION',
    };

    const sendResult = await ws.sendMessage(finalTarget, summaryText, updatedSettings);

    const successStatus = 'BERHASIL';
    await saveSettings({
      ...settings,
      lastAutoRecapSentAt: `${nowStr} (${sendResult.method})`,
      lastAutoRecapSentStatus: successStatus,
    });

    return {
      success: true,
      timestamp: nowStr,
      target: finalTarget,
      method: sendResult.method,
      detail: sendResult.detail,
      message: summaryText,
    };
  } catch (err: any) {
    console.error('[Cron Send Recap] Failed to send automatic recap:', err);
    
    await saveSettings({
      ...settings,
      lastAutoRecapSentAt: nowStr,
      lastAutoRecapSentStatus: `GAGAL: ${err.message || err}`,
    });

    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const simulate = searchParams.get('simulate') === 'true';

    const result = await executeRecapDispatch(simulate);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Gagal mengirim rekap otomatis.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const simulate = body.simulate === true;

    const result = await executeRecapDispatch(simulate);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Gagal mengirim rekap otomatis.',
      },
      { status: 500 }
    );
  }
}
