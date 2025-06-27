import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function BackButton() {
  return (
    <a href="/mail">
      <Button variant="outline" className="text-muted-foreground gap-2">
        <ArrowLeft className="h-4 w-4" />
        Go Back
      </Button>
    </a>
  );
}
