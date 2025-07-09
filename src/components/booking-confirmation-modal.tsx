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
            <p className="font-semibold">Dettagli Orario</p>
            <p className="text-muted-foreground">Creato da: {slot.createdBy || 'N/A'}</p>
          </div>
          
          <div className="text-sm">
             <p className="font-semibold">Persone Prenotate ({slot.bookedBy.length})</p>
            {slot.bookedBy.length > 0 ? (
                <div className="text-muted-foreground max-h-20 overflow-y-auto pr-2 space-y-1 mt-1">
                  {slot.bookedBy.map((name, i) => <div key={i}>{name}{name === user.name && ' (Tu)'}</div>)}
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
