import { getActiveDriver } from '@/actions/utils';
import { Label } from '@/hooks/use-labels';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return NextResponse.json({ error: 'Thread IDs are required' }, { status: 400 });
    }

    const threadIds = ids.split(',');
    const driver = await getActiveDriver();

    const labels = await Promise.all(threadIds.map(async (id) => await driver.getLabel(id)));

    const userLabels: Label[] = labels
      .filter((label): label is Label => {
        return label && typeof label === 'object' && label.type === 'user';
      })
      .map((label) => ({
        id: label.id,
        name: label.name,
        type: label.type,
        color: label.color,
      }));

    return NextResponse.json(userLabels);
  } catch (error) {
    console.error('Error fetching thread labels:', error);
    return NextResponse.json({ error: 'Failed to fetch thread labels' }, { status: 500 });
  }
}
