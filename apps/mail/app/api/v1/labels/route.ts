import { processIP, getRatelimitModule, checkRateLimit, getAuthenticatedUserId } from '../../utils';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';

interface Label {
  name: string;
  color?: {
    backgroundColor: string;
    textColor: string;
  };
  type?: 'user' | 'system';
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  const finalIp = processIP(req);
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:get-labels-${userId}`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const driver = await getActiveDriver();
    if (!driver) {
      return NextResponse.json({ error: 'Email driver not configured' }, { status: 500 });
    }
    const labels = await driver.getUserLabels();
    if (!labels) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json(labels.filter((label: Label) => label.type === 'user'));
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  const finalIp = processIP(req);
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:labels-post-${userId}`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const reqLabel = await req.json();
    const label = {
      ...reqLabel,
      type: 'user',
    };
    const driver = await getActiveDriver();
    const result = await driver?.createLabel(label);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating label:', error);
    return NextResponse.json({ error: 'Failed to create label' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  const finalIp = processIP(req);
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:labels-patch-${userId}`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const { id, ...label } = (await req.json()) as Label & { id: string } & { type: string };
    const driver = await getActiveDriver();
    const result = await driver?.updateLabel(id, label);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating label:', error);
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  const finalIp = processIP(req);
  const ratelimit = getRatelimitModule({
    prefix: `ratelimit:labels-delete-${userId}`,
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, finalIp);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const { id } = (await req.json()) as { id: string };
    const driver = await getActiveDriver();
    await driver?.deleteLabel(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting label:', error);
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}
