import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

type SnoozeDialogProps = {
  trigger?: React.ReactElement;
  onConfirm: (wakeAt: Date) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SnoozeDialog({ trigger, onConfirm, open: controlledOpen, onOpenChange }: SnoozeDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const [date, setDate] = useState<string>(defaultDate);
  const [time, setTime] = useState<string>(defaultTime);

  const handleSubmit = () => {
    let wakeDate: Date;
    if (date) {
      wakeDate = new Date(`${date}T${time || defaultTime}`);
    } else {
      wakeDate = new Date();
    }
    onConfirm(wakeDate);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Snooze until…</DialogTitle>
          <DialogDescription>Select date and time you'd like this email to return.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <label className="text-sm font-medium">
            Date
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Time
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Snooze</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 