import { checkRateLimit, getAuthenticatedUserId, getRatelimitModule } from '../../utils';
import { getActiveDriver } from '@/actions/utils';
import { Ratelimit } from '@upstash/ratelimit';
import { NextResponse } from 'next/server';

interface Label {
  name: string;
  color?: string;
}

export async function GET() {
  const userId = await getAuthenticatedUserId();

  const ratelimit = getRatelimitModule({
    prefix: 'ratelimit:labels',
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const driver = await getActiveDriver();
    const labels = await driver?.getUserLabels();
    return NextResponse.json(labels.filter((label: any) => label.type === 'user'));
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();

  const ratelimit = getRatelimitModule({
    prefix: 'ratelimit:labels-post',
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const reqLabel = await request.json();
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

export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserId();

  const ratelimit = getRatelimitModule({
    prefix: 'ratelimit:labels-patch',
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const { id, ...label } = (await request.json()) as Label & { id: string } & { type: string };
    const driver = await getActiveDriver();
    const result = await driver?.updateLabel(id, label);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating label:', error);
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId();

  const ratelimit = getRatelimitModule({
    prefix: 'ratelimit:labels-delete',
    limiter: Ratelimit.slidingWindow(60, '1m'),
  });

  const { success, headers } = await checkRateLimit(ratelimit, userId);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers },
    );
  }

  try {
    const { id } = (await request.json()) as { id: string };
    const driver = await getActiveDriver();
    await driver?.deleteLabel(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting label:', error);
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}
