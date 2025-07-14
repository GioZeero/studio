
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Slot, User } from '@/lib/types';

interface BookingConfirmationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  slot: Slot | null;
  user: User | null;
  onConfirm: (slot: Slot) => void;
  isLoading: boolean;
}

export function BookingConfirmationModal({ isOpen, onOpenChange, slot, user, onConfirm, isLoading }: BookingConfirmationModalProps) {
  if (!slot || !user) return null;

  const isBookedByUser = slot.bookedBy.includes(user.name);

  const handleConfirm = () => {
    onConfirm(slot);
  };
  
  const attendees = [
    ...(slot.createdBy ? [slot.createdBy] : []),
    ...slot.bookedBy,
  ];
  const uniqueAttendees = [...new Set(attendees)];


  return (
    <Dialog open={isOpen} onOpenChange={isLoading ? () => {} : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBookedByUser ? 'Cancella Prenotazione' : 'Conferma Prenotazione'}</DialogTitle>
          <DialogDescription>
            Stai per {isBookedByUser ? 'cancellare la tua prenotazione per' : 'prenotare'} la fascia oraria {slot.timeRange}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm">
             <p className="font-semibold">Persone Presenti ({uniqueAttendees.length})</p>
            {uniqueAttendees.length > 0 ? (
                <div className="text-muted-foreground max-h-20 overflow-y-auto pr-2 space-y-1 mt-1">
                  {uniqueAttendees.map((name, i) => (
                    <div key={i}>
                      {name}
                      {name === user.name && user.role !== 'owner' && ' (Tu)'}
                      {name === user.name && user.role === 'owner' && !isBookedByUser && ' (Tu, Creatore)'}
                      {name === user.name && user.role === 'owner' && isBookedByUser && ' (Tu, Prenotato)'}
                      {name !== user.name && slot.createdBy === name && ' (Creatore)'}
                    </div>
                  ))}
                </div>
            ) : (
                <p className="text-muted-foreground mt-1">Sii il primo a prenotare!</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Attendere...</>
            ) : (
              isBookedByUser ? 'Cancella' : 'Conferma'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
